/* Cadence DSP — every sound is synthesized in code (no copyrighted samples).
 * All functions take a BaseAudioContext so the exact same voices run in the
 * live engine AND in the OfflineAudioContext used for WAV export. */

import { InstrumentKind } from "../types";

export const noteFreq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

/* Deterministic PRNG (mulberry32). All noise/impulse content is seeded, NOT
 * Math.random(), so a live render and an offline render of the same project use
 * byte-identical noise/reverb material — a hard requirement for the realtime↔
 * offline parity test to diff meaningful signal instead of unrelated noise. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------- noise buffer (cached per context, deterministic) ---------------- */
const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();
export function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let buf = noiseCache.get(ctx);
  if (!buf) {
    buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = buf.getChannelData(0);
    const rng = mulberry32(0x9e3779b9);
    for (let i = 0; i < d.length; i++) d[i] = rng() * 2 - 1;
    noiseCache.set(ctx, buf);
  }
  return buf;
}

function adsr(
  g: GainNode, t: number, peak: number,
  a: number, d: number, sustain: number, dur: number, rel: number,
) {
  const end = t + Math.max(dur, a + 0.02);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
  g.gain.exponentialRampToValueAtTime(Math.max(peak * sustain, 0.0002), t + a + d);
  g.gain.setValueAtTime(Math.max(peak * sustain, 0.0002), end);
  g.gain.exponentialRampToValueAtTime(0.0001, end + rel);
}

export interface VoiceHandle { stop: (when: number) => void; }

/* ---------------- melodic voices ---------------- */
export function playNote(
  ctx: BaseAudioContext, dest: AudioNode, inst: InstrumentKind,
  midi: number, time: number, dur: number, vel: number,
): void {
  const f = noteFreq(midi);
  const v = Math.max(0.05, Math.min(1.2, vel));

  if (inst === "pluck") {
    const g = ctx.createGain();
    const flt = ctx.createBiquadFilter();
    flt.type = "lowpass"; flt.Q.value = 4;
    flt.frequency.setValueAtTime(Math.min(f * 7, 9000), time);
    flt.frequency.exponentialRampToValueAtTime(Math.max(f * 1.6, 400), time + 0.22);
    const o1 = ctx.createOscillator(); o1.type = "sawtooth"; o1.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = "square"; o2.frequency.value = f; o2.detune.value = 9;
    const g2 = ctx.createGain(); g2.gain.value = 0.4;
    o1.connect(flt); o2.connect(g2).connect(flt); flt.connect(g).connect(dest);
    adsr(g, time, 0.3 * v, 0.004, 0.16, 0.18, dur, 0.09);
    const end = time + Math.max(dur, 0.03) + 0.12;
    o1.start(time); o2.start(time); o1.stop(end); o2.stop(end);
    return;
  }

  if (inst === "keys") {
    const g = ctx.createGain();
    const o1 = ctx.createOscillator(); o1.type = "triangle"; o1.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = "sine"; o2.frequency.value = f * 2;
    const g2 = ctx.createGain(); g2.gain.value = 0.28;
    const o3 = ctx.createOscillator(); o3.type = "sine"; o3.frequency.value = f; o3.detune.value = -6;
    o1.connect(g); o2.connect(g2).connect(g); o3.connect(g);
    g.connect(dest);
    adsr(g, time, 0.26 * v, 0.006, 0.35, 0.42, dur, 0.22);
    const end = time + Math.max(dur, 0.05) + 0.3;
    o1.start(time); o2.start(time); o3.start(time);
    o1.stop(end); o2.stop(end); o3.stop(end);
    return;
  }

  if (inst === "bass") {
    const g = ctx.createGain();
    const flt = ctx.createBiquadFilter();
    flt.type = "lowpass"; flt.Q.value = 6;
    flt.frequency.setValueAtTime(1400, time);
    flt.frequency.exponentialRampToValueAtTime(220, time + 0.14);
    const saw = ctx.createOscillator(); saw.type = "sawtooth"; saw.frequency.value = f;
    const sub = ctx.createOscillator(); sub.type = "sine"; sub.frequency.value = f / 2;
    const gs = ctx.createGain(); gs.gain.value = 0.7;
    saw.connect(flt); sub.connect(gs).connect(g); flt.connect(g); g.connect(dest);
    adsr(g, time, 0.42 * v, 0.004, 0.1, 0.75, dur, 0.06);
    const end = time + Math.max(dur, 0.04) + 0.08;
    saw.start(time); sub.start(time); saw.stop(end); sub.stop(end);
    return;
  }

  // pad — slow-breathing detuned saws
  const g = ctx.createGain();
  const flt = ctx.createBiquadFilter();
  flt.type = "lowpass"; flt.frequency.setValueAtTime(1600, time);
  flt.frequency.linearRampToValueAtTime(900, time + Math.max(dur, 0.5));
  const o1 = ctx.createOscillator(); o1.type = "sawtooth"; o1.frequency.value = f; o1.detune.value = -8;
  const o2 = ctx.createOscillator(); o2.type = "sawtooth"; o2.frequency.value = f; o2.detune.value = 8;
  o1.connect(flt); o2.connect(flt); flt.connect(g).connect(dest);
  const atk = Math.min(0.5, dur * 0.35);
  adsr(g, time, 0.11 * v, Math.max(atk, 0.08), 0.3, 0.85, dur, 0.55);
  const end = time + Math.max(dur, 0.3) + 0.7;
  o1.start(time); o2.start(time); o1.stop(end); o2.stop(end);
}

