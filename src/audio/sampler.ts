/* Cadence Sampler — a sample-playback instrument.
 *
 * Loads an audio file, lets the user shape it (region, loop, reverse, granular
 * time-stretch, pitch), maps it across the keyboard, layers velocity zones, and
 * slices it into triggerable segments. Playback is plain WebAudio BufferSources,
 * so it is cheap enough for many simultaneous voices on low-end hardware.
 *
 * Processing model: the *processed buffer* bakes in region + reverse + stretch.
 * Pitch (from key-mapping, global pitch-shift and velocity zones) is applied at
 * playback time via playbackRate — the classic sampler relationship. Slicing keeps
 * markers in region-relative fractions so they survive reverse/stretch. */

export type SamplerMode = "oneshot" | "sustain";
export type KeymapMode = "pitched" | "sliced";

export interface VelocityZone {
  id: string;
  lo: number; // velocity lower bound (inclusive) 0..1
  hi: number; // velocity upper bound (exclusive) 0..1
  pitchOffset: number; // semitones added for this zone
  gain: number; // amplitude multiplier 0..1
  cutoff: number; // lowpass Hz, 0 = no filter
}

export interface SamplerParams {
  mode: SamplerMode;
  keymap: KeymapMode;
  baseNote: number; // midi note that plays the sample at natural pitch
  pitchShift: number; // semitones
  stretch: number; // 1 = original; >1 longer; <1 shorter (pitch preserved)
  reverse: boolean;
  loop: boolean;
  loopStart: number; // 0..1 (region-relative, forward orientation)
  loopEnd: number; // 0..1
  regionStart: number; // 0..1 of the raw sample
  regionEnd: number; // 0..1
}

export interface SampleInfo {
  name: string;
  duration: number; // seconds (raw)
  sampleRate: number;
  channels: number;
  frames: number;
}

interface Voice {
  src: AudioBufferSourceNode;
  amp: GainNode;
  startCtxTime: number;
  duration: number; // approximate audible seconds (for playhead)
}

export const DEFAULT_PARAMS: SamplerParams = {
  mode: "sustain",
  keymap: "pitched",
  baseNote: 60,
  pitchShift: 0,
  stretch: 1,
  reverse: false,
  loop: true,
  loopStart: 0,
  loopEnd: 1,
  regionStart: 0,
  regionEnd: 1,
};

export const DEFAULT_ZONES: VelocityZone[] = [
  { id: "z-soft", lo: 0, hi: 0.34, pitchOffset: 0, gain: 0.55, cutoff: 2400 },
  { id: "z-mid", lo: 0.34, hi: 0.67, pitchOffset: 0, gain: 0.8, cutoff: 0 },
  { id: "z-loud", lo: 0.67, hi: 1.01, pitchOffset: 0, gain: 1, cutoff: 0 },
];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const semisToRate = (s: number) => Math.pow(2, s / 12);

let zoneCounter = 0;
const zid = () => `z-${++zoneCounter}`;

/* ---------------- DSP helpers ---------------- */

function hann(grain: number): Float32Array {
  const w = new Float32Array(grain);
  const denom = Math.max(1, grain - 1);
  for (let i = 0; i < grain; i++) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / denom));
  return w;
}

function extractRegion(input: AudioBuffer, ctx: BaseAudioContext, a: number, b: number): AudioBuffer {
  const s = Math.floor(clamp01(a) * input.length);
  const e = Math.max(s + 1, Math.ceil(clamp01(b) * input.length));
  const len = e - s;
  const out = ctx.createBuffer(input.numberOfChannels, len, input.sampleRate);
  for (let ch = 0; ch < input.numberOfChannels; ch++) {
    out.copyToChannel(input.getChannelData(ch).subarray(s, e), ch);
  }
  return out;
}

function reverseBuffer(input: AudioBuffer, ctx: BaseAudioContext): AudioBuffer {
  const out = ctx.createBuffer(input.numberOfChannels, input.length, input.sampleRate);
  for (let ch = 0; ch < input.numberOfChannels; ch++) {
    const src = input.getChannelData(ch);
    const dst = out.getChannelData(ch);
    const n = src.length;
    for (let i = 0; i < n; i++) dst[i] = src[n - 1 - i];
  }
  return out;
}

