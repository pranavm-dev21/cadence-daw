import { VocalProcessor } from "./vocal";
import type { VocalSettings } from "../core/vocal";
/* Mixer engine — the channel-strip / bus / metering core.
 *
 * Topology per channel (fixed signal-flow order, per spec):
 *
 *     input → [gate] → INSERTS(filter→shaper) → PAN → VOLUME(fader) → POST-FADER
 *                                                                          ├─ SEND(reverb) → Reverb return ─┐
 *                                                                          ├─ SEND(delay)  → Delay  return ─┤→ MASTER BUS
 *                                                                          └────────────────────────────────┤   (sum → comp → analyser → out)
 *
 *  - INSERTS are a per-channel effect chain (lowpass + waveshaper drive today;
 *    the chain is an explicit ordered list so more inserts can be appended).
 *  - SENDS tap POST-FADER (after volume) and feed shared RETURN buses.
 *  - The MASTER bus sums every channel's post-fader plus every return output.
 *  - Meters sit on the post-fader tap, so they reflect volume AND mute/solo.
 *
 * Solo semantics (single source of truth, shared with the note scheduler):
 * soloing any track audibly silences every non-soloed track by zeroing its
 * input gate — the track's own `mute` flag is NEVER written, so un-soloing
 * restores the exact prior mute state.
 *
 * Everything here is stateless with respect to the project: the mixer only
 * mirrors what the command bus already validated. It never mutates Project. */

import { AutomationParam, Project, Track } from "../types";
import { makeDriveCurve, makeImpulse } from "./synth";
import { estimateGraphCost } from "./fx";

const clampF = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/* ---------------- solo logic (shared with the scheduler) ---------------- */

export function soloActive(tracks: Track[]): boolean {
  for (let i = 0; i < tracks.length; i++) if (tracks[i].solo) return true;
  return false;
}

/** Audibility of `t` given whether any track is soloed. Never mutates anything. */
export function isAudible(t: Track, anySolo: boolean): boolean {
  return anySolo ? t.solo : !t.mute;
}

/* ---------------- return bus definitions (shared live / offline / UI) ---------------- */

export interface ReturnDef { id: string; name: string; }
export const RETURN_DEFS: ReturnDef[] = [
  { id: "reverb", name: "Reverb" },
  { id: "delay", name: "Delay" },
];

/* ---------------- metering ---------------- */

export interface MeterReading { peak: number; rms: number; }
interface MeterState { peakHold: number; lastT: number; }

/** Peak (with ~280 ms hold/decay) + RMS from a pre-allocated time-domain buffer. */
function readMeter(analyser: AnalyserNode, buf: Uint8Array, s: MeterState): MeterReading {
  analyser.getByteTimeDomainData(buf as Uint8Array<ArrayBuffer>);
  let sum = 0;
  let peak = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = (buf[i] - 128) / 128;
    sum += v * v;
    const a = v < 0 ? -v : v;
    if (a > peak) peak = a;
  }
  const now = performance.now();
  const dt = now - s.lastT;
  s.lastT = now;
  s.peakHold = Math.max(peak, s.peakHold * Math.exp(-dt / 280));
  return { peak: s.peakHold, rms: Math.sqrt(sum / buf.length) };
}

/* ---------------- shared topology factories (live + offline use these) ---------------- */

export interface ChannelNodes {
  vocal?: VocalProcessor;
  input: GainNode;      // voices connect here
  gate: GainNode;       // mute/solo audibility (1 or 0)
  filter: BiquadFilterNode;
  shaper: WaveShaperNode;
  pan: StereoPannerNode;
  fader: GainNode;      // channel volume
  postFader: GainNode;  // meter + send tap point
  sends: Map<string, GainNode>; // returnId → send amount
}

