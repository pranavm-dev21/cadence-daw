/* FX framework — reusable, chainable audio-graph effect nodes.
 *
 * Every effect implements the FxNode contract:
 *   - `input` / `output` AudioNodes, so effects compose: a.output → b.input.
 *   - `setBypass(b)` — true bypass. The internal graph is physically
 *     disconnected and input is wired straight to output, so a bypassed
 *     effect costs ~0 (reflected in getCpuCost()).
 *   - `getCpuCost()` — a relative cost figure derived from the effect's node
 *     graph using a shared weight model, so the mixer UI can show per-channel
 *     load. Cost is an honest analytic estimate: native WebAudio runs on the
 *     platform audio thread, and a node's cost scales with its type/count.
 *
 * The framework is deliberately context-agnostic in its *math*: every effect's
 * parameter clamping lives in a pure `normalize*` function (unit-tested), while
 * node construction happens in the constructor (needs a BaseAudioContext). */

/* ---------------- CPU cost model (pure, testable) ---------------- */

/** Relative cost weight per WebAudio node type. Convolver (FFT overlap-add) is
 *  by far the heaviest; gains/mergers are near-free. Values are heuristic but
 *  stable, so per-channel figures are comparable across sessions. */
export const NODE_COST: Record<string, number> = {
  GainNode: 1,
  StereoPannerNode: 2,
  ChannelSplitterNode: 2,
  ChannelMergerNode: 2,
  BiquadFilterNode: 3,
  DelayNode: 4,
  WaveShaperNode: 6,
  DynamicsCompressorNode: 9,
  ConvolverNode: 32,
  AnalyserNode: 2,
  AudioBufferSourceNode: 1,
  OscillatorNode: 2,
};

