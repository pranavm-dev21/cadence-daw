/* Bounded voice pool with oldest/quietest voice stealing.
 *
 * Why: an unbounded number of simultaneous Web Audio voices melts low-end CPUs.
 * The pool caps concurrency at a configurable `maxPolyphony`. When the cap is
 * hit, the least musically important voice (oldest, tie-broken by quietest) is
 * stolen: its persistent gain is faded out click-free and the slot is reused.
 *
 * Hot-path hygiene: slot objects, the free-list (an Int32Array) and all
 * bookkeeping are allocated once and reused — `trigger()` performs no object or
 * array allocation. The voice *builder* is pre-bound once via setBuilder(), so
 * note triggering passes primitives only (no per-note closures). The single
 * unavoidable per-note allocations are the one-shot Web Audio source nodes the
 * builder creates; stealing keeps their count strictly below maxPolyphony.
 *
 * Each slot owns one persistent GainNode. The builder's synth graph terminates
 * in it, which makes that gain the single point we can fade to steal a voice. */

import { InstrumentKind } from "../types";

export type VoiceBuilder = (
  ctx: BaseAudioContext,
  dest: AudioNode,
  kind: InstrumentKind,
  pitch: number,
  time: number,
  dur: number,
  vel: number,
) => void;

interface Slot {
  /** Persistent fade/steal point; the synth graph connects into this. */
  gain: GainNode;
  busy: boolean;
  /** Monotonic start order — lower means started earlier (the stealing "oldest" key). */
  order: number;
  vel: number;
  /** Audio-clock time the voice is fully done (incl. release tail). */
  endTime: number;
}

const STEAL_FADE = 0.028; // seconds — fast enough to feel instant, slow enough to avoid clicks
/** Extra reclaim margin so a slot is only reused after the release tail has fully died. */
const RECLAIM_TAIL = 0.8;

export class VoicePool {
  private readonly ctx: BaseAudioContext;
  private slots: Slot[] = [];
  private free: Int32Array = new Int32Array(0);
  private freeCount = 0;
  private orderCounter = 0;
  private builder: VoiceBuilder | null = null;

  private maxPoly: number;
  /** Running total of stolen voices — surfaced in diagnostics. */
  stolenTotal = 0;

  constructor(ctx: BaseAudioContext, maxPolyphony: number) {
    this.ctx = ctx;
    this.maxPoly = Math.max(1, Math.floor(maxPolyphony));
    this.rebuild(this.maxPoly);
  }

  setBuilder(b: VoiceBuilder): void {
    this.builder = b;
  }

  getMaxPolyphony(): number {
    return this.maxPoly;
  }

  /** Cold path — rebuilds slots; call only from UI/config changes, not the audio loop. */
  setMaxPolyphony(n: number): void {
    const next = Math.max(1, Math.min(128, Math.floor(n)));
    if (next === this.maxPoly) return;
    this.maxPoly = next;
    this.rebuild(next);
  }

  getActiveCount(): number {
    return this.maxPoly - this.freeCount;
  }

  private rebuild(n: number): void {
    // Disconnect anything live first.
    for (const s of this.slots) {
      try {
        s.gain.disconnect();
      } catch {
        /* noop */
      }
    }
    this.slots = new Array(n);
    for (let i = 0; i < n; i++) {
      const gain = this.ctx.createGain();
      gain.gain.value = 1;
      this.slots[i] = { gain, busy: false, order: 0, vel: 0, endTime: 0 };
    }
    this.free = new Int32Array(n);
    for (let i = 0; i < n; i++) this.free[i] = i;
    this.freeCount = n;
  }

  /** Return expired voices to the free list. O(n), allocation-free; call each pump. */
  reclaim(now: number): void {
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (s.busy && s.endTime <= now) {
        s.busy = false;
        this.free[this.freeCount++] = i;
      }
    }
  }

  /**
   * Trigger a voice. `dur` is the note length handed to the builder; an internal
   * reclaim margin keeps the slot busy until the release tail dies. Allocation-free:
   * only primitives flow — the pre-bound builder does the one-shot node creation.
   */
  trigger(
    dest: AudioNode,
    time: number,
    dur: number,
    vel: number,
    kind: InstrumentKind,
    pitch: number,
  ): void {
    this.reclaim(time);
    let idx = this.acquire();
    if (idx < 0) idx = this.steal(time);
    const s = this.slots[idx];

    s.busy = true;
    s.order = ++this.orderCounter;
    s.vel = vel;
    s.endTime = time + dur + RECLAIM_TAIL;

    const g = s.gain.gain;
    g.cancelScheduledValues(time);
    g.setValueAtTime(1, time);

    // Route the persistent gain to this note's destination (cheap; no JS alloc).
    s.gain.disconnect();
    s.gain.connect(dest);

    this.builder?.(this.ctx, s.gain, kind, pitch, time, dur, vel);
  }

  private acquire(): number {
    if (this.freeCount === 0) return -1;
    return this.free[--this.freeCount];
  }

  /** Pick the oldest voice (tie-break: quietest) and fade it out. Returns its slot. */
  private steal(now: number): number {
    let victim = 0;
    let vOrder = Infinity;
    let vVel = Infinity;
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (!s.busy) continue;
      if (s.order < vOrder || (s.order === vOrder && s.vel < vVel)) {
        victim = i;
        vOrder = s.order;
        vVel = s.vel;
      }
    }
    const v = this.slots[victim];
    const g = v.gain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(Math.max(g.value, 0.0001), now);
    g.exponentialRampToValueAtTime(0.0001, now + STEAL_FADE);
    v.busy = false; // handed straight to the caller; not returned to the free list
    this.stolenTotal++;
    return victim;
  }

  /** Silence everything (transport stop). */
  allNotesOff(now: number): void {
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (!s.busy) continue;
      const g = s.gain.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(Math.max(g.value, 0.0001), now);
      g.exponentialRampToValueAtTime(0.0001, now + 0.05);
      s.busy = false;
      this.free[this.freeCount++] = i;
    }
  }
}
