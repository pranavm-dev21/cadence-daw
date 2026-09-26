/* Cadence SubSynth — a lightweight subtractive synthesizer.
 *
 * Architecture (per voice):
 *   [unison detuned osc1+osc2 pairs] → FILTER(type,cutoff,res) → AMP env → out
 *        └ LFO (routable to pitch or amplitude)
 *        └ FILTER env (ADSR) modulates cutoff
 *
 * The DSP is deliberately a thin native-WebAudio node graph: oscillators, one
 * biquad filter, one amp-envelope gain and one LFO per voice. Unison voices share
 * a single filter + amp envelope (classic supersaw), so 8-way unison costs only a
 * handful of extra oscillators. Native WebAudio runs on the platform audio thread
 * (off the JS heap), which is what lets 16+ voices stay dropout-free on a 4-core
 * low-end CPU. The bundled profiler measures the per-voice cost so headroom is a
 * reported number, not an assumption. */

import { noiseBuffer, noteFreq } from "./synth";

export type Waveform = "sine" | "triangle" | "sawtooth" | "square" | "noise";
export type FilterType = "lowpass" | "highpass" | "bandpass";
export type LfoTarget = "pitch" | "amplitude";
export type PlayMode = "mono" | "poly";
export type PatchCategory = "bass" | "pad" | "lead" | "pluck";

export interface AdsrParams {
  attack: number; // s
  decay: number; // s
  sustain: number; // 0..1
  release: number; // s
}

export interface SynthPatch {
  name: string;
  category: PatchCategory;
  mode: PlayMode;
  glide: number; // s — mono portamento

  osc1Wave: Waveform;
  osc1Detune: number; // cents
  osc2Wave: Waveform;
  osc2Detune: number; // cents
  oscMix: number; // 0..1 osc2 level

  unison: number; // 1..8
  unisonSpread: number; // cents total spread

  filterType: FilterType;
  cutoff: number; // Hz
  resonance: number; // Q

  amp: AdsrParams;
  ampLevel: number; // 0..1

  filterEnv: AdsrParams;
  filterEnvAmount: number; // Hz added at envelope peak

  lfoRate: number; // Hz
  lfoDepth: number; // 0..1 (scaled per target)
  lfoTarget: LfoTarget;
}

/* ---------------- internal voice ---------------- */

interface OscUnit {
  src: AudioScheduledSourceNode;
  detune: AudioParam | null; // null for noise
  freq: AudioParam | null; // null for noise
}

export interface VoiceHandle {
  oscs: OscUnit[];
  amp: GainNode;
  filter: BiquadFilterNode;
  out: GainNode;
  /** Release the amp envelope and stop all sources. Safe to call twice. */
  release: (when: number) => void;
  /** Glide every pitched oscillator toward `freq` over `glide` seconds. */
  glideTo: (freq: number, glide: number, when: number) => void;
  /** Re-trigger the amp envelope (used by mono retrigger). */
  retrigger: (peak: number, when: number) => void;
}

const clampF = (f: number) => Math.min(20000, Math.max(20, f));

function makeOsc(ctx: BaseAudioContext, wave: Waveform, freq: number, detuneCents: number, time: number): OscUnit {
  if (wave === "noise") {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    src.loop = true;
    src.start(time);
    return { src, detune: null, freq: null };
  }
  const src = ctx.createOscillator();
  src.type = wave;
  src.frequency.value = freq;
  src.detune.value = detuneCents;
  src.start(time);
  return { src, detune: src.detune, freq: src.frequency };
}

/**
 * Build and schedule one voice. `dur` finite → self-terminating note (playback /
 * profiling); `hold` → sustains until `release()` is called (interactive keys).
 */
