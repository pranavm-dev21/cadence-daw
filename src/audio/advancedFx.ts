/* Advanced studio effects suite for Cadence DAW
 * Extends the FxBase framework with FL Studio-style processing:
 * - SoftClipper: classic saturation transfer curve
 * - StereoShaper: Haas delay + M/S width management
 * - Chorus: Multi-voice modulated bucket-brigade style chorus
 * - NoiseGate: Fast downward expansion / gating
 */

import { FxBase, FxKind, estimateGraphCost } from "./fx";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/* ================= 1. Soft Clipper ================= */

export interface SoftClipperParams {
  threshold: number; // dB, -24..0
  postGain: number;  // dB, -12..12
}

export function normalizeSoftClipperParams(p: SoftClipperParams): SoftClipperParams {
  return {
    threshold: clamp(p.threshold, -24, 0),
    postGain: clamp(p.postGain, -12, 12),
  };
}

export const SOFT_CLIPPER_DEFAULT: SoftClipperParams = normalizeSoftClipperParams({
  threshold: -2,
  postGain: 0,
});

function makeSoftClipCurve(thresholdLinear: number): Float32Array<ArrayBuffer> {
  const n = 2048;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  const t = Math.max(0.1, thresholdLinear);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const ax = Math.abs(x);
    if (ax <= t) {
      curve[i] = x;
    } else {
      const sign = x < 0 ? -1 : 1;
      const over = ax - t;
      curve[i] = sign * (t + (1 - t) * Math.tanh(over / (1 - t)));
    }
  }
  return curve;
}

export class SoftClipper extends FxBase {
  readonly kind: FxKind = "softclipper";
  readonly label = "Soft Clipper";
  private shaper: WaveShaperNode;
  private postGainNode: GainNode;
  private params: SoftClipperParams;

  constructor(ctx: BaseAudioContext, params: SoftClipperParams = SOFT_CLIPPER_DEFAULT) {
    super(ctx);
    this.params = normalizeSoftClipperParams(params);
    this.shaper = this.track(ctx.createWaveShaper(), "WaveShaperNode");
    this.shaper.oversample = "4x";
    this.postGainNode = this.track(ctx.createGain(), "GainNode");

    this.input.connect(this.shaper);
    this.shaper.connect(this.postGainNode);
    this.postGainNode.connect(this.output);
    this.setEndpoints(this.shaper, this.postGainNode);

    this.apply();
  }

  private apply(): void {
    const tLinear = Math.pow(10, this.params.threshold / 20);
    this.shaper.curve = makeSoftClipCurve(tLinear);
    const postGainLinear = Math.pow(10, this.params.postGain / 20);
    this.postGainNode.gain.setTargetAtTime(postGainLinear, this.ctx.currentTime, 0.02);
  }

  setParams(p: SoftClipperParams): void {
    this.params = normalizeSoftClipperParams(p);
    this.apply();
  }

  getParams(): SoftClipperParams {
    return this.params;
  }
}

/* ================= 2. Stereo Shaper ================= */

export interface StereoShaperParams {
  width: number;      // 0 = mono, 1 = normal, 2 = super-wide
  delayMs: number;    // Haas effect delay 0..30ms
  sideHighpass: number; // Hz, mono bass frequency cutoff 20..300Hz
  phaseInvertL: boolean;
  phaseInvertR: boolean;
}

export function normalizeStereoShaperParams(p: StereoShaperParams): StereoShaperParams {
  return {
    width: clamp(p.width, 0, 2),
    delayMs: clamp(p.delayMs, 0, 30),
    sideHighpass: clamp(p.sideHighpass, 20, 400),
    phaseInvertL: p.phaseInvertL,
    phaseInvertR: p.phaseInvertR,
  };
}

export const STEREO_SHAPER_DEFAULT: StereoShaperParams = normalizeStereoShaperParams({
  width: 1,
  delayMs: 0,
  sideHighpass: 120,
  phaseInvertL: false,
  phaseInvertR: false,
});

export class StereoShaper extends FxBase {
  readonly kind: FxKind = "stereoshaper";
  readonly label = "Stereo Shaper";
  private split: ChannelSplitterNode;
  private merge: ChannelMergerNode;
  private rDelay: DelayNode;
  private midL: GainNode;
  private midR: GainNode;
  private sideL: GainNode;
  private sideR: GainNode;
  private sideFilter: BiquadFilterNode;
  private outL: GainNode;
  private outR: GainNode;
  private params: StereoShaperParams;

