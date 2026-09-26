/* Offline render pipeline.
 *
 * Renders a Project through an OfflineAudioContext — the SAME topology
 * factories (buildChannel/buildReturn/buildMaster), the SAME synth voices and
 * the SAME note/automation walk (schedule.ts) that the live engine uses, so the
 * result is perceptually identical to real-time playback. OfflineAudioContext
 * renders as fast as the CPU allows (not real-time), which is what makes export
 * faster-than-realtime on any machine.
 *
 * Chunking: the song is rendered in fixed-length chunks that each carry a short
 * overlap tail, then summed into one accumulator. This (a) keeps peak memory
 * bounded for long songs, (b) yields true incremental progress, and (c) lets the
 * reverb/delay tails of one chunk bridge seamlessly into the next.
 *
 * Determinism: noise and reverb impulses are seeded (synth.ts), and scheduling is
 * shared, so two renders of the same project — or a render vs. real-time capture —
 * diff to ~0 dB. `diffAudioBuffers` quantifies exactly that. */

import { AutomationLane, Project, Track } from "../types";
import { buildChannel, buildMaster, buildReturn, ChannelNodes, RETURN_DEFS, isAudible, soloActive } from "./mixer";
import { makeDriveCurve, playDrum, playNote } from "./synth";
import { placementFade, stepDurFor, stepNotes } from "./schedule";
import { activeLanesForTrack, laneRealValueAt } from "./automation";

/* ---------------- settings ---------------- */

export type BitDepth = 16 | 24 | 32; // 32 = IEEE float

export interface RenderSettings {
  sampleRate: number; // 22050 | 44100 | 48000 | 96000
  bitDepth: BitDepth;
  /** Seconds of reverb/release tail appended after the last bar. */
  tailSeconds: number;
  /** Peak-normalize the result to -0.3 dBFS. */
  normalize: boolean;
}

export const DEFAULT_RENDER_SETTINGS: RenderSettings = {
  sampleRate: 44100,
  bitDepth: 16,
  tailSeconds: 2.5,
  normalize: false,
};

export function clampSettings(s: Partial<RenderSettings>): RenderSettings {
  const rates = [22050, 44100, 48000, 96000];
  const sr = rates.includes(s.sampleRate ?? 0) ? (s.sampleRate as number) : DEFAULT_RENDER_SETTINGS.sampleRate;
  const bd = s.bitDepth === 24 || s.bitDepth === 32 ? s.bitDepth : 16;
  const tail = Math.min(8, Math.max(0, s.tailSeconds ?? DEFAULT_RENDER_SETTINGS.tailSeconds));
  return { sampleRate: sr, bitDepth: bd, tailSeconds: tail, normalize: !!s.normalize };
}

/* ---------------- results ---------------- */

export interface RenderResult {
  buffer: AudioBuffer;
  blob: Blob;
  fileName: string;
  durationSec: number;
  sampleRate: number;
  bitDepth: BitDepth;
  renderMs: number;
  /** Wall-clock speedup vs. the audio duration (>1 = faster than real-time). */
  speedup: number;
}

export interface RenderProgress {
  phase: string;
  fraction: number; // 0..1
}

/* ---------------- offline graph (mirrors the live mixer exactly) ---------------- */

interface OfflineGraph {
  inputs: Map<string, AudioNode>; // trackId → channel input
  channels: Map<string, ChannelNodes>;
  automation: Map<string, AutomationLane[]>;
}