export function buildVoice(
  ctx: BaseAudioContext,
  dest: AudioNode,
  p: SynthPatch,
  midi: number,
  vel: number,
  time: number,
  opts: { dur?: number; hold?: boolean },
): VoiceHandle {
  const freq = noteFreq(midi);
  const peak = Math.max(0.0001, vel * p.ampLevel);
  const release = p.amp.release;
  const noteEnd = opts.hold
    ? Number.POSITIVE_INFINITY
    : time + Math.max(opts.dur ?? 0.2, p.amp.attack + 0.02);

  const out = ctx.createGain();
  out.gain.value = 1;
  out.connect(dest);

  const amp = ctx.createGain();
  amp.gain.value = 0;
  amp.connect(out);

  const filter = ctx.createBiquadFilter();
  filter.type = p.filterType;
  filter.frequency.value = clampF(p.cutoff);
  filter.Q.value = p.resonance;
  filter.connect(amp);

  const oscs: OscUnit[] = [];
  const n = Math.max(1, Math.min(8, Math.round(p.unison)));
  for (let i = 0; i < n; i++) {
    const spread = n === 1 ? 0 : (i / (n - 1)) * 2 - 1; // -1..1
    const offset = spread * (p.unisonSpread / 2);
    const o1 = makeOsc(ctx, p.osc1Wave, freq, p.osc1Detune + offset, time);
    const g1 = ctx.createGain();
    g1.gain.value = 1 / Math.sqrt(n);
    o1.src.connect(g1);
    g1.connect(filter);
    oscs.push(o1);

    const o2 = makeOsc(ctx, p.osc2Wave, freq, p.osc2Detune + offset, time);
    const g2 = ctx.createGain();
    g2.gain.value = p.oscMix / Math.sqrt(n);
    o2.src.connect(g2);
    g2.connect(filter);
    oscs.push(o2);
  }

  /* ---- amp envelope (ADSR) ---- */
  const env = amp.gain;
  env.setValueAtTime(0.0001, time);
  env.linearRampToValueAtTime(peak, time + p.amp.attack);
  env.linearRampToValueAtTime(Math.max(0.0001, peak * p.amp.sustain), time + p.amp.attack + p.amp.decay);
  if (!opts.hold) {
    env.setValueAtTime(Math.max(0.0001, peak * p.amp.sustain), noteEnd);
    env.linearRampToValueAtTime(0.0001, noteEnd + release);
  }

  /* ---- filter envelope (ADSR → cutoff) ---- */
  const fe = p.filterEnv;
  const base = p.cutoff;
  const amt = p.filterEnvAmount;
  const ff = filter.frequency;
  ff.setValueAtTime(clampF(base), time);
  ff.linearRampToValueAtTime(clampF(base + amt), time + fe.attack);
  ff.linearRampToValueAtTime(clampF(base + amt * fe.sustain), time + fe.attack + fe.decay);
  if (!opts.hold) {
    ff.setValueAtTime(clampF(base + amt * fe.sustain), noteEnd);
    ff.linearRampToValueAtTime(clampF(base), noteEnd + release);
  }

  /* ---- LFO → pitch | amplitude ---- */
  if (p.lfoRate > 0.01 && p.lfoDepth > 0.001) {
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = p.lfoRate;
    const lfoGain = ctx.createGain();
    if (p.lfoTarget === "pitch") {
      lfoGain.gain.value = p.lfoDepth * 60; // cents of vibrato
      for (const o of oscs) if (o.detune) lfoGain.connect(o.detune);
    } else {
      lfoGain.gain.value = p.lfoDepth * 0.4; // fraction of tremolo
      lfoGain.connect(env);
    }
    lfo.connect(lfoGain);
    lfo.start(time);
    const lfoEnd = opts.hold ? time + 7200 : noteEnd + release + 0.2;
    lfo.stop(lfoEnd);
  }

  /* ---- stop sources ---- */
  const stopAt = opts.hold ? time + 7200 : noteEnd + release + 0.1;
  for (const o of oscs) o.src.stop(stopAt);

  const handle: VoiceHandle = {
    oscs,
    amp,
    filter,
    out,
    release: (when: number) => {
      env.cancelScheduledValues(when);
      env.setValueAtTime(Math.max(env.value, 0.0001), when);
      env.linearRampToValueAtTime(0.0001, when + release);
      for (const o of oscs) {
        try {
          o.src.stop(when + release + 0.1);
        } catch {
          /* already stopped */
        }
      }
    },
    glideTo: (f: number, glide: number, when: number) => {
      const tc = Math.max(0.003, glide / 3);
      for (const o of oscs) {
        if (!o.freq) continue;
        o.freq.cancelScheduledValues(when);
        o.freq.setTargetAtTime(f, when, tc);
      }
    },
    retrigger: (pk: number, when: number) => {
      env.cancelScheduledValues(when);
      env.setValueAtTime(Math.max(env.value, 0.0001), when);
      env.linearRampToValueAtTime(pk, when + p.amp.attack);
      env.linearRampToValueAtTime(Math.max(0.0001, pk * p.amp.sustain), when + p.amp.attack + p.amp.decay);
    },
  };
  return handle;
}

/** Finite, self-terminating note — used by the profiler and any scheduled path. */
export function scheduleNote(
  ctx: BaseAudioContext,
  dest: AudioNode,
  p: SynthPatch,
  midi: number,
  vel: number,
  time: number,
  dur: number,
): void {
  buildVoice(ctx, dest, p, midi, vel, time, { dur });
}

/* ---------------- interactive engine (mono/poly + glide) ---------------- */

export class SubSynth {
  private ctx: AudioContext | null = null;
  private dest: AudioNode | null = null;
  private patch: SynthPatch;
  private poly = new Map<number, VoiceHandle>();
  private mono: VoiceHandle | null = null;
  private monoMidi = -1;
  private _peak = 0;