/** Sum the weights of a list of node-kind names. Pure — unit tested. */
export function estimateGraphCost(nodeKinds: string[]): number {
  let sum = 0;
  for (const k of nodeKinds) sum += NODE_COST[k] ?? 1;
  return sum;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/* ---------------- the FxNode contract ---------------- */

export type FxKind =
  | "eq" | "compressor" | "limiter" | "reverb" | "delay" | "distortion" | "utility"
  | "softclipper" | "chorus" | "gate" | "stereoshaper";

export interface FxNode {
  readonly kind: FxKind;
  readonly label: string;
  readonly input: AudioNode;
  readonly output: AudioNode;
  readonly bypassed: boolean;
  setBypass(b: boolean): void;
  /** Relative cost right now (0 while bypassed). */
  getCpuCost(): number;
  /** Relative cost when fully active (node-graph weight). */
  getStaticCost(): number;
  /** Detach everything; call when removing from a chain/context. */
  dispose(): void;
}

/* ---------------- shared base: I/O gains + true bypass ---------------- */

export abstract class FxBase implements FxNode {
  abstract readonly kind: FxKind;
  abstract readonly label: string;

  readonly input: GainNode;
  readonly output: GainNode;
  protected procIn: AudioNode;   // first internal node
  protected procOut: AudioNode;  // last internal node
  protected nodeKinds: string[] = [];
  private _bypassed = false;

  constructor(protected ctx: BaseAudioContext) {
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.input.gain.value = 1;
    this.output.gain.value = 1;
    this.procIn = this.input;
    this.procOut = this.output;
    this.nodeKinds.push("GainNode", "GainNode");
  }

  /** Subclasses call after building their graph to register endpoints. */
  protected setEndpoints(procIn: AudioNode, procOut: AudioNode): void {
    this.procIn = procIn;
    this.procOut = procOut;
  }
  protected track<T extends AudioNode>(node: T, kind: string): T {
    this.nodeKinds.push(kind);
    return node;
  }

  get bypassed(): boolean {
    return this._bypassed;
  }

  setBypass(b: boolean): void {
    if (this._bypassed === b) return;
    this._bypassed = b;
    try {
      if (b) {
        // true bypass: input → output direct; internal graph floats disconnected
        this.input.disconnect();
        this.input.connect(this.output);
      } else {
        this.input.disconnect();
        this.input.connect(this.procIn);
        this.procOut.disconnect();
        this.procOut.connect(this.output);
      }
    } catch {
      /* nodes already torn down */
    }
  }

  getStaticCost(): number {
    return estimateGraphCost(this.nodeKinds);
  }
  getCpuCost(): number {
    return this._bypassed ? 0 : this.getStaticCost();
  }

  dispose(): void {
    try {
      this.input.disconnect();
      this.output.disconnect();
      this.procOut.disconnect();
    } catch {
      /* noop */
    }
  }
}

/* helper: wire a→b→c… in order */
function chain(ctx: BaseAudioContext, ...nodes: AudioNode[]): void {
  void ctx;
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
}

/* ================= 1. Parametric EQ (4-band) ================= */

export type EqBandType = "bell" | "lowshelf" | "highshelf" | "highpass" | "lowpass";
export interface EqBandParams { type: EqBandType; freq: number; gain: number; q: number; }
export interface EqParams { bands: EqBandParams[]; }

const EQ_BAND_MAP: Record<EqBandType, BiquadFilterType> = {
  bell: "peaking",
  lowshelf: "lowshelf",
  highshelf: "highshelf",
  highpass: "highpass",
  lowpass: "lowpass",
};

/** Pure — clamps every band into legal ranges. */
export function normalizeEqParams(p: EqParams): EqParams {
  return {
    bands: p.bands.slice(0, 4).map((b) => ({
      type: b.type,
      freq: clamp(b.freq, 20, 20000),
      gain: clamp(b.gain, -24, 24),
      q: clamp(b.q, 0.1, 18),
    })),
  };
}

export const EQ_DEFAULT: EqParams = normalizeEqParams({
  bands: [
    { type: "highpass", freq: 40, gain: 0, q: 0.7 },
    { type: "bell", freq: 250, gain: 0, q: 1.0 },
    { type: "bell", freq: 2500, gain: 0, q: 1.0 },
    { type: "highshelf", freq: 10000, gain: 0, q: 0.7 },
  ],
});

export class ParametricEq extends FxBase {
  readonly kind = "eq" as const;
  readonly label = "Parametric EQ";
  private filters: BiquadFilterNode[] = [];
  private params: EqParams;

  constructor(ctx: BaseAudioContext, params: EqParams = EQ_DEFAULT) {
    super(ctx);
    this.params = normalizeEqParams(params);
    const filters = this.params.bands.map((b) => {
      const f = ctx.createBiquadFilter();
      f.type = EQ_BAND_MAP[b.type];
      f.frequency.value = b.freq;
      f.gain.value = b.type === "bell" || b.type === "lowshelf" || b.type === "highshelf" ? b.gain : 0;
      f.Q.value = b.q;
      this.track(f, "BiquadFilterNode");
      return f;
    });
    this.filters = filters;
    chain(ctx, this.input, ...filters, this.output);
    // proc endpoints are input→first filter … last filter→output
    if (filters.length) {
      this.setEndpoints(filters[0], filters[filters.length - 1]);
      this.input.connect(filters[0]);
      filters[filters.length - 1].connect(this.output);
    } else {
      this.input.connect(this.output);
    }
  }

  setParams(p: EqParams): void {
    this.params = normalizeEqParams(p);
    this.params.bands.forEach((b, i) => {
      const f = this.filters[i];
      if (!f) return;
      f.type = EQ_BAND_MAP[b.type];
      f.frequency.setTargetAtTime(b.freq, this.ctx.currentTime, 0.02);
      f.gain.setTargetAtTime(
        b.type === "bell" || b.type === "lowshelf" || b.type === "highshelf" ? b.gain : 0,
        this.ctx.currentTime, 0.02,
      );
      f.Q.setTargetAtTime(b.q, this.ctx.currentTime, 0.02);
    });
  }
  getParams(): EqParams {
    return this.params;
  }
}

/* ================= 2. Compressor ================= */

export interface CompParams {
  threshold: number; // dB
  ratio: number;
  attack: number; // s
  release: number; // s
  knee: number; // dB
  makeup: number; // linear gain
}

export function normalizeCompParams(p: CompParams): CompParams {
  return {
    threshold: clamp(p.threshold, -60, 0),
    ratio: clamp(p.ratio, 1, 20),
    attack: clamp(p.attack, 0.0005, 1),
    release: clamp(p.release, 0.01, 3),
    knee: clamp(p.knee, 0, 40),
    makeup: clamp(p.makeup, 0, 8),
  };
}

export const COMP_DEFAULT: CompParams = normalizeCompParams({
  threshold: -18, ratio: 3, attack: 0.006, release: 0.18, knee: 12, makeup: 1.4,
});

export class Compressor extends FxBase {
  readonly kind = "compressor" as const;
  readonly label = "Compressor";
  private comp: DynamicsCompressorNode;
  private makeupGain: GainNode;
  private params: CompParams;

  constructor(ctx: BaseAudioContext, params: CompParams = COMP_DEFAULT) {
    super(ctx);
    this.params = normalizeCompParams(params);
    this.comp = this.track(ctx.createDynamicsCompressor(), "DynamicsCompressorNode");
    this.makeupGain = this.track(ctx.createGain(), "GainNode");
    this.apply();
    chain(ctx, this.input, this.comp, this.makeupGain, this.output);
    this.setEndpoints(this.comp, this.makeupGain);
    this.input.connect(this.comp);
    this.makeupGain.connect(this.output);
  }
  private apply(): void {
    const p = this.params;
    this.comp.threshold.value = p.threshold;
    this.comp.ratio.value = p.ratio;
    this.comp.attack.value = p.attack;
    this.comp.release.value = p.release;
    this.comp.knee.value = p.knee;
    this.makeupGain.gain.value = p.makeup;
  }
  setParams(p: CompParams): void {
    this.params = normalizeCompParams(p);
    this.apply();
  }
  getParams(): CompParams {
    return this.params;
  }
  /** Live gain reduction in dB (read-only metering). */
  getReductionDb(): number {
    return this.comp.reduction;
  }
}

/* ================= 3. Limiter ================= */

export interface LimiterParams {
  threshold: number; // dB — where limiting starts
  ceiling: number; // dBFS — hard output ceiling
  release: number; // s
}

export function normalizeLimiterParams(p: LimiterParams): LimiterParams {
  return {
    threshold: clamp(p.threshold, -40, 0),
    ceiling: clamp(p.ceiling, -24, 0),
    release: clamp(p.release, 0.01, 1),
  };
}

export const LIMITER_DEFAULT: LimiterParams = normalizeLimiterParams({
  threshold: -6, ceiling: -0.3, release: 0.12,
});

export class Limiter extends FxBase {
  readonly kind = "limiter" as const;
  readonly label = "Limiter";
  private comp: DynamicsCompressorNode;
  private ceilingGain: GainNode;
  private params: LimiterParams;

  constructor(ctx: BaseAudioContext, params: LimiterParams = LIMITER_DEFAULT) {
    super(ctx);
    this.params = normalizeLimiterParams(params);
    this.comp = this.track(ctx.createDynamicsCompressor(), "DynamicsCompressorNode");
    this.ceilingGain = this.track(ctx.createGain(), "GainNode");
    // brick-wall-ish: very high ratio, fast attack
    this.comp.ratio.value = 20;
    this.comp.attack.value = 0.001;
    this.comp.knee.value = 0;
    this.apply();
    chain(ctx, this.input, this.comp, this.ceilingGain, this.output);
    this.setEndpoints(this.comp, this.ceilingGain);
    this.input.connect(this.comp);
    this.ceilingGain.connect(this.output);
  }
  private apply(): void {
    this.comp.threshold.value = this.params.threshold;
    this.comp.release.value = this.params.release;
    this.ceilingGain.gain.value = Math.pow(10, this.params.ceiling / 20);
  }
  setParams(p: LimiterParams): void {
    this.params = normalizeLimiterParams(p);
    this.apply();
  }
  getParams(): LimiterParams {
    return this.params;
  }
}

/* ================= 4. Reverb (algorithmic FDN) ================= */

export interface ReverbParams {
  roomSize: number; // 0..1
  decay: number; // 0..1  (feedback amount)
  damping: number; // 0..1 (high-frequency absorption)
  mix: number; // 0..1 wet
}

export function normalizeReverbParams(p: ReverbParams): ReverbParams {
  return {
    roomSize: clamp(p.roomSize, 0, 1),
    decay: clamp(p.decay, 0, 0.98),
    damping: clamp(p.damping, 0, 1),
    mix: clamp(p.mix, 0, 1),
  };
}

export const REVERB_DEFAULT: ReverbParams = normalizeReverbParams({
  roomSize: 0.5, decay: 0.6, damping: 0.4, mix: 0.3,
});

/** Base delay-line times (ms) — mutually prime-ish to avoid ringing comb artifacts. */
const FDN_LINES = [29.7, 37.1, 43.9, 53.3];

export class Reverb extends FxBase {
  readonly kind = "reverb" as const;
  readonly label = "Reverb (FDN)";
  private delays: DelayNode[] = [];
  private feedbacks: GainNode[] = [];
  private dampers: BiquadFilterNode[] = [];
  private dry: GainNode;
  private wet: GainNode;
  private params: ReverbParams;

  constructor(ctx: BaseAudioContext, params: ReverbParams = REVERB_DEFAULT) {
    super(ctx);
    this.params = normalizeReverbParams(params);

    this.dry = this.track(ctx.createGain(), "GainNode");
    this.wet = this.track(ctx.createGain(), "GainNode");
    const wetSum = this.track(ctx.createGain(), "GainNode");

    for (const ms of FDN_LINES) {
      const delay = this.track(ctx.createDelay(2.0), "DelayNode");
      const fb = this.track(ctx.createGain(), "GainNode");
      const damp = this.track(ctx.createBiquadFilter(), "BiquadFilterNode");
      damp.type = "lowpass";
      delay.connect(damp);
      damp.connect(fb);
      fb.connect(delay); // feedback loop with damping inside
      delay.connect(wetSum);
      this.delays.push(delay);
      this.feedbacks.push(fb);
      this.dampers.push(damp);
    }

    // input fans out to every delay line + the dry path
    for (const d of this.delays) this.input.connect(d);
    this.input.connect(this.dry);
    this.dry.connect(this.output);
    wetSum.connect(this.wet);
    this.wet.connect(this.output);
    this.setEndpoints(this.input, this.output);
    // note: bypass uses input→output; the internal fan-out stays within input/output
    this.apply();
  }

  private apply(): void {
    const p = this.params;
    const now = this.ctx.currentTime;
    const scale = 0.5 + p.roomSize * 1.6; // room size stretches delay times
    FDN_LINES.forEach((ms, i) => {
      this.delays[i].delayTime.setTargetAtTime((ms / 1000) * scale, now, 0.05);
      this.feedbacks[i].gain.setTargetAtTime(p.decay, now, 0.03);
      // damping: higher value → darker (lower feedback lowpass)
      this.dampers[i].frequency.setTargetAtTime(18000 - p.damping * 15000, now, 0.03);
    });
    this.dry.gain.setTargetAtTime(1 - p.mix, now, 0.02);
    this.wet.gain.setTargetAtTime(p.mix, now, 0.02);
  }

  setParams(p: ReverbParams): void {
    this.params = normalizeReverbParams(p);
    this.apply();
  }
  getParams(): ReverbParams {
    return this.params;
  }
}

/* ================= 5. Delay (BPM-sync or free, stereo offset) ================= */

export type DelaySync = "free" | "1/1" | "1/2" | "1/4" | "1/8" | "1/16" | "1/8." | "1/16.";
const SYNC_DIV: Record<Exclude<DelaySync, "free">, number> = {
  "1/1": 1, "1/2": 1 / 2, "1/4": 1 / 4, "1/8": 1 / 8, "1/16": 1 / 16,
  "1/8.": 3 / 16, "1/16.": 3 / 32,
};

export interface DelayParams {
  sync: DelaySync;
  timeMs: number; // used when sync === "free"
  feedback: number; // 0..0.95
  stereoOffsetMs: number; // extra delay on the right channel
  mix: number; // 0..1 wet
}

export function normalizeDelayParams(p: DelayParams): DelayParams {
  return {
    sync: p.sync,
    timeMs: clamp(p.timeMs, 10, 2000),
    feedback: clamp(p.feedback, 0, 0.95),
    stereoOffsetMs: clamp(p.stereoOffsetMs, 0, 100),
    mix: clamp(p.mix, 0, 1),
  };
}

export const DELAY_DEFAULT: DelayParams = normalizeDelayParams({
  sync: "1/8", timeMs: 300, feedback: 0.4, stereoOffsetMs: 12, mix: 0.3,
});

export class Delay extends FxBase {
  readonly kind = "delay" as const;
  readonly label = "Delay";
  private lDelay: DelayNode;
  private rDelay: DelayNode;
  private lFb: GainNode;
  private rFb: GainNode;
  private dry: GainNode;
  private wet: GainNode;
  private split: ChannelSplitterNode;
  private merge: ChannelMergerNode;
  private params: DelayParams;
  private bpm = 120;

  constructor(ctx: BaseAudioContext, params: DelayParams = DELAY_DEFAULT) {
    super(ctx);
    this.params = normalizeDelayParams(params);

    this.split = this.track(ctx.createChannelSplitter(2), "ChannelSplitterNode");
    this.merge = this.track(ctx.createChannelMerger(2), "ChannelMergerNode");
    this.lDelay = this.track(ctx.createDelay(3.0), "DelayNode");
    this.rDelay = this.track(ctx.createDelay(3.0), "DelayNode");
    this.lFb = this.track(ctx.createGain(), "GainNode");
    this.rFb = this.track(ctx.createGain(), "GainNode");
    this.dry = this.track(ctx.createGain(), "GainNode");
    this.wet = this.track(ctx.createGain(), "GainNode");

    // L: in → lDelay → wet ; feedback loop
    this.input.connect(this.split);
    this.split.connect(this.lDelay, 0);
    this.split.connect(this.rDelay, 1);
    this.lDelay.connect(this.lFb);
    this.lFb.connect(this.lDelay);
    this.rDelay.connect(this.rFb);
    this.rFb.connect(this.rDelay);
    this.lDelay.connect(this.merge, 0, 0);
    this.rDelay.connect(this.merge, 0, 1);
    this.merge.connect(this.wet);

    this.input.connect(this.dry);
    this.dry.connect(this.output);
    this.wet.connect(this.output);
    this.setEndpoints(this.input, this.output);
    this.apply();
  }

  setBpm(bpm: number): void {
    this.bpm = clamp(bpm, 30, 300);
    this.apply();
  }

  private currentMs(): number {
    if (this.params.sync === "free") return this.params.timeMs;
    const beats = SYNC_DIV[this.params.sync as Exclude<DelaySync, "free">];
    return (60000 / this.bpm) * beats;
  }

  private apply(): void {
    const p = this.params;
    const now = this.ctx.currentTime;
    const base = this.currentMs() / 1000;
    const off = p.stereoOffsetMs / 1000;
    this.lDelay.delayTime.setTargetAtTime(base, now, 0.02);
    this.rDelay.delayTime.setTargetAtTime(base + off, now, 0.02);
    this.lFb.gain.setTargetAtTime(p.feedback, now, 0.02);
    this.rFb.gain.setTargetAtTime(p.feedback, now, 0.02);
    this.dry.gain.setTargetAtTime(1 - p.mix, now, 0.02);
    this.wet.gain.setTargetAtTime(p.mix, now, 0.02);
  }

  setParams(p: DelayParams): void {
    this.params = normalizeDelayParams(p);
    this.apply();
  }
  getParams(): DelayParams {
    return this.params;
  }
  getTimeMs(): number {
    return this.currentMs();
  }
}

/* ================= 6. Distortion / Saturation ================= */

export interface DistortionParams {
  drive: number; // 0..1
  tone: number; // 0..1 → lowpass 18k..1.5k after the shaper
  mix: number; // 0..1 wet
}

export function normalizeDistortionParams(p: DistortionParams): DistortionParams {
  return {
    drive: clamp(p.drive, 0, 1),
    tone: clamp(p.tone, 0, 1),
    mix: clamp(p.mix, 0, 1),
  };
}

export const DISTORTION_DEFAULT: DistortionParams = normalizeDistortionParams({
  drive: 0.4, tone: 0.6, mix: 1,
});

function makeSatCurve(drive: number): Float32Array<ArrayBuffer> {
  const n = 2048;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  const k = 1 + drive * 24; // saturation amount
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(k * x) / Math.tanh(k);
  }
  return curve;
}

