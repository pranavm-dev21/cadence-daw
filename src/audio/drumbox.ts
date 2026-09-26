/* Cadence DrumBox — a self-contained step-sequencer drum machine.
 *
 * Every drum is synthesized in code (no samples, no licensed content). The
 * sequencer schedules hits with a WebAudio-clock lookahead (never setInterval
 * for timing), honours per-step velocity, a global swing/groove amount, and a
 * song-mode chain of patterns. It owns its own AudioContext and transport so it
 * runs independently of the arrangement engine — like a hardware groove box. */

import { noiseBuffer } from "./synth";

/* ---------------- drum slots & synthesis ---------------- */

export const DRUM_SLOTS = ["kick", "snare", "closedhat", "openhat", "clap", "perc", "808"] as const;
export type DrumSlot = (typeof DRUM_SLOTS)[number];

export const SLOT_META: Record<DrumSlot, { label: string; short: string; color: string }> = {
  kick: { label: "Kick", short: "KCK", color: "#ff6f61" },
  snare: { label: "Snare", short: "SNR", color: "#ffb45e" },
  closedhat: { label: "Closed Hat", short: "CHH", color: "#35e0c2" },
  openhat: { label: "Open Hat", short: "OHH", color: "#3ecfb2" },
  clap: { label: "Clap", short: "CLP", color: "#58b7f5" },
  perc: { label: "Perc", short: "PRC", color: "#a78bfa" },
  "808": { label: "808 Sub", short: "808", color: "#f5a3d0" },
};

/** Trigger one synthesized drum at an absolute AudioContext time. */
export function playDrumSlot(ctx: BaseAudioContext, dest: AudioNode, slot: DrumSlot, time: number, vel: number): void {
  const v = Math.max(0.05, Math.min(1.25, vel));
  const noise = () => {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    return src;
  };

  switch (slot) {
    case "kick": {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(150, time);
      o.frequency.exponentialRampToValueAtTime(45, time + 0.11);
      const g = ctx.createGain();
      g.gain.setValueAtTime(1.1 * v, time);
      g.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
      o.connect(g).connect(dest);
      o.start(time);
      o.stop(time + 0.32);
      const c = noise();
      const cf = ctx.createBiquadFilter();
      cf.type = "highpass";
      cf.frequency.value = 3200;
      const cg = ctx.createGain();
      cg.gain.setValueAtTime(0.22 * v, time);
      cg.gain.exponentialRampToValueAtTime(0.001, time + 0.02);
      c.connect(cf).connect(cg).connect(dest);
      c.start(time);
      c.stop(time + 0.03);
      break;
    }
    case "snare": {
      const n = noise();
      const nf = ctx.createBiquadFilter();
      nf.type = "bandpass";
      nf.frequency.value = 1800;
      nf.Q.value = 0.7;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.8 * v, time);
      ng.gain.exponentialRampToValueAtTime(0.001, time + 0.17);
      n.connect(nf).connect(ng).connect(dest);
      n.start(time);
      n.stop(time + 0.19);
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = 190;
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.42 * v, time);
      og.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
      o.connect(og).connect(dest);
      o.start(time);
      o.stop(time + 0.09);
      break;
    }
    case "closedhat":
    case "openhat": {
      const open = slot === "openhat";
      const n = noise();
      const f = ctx.createBiquadFilter();
      f.type = "highpass";
      f.frequency.value = 7200;
      const g = ctx.createGain();
      const dur = open ? 0.32 : 0.045;
      g.gain.setValueAtTime((open ? 0.4 : 0.5) * v, time);
      g.gain.exponentialRampToValueAtTime(0.001, time + dur);
      n.connect(f).connect(g).connect(dest);
      n.start(time);
      n.stop(time + dur + 0.02);
      break;
    }
    case "clap": {
      for (let i = 0; i < 3; i++) {
        const n = noise();
        const f = ctx.createBiquadFilter();
        f.type = "bandpass";
        f.frequency.value = 1100;
        f.Q.value = 1.4;
        const g = ctx.createGain();
        const t = time + i * 0.012;
        g.gain.setValueAtTime(0.5 * v * (i === 2 ? 1 : 0.6), t);
        g.gain.exponentialRampToValueAtTime(0.001, t + (i === 2 ? 0.18 : 0.03));
        n.connect(f).connect(g).connect(dest);
        n.start(t);
        n.stop(t + 0.2);
      }
      break;
    }
    case "perc": {
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.setValueAtTime(880, time);
      o.frequency.exponentialRampToValueAtTime(340, time + 0.06);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.45 * v, time);
      g.gain.exponentialRampToValueAtTime(0.001, time + 0.09);
      o.connect(g).connect(dest);
      o.start(time);
      o.stop(time + 0.1);
      break;
    }
    case "808": {
      // Long, pitched-down sub with a slow decay — the classic 808.
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(120, time);
      o.frequency.exponentialRampToValueAtTime(41, time + 0.09);
      const g = ctx.createGain();
      g.gain.setValueAtTime(1.0 * v, time);
      g.gain.exponentialRampToValueAtTime(0.001, time + 0.85);
      o.connect(g).connect(dest);
      o.start(time);
      o.stop(time + 0.9);
      break;
    }
  }
}