function buildOfflineGraph(octx: BaseAudioContext, p: Project, onlyTrackId: string | null): OfflineGraph {
  const master = buildMaster(octx);
  master.comp.connect(octx.destination);

  const returns = RETURN_DEFS.map((d) => buildReturn(octx, d.id, d.name));
  for (const r of returns) r.output.connect(master.busIn);

  const anySolo = soloActive(p.tracks);
  const inputs = new Map<string, AudioNode>();
  const channels = new Map<string, ChannelNodes>();

  for (const t of p.tracks) {
    const ch = buildChannel(octx, master.busIn, returns, t.fx.drive, t.fx.vocalBypass ? undefined : t.fx.vocal);
    // Audibility: solo/mute semantics AND the stem filter (onlyTrackId).
    const audible = isAudible(t, anySolo) && (onlyTrackId === null || t.id === onlyTrackId);
    ch.gate.gain.value = audible ? 1 : 0;
    // Steady-state params — identical targets to mixer.applyParams.
    ch.filter.frequency.value = t.fx.cutoff;
    ch.pan.pan.value = t.pan;
    ch.fader.gain.value = t.volume;
    ch.shaper.curve = makeDriveCurve(t.fx.drive);
    ch.sends.get("reverb")?.gain.setValueAtTime(t.fx.reverb * 0.7, 0);
    ch.sends.get("delay")?.gain.setValueAtTime(t.fx.delay * 0.55, 0);
    inputs.set(t.id, ch.input);
    channels.set(t.id, ch);
  }

  const automation = new Map<string, AutomationLane[]>();
  for (const t of p.tracks) {
    const lanes = activeLanesForTrack(p.automation, t.id);
    if (lanes.length > 0) automation.set(t.id, lanes);
  }

  return { inputs, channels, automation };
}

/** Mirrors MixerEngine.applyAutomation for the offline graph (no analysers/meters). */
export function applyAutomationOffline(ch: ChannelNodes, param: AutomationLane["param"], v: number, time: number, dur: number): void {
  const d = Math.max(0.001, dur);
  const c = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
  switch (param) {
    case "volume":
      ch.fader.gain.setValueAtTime(v, time);
      ch.fader.gain.linearRampToValueAtTime(v, time + d);
      break;
    case "pan":
      ch.pan.pan.setValueAtTime(c(v, -1, 1), time);
      ch.pan.pan.linearRampToValueAtTime(c(v, -1, 1), time + d);
      break;
    case "cutoff":
      ch.filter.frequency.setValueAtTime(c(v, 40, 20000), time);
      ch.filter.frequency.linearRampToValueAtTime(c(v, 40, 20000), time + d);
      break;
    case "reverb":
      ch.sends.get("reverb")?.gain.setValueAtTime(c(v, 0, 1) * 0.7, time);
      ch.sends.get("reverb")?.gain.linearRampToValueAtTime(c(v, 0, 1) * 0.7, time + d);
      break;
    case "delay":
      ch.sends.get("delay")?.gain.setValueAtTime(c(v, 0, 1) * 0.55, time);
      ch.sends.get("delay")?.gain.linearRampToValueAtTime(c(v, 0, 1) * 0.55, time + d);
      break;
    case "drive": // waveshaper curve can't ramp; snap (matches live behaviour)
      ch.shaper.curve = makeDriveCurve(c(v, 0, 1));
      break;
  }
}

/** Schedule every note + automation event whose onset falls in [t0, t1). */
function scheduleRange(
  octx: BaseAudioContext,
  p: Project,
  graph: OfflineGraph,
  t0: number,
  t1: number,
  stepDur: number,
): void {
  const total = p.lengthBars * 16;
  const s0 = Math.max(0, Math.floor(t0 / stepDur));
  const s1 = Math.min(total, Math.ceil(t1 / stepDur));

  for (let s = s0; s < s1; s++) {
    const time = s * stepDur - t0; // local to this chunk
    stepNotes(p, s, (t, n, rel, pl) => {
      const input = graph.inputs.get(t.id);
      if (!input) return;
      const frac = n.start - Math.floor(n.start);
      const when = time + frac * stepDur;
      const clip = p.clips[pl.clipId];
      const off = pl.offsetSteps ?? 0;
      const vis = pl.lengthBars !== undefined ? Math.round(pl.lengthBars * 16) : (clip ? clip.lengthBars * 16 - off : 16);
      const f = pl.fadeIn || pl.fadeOut ? placementFade(pl, rel, vis) : 1;
      if (f <= 0.004) return;
      const dur = t.instrument === "drumkit" ? 0.4 : Math.max(0.06, n.dur * stepDur);
      if (t.instrument === "drumkit") playDrum(octx, input, n.pitch, when, n.vel * f);
      else playNote(octx, input, t.instrument, n.pitch, when, dur, n.vel * f);
    });

    const lanes = graph.automation;
    if (lanes.size > 0) {
      for (const [trackId, ls] of lanes) {
        const ch = graph.channels.get(trackId);
        if (!ch) continue;
        for (const lane of ls) {
          applyAutomationOffline(ch, lane.param, laneRealValueAt(lane, s), time, stepDur);
        }
      }
    }
  }
}