export class Distortion extends FxBase {
  readonly kind = "distortion" as const;
  readonly label = "Distortion";
  private shaper: WaveShaperNode;
  private tone: BiquadFilterNode;
  private dry: GainNode;
  private wet: GainNode;
  private params: DistortionParams;
  private lastDrive = -1;

  constructor(ctx: BaseAudioContext, params: DistortionParams = DISTORTION_DEFAULT) {
    super(ctx);
    this.params = normalizeDistortionParams(params);
    this.shaper = this.track(ctx.createWaveShaper(), "WaveShaperNode");
    this.shaper.oversample = "2x";
    this.tone = this.track(ctx.createBiquadFilter(), "BiquadFilterNode");
    this.tone.type = "lowpass";
    this.dry = this.track(ctx.createGain(), "GainNode");
    this.wet = this.track(ctx.createGain(), "GainNode");

    this.input.connect(this.dry);
    this.dry.connect(this.output);
    this.input.connect(this.shaper);
    this.shaper.connect(this.tone);
    this.tone.connect(this.wet);
    this.wet.connect(this.output);
    this.setEndpoints(this.input, this.output);
    this.apply();
  }

  private apply(): void {
    const p = this.params;
    const now = this.ctx.currentTime;
    // regenerate the curve only when drive actually changed (alloc-free otherwise)
    if (Math.abs(p.drive - this.lastDrive) > 0.004) {
      this.shaper.curve = makeSatCurve(p.drive);
      this.lastDrive = p.drive;
    }
    this.tone.frequency.setTargetAtTime(18000 - p.tone * 16500, now, 0.02);
    this.dry.gain.setTargetAtTime(1 - p.mix, now, 0.02);
    this.wet.gain.setTargetAtTime(p.mix, now, 0.02);
  }