/* ---------------- data model ---------------- */

export type StepCount = 8 | 16 | 32;

export interface DrumStep {
  on: boolean;
  vel: number; // 0..1
}

export interface DrumPattern {
  id: string;
  name: string;
  stepCount: StepCount;
  swing: number; // 0..1 (0 = straight, 1 = max groove)
  /** steps[lane][step] — lane indexed by DRUM_SLOTS order. */
  steps: DrumStep[][];
}

const emptySteps = (count: StepCount): DrumStep[][] =>
  DRUM_SLOTS.map(() => Array.from({ length: count }, (): DrumStep => ({ on: false, vel: 0.8 })));

let seq = 0;
const uid = (p: string) => `${p}_${(seq++).toString(36)}${Date.now().toString(36).slice(-4)}`;

export function makePattern(name: string, stepCount: StepCount = 16, swing = 0): DrumPattern {
  return { id: uid("pat"), name, stepCount, swing, steps: emptySteps(stepCount) };
}

/** Place a hit. Steps beyond the current count are ignored. */
export function setHit(p: DrumPattern, lane: number, step: number, on: boolean, vel = 0.8): DrumPattern {
  if (step < 0 || step >= p.stepCount) return p;
  const steps = p.steps.map((row, li) =>
    li === lane ? row.map((s, si) => (si === step ? { on, vel: on ? vel : s.vel } : s)) : row,
  );
  return { ...p, steps };
}

export function setStepVel(p: DrumPattern, lane: number, step: number, vel: number): DrumPattern {
  if (step < 0 || step >= p.stepCount) return p;
  const steps = p.steps.map((row, li) =>
    li === lane ? row.map((s, si) => (si === step ? { ...s, vel: Math.max(0.05, Math.min(1, vel)) } : s)) : row,
  );
  return { ...p, steps };
}

export function setStepCount(p: DrumPattern, count: StepCount): DrumPattern {
  const steps = p.steps.map((row) => {
    const next = Array.from({ length: count }, (_, i) => row[i] ?? { on: false, vel: 0.8 });
    return next;
  });
  return { ...p, stepCount: count, steps };
}

/** Deep-copy a pattern under a new id/name. */
export function duplicatePattern(p: DrumPattern, name?: string): DrumPattern {
  return {
    id: uid("pat"),
    name: name ?? `${p.name} copy`,
    stepCount: p.stepCount,
    swing: p.swing,
    steps: p.steps.map((row) => row.map((s) => ({ ...s }))),
  };
}

/* ---------------- starter patterns (original, hand-programmed) ---------------- */

const lane = (slot: DrumSlot) => DRUM_SLOTS.indexOf(slot);
const H = (vel = 0.8): DrumStep => ({ on: true, vel });

function hits(p: DrumPattern, slot: DrumSlot, map: Record<number, number>): void {
  const li = lane(slot);
  for (const [step, vel] of Object.entries(map)) {
    const s = Number(step);
    if (s < p.stepCount) p.steps[li][s] = { on: true, vel };
  }
}