/* ---------------- chunked renderer ---------------- */

const CHUNK_SEC = 6;

async function renderToBuffer(
  p: Project,
  settings: RenderSettings,
  onlyTrackId: string | null,
  onProgress?: (pr: RenderProgress) => void,
): Promise<{ buffer: AudioBuffer; renderMs: number }> {
  const sr = settings.sampleRate;
  const stepDur = stepDurFor(p.bpm);
  const songSec = p.lengthBars * 16 * stepDur;
  const totalSec = songSec + settings.tailSeconds;
  const totalFrames = Math.ceil(totalSec * sr);

  const started = performance.now();
  const accL = new Float32Array(totalFrames);
  const accR = new Float32Array(totalFrames);

  const numChunks = Math.max(1, Math.ceil(songSec / CHUNK_SEC));
  for (let i = 0; i < numChunks; i++) {
    const t0 = i * CHUNK_SEC;
    const t1 = Math.min(t0 + CHUNK_SEC, songSec);
    const chunkLen = t1 - t0 + settings.tailSeconds; // overlap tail bridges chunks
    const octx = new OfflineAudioContext(2, Math.ceil(chunkLen * sr), sr);
    const graph = buildOfflineGraph(octx, p, onlyTrackId);
    scheduleRange(octx, p, graph, t0, t1 + settings.tailSeconds, stepDur);

    const rendered = await octx.startRendering();
    const rl = rendered.getChannelData(0);
    const rr = rendered.getChannelData(1);
    const off = Math.floor(t0 * sr);
    for (let j = 0; j < rl.length && off + j < totalFrames; j++) {
      accL[off + j] += rl[j];
      accR[off + j] += rr[j];
    }

    onProgress?.({ phase: "render", fraction: (i + 1) / numChunks });
  }

  if (settings.normalize) {
    let peak = 0;
    for (let j = 0; j < totalFrames; j++) {
      const a = Math.abs(accL[j]);
      const b = Math.abs(accR[j]);
      if (a > peak) peak = a;
      if (b > peak) peak = b;
    }
    if (peak > 0.0001) {
      const target = Math.pow(10, -0.3 / 20); // -0.3 dBFS
      const gain = target / peak;
      for (let j = 0; j < totalFrames; j++) {
        accL[j] *= gain;
        accR[j] *= gain;
      }
    }
  }

  const out = new OfflineAudioContext(2, totalFrames, sr);
  const buffer = out.createBuffer(2, totalFrames, sr);
  buffer.copyToChannel(accL, 0);
  buffer.copyToChannel(accR, 1);

  return { buffer, renderMs: performance.now() - started };
}

/* ---------------- public API ---------------- */

const safeName = (s: string) => s.replace(/[^\w\- ]+/g, "").trim() || "session";

