/* Internal audio profiler — catches scheduling regressions.
 *
 * Every audio "callback" (one pass of the lookahead pump) is timed with
 * performance.now() and the elapsed milliseconds are pushed into a fixed,
 * pre-allocated ring buffer. Nothing is allocated in the hot path: the ring,
 * the running accumulators and the reusable stats object are all created once.
 *
 * "Callback" here means one invocation of the scheduler pump — the periodic
 * unit of audio-thread-adjacent work in a Web Audio lookahead engine. If a
 * pump ever exceeds the budget we flag it (and optionally warn) so a future
 * change that makes scheduling expensive shows up immediately. */

export interface ProfilerStats {
  /** Number of callbacks recorded so far (saturates at ring capacity for the window). */
  count: number;
  /** Mean CPU ms per callback across the window. */
  avgMs: number;
  /** Worst CPU ms seen in the window. */
  maxMs: number;
  /** Most recent CPU ms. */
  lastMs: number;
  /** Fraction of the pump interval the worst callback consumed (0..1). */
  peakLoad: number;
  /** How many callbacks exceeded the budget. */
  overBudget: number;
}

export class AudioProfiler {
  private readonly ring: Float64Array;
  private head = 0;
  private count = 0;
  private overBudget = 0;

  /** Reusable — getStats() fills and returns this; callers must copy if they hold it. */
  private readonly stats: ProfilerStats = {
    count: 0, avgMs: 0, maxMs: 0, lastMs: 0, peakLoad: 0, overBudget: 0,
  };

  /** Budget per callback in ms; a warning fires when exceeded. */
  budgetMs: number;
  /** The pump interval in ms, used to express peak load as a fraction. */
  intervalMs: number;

  private warnThrottle = 0;

  constructor(ringSize = 256, budgetMs = 5, intervalMs = 25) {
    this.ring = new Float64Array(ringSize);
    this.budgetMs = budgetMs;
    this.intervalMs = intervalMs;
  }

  /** Record one callback's CPU time. O(1), allocation-free. */
  record(ms: number): void {
    this.ring[this.head] = ms;
    this.head = (this.head + 1) % this.ring.length;
    if (this.count < this.ring.length) this.count++;
    if (ms > this.budgetMs) {
      this.overBudget++;
      // Throttle warnings so a sustained regression doesn't flood the console.
      const now = performance.now();
      if (now - this.warnThrottle > 2000) {
        this.warnThrottle = now;
        console.warn(
          `[audio-profiler] callback took ${ms.toFixed(2)}ms (budget ${this.budgetMs}ms) — possible scheduling regression`,
        );
      }
    }
  }

  /** Fill and return the reusable stats object. O(window), allocation-free. */
  getStats(): ProfilerStats {
    const n = this.count;
    let sum = 0;
    let max = 0;
    for (let i = 0; i < n; i++) {
      const v = this.ring[i];
      sum += v;
      if (v > max) max = v;
    }
    const last = n > 0 ? this.ring[(this.head - 1 + this.ring.length) % this.ring.length] : 0;
    const s = this.stats;
    s.count = n;
    s.avgMs = n > 0 ? sum / n : 0;
    s.maxMs = max;
    s.lastMs = last;
    s.peakLoad = this.intervalMs > 0 ? Math.min(1, max / this.intervalMs) : 0;
    s.overBudget = this.overBudget;
    return s;
  }

  /** Copy of the raw window, oldest→newest, written into `out` (allocation-free). */
  getWindow(out: Float64Array): number {
    const n = Math.min(this.count, out.length);
    for (let i = 0; i < n; i++) {
      const idx = (this.head - n + i + this.ring.length * 2) % this.ring.length;
      out[i] = this.ring[idx];
    }
    return n;
  }

  reset(): void {
    this.head = 0;
    this.count = 0;
    this.overBudget = 0;
    this.ring.fill(0);
  }
}