  setParams(p: DistortionParams): void {
    this.params = normalizeDistortionParams(p);
    this.apply();
  }
  getParams(): DistortionParams {
    return this.params;
  }
}

/* ================= 7. Utility (gain / invert / width / mono) ================= */

export interface UtilityParams {
  gain: number; // linear
  invert: boolean; // phase invert
  width: number; // 0 = mono … 1 = normal … 2 = wide
  mono: boolean; // force mono sum
}

export function normalizeUtilityParams(p: UtilityParams): UtilityParams {
  return {
    gain: clamp(p.gain, 0, 4),
    invert: p.invert,
    width: clamp(p.width, 0, 2),
    mono: p.mono,
  };
}

export const UTILITY_DEFAULT: UtilityParams = normalizeUtilityParams({
  gain: 1, invert: false, width: 1, mono: false,
});

export class Utility extends FxBase {
  readonly kind = "utility" as const;
  readonly label = "Utility";
  private split: ChannelSplitterNode;
  private merge: ChannelMergerNode;
  private midL: GainNode;
  private midR: GainNode;
  private sideL: GainNode;
  private sideR: GainNode;
  private outL: GainNode;
  private outR: GainNode;
  private masterGain: GainNode;
  private params: UtilityParams;

  constructor(ctx: BaseAudioContext, params: UtilityParams = UTILITY_DEFAULT) {
    super(ctx);
    this.params = normalizeUtilityParams(params);

    this.split = this.track(ctx.createChannelSplitter(2), "ChannelSplitterNode");
    this.merge = this.track(ctx.createChannelMerger(2), "ChannelMergerNode");
    // mid = (L+R)/2 ; side = (L-R)/2
    this.midL = this.track(ctx.createGain(), "GainNode"); // L * 0.5 → mid
    this.midR = this.track(ctx.createGain(), "GainNode"); // R * 0.5 → mid
    this.sideL = this.track(ctx.createGain(), "GainNode"); // L * 0.5 → side
    this.sideR = this.track(ctx.createGain(), "GainNode"); // R * -0.5 → side
    this.outL = this.track(ctx.createGain(), "GainNode");
    this.outR = this.track(ctx.createGain(), "GainNode");
    this.masterGain = this.track(ctx.createGain(), "GainNode");

    const mid = ctx.createGain();
    const side = ctx.createGain();

    this.input.connect(this.split);
    this.split.connect(this.midL, 0);
    this.split.connect(this.midR, 1);
    this.split.connect(this.sideL, 0);
    this.split.connect(this.sideR, 1);
    this.midL.connect(mid);
    this.midR.connect(mid);
    this.sideL.connect(side);
    this.sideR.connect(side);

    // L' = mid + side*width ; R' = mid - side*width
    mid.connect(this.outL);
    mid.connect(this.outR);
    side.connect(this.outL);
    side.connect(this.outR);
    this.outL.connect(this.merge, 0, 0);
    this.outR.connect(this.merge, 0, 1);
    this.merge.connect(this.masterGain);
    this.masterGain.connect(this.output);
    this.setEndpoints(this.input, this.output);
    this.apply();
  }