  constructor(patch: SynthPatch) {
    this.patch = patch;
  }

  setPatch(p: SynthPatch): void {
    this.patch = p;
  }
  getPatch(): SynthPatch {
    return this.patch;
  }
  attach(ctx: AudioContext, dest: AudioNode): void {
    this.ctx = ctx;
    this.dest = dest;
  }

  get activeVoices(): number {
    return this.poly.size + (this.mono ? 1 : 0);
  }
  get peakVoices(): number {
    return this._peak;
  }
  private bump(): void {
    if (this.activeVoices > this._peak) this._peak = this.activeVoices;
  }

  noteOn(midi: number, vel: number): void {
    if (!this.ctx || !this.dest) return;
    const now = this.ctx.currentTime;
    const peak = Math.max(0.0001, vel * this.patch.ampLevel);

    if (this.patch.mode === "mono") {
      if (this.mono && this.patch.glide > 0.001) {
        // glide + retrigger on the existing voice
        this.mono.glideTo(noteFreq(midi), this.patch.glide, now);
        this.mono.retrigger(peak, now);
      } else {
        this.releaseMono(now);
        this.mono = buildVoice(this.ctx, this.dest, this.patch, midi, vel, now, { hold: true });
      }
      this.monoMidi = midi;
      this.bump();
      return;
    }

    // poly: one voice per note (retrigger same pitch)
    const existing = this.poly.get(midi);
    if (existing) existing.release(now);
    const v = buildVoice(this.ctx, this.dest, this.patch, midi, vel, now, { hold: true });
    this.poly.set(midi, v);
    this.bump();
  }

  noteOff(midi: number): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.patch.mode === "mono") {
      if (midi === this.monoMidi) this.releaseMono(now);
      return;
    }
    const v = this.poly.get(midi);
    if (v) {
      v.release(now);
      this.poly.delete(midi);
    }
  }

  private releaseMono(now: number): void {
    if (this.mono) {
      this.mono.release(now);
      this.mono = null;
      this.monoMidi = -1;
    }
  }

  allNotesOff(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const v of this.poly.values()) v.release(now);
    this.poly.clear();
    this.releaseMono(now);
  }

  resetPeak(): void {
    this._peak = this.activeVoices;
  }
}

/* ---------------- factory presets (8: bass/pad/lead/pluck ×2) ---------------- */

const env = (attack: number, decay: number, sustain: number, release: number): AdsrParams => ({
  attack,
  decay,
  sustain,
  release,
});