export function buildChannel(
  ctx: BaseAudioContext,
  dest: AudioNode,
  returns: { id: string; input: AudioNode }[],
  drive: number,
  vocalSettings?: VocalSettings,
): ChannelNodes {
  const input = ctx.createGain();
  const gate = ctx.createGain();
  gate.gain.value = 1;

  // insert chain: lowpass → waveshaper drive
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 18000;
  const shaper = ctx.createWaveShaper();
  shaper.curve = makeDriveCurve(drive);
  shaper.oversample = "2x";

  const pan = ctx.createStereoPanner();
  const fader = ctx.createGain();
  const postFader = ctx.createGain();
  postFader.gain.value = 1;

  // inserts → pan → volume → (sends + master)
  input.connect(gate);
  gate.connect(filter);
  filter.connect(shaper);
  shaper.connect(pan);
  pan.connect(fader);
  fader.connect(postFader);
  postFader.connect(dest);

  const sends = new Map<string, GainNode>();
  for (const r of returns) {
    const s = ctx.createGain();
    s.gain.value = 0;
    postFader.connect(s);
    s.connect(r.input);
    sends.set(r.id, s);
  }

  const channel = { input, gate, filter, shaper, pan, fader, postFader, sends };
  configureVocal(channel, vocalSettings);
  return channel;
}

export function configureVocal(ch: ChannelNodes, settings?: VocalSettings): void {
  if (settings) {
    if (!ch.vocal) {
      ch.vocal = new VocalProcessor(ch.input.context, settings);
      ch.gate.disconnect(); ch.gate.connect(ch.vocal.input); ch.vocal.output.connect(ch.filter);
    } else ch.vocal.configure(settings);
  } else if (ch.vocal) {
    ch.gate.disconnect(); ch.vocal.dispose(); ch.vocal = undefined; ch.gate.connect(ch.filter);
  }
}

export interface ReturnNodes { id: string; name: string; input: GainNode; output: GainNode; }

/** Builds a return bus; `output` is left unconnected — caller wires it to the master. */
export function buildReturn(ctx: BaseAudioContext, id: string, name: string): ReturnNodes {
  const input = ctx.createGain();
  const output = ctx.createGain();
  output.gain.value = 1;

  if (id === "reverb") {
    const conv = ctx.createConvolver();
    conv.buffer = makeImpulse(ctx);
    const wet = ctx.createGain();
    wet.gain.value = 0.9;
    input.connect(conv);
    conv.connect(wet);
    wet.connect(output);
  } else {
    const delay = ctx.createDelay(1.5);
    delay.delayTime.value = 0.29;
    const fb = ctx.createGain();
    fb.gain.value = 0.34;
    const wet = ctx.createGain();
    wet.gain.value = 0.8;
    input.connect(delay);
    delay.connect(fb);
    fb.connect(delay);
    delay.connect(wet);
    wet.connect(output);
  }
  return { id, name, input, output };
}

/** Master bus sum + glue compressor. `comp` is left unconnected onward — caller wires it. */
export function buildMaster(ctx: BaseAudioContext): { busIn: GainNode; comp: DynamicsCompressorNode } {
  const busIn = ctx.createGain();
  busIn.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -10;
  comp.knee.value = 22;
  comp.ratio.value = 3.5;
  comp.attack.value = 0.004;
  comp.release.value = 0.18;
  busIn.connect(comp);
  return { busIn, comp };
}

/* ---------------- live mixer engine ---------------- */

interface LiveChannel extends ChannelNodes {
  analyser: AnalyserNode;
  levelBuf: Uint8Array;
  meter: MeterState;
  lastDrive: number;
}

/** Node kinds that make up a channel's fixed signal path (for cost reporting). */
const CHANNEL_PATH_KINDS = [
  "GainNode", // input
  "GainNode", // gate
  "BiquadFilterNode", // insert lowpass
  "WaveShaperNode", // insert drive
  "StereoPannerNode", // pan
  "GainNode", // fader
  "GainNode", // postFader
  "GainNode", "GainNode", // sends
  "AnalyserNode", // meter tap
];
const RETURN_KINDS: Record<string, string[]> = {
  reverb: ["GainNode", "ConvolverNode", "GainNode", "AnalyserNode"],
  delay: ["GainNode", "DelayNode", "GainNode", "GainNode", "AnalyserNode"],
};
const MASTER_KINDS = ["GainNode", "DynamicsCompressorNode", "AnalyserNode"];

interface LiveReturn extends ReturnNodes {
  analyser: AnalyserNode;
  levelBuf: Uint8Array;
  meter: MeterState;
}

export interface ReturnInfo extends ReturnDef { level: number; }