/** Granular overlap-add stretch: changes duration, preserves pitch. O(n). */
function granularStretch(input: AudioBuffer, ctx: BaseAudioContext, factor: number): AudioBuffer {
  if (Math.abs(factor - 1) < 0.005) return input;
  const sr = input.sampleRate;
  const inLen = input.length;
  const outLen = Math.max(64, Math.round(inLen * factor));
  const out = ctx.createBuffer(input.numberOfChannels, outLen, sr);
  const grain = Math.max(64, Math.round(0.08 * sr));
  const hopOut = Math.max(1, Math.round(grain * 0.5));
  const win = hann(grain);

  for (let ch = 0; ch < input.numberOfChannels; ch++) {
    const src = input.getChannelData(ch);
    const dst = out.getChannelData(ch);
    for (let outPos = 0; outPos < outLen; outPos += hopOut) {
      const srcPos = Math.round(outPos / factor);
      const lim = Math.min(grain, outLen - outPos);
      for (let i = 0; i < lim; i++) {
        const sp = srcPos + i;
        if (sp >= inLen) break;
        dst[outPos + i] += src[sp] * win[i];
      }
    }
  }
  return out;
}

/** Energy-flux onset detection → proposed slice fractions (stretch goal). */
export function detectTransients(buf: AudioBuffer, sensitivity = 1): number[] {
  const data = new Float32Array(buf.length);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < d.length; i++) data[i] += d[i] / buf.numberOfChannels;
  }
  const hop = 512;
  const frames = Math.floor(data.length / hop);
  if (frames < 4) return [];
  const energy = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    const base = f * hop;
    for (let i = 0; i < hop; i++) { const v = data[base + i]; sum += v * v; }
    energy[f] = sum;
  }
  const flux = new Float32Array(frames);
  for (let f = 1; f < frames; f++) flux[f] = Math.max(0, energy[f] - energy[f - 1]);

  let mean = 0;
  for (let f = 0; f < frames; f++) mean += flux[f];
  mean /= frames;
  const threshold = mean * (2.6 - sensitivity); // higher sensitivity → lower threshold

  const minGap = Math.max(2, Math.round(0.06 * buf.sampleRate / hop)); // ≥60 ms apart
  const picks: number[] = [];
  let last = -minGap;
  for (let f = 2; f < frames - 1; f++) {
    if (flux[f] > threshold && flux[f] >= flux[f - 1] && flux[f] >= flux[f + 1] && f - last >= minGap) {
      picks.push(f / frames);
      last = f;
    }
  }
  // drop a marker too close to the very start
  return picks.filter((p) => p > 0.01 && p < 0.99);
}

/* ---------------- the instrument ---------------- */

export class SamplerInstrument {
  private ctx: AudioContext;
  private dest: AudioNode;
  private raw: AudioBuffer | null = null;
  private processed: AudioBuffer | null = null;
  private voices = new Map<number, Voice>();
  private lastVoice: Voice | null = null;

  params: SamplerParams = { ...DEFAULT_PARAMS };
  zones: VelocityZone[] = DEFAULT_ZONES.map((z) => ({ ...z }));
  slices: number[] = []; // region-relative, sorted, exclusive of 0/1
  info: SampleInfo | null = null;

  constructor(ctx: AudioContext, dest: AudioNode) {
    this.ctx = ctx;
    this.dest = dest;
  }

  get hasSample(): boolean {
    return this.processed !== null;
  }

  async loadFile(file: File): Promise<SampleInfo> {
    const ab = await file.arrayBuffer();
    const buf = await this.ctx.decodeAudioData(ab);
    this.raw = buf;
    this.info = {
      name: file.name,
      duration: buf.duration,
      sampleRate: buf.sampleRate,
      channels: buf.numberOfChannels,
      frames: buf.length,
    };
    this.slices = [];
    this.rebuild();
    return this.info;
  }

  /** Re-render the processed buffer from current params. Synchronous & O(n). */
  rebuild(): void {
    if (!this.raw) return;
    let b = extractRegion(this.raw, this.ctx, this.params.regionStart, this.params.regionEnd);
    if (this.params.reverse) b = reverseBuffer(b, this.ctx);
    if (this.params.stretch !== 1) b = granularStretch(b, this.ctx, this.params.stretch);
    this.processed = b;
  }

  /** Downsampled |peak| per bucket for the waveform view. */
  computePeaks(buckets: number): number[] {
    const src = this.raw;
    if (!src) return new Array(buckets).fill(0);
    const data = src.getChannelData(0);
    const per = Math.max(1, Math.floor(src.length / buckets));
    const out = new Array(buckets).fill(0);
    for (let i = 0; i < buckets; i++) {
      let m = 0;
      const base = i * per;
      for (let j = 0; j < per; j += 4) {
        const v = Math.abs(data[base + j] ?? 0);
        if (v > m) m = v;
      }
      out[i] = m;
    }
    return out;
  }

  autoSlice(sensitivity = 1): number[] {
    if (!this.raw) return [];
    return detectTransients(this.raw, sensitivity);
  }

  private zoneFor(vel: number): VelocityZone {
    for (const z of this.zones) if (vel >= z.lo && vel < z.hi) return z;
    return this.zones[this.zones.length - 1];
  }