export const SUBSYNTH_PRESETS: SynthPatch[] = [
  {
    name: "Sub Anchor",
    category: "bass",
    mode: "mono",
    glide: 0.06,
    osc1Wave: "sawtooth", osc1Detune: 0,
    osc2Wave: "square", osc2Detune: -1200, oscMix: 0.5,
    unison: 1, unisonSpread: 0,
    filterType: "lowpass", cutoff: 320, resonance: 6,
    amp: env(0.004, 0.18, 0.7, 0.08), ampLevel: 0.9,
    filterEnv: env(0.002, 0.22, 0.1, 0.1), filterEnvAmount: 900,
    lfoRate: 0, lfoDepth: 0, lfoTarget: "pitch",
  },
  {
    name: "Acid Squelch",
    category: "bass",
    mode: "mono",
    glide: 0.03,
    osc1Wave: "sawtooth", osc1Detune: 0,
    osc2Wave: "sawtooth", osc2Detune: 8, oscMix: 0.3,
    unison: 1, unisonSpread: 0,
    filterType: "lowpass", cutoff: 420, resonance: 14,
    amp: env(0.003, 0.15, 0.55, 0.07), ampLevel: 0.85,
    filterEnv: env(0.001, 0.18, 0.05, 0.12), filterEnvAmount: 3200,
    lfoRate: 6, lfoDepth: 0.12, lfoTarget: "pitch",
  },
  {
    name: "Analog Wash",
    category: "pad",
    mode: "poly",
    glide: 0,
    osc1Wave: "sawtooth", osc1Detune: -6,
    osc2Wave: "sawtooth", osc2Detune: 6, oscMix: 0.8,
    unison: 5, unisonSpread: 22,
    filterType: "lowpass", cutoff: 1500, resonance: 2,
    amp: env(0.9, 0.6, 0.85, 1.6), ampLevel: 0.32,
    filterEnv: env(0.8, 0.9, 0.4, 1.4), filterEnvAmount: 600,
    lfoRate: 0.4, lfoDepth: 0.12, lfoTarget: "amplitude",
  },
  {
    name: "Air Choir",
    category: "pad",
    mode: "poly",
    glide: 0,
    osc1Wave: "triangle", osc1Detune: 0,
    osc2Wave: "sine", osc2Detune: 7, oscMix: 0.6,
    unison: 4, unisonSpread: 14,
    filterType: "bandpass", cutoff: 1400, resonance: 4,
    amp: env(1.2, 0.5, 0.9, 2.2), ampLevel: 0.3,
    filterEnv: env(1.0, 1.0, 0.5, 1.8), filterEnvAmount: 400,
    lfoRate: 0.25, lfoDepth: 0.15, lfoTarget: "amplitude",
  },
  {
    name: "Neon Glide",
    category: "lead",
    mode: "mono",
    glide: 0.09,
    osc1Wave: "sawtooth", osc1Detune: 0,
    osc2Wave: "square", osc2Detune: 12, oscMix: 0.45,
    unison: 2, unisonSpread: 10,
    filterType: "lowpass", cutoff: 2600, resonance: 5,
    amp: env(0.01, 0.25, 0.75, 0.25), ampLevel: 0.5,
    filterEnv: env(0.01, 0.3, 0.2, 0.25), filterEnvAmount: 1200,
    lfoRate: 5.2, lfoDepth: 0.2, lfoTarget: "pitch",
  },
  {
    name: "Pulse Drive",
    category: "lead",
    mode: "poly",
    glide: 0,
    osc1Wave: "square", osc1Detune: 0,
    osc2Wave: "square", osc2Detune: -10, oscMix: 0.5,
    unison: 2, unisonSpread: 8,
    filterType: "lowpass", cutoff: 3200, resonance: 3,
    amp: env(0.005, 0.2, 0.65, 0.2), ampLevel: 0.42,
    filterEnv: env(0.005, 0.25, 0.15, 0.2), filterEnvAmount: 800,
    lfoRate: 7, lfoDepth: 0.18, lfoTarget: "amplitude",
  },
  {
    name: "Glass Pluck",
    category: "pluck",
    mode: "poly",
    glide: 0,
    osc1Wave: "triangle", osc1Detune: 0,
    osc2Wave: "sine", osc2Detune: 1200, oscMix: 0.35,
    unison: 1, unisonSpread: 0,
    filterType: "lowpass", cutoff: 4800, resonance: 4,
    amp: env(0.002, 0.3, 0.0, 0.35), ampLevel: 0.55,
    filterEnv: env(0.001, 0.25, 0.0, 0.3), filterEnvAmount: 2600,
    lfoRate: 0, lfoDepth: 0, lfoTarget: "pitch",
  },
  {
    name: "Reso Bell",
    category: "pluck",
    mode: "poly",
    glide: 0,
    osc1Wave: "sine", osc1Detune: 0,
    osc2Wave: "sine", osc2Detune: 35, oscMix: 0.4,
    unison: 1, unisonSpread: 0,
    filterType: "bandpass", cutoff: 2400, resonance: 12,
    amp: env(0.001, 0.45, 0.0, 0.5), ampLevel: 0.5,
    filterEnv: env(0.001, 0.4, 0.0, 0.45), filterEnvAmount: 1800,
    lfoRate: 0, lfoDepth: 0, lfoTarget: "amplitude",
  },
];

/* ---------------- voice-cost profiler / headroom ---------------- */

export interface VoiceProfile {
  voices: number;
  unison: number;
  renderMs: number;
  costPerVoiceMs: number;
  /** Simultaneous voices that fit inside the scheduling/DSP budget. */
  estimatedHeadroom: number;
}

/** Budget of DSP time (ms of render per profiling window) we allow the synth. */
const HEADROOM_BUDGET_MS = 12;

/**
 * Render `voices` simultaneous notes of `patch` offline and time it. Offline
 * rendering executes the exact same node graph; the measured cost-per-voice is a
 * defensible proxy for real-time DSP load, from which headroom is derived.
 */
export async function profileSubSynth(
  patch: SynthPatch,
  voices = 32,
  seconds = 1,
): Promise<VoiceProfile> {
  const sr = 44100;
  const octx = new OfflineAudioContext(2, Math.ceil(seconds * sr), sr);
  const out = octx.createGain();
  out.gain.value = 0.8;
  out.connect(octx.destination);

  const dur = Math.max(0.2, seconds - 0.2);
  for (let i = 0; i < voices; i++) {
    const midi = 40 + (i % 25);
    scheduleNote(octx, out, patch, midi, 0.5, 0.05, dur);
  }

  const t0 = performance.now();
  await octx.startRendering();
  const renderMs = performance.now() - t0;

  const costPerVoiceMs = renderMs / Math.max(1, voices);
  const estimatedHeadroom = costPerVoiceMs > 0.0001 ? Math.floor(HEADROOM_BUDGET_MS / costPerVoiceMs) : 999;

  return {
    voices,
    unison: patch.unison,
    renderMs,
    costPerVoiceMs,
    estimatedHeadroom: Math.min(999, estimatedHeadroom),
  };
}