export class MixerEngine {
  private channels = new Map<string, LiveChannel>();
  private returns: LiveReturn[];
  private masterIn: GainNode;
  private masterAnalyser: AnalyserNode;
  private masterBuf = new Uint8Array(512);
  private masterMeter: MeterState = { peakHold: 0, lastT: performance.now() };

  constructor(private ctx: AudioContext) {
    const master = buildMaster(ctx);
    this.masterIn = master.busIn;
    this.masterAnalyser = ctx.createAnalyser();
    this.masterAnalyser.fftSize = 2048;
    master.comp.connect(this.masterAnalyser);
    this.masterAnalyser.connect(ctx.destination);

    this.returns = RETURN_DEFS.map((def) => {
      const r = buildReturn(ctx, def.id, def.name);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      r.output.connect(analyser);
      analyser.connect(this.masterIn);
      return { ...r, analyser, levelBuf: new Uint8Array(512), meter: { peakHold: 0, lastT: performance.now() } };
    });
  }

  /** Voices route here; falls back to the master bus input. */
  getInput(trackId: string): AudioNode | null {
    return this.channels.get(trackId)?.input ?? null;
  }

  get masterInput(): GainNode {
    return this.masterIn;
  }

  /* ---------------- project sync (mirrors the command-validated state) ---------------- */

  setProject(p: Project): void {
    const alive = new Set(p.tracks.map((t) => t.id));
    for (const [id, ch] of this.channels) {
      if (!alive.has(id)) {
        try { ch.input.disconnect(); ch.postFader.disconnect(); ch.analyser.disconnect(); } catch { /* noop */ }
        this.channels.delete(id);
      }
    }
    for (const t of p.tracks) {
      let ch = this.channels.get(t.id);
      if (!ch) {
        ch = this.buildChannel(t.fx.drive);
        this.channels.set(t.id, ch);
      }
      this.applyParams(t, ch);
    }
    this.applyAudibility(p.tracks);
  }

  private buildChannel(drive: number): LiveChannel {
    const ctx = this.ctx;
    const base = buildChannel(ctx, this.masterIn, this.returns, drive);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    base.postFader.connect(analyser); // meter tap is read-only (analyser has no output wiring)
    return { ...base, analyser, levelBuf: new Uint8Array(512), meter: { peakHold: 0, lastT: performance.now() }, lastDrive: drive };
  }

  private applyParams(t: Track, ch: LiveChannel): void {
    configureVocal(ch, t.fx.vocalBypass ? undefined : t.fx.vocal);
    const now = this.ctx.currentTime;
    ch.fader.gain.setTargetAtTime(t.volume, now, 0.02);
    ch.pan.pan.setTargetAtTime(t.pan, now, 0.02);
    ch.filter.frequency.setTargetAtTime(t.fx.cutoff, now, 0.02);
    ch.sends.get("reverb")?.gain.setTargetAtTime(t.fx.reverb * 0.7, now, 0.02);
    ch.sends.get("delay")?.gain.setTargetAtTime(t.fx.delay * 0.55, now, 0.02);
    if (Math.abs(t.fx.drive - ch.lastDrive) > 0.005) {
      ch.shaper.curve = makeDriveCurve(t.fx.drive);
      ch.lastDrive = t.fx.drive;
    }
  }

  /**
   * Apply one automated parameter value at an exact audio-clock instant.
   * Shared by the real-time engine (per scheduled step) and the offline renderer,
   * so both modulate the identical node graph identically. Uses a short linear
   * ramp to the value so consecutive steps join smoothly without zipper noise,
   * while remaining phase-accurate (the value is reached exactly at `time+dur`).
   */
  applyAutomation(trackId: string, param: AutomationParam, realValue: number, time: number, dur: number): void {
    const ch = this.channels.get(trackId);
    if (!ch) return;
    const v = realValue;
    switch (param) {
      case "volume":
        ch.fader.gain.setValueAtTime(v, time);
        ch.fader.gain.linearRampToValueAtTime(v, time + Math.max(0.001, dur));
        break;
      case "pan":
        ch.pan.pan.setValueAtTime(clampF(v, -1, 1), time);
        ch.pan.pan.linearRampToValueAtTime(clampF(v, -1, 1), time + Math.max(0.001, dur));
        break;
      case "cutoff":
        ch.filter.frequency.setValueAtTime(clampF(v, 40, 20000), time);
        ch.filter.frequency.linearRampToValueAtTime(clampF(v, 40, 20000), time + Math.max(0.001, dur));
        break;
      case "drive":
        if (Math.abs(v - ch.lastDrive) > 0.005) {
          ch.shaper.curve = makeDriveCurve(clampF(v, 0, 1));
          ch.lastDrive = v;
        }
        break;
      case "reverb":
        ch.sends.get("reverb")?.gain.setValueAtTime(clampF(v, 0, 1) * 0.7, time);
        ch.sends.get("reverb")?.gain.linearRampToValueAtTime(clampF(v, 0, 1) * 0.7, time + Math.max(0.001, dur));
        break;
      case "delay":
        ch.sends.get("delay")?.gain.setValueAtTime(clampF(v, 0, 1) * 0.55, time);
        ch.sends.get("delay")?.gain.linearRampToValueAtTime(clampF(v, 0, 1) * 0.55, time + Math.max(0.001, dur));
        break;
    }
  }