export async function renderProject(
  p: Project,
  settings: Partial<RenderSettings>,
  onProgress?: (pr: RenderProgress) => void,
): Promise<RenderResult> {
  const s = clampSettings(settings);
  onProgress?.({ phase: "start", fraction: 0 });
  const { buffer, renderMs } = await renderToBuffer(p, s, null, onProgress);
  onProgress?.({ phase: "encode", fraction: 1 });
  const blob = encodeWavExt(buffer, s.bitDepth);
  const durationSec = buffer.duration;
  return {
    buffer,
    blob,
    fileName: `${safeName(p.name)}_${s.sampleRate / 1000}k_${s.bitDepth}bit.wav`,
    durationSec,
    sampleRate: s.sampleRate,
    bitDepth: s.bitDepth,
    renderMs,
    speedup: renderMs > 0 ? durationSec / (renderMs / 1000) : Infinity,
  };
}

export interface StemResult extends RenderResult {
  trackId: string;
  trackName: string;
}

/** Render one WAV per audible track (soloed in isolation) plus the full mix. */
export async function renderStems(
  p: Project,
  settings: Partial<RenderSettings>,
  onProgress?: (pr: RenderProgress) => void,
): Promise<StemResult[]> {
  const s = clampSettings(settings);
  const out: StemResult[] = [];
  const anySolo = soloActive(p.tracks);
  const audible = p.tracks.filter((t) => isAudible(t, anySolo));
  const total = audible.length + 1;
  let done = 0;

  for (const t of audible) {
    const { buffer, renderMs } = await renderToBuffer(p, s, t.id, (pr) =>
      onProgress?.({ phase: `stem ${t.name}`, fraction: (done + pr.fraction) / total }),
    );
    const blob = encodeWavExt(buffer, s.bitDepth);
    out.push({
      buffer, blob, renderMs,
      trackId: t.id,
      trackName: t.name,
      fileName: `${safeName(p.name)}_stem_${safeName(t.name)}.wav`,
      durationSec: buffer.duration,
      sampleRate: s.sampleRate,
      bitDepth: s.bitDepth,
      speedup: renderMs > 0 ? buffer.duration / (renderMs / 1000) : Infinity,
    });
    done++;
  }

  const mix = await renderProject(p, s, (pr) => onProgress?.({ phase: "mix", fraction: (done + pr.fraction) / total }));
  out.push({ ...mix, trackId: "mix", trackName: "Full Mix", fileName: `${safeName(p.name)}_mix.wav` });
  return out;
}

/* ---------------- WAV encoding (16 / 24 / 32-float) ---------------- */

export function encodeWavExt(buffer: AudioBuffer, bitDepth: BitDepth): Blob {
  const numCh = Math.min(2, buffer.numberOfChannels);
  const sr = buffer.sampleRate;
  const frames = buffer.length;

  if (bitDepth === 32) {
    const bytesPerSample = 4;
    const blockAlign = numCh * bytesPerSample;
    const dataSize = frames * blockAlign;
    const ab = new ArrayBuffer(44 + dataSize);
    const view = new DataView(ab);
    writeHeader(view, numCh, sr, blockAlign, 3 /* IEEE float */, dataSize);
    const chans = [buffer.getChannelData(0), numCh > 1 ? buffer.getChannelData(1) : buffer.getChannelData(0)];
    let off = 44;
    for (let i = 0; i < frames; i++) {
      for (let c = 0; c < numCh; c++) {
        view.setFloat32(off, chans[c][i], true);
        off += 4;
      }
    }
    return new Blob([ab], { type: "audio/wav" });
  }

  const bytesPerSample = bitDepth === 24 ? 3 : 2;
  const blockAlign = numCh * bytesPerSample;
  const dataSize = frames * blockAlign;
  const ab = new ArrayBuffer(44 + dataSize);
  const view = new DataView(ab);
  writeHeader(view, numCh, sr, blockAlign, 1 /* PCM */, dataSize);
  const chans = [buffer.getChannelData(0), numCh > 1 ? buffer.getChannelData(1) : buffer.getChannelData(0)];
  let off = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < numCh; c++) {
      const v = Math.max(-1, Math.min(1, chans[c][i]));
      if (bitDepth === 24) {
        const s = Math.round(v < 0 ? v * 0x800000 : v * 0x7fffff);
        view.setUint8(off, s & 0xff);
        view.setUint8(off + 1, (s >> 8) & 0xff);
        view.setUint8(off + 2, (s >> 16) & 0xff);
        off += 3;
      } else {
        view.setInt16(off, Math.round(v < 0 ? v * 0x8000 : v * 0x7fff), true);
        off += 2;
      }
    }
  }
  return new Blob([ab], { type: "audio/wav" });
}