  constructor(ctx: BaseAudioContext, params: StereoShaperParams = STEREO_SHAPER_DEFAULT) {
    super(ctx);
    this.params = normalizeStereoShaperParams(params);

    this.split = this.track(ctx.createChannelSplitter(2), "ChannelSplitterNode");
    this.merge = this.track(ctx.createChannelMerger(2), "ChannelMergerNode");
    this.rDelay = this.track(ctx.createDelay(0.1), "DelayNode");

    this.midL = this.track(ctx.createGain(), "GainNode");
    this.midR = this.track(ctx.createGain(), "GainNode");
    this.sideL = this.track(ctx.createGain(), "GainNode");
    this.sideR = this.track(ctx.createGain(), "GainNode");
    this.sideFilter = this.track(ctx.createBiquadFilter(), "BiquadFilterNode");
    this.sideFilter.type = "highpass";

    this.outL = this.track(ctx.createGain(), "GainNode");
    this.outR = this.track(ctx.createGain(), "GainNode");

    const midBus = ctx.createGain();
    const sideBus = ctx.createGain();

    this.input.connect(this.split);
    // Left channel straight
    this.split.connect(this.midL, 0);
    this.split.connect(this.sideL, 0);

    // Right channel through Haas delay
    this.split.connect(this.rDelay, 1);
    this.rDelay.connect(this.midR);
    this.rDelay.connect(this.sideR);

    this.midL.connect(midBus);
    this.midR.connect(midBus);

    this.sideL.connect(this.sideFilter);
    this.sideR.connect(this.sideFilter);
    this.sideFilter.connect(sideBus);

    midBus.connect(this.outL);
    midBus.connect(this.outR);
    sideBus.connect(this.outL);
    sideBus.connect(this.outR);

    this.outL.connect(this.merge, 0, 0);
    this.outR.connect(this.merge, 0, 1);
    this.merge.connect(this.output);

    this.setEndpoints(this.input, this.output);
    this.apply();
  }

  private apply(): void {
    const p = this.params;
    const now = this.ctx.currentTime;
    this.rDelay.delayTime.setTargetAtTime(p.delayMs / 1000, now, 0.02);

    const signL = p.phaseInvertL ? -1 : 1;
    const signR = p.phaseInvertR ? -1 : 1;

    this.midL.gain.setTargetAtTime(0.5 * signL, now, 0.01);
    this.midR.gain.setTargetAtTime(0.5 * signR, now, 0.01);

    this.sideL.gain.setTargetAtTime(0.5 * p.width * signL, now, 0.01);
    this.sideR.gain.setTargetAtTime(-0.5 * p.width * signR, now, 0.01);

    this.sideFilter.frequency.setTargetAtTime(p.sideHighpass, now, 0.02);
  }

  setParams(p: StereoShaperParams): void {
    this.params = normalizeStereoShaperParams(p);
    this.apply();
  }

  getParams(): StereoShaperParams {
    return this.params;
  }
}

/* ================= 3. Chorus ================= */

export interface ChorusParams {
  rate: number;    // Hz, 0.1..8
  depth: number;   // ms, 0.5..10
  mix: number;     // 0..1
  voices: number;  // 1 or 2
}

export function normalizeChorusParams(p: ChorusParams): ChorusParams {
  return {
    rate: clamp(p.rate, 0.1, 8),
    depth: clamp(p.depth, 0.5, 10),
    mix: clamp(p.mix, 0, 1),
    voices: clamp(Math.round(p.voices), 1, 3),
  };
}

export const CHORUS_DEFAULT: ChorusParams = normalizeChorusParams({
  rate: 1.2,
  depth: 3.5,
  mix: 0.5,
  voices: 2,
});

export class Chorus extends FxBase {
  readonly kind: FxKind = "chorus";
  readonly label = "Vintage Chorus";
  private delayNode: DelayNode;
  private lfo: OscillatorNode;
  private lfoGain: GainNode;
  private dryGain: GainNode;
  private wetGain: GainNode;
  private params: ChorusParams;

  constructor(ctx: BaseAudioContext, params: ChorusParams = CHORUS_DEFAULT) {
    super(ctx);
    this.params = normalizeChorusParams(params);

    this.dryGain = this.track(ctx.createGain(), "GainNode");
    this.wetGain = this.track(ctx.createGain(), "GainNode");

    this.delayNode = this.track(ctx.createDelay(0.05), "DelayNode");
    this.delayNode.delayTime.value = 0.015; // 15ms center delay

    this.lfo = ctx.createOscillator();
    this.lfo.type = "sine";
    this.lfo.frequency.value = this.params.rate;

    this.lfoGain = this.track(ctx.createGain(), "GainNode");
    this.lfoGain.gain.value = (this.params.depth / 1000);

    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(this.delayNode.delayTime);

    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);

    this.input.connect(this.delayNode);
    this.delayNode.connect(this.wetGain);
    this.wetGain.connect(this.output);

    try {
      this.lfo.start();
    } catch {
      // AudioContext not yet resumed or offline
    }

    this.setEndpoints(this.input, this.output);
    this.apply();
  }

  private apply(): void {
    const p = this.params;
    const now = this.ctx.currentTime;
    this.lfo.frequency.setTargetAtTime(p.rate, now, 0.02);
    this.lfoGain.gain.setTargetAtTime(p.depth / 1000, now, 0.02);
    this.dryGain.gain.setTargetAtTime(1 - p.mix * 0.5, now, 0.02);
    this.wetGain.gain.setTargetAtTime(p.mix, now, 0.02);
  }

  setParams(p: ChorusParams): void {
    this.params = normalizeChorusParams(p);
    this.apply();
  }

  getParams(): ChorusParams {
    return this.params;
  }

  override dispose(): void {
    super.dispose();
    try {
      this.lfo.stop();
      this.lfo.disconnect();
    } catch {
      /* noop */
    }
  }
}