  private apply(): void {
    const p = this.params;
    const now = this.ctx.currentTime;
    const sign = p.invert ? -1 : 1;
    this.midL.gain.setTargetAtTime(0.5 * sign, now, 0.01);
    this.midR.gain.setTargetAtTime(0.5 * sign, now, 0.01);
    // mono collapses side to 0; width scales side (normal = 1)
    const sideAmt = p.mono ? 0 : p.width;
    this.sideL.gain.setTargetAtTime(0.5 * sideAmt * sign, now, 0.01);
    this.sideR.gain.setTargetAtTime(-0.5 * sideAmt * sign, now, 0.01);
    this.masterGain.gain.setTargetAtTime(p.gain, now, 0.01);
  }

  setParams(p: UtilityParams): void {
    this.params = normalizeUtilityParams(p);
    this.apply();
  }
  getParams(): UtilityParams {
    return this.params;
  }
}

/* ---------------- FxChain: ordered, rewirable container ---------------- */

export class FxChain {
  readonly input: GainNode;
  readonly output: GainNode;
  private nodes: FxNode[] = [];

  constructor(ctx: BaseAudioContext) {
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.input.connect(this.output); // empty chain = passthrough
  }

  get length(): number {
    return this.nodes.length;
  }
  getNodes(): FxNode[] {
    return [...this.nodes];
  }