function writeHeader(view: DataView, numCh: number, sr: number, blockAlign: number, fmt: number, dataSize: number): void {
  const writeStr = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, fmt, true);
  view.setUint16(22, numCh, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, sr * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, fmt === 3 ? 32 : blockAlign * 8 / numCh, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);
}

/* ---------------- parity diff ---------------- */

export interface DiffResult {
  /** Peak absolute sample difference (0 = identical). */
  maxAbsDiff: number;
  rmsDiff: number;
  /** Signal-to-difference ratio in dB (higher = closer). Infinity = identical. */
  snrDb: number;
  identical: boolean;
}

/**
 * Compare two rendered buffers sample-by-sample. Used to prove the offline path
 * matches real-time capture: identical scheduling + seeded noise → snrDb should
 * be very high (or infinite). Frames are compared up to the shorter buffer.
 */
export function diffAudioBuffers(a: AudioBuffer, b: AudioBuffer): DiffResult {
  const frames = Math.min(a.length, b.length);
  const chs = Math.min(a.numberOfChannels, b.numberOfChannels);
  let maxAbs = 0;
  let sumSq = 0;
  let sigSq = 0;
  let n = 0;
  for (let c = 0; c < chs; c++) {
    const da = a.getChannelData(c);
    const db = b.getChannelData(c);
    for (let i = 0; i < frames; i++) {
      const d = da[i] - db[i];
      const ad = Math.abs(d);
      if (ad > maxAbs) maxAbs = ad;
      sumSq += d * d;
      sigSq += da[i] * da[i];
      n++;
    }
  }
  const rmsDiff = n > 0 ? Math.sqrt(sumSq / n) : 0;
  const rmsSig = n > 0 ? Math.sqrt(sigSq / n) : 0;
  const snrDb = rmsDiff <= 1e-9 ? Infinity : 20 * Math.log10(rmsSig / rmsDiff);
  return { maxAbsDiff: maxAbs, rmsDiff, snrDb, identical: maxAbs <= 1e-6 };
}

/* ---------------- real-time capture (for the parity check) ---------------- */

/**
 * Play the project through a REAL AudioContext at real speed and capture the
 * output via a MediaStream destination. This is the "real-time" reference the
 * offline render is diffed against in the UI's parity check. Resolves with the
 * captured stereo buffer. Runs at wall-clock speed by definition.
 */