/** Boom Bap — dusty 90s: swung kick/snare, tight hats. 16 steps, ~90 BPM feel. */
export function boomBapPattern(): DrumPattern {
  const p = makePattern("Boom Bap", 16, 0.54);
  hits(p, "kick", { 0: 1, 7: 0.7, 10: 0.9 });
  hits(p, "snare", { 4: 1, 12: 1 });
  hits(p, "closedhat", { 0: 0.7, 2: 0.5, 4: 0.7, 6: 0.5, 8: 0.7, 10: 0.5, 12: 0.7, 14: 0.6 });
  hits(p, "openhat", { 15: 0.45 });
  return p;
}

/** Trap — sparse 808, snare on 3, rapid hats. 16 steps. */
export function trapPattern(): DrumPattern {
  const p = makePattern("Trap", 16, 0);
  hits(p, "kick", { 0: 1, 10: 0.8 });
  hits(p, "snare", { 8: 1 });
  hits(p, "closedhat", { 0: 0.7, 1: 0.45, 2: 0.7, 3: 0.45, 4: 0.7, 5: 0.45, 6: 0.7, 7: 0.5, 8: 0.7, 9: 0.45, 10: 0.7, 11: 0.5, 12: 0.7, 13: 0.45, 14: 0.8, 15: 0.5 });
  hits(p, "808", { 0: 1, 10: 0.9 });
  hits(p, "clap", { 8: 0.6 });
  return p;
}

/** House — four-on-the-floor kick, off-beat open hats, swung claps. 16 steps. */
export function housePattern(): DrumPattern {
  const p = makePattern("House", 16, 0.62);
  hits(p, "kick", { 0: 1, 4: 1, 8: 1, 12: 1 });
  hits(p, "clap", { 4: 0.9, 12: 0.9 });
  hits(p, "openhat", { 2: 0.8, 6: 0.8, 10: 0.8, 14: 0.8 });
  hits(p, "closedhat", { 1: 0.35, 3: 0.35, 5: 0.35, 7: 0.35, 9: 0.35, 11: 0.35, 13: 0.35, 15: 0.35 });
  hits(p, "perc", { 14: 0.5 });
  hits(p, "808", { 0: 0.7 });
  return p;
}

export function starterPatterns(): DrumPattern[] {
  return [boomBapPattern(), trapPattern(), housePattern()];
}

/* ---------------- the engine ---------------- */

const AHEAD = 0.14; // s lookahead
const PUMP_MS = 25; // scheduler pump (the audio clock is still the source of truth)

export interface GroovePosition {
  playing: boolean;
  songMode: boolean;
  /** index into the chain (song mode) or 0 (pattern mode) */
  chainIndex: number;
  patternId: string | null;
  step: number;
  stepCount: number;
}

export class DrumBoxEngine {
  private ctx: AudioContext | null = null;
  private out!: GainNode;

  private patterns = new Map<string, DrumPattern>();
  private chain: string[] = [];
  private bpm = 120;

  playing = false;
  songMode = false;
  private currentPatternId: string | null = null;
  private chainIndex = 0;
  private stepInPattern = 0;

  private timer: number | null = null;
  private nextTime = 0;
  private stopToken = 0;

  /** UI hook: called at wall-clock time when a step triggers. */
  onTrigger: ((patternId: string, lane: number, step: number) => void) | null = null;

  /* -------- lifecycle / data -------- */

  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.out = this.ctx.createGain();
      this.out.gain.value = 0.9;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -8;
      comp.ratio.value = 4;
      comp.attack.value = 0.003;
      comp.release.value = 0.16;
      this.out.connect(comp);
      comp.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  setPatterns(list: DrumPattern[]): void {
    this.patterns = new Map(list.map((p) => [p.id, p]));
  }
  setChain(chain: string[]): void {
    this.chain = chain.filter((id) => this.patterns.has(id));
  }
  setBpm(bpm: number): void {
    this.bpm = Math.max(55, Math.min(200, bpm));
  }