/* ---------------- drums (lane 0..4) ---------------- */
export function playDrum(ctx: BaseAudioContext, dest: AudioNode, lane: number, time: number, vel: number): void {
  const v = Math.max(0.05, Math.min(1.2, vel));
  const noise = () => {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    return src;
  };

  if (lane === 0) {
    // kick — sine pitch drop + click
    const o = ctx.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(165, time);
    o.frequency.exponentialRampToValueAtTime(46, time + 0.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(1.05 * v, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
    o.connect(g).connect(dest);
    o.start(time); o.stop(time + 0.32);
    const c = noise(); const cf = ctx.createBiquadFilter();
    cf.type = "highpass"; cf.frequency.value = 3500;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.25 * v, time);
    cg.gain.exponentialRampToValueAtTime(0.001, time + 0.02);
    c.connect(cf).connect(cg).connect(dest);
    c.start(time); c.stop(time + 0.03);
    return;
  }

  if (lane === 1) {
    // snare — noise burst + tonal body
    const n = noise(); const nf = ctx.createBiquadFilter();
    nf.type = "bandpass"; nf.frequency.value = 1900; nf.Q.value = 0.8;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.75 * v, time);
    ng.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
    n.connect(nf).connect(ng).connect(dest);
    n.start(time); n.stop(time + 0.2);
    const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = 196;
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.4 * v, time);
    og.gain.exponentialRampToValueAtTime(0.001, time + 0.09);
    o.connect(og).connect(dest);
    o.start(time); o.stop(time + 0.1);
    return;
  }

  if (lane === 2 || lane === 3) {
    // closed / open hat — highpassed noise
    const open = lane === 3;
    const n = noise(); const f = ctx.createBiquadFilter();
    f.type = "highpass"; f.frequency.value = 7400;
    const g = ctx.createGain();
    const dur = open ? 0.34 : 0.05;
    g.gain.setValueAtTime((open ? 0.42 : 0.5) * v, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    n.connect(f).connect(g).connect(dest);
    n.start(time); n.stop(time + dur + 0.02);
    return;
  }

  // clap — three bandpassed noise spikes
  for (let i = 0; i < 3; i++) {
    const n = noise(); const f = ctx.createBiquadFilter();
    f.type = "bandpass"; f.frequency.value = 1150; f.Q.value = 1.6;
    const g = ctx.createGain();
    const t = time + i * 0.012;
    g.gain.setValueAtTime(0.5 * v * (i === 2 ? 1 : 0.6), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (i === 2 ? 0.19 : 0.03));
    n.connect(f).connect(g).connect(dest);
    n.start(t); n.stop(t + 0.22);
  }
}

/* ---------------- shared resources ---------------- */
export function makeImpulse(ctx: BaseAudioContext, seconds = 1.9, decay = 2.6): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  const rng = mulberry32(0x51ed270b); // fixed seed — identical impulse on every render
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      d[i] = (rng() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

export function makeDriveCurve(amount: number) {
  const k = 1 + amount * 60;
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = amount <= 0.001 ? x : ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

/* ---------------- WAV encoding ---------------- */
export function encodeWav(buffer: AudioBuffer): Blob {
  const numCh = 2;
  const sr = buffer.sampleRate;
  const frames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numCh * bytesPerSample;
  const dataSize = frames * blockAlign;
  const ab = new ArrayBuffer(44 + dataSize);
  const view = new DataView(ab);
  const writeStr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numCh, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, sr * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  const chans = [buffer.getChannelData(0), buffer.getChannelData(1)];
  let offset = 44;
  for (let i = 0; i < frames; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      const s = Math.max(-1, Math.min(1, chans[ch][i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([ab], { type: "audio/wav" });
}