  private rewire(): void {
    try {
      this.input.disconnect();
      for (const n of this.nodes) n.output.disconnect();
    } catch {
      /* noop */
    }
    if (this.nodes.length === 0) {
      this.input.connect(this.output);
      return;
    }
    this.input.connect(this.nodes[0].input);
    for (let i = 0; i < this.nodes.length - 1; i++) {
      this.nodes[i].output.connect(this.nodes[i + 1].input);
    }
    this.nodes[this.nodes.length - 1].output.connect(this.output);
  }

  push(node: FxNode): void {
    this.nodes.push(node);
    this.rewire();
  }
  insertAt(index: number, node: FxNode): void {
    this.nodes.splice(clamp(index, 0, this.nodes.length), 0, node);
    this.rewire();
  }
  remove(node: FxNode): void {
    const i = this.nodes.indexOf(node);
    if (i >= 0) {
      this.nodes.splice(i, 1);
      node.dispose();
      this.rewire();
    }
  }
  move(from: number, to: number): void {
    if (from < 0 || from >= this.nodes.length) return;
    const [n] = this.nodes.splice(from, 1);
    this.nodes.splice(clamp(to, 0, this.nodes.length), 0, n);
    this.rewire();
  }
  clear(): void {
    for (const n of this.nodes) n.dispose();
    this.nodes = [];
    this.rewire();
  }