  /** Solo-safe mute: gates audibility without ever writing a track's mute flag. */
  private applyAudibility(tracks: Track[]): void {
    const anySolo = soloActive(tracks);
    const now = this.ctx.currentTime;
    for (const t of tracks) {
      const ch = this.channels.get(t.id);
      if (!ch) continue;
      const target = isAudible(t, anySolo) ? 1 : 0;
      ch.gate.gain.setTargetAtTime(target, now, 0.015);
    }
  }

  /* ---------------- metering (allocation-free, pre-allocated buffers) ---------------- */

  getChannelMeter(trackId: string): MeterReading {
    const ch = this.channels.get(trackId);
    if (!ch) return { peak: 0, rms: 0 };
    return readMeter(ch.analyser, ch.levelBuf, ch.meter);
  }

  getMasterMeter(): MeterReading {
    return readMeter(this.masterAnalyser, this.masterBuf, this.masterMeter);
  }

  getReturnMeter(returnId: string): MeterReading {
    const r = this.returns.find((x) => x.id === returnId);
    if (!r) return { peak: 0, rms: 0 };
    return readMeter(r.analyser, r.levelBuf, r.meter);
  }

  getReturnInfos(): ReturnInfo[] {
    return this.returns.map((r) => ({ id: r.id, name: r.name, level: this.getReturnMeter(r.id).rms }));
  }

  getSpectrum(out: Uint8Array): void {
    this.masterAnalyser.getByteFrequencyData(out as Uint8Array<ArrayBuffer>);
  }

  /* ---------------- CPU cost (relative load per channel) ----------------
   * Uses the shared FX node-cost model so these figures are comparable with the
   * FX framework's per-effect costs. A channel's load is its fixed signal path
   * plus a proportional share of each expensive shared return (the convolver
   * reverb and the delay line), weighted by how hard the channel drives them.
   * That's what makes load *vary* per channel: a drum kit leaning on the reverb
   * shows hotter than a dry bass. */

  /** Relative DSP load of one channel. */
  getChannelCpuCost(trackId: string): number {
    const ch = this.channels.get(trackId);
    if (!ch) return 0;
    let cost = estimateGraphCost(CHANNEL_PATH_KINDS);
    if (this.channels.get(trackId)?.vocal) cost += estimateGraphCost(["BiquadFilterNode", "BiquadFilterNode", "DynamicsCompressorNode", "GainNode"]);
    const rev = ch.sends.get("reverb")?.gain.value ?? 0;
    const dly = ch.sends.get("delay")?.gain.value ?? 0;
    cost += rev * estimateGraphCost(RETURN_KINDS.reverb);
    cost += dly * estimateGraphCost(RETURN_KINDS.delay);
    return cost;
  }

  /** Relative load of shared infrastructure (returns + master). */
  getBusCpuCost(): number {
    let sum = estimateGraphCost(MASTER_KINDS);
    for (const r of this.returns) sum += estimateGraphCost(RETURN_KINDS[r.id] ?? []);
    return sum;
  }

  /** Total mixer load: every channel + returns + master. */
  getTotalCpuCost(): number {
    let sum = this.getBusCpuCost();
    for (const [id] of this.channels) sum += this.getChannelCpuCost(id);
    return sum;
  }
}