  getPattern(id: string): DrumPattern | undefined {
    return this.patterns.get(id);
  }

  private currentPattern(): DrumPattern | null {
    if (this.songMode) {
      const id = this.chain[this.chainIndex];
      return id ? this.patterns.get(id) ?? null : null;
    }
    return this.currentPatternId ? this.patterns.get(this.currentPatternId) ?? null : null;
  }

  /* -------- transport -------- */

  play(currentPatternId: string, songMode: boolean): void {
    const ctx = this.ensureCtx();
    void ctx.resume();
    if (this.playing) return;
    this.playing = true;
    this.songMode = songMode;
    this.stopToken++;

    this.currentPatternId = currentPatternId;
    this.chainIndex = 0;
    this.stepInPattern = 0;
    this.nextTime = ctx.currentTime + 0.06;
    const token = this.stopToken;
    this.timer = window.setInterval(() => {
      if (token !== this.stopToken) return;
      this.tick();
    }, PUMP_MS);
  }

  stop(): void {
    this.stopToken++;
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    if (this.playing) {
      this.playing = false;
      this.chainIndex = 0;
      this.stepInPattern = 0;
    }
  }

  getPosition(): GroovePosition {
    const p = this.currentPattern();
    const activeId = this.songMode ? this.chain[this.chainIndex] ?? null : this.currentPatternId;
    return {
      playing: this.playing,
      songMode: this.songMode,
      chainIndex: this.chainIndex,
      patternId: activeId ?? p?.id ?? null,
      step: this.stepInPattern,
      stepCount: p?.stepCount ?? 16,
    };
  }

  /** Preview a single drum hit (pad click / key). */
  preview(slot: DrumSlot, vel = 0.9): void {
    const ctx = this.ensureCtx();
    void ctx.resume();
    playDrumSlot(ctx, this.out, slot, ctx.currentTime, vel);
  }

  /* -------- scheduling (audio-clock lookahead + swing + chaining) -------- */

  private stepDur(p: DrumPattern): number {
    // one 16th note
    return 60 / this.bpm / 4;
  }

  /** Swing pushes odd 16ths later; max offset is half a step. */
  private swingOffset(p: DrumPattern, step: number): number {
    if (step % 2 === 0) return 0;
    return p.swing * 0.5 * this.stepDur(p);
  }

  private tick(): void {
    const ctx = this.ctx!;
    while (this.nextTime < ctx.currentTime + AHEAD) {
      const p = this.currentPattern();
      if (!p) {
        this.stop();
        return;
      }
      this.scheduleStep(p, this.stepInPattern, this.nextTime);

      // advance
      this.stepInPattern++;
      this.nextTime += this.stepDur(p);
      if (this.stepInPattern >= p.stepCount) {
        this.stepInPattern = 0;
        if (this.songMode) {
          this.chainIndex++;
          if (this.chainIndex >= this.chain.length) {
            this.chainIndex = 0; // loop the song
          }
        }
      }
    }
  }

  private scheduleStep(p: DrumPattern, step: number, time: number): void {
    const ctx = this.ctx!;
    const t = time + this.swingOffset(p, step);
    for (let li = 0; li < p.steps.length; li++) {
      const s = p.steps[li][step];
      if (!s || !s.on) continue;
      playDrumSlot(ctx, this.out, DRUM_SLOTS[li], t, s.vel);
      this.queueVisual(p.id, li, step, t);
    }
  }

  /** Fire the UI trigger at the right wall-clock moment (visual sync only). */
  private queueVisual(patternId: string, li: number, step: number, when: number): void {
    if (!this.onTrigger || !this.ctx) return;
    const delayMs = Math.max(0, (when - this.ctx.currentTime) * 1000);
    const cb = this.onTrigger;
    window.setTimeout(() => cb(patternId, li, step), delayMs);
  }
}

let singleton: DrumBoxEngine | null = null;
export function getDrumBox(): DrumBoxEngine {
  if (!singleton) singleton = new DrumBoxEngine();
  return singleton;
}