export async function captureRealtime(p: Project, settings: Partial<RenderSettings>): Promise<AudioBuffer> {
  const s = clampSettings(settings);
  const sr = s.sampleRate;
  const stepDur = stepDurFor(p.bpm);
  const songSec = p.lengthBars * 16 * stepDur;
  const totalSec = songSec + s.tailSeconds;

  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx({ sampleRate: sr });
  await ctx.resume();

  const master = buildMaster(ctx);
  const returns = RETURN_DEFS.map((d) => buildReturn(ctx, d.id, d.name));
  for (const r of returns) r.output.connect(master.busIn);
  const anySolo = soloActive(p.tracks);
  const inputs = new Map<string, AudioNode>();
  const channels = new Map<string, ChannelNodes>();
  for (const t of p.tracks) {
    const ch = buildChannel(ctx, master.busIn, returns, t.fx.drive);
    ch.gate.gain.value = isAudible(t, anySolo) ? 1 : 0;
    ch.filter.frequency.value = t.fx.cutoff;
    ch.pan.pan.value = t.pan;
    ch.fader.gain.value = t.volume;
    const rev = ch.sends.get("reverb");
    if (rev) rev.gain.value = t.fx.reverb * 0.7;
    const dly = ch.sends.get("delay");
    if (dly) dly.gain.value = t.fx.delay * 0.55;
    inputs.set(t.id, ch.input);
    channels.set(t.id, ch);
  }
  const automation = new Map<string, AutomationLane[]>();
  for (const t of p.tracks) {
    const lanes = activeLanesForTrack(p.automation, t.id);
    if (lanes.length > 0) automation.set(t.id, lanes);
  }
  const graph: OfflineGraph = { inputs, channels, automation };

  // Capture: master → media stream dest. ScriptProcessor keeps the graph pulled
  // and hands us raw PCM as it renders in real time.
  const mediaDest = ctx.createMediaStreamDestination();
  master.comp.connect(mediaDest);
  const totalFrames = Math.ceil(totalSec * sr);
  const capL = new Float32Array(totalFrames);
  const capR = new Float32Array(totalFrames);
  let written = 0;

  const startAt = ctx.currentTime + 0.15;
  const total = p.lengthBars * 16;
  for (let sIdx = 0; sIdx < total; sIdx++) {
    const time = startAt + sIdx * stepDur;
    stepNotes(p, sIdx, (t, n, rel, pl) => {
      const input = inputs.get(t.id);
      if (!input) return;
      const frac = n.start - Math.floor(n.start);
      const when = time + frac * stepDur;
      const clip = p.clips[pl.clipId];
      const off = pl.offsetSteps ?? 0;
      const vis = pl.lengthBars !== undefined ? Math.round(pl.lengthBars * 16) : (clip ? clip.lengthBars * 16 - off : 16);
      const f = pl.fadeIn || pl.fadeOut ? placementFade(pl, rel, vis) : 1;
      if (f <= 0.004) return;
      const dur = t.instrument === "drumkit" ? 0.4 : Math.max(0.06, n.dur * stepDur);
      if (t.instrument === "drumkit") playDrum(ctx, input, n.pitch, when, n.vel * f);
      else playNote(ctx, input, t.instrument, n.pitch, when, dur, n.vel * f);
    });
    for (const [trackId, lanes] of automation) {
      const ch = channels.get(trackId);
      if (!ch) continue;
      for (const lane of lanes) {
        applyAutomationOffline(ch, lane.param, laneRealValueAt(lane, sIdx), time, stepDur);
      }
    }
  }

  await new Promise<void>((resolve) => {
    const rec = new MediaRecorder(mediaDest.stream);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    rec.onstop = async () => {
      const blob = new Blob(chunks, { type: rec.mimeType });
      const ab = await blob.arrayBuffer();
      // Decode the captured stream back to PCM. The decode uses the same sample
      // rate, so the diff against the offline render is sample-aligned.
      const decoded = await new Ctx({ sampleRate: sr }).decodeAudioData(ab);
      const dl = decoded.getChannelData(0);
      const dr = decoded.numberOfChannels > 1 ? decoded.getChannelData(1) : dl;
      for (let i = 0; i < Math.min(totalFrames, dl.length); i++) {
        capL[i] = dl[i];
        capR[i] = dr[i];
      }
      written = Math.min(totalFrames, dl.length);
      resolve();
    };
    rec.start();
    window.setTimeout(() => rec.stop(), (totalSec + 0.5) * 1000);
  });

  const out = new OfflineAudioContext(2, written || totalFrames, sr);
  const buffer = out.createBuffer(2, written || totalFrames, sr);
  buffer.copyToChannel(capL.subarray(0, written || totalFrames), 0);
  buffer.copyToChannel(capR.subarray(0, written || totalFrames), 1);
  await ctx.close();
  return buffer;
}

export type { Track };


