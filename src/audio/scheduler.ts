/* Deterministic, sample-accurate transport scheduler.
 *
 * The single source of truth for musical time is the AudioContext clock
 * (`ctx.currentTime`), never the JS timer. The timer (a self-rescheduling
 * setTimeout) is ONLY a coarse "pump" that wakes us up to fill the lookahead
 * window; it never decides *when* a note plays. Every event time is computed
 * as  baseTime + (step - baseStep) * stepDur  from a clock anchor, and every
 * node is started with an explicit sample-accurate timestamp, so scheduling is
 * immune to main-thread jitter. Transport position is likewise *derived* by
 * reading the clock, not by counting ticks.
 *
 * This is the standard Web Audio "two clocks" pattern: the audio clock is
 * authoritative; the JS timer merely services it. */

import { AudioProfiler } from "./profiler";

export interface SchedulerCallbacks {
  /** Schedule all notes belonging to `absStep` to sound at `time` (audio-clock seconds). */
  onStep: (absStep: number, time: number) => void;
  /** Non-looping playback scheduled its final step; audio will finish shortly. */
  onEnded?: () => void;
}

export class TransportClock {
  loop = true;

  /** Loop region in steps; [0, Infinity) = "loop the whole timeline". */
  private loopStart = 0;
  private loopEnd = Number.POSITIVE_INFINITY;

  /** Set/clear the loop region (steps). Kept in sync with project.loopRegion. */
  setLoopRegion(startStep: number, endStep: number | null): void {
    this.loopStart = Math.max(0, Math.floor(startStep));
    this.loopEnd = endStep === null ? Number.POSITIVE_INFINITY : Math.max(this.loopStart + 1, Math.floor(endStep));
  }

  private readonly ctx: AudioContext;
  private readonly cbs: SchedulerCallbacks;
  private readonly totalSteps: () => number;
  private readonly profiler: AudioProfiler | null;

  /** Clock anchor: `baseTime` on the audio clock corresponds to `baseStep`. */
  private baseTime = 0;
  private baseStep = 0;
  private stepDur = 0.125;
  private nextStep = 0;

  private running = false;
  private timer: number | null = null;

  /** How far ahead (s) to schedule. Larger = more jitter-tolerant, more latency. */
  readonly lookahead: number;
  /** Pump period (ms). Only the wake-up cadence — never the timing source. */
  readonly pumpMs: number;

  constructor(
    ctx: AudioContext,
    cbs: SchedulerCallbacks,
    totalSteps: () => number,
    opts: { lookahead?: number; pumpMs?: number; profiler?: AudioProfiler | null } = {},
  ) {
    this.ctx = ctx;
    this.cbs = cbs;
    this.totalSteps = totalSteps;
    this.lookahead = opts.lookahead ?? 0.12;
    this.pumpMs = opts.pumpMs ?? 25;
    this.profiler = opts.profiler ?? null;
  }

  /* ---------------- pure clock math (no side effects) ---------------- */

  /** Audio-clock time at which `step` should sound. */
  timeOf(step: number): number {
    return this.baseTime + (step - this.baseStep) * this.stepDur;
  }

  /** Fractional step position at a given audio-clock time. */
  stepAt(ctxTime: number): number {
    if (this.stepDur <= 0) return this.baseStep;
    return this.baseStep + (ctxTime - this.baseTime) / this.stepDur;
  }

  /** Current transport position, derived from the audio clock. */
  getPosition(): number {
    return this.running ? this.stepAt(this.ctx.currentTime) : this.baseStep;
  }

  isRunning(): boolean {
    return this.running;
  }

  getStepDur(): number {
    return this.stepDur;
  }

  /** Change tempo (step duration) without a position jump — re-anchors the grid. */
  setStepDur(sd: number): void {
    if (sd <= 0) return;
    const cur = this.stepAt(this.ctx.currentTime);
    this.stepDur = sd;
    this.baseStep = cur;
    this.baseTime = this.ctx.currentTime;
    this.nextStep = Math.max(this.nextStep, Math.ceil(cur));
  }

  /* ---------------- transport ---------------- */

  play(fromStep: number, leadIn = 0.08): void {
    if (this.running) return;
    // Starting outside a loop region snaps to its head (the region is what repeats).
    const start = this.loop && fromStep >= this.loopEnd ? this.loopStart : fromStep;
    const now = this.ctx.currentTime;
    this.baseTime = now + leadIn;
    this.baseStep = start;
    this.nextStep = start;
    this.running = true;
    this.startPump();
    // Fill immediately so the first notes are already scheduled before the first wake-up.
    this.pumpOnce();
  }

  /** Pause; returns the position (from the clock) to resume from. */
  pause(): number {
    const pos = this.stepAt(this.ctx.currentTime);
    this.teardownPump();
    this.running = false;
    return pos;
  }

  stop(): void {
    this.teardownPump();
    this.running = false;
    this.baseStep = 0;
    this.nextStep = 0;
  }

  /* ---------------- the pump ---------------- */

  private startPump(): void {
    if (this.timer !== null) return;
    this.timer = window.setTimeout(this.pump, this.pumpMs);
  }

  private teardownPump(): void {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /** Self-rescheduling wake-up. Timing authority stays with the audio clock. */
  private pump = (): void => {
    if (!this.running) {
      this.timer = null;
      return;
    }
    this.pumpOnce();
    this.timer = window.setTimeout(this.pump, this.pumpMs);
  };

  /** One lookahead fill. Timed by the profiler when attached. Allocation-free. */
  pumpOnce(): void {
    if (this.profiler) {
      const t0 = performance.now();
      this.fill();
      this.profiler.record(performance.now() - t0);
    } else {
      this.fill();
    }
  }

  private fill(): void {
    const horizon = this.ctx.currentTime + this.lookahead;
    const total = this.totalSteps();
    while (this.timeOf(this.nextStep) < horizon) {
      let abs = this.nextStep;
      // Loop-region wrap: re-anchor the clock so loopStart sounds at the exact
      // instant loopEnd would have — time stays monotonic, audio clock stays
      // authoritative, and the wrap is sample-accurate (no audible seam).
      if (this.loop && abs >= this.loopEnd) {
        const anchor = this.timeOf(abs);
        this.baseTime = anchor;
        this.baseStep = this.loopStart;
        this.nextStep = this.loopStart;
        abs = this.loopStart;
      }
      if (this.loop || abs < total) {
        this.cbs.onStep(abs, this.timeOf(abs));
        this.nextStep++;
      } else {
        // Non-looping playback has scheduled everything; let the tail ring out.
        this.running = false;
        this.cbs.onEnded?.();
        return;
      }
    }
  }
}