  /** Sum of active node costs (bypassed nodes contribute 0). */
  getCpuCost(): number {
    let sum = 0;
    for (const n of this.nodes) sum += n.getCpuCost();
    return sum;
  }
  getStaticCost(): number {
    let sum = 0;
    for (const n of this.nodes) sum += n.getStaticCost();
    return sum;
  }
}

/* ---------------- factory: build an effect by kind ---------------- */

export function createFx(ctx: BaseAudioContext, kind: FxKind): FxNode {
  switch (kind) {
    case "eq": return new ParametricEq(ctx);
    case "compressor": return new Compressor(ctx);
    case "limiter": return new Limiter(ctx);
    case "reverb": return new Reverb(ctx);
    case "delay": return new Delay(ctx);
    case "distortion": return new Distortion(ctx);
    case "utility": return new Utility(ctx);
    default: return new Utility(ctx);
  }
}

export const FX_KINDS: { kind: FxKind; label: string; blurb: string }[] = [
  { kind: "eq", label: "Parametric EQ", blurb: "4-band bell/shelf/HP/LP" },
  { kind: "compressor", label: "Compressor", blurb: "threshold · ratio · knee" },
  { kind: "limiter", label: "Limiter", blurb: "brick-wall ceiling" },
  { kind: "reverb", label: "Reverb", blurb: "algorithmic FDN space" },
  { kind: "delay", label: "Delay", blurb: "sync/free · stereo offset" },
  { kind: "distortion", label: "Distortion", blurb: "saturation · tone" },
  { kind: "utility", label: "Utility", blurb: "gain · width · mono" },
];