  /** Map a region-relative marker to processed-buffer seconds (handles reverse). */
  private markerToSec(frac: number): number {
    const len = this.processed?.duration ?? 0;
    const f = this.params.reverse ? 1 - clamp01(frac) : clamp01(frac);
    return f * len;
  }

  noteOn(midi: number, vel: number): void {
    const buf = this.processed;
    if (!buf) return;
    if (this.voices.has(midi)) this.noteOff(midi);

    const zone = this.zoneFor(vel);
    const p = this.params;

    // which slice (if sliced) — key index from baseNote
    let startSec = 0;
    let endSec = buf.duration;
    let sliceIdx = -1;
    if (p.keymap === "sliced" && this.slices.length > 0) {
      const bounds = [0, ...this.slices, 1];
      sliceIdx = midi - p.baseNote;
      if (sliceIdx < 0 || sliceIdx >= this.slices.length + 1) sliceIdx = ((sliceIdx % (bounds.length - 1)) + (bounds.length - 1)) % (bounds.length - 1);
      const a = bounds[sliceIdx];
      const b = bounds[sliceIdx + 1];
      // order in processed time depends on reverse
      const ta = this.markerToSec(a);
      const tb = this.markerToSec(b);
      startSec = Math.min(ta, tb);
      endSec = Math.max(ta, tb);
    }

    // pitch: key-mapping (pitched) + global shift + zone offset
    let semis = p.pitchShift + zone.pitchOffset;
    if (p.keymap === "pitched") semis += midi - p.baseNote;
    const rate = Math.min(8, Math.max(0.0625, semisToRate(semis)));

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;

    let node: AudioNode = src;
    if (zone.cutoff > 0) {
      const filt = this.ctx.createBiquadFilter();
      filt.type = "lowpass";
      filt.frequency.value = zone.cutoff;
      src.connect(filt);
      node = filt;
    }
    const amp = this.ctx.createGain();
    amp.gain.value = 0;
    node.connect(amp);
    amp.connect(this.dest);

    const sustain = p.mode === "sustain";
    if (sustain && p.loop && p.keymap === "pitched") {
      const ls = Math.min(this.markerToSec(p.loopStart), this.markerToSec(p.loopEnd));
      const le = Math.max(this.markerToSec(p.loopStart), this.markerToSec(p.loopEnd));
      if (le - ls > 0.01) {
        src.loop = true;
        src.loopStart = ls;
        src.loopEnd = le;
      }
    }

    const now = this.ctx.currentTime;
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.linearRampToValueAtTime(Math.max(0.0001, vel * zone.gain), now + 0.004);

    const durSec = (endSec - startSec) / rate;
    src.start(now, startSec, sustain ? undefined : endSec - startSec);

    this.voices.set(midi, { src, amp, startCtxTime: now, duration: durSec });
    this.lastVoice = this.voices.get(midi)!;
    this.onTrigger?.(sliceIdx, vel);
  }

  noteOff(midi: number): void {
    const v = this.voices.get(midi);
    if (!v) return;
    const now = this.ctx.currentTime;
    v.amp.gain.cancelScheduledValues(now);
    v.amp.gain.setValueAtTime(Math.max(v.amp.gain.value, 0.0001), now);
    v.amp.gain.linearRampToValueAtTime(0.0001, now + 0.06);
    try { v.src.stop(now + 0.08); } catch { /* already stopped */ }
    this.voices.delete(midi);
  }

  allNotesOff(): void {
    for (const m of Array.from(this.voices.keys())) this.noteOff(m);
    this.lastVoice = null;
  }

  /** Fire a slice (or the whole sample) once for auditioning. */
  previewSlice(sliceIdx: number): void {
    const base = this.params.baseNote;
    const midi = this.params.keymap === "sliced" ? base + sliceIdx : base;
    this.noteOn(midi, 0.9);
    window.setTimeout(() => this.noteOff(midi), 220);
  }

  get activeVoices(): number {
    return this.voices.size;
  }

  /** Playhead 0..1 of the most recent voice, or -1 when idle. */
  getPlayhead(): number {
    const v = this.lastVoice;
    if (!v || this.voices.size === 0) {
      if (v) {
        const el = (this.ctx.currentTime - v.startCtxTime) / Math.max(0.001, v.duration);
        return el >= 1 ? -1 : Math.min(1, el);
      }
      return -1;
    }
    const el = (this.ctx.currentTime - v.startCtxTime) / Math.max(0.001, v.duration);
    return el >= 1 ? -1 : Math.min(1, el);
  }

  /** Optional hook the UI sets to flash the triggered slice. */
  onTrigger: ((sliceIdx: number, vel: number) => void) | null = null;
}

export { zid, clamp01 };
