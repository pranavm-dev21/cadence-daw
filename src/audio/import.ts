import { audioAssets } from './assets';
import type { TakeMeta } from '../types';
export function isSupportedAudioHeader(bytes: Uint8Array): boolean {
  const text = (start: number, count: number) => String.fromCharCode(...bytes.subarray(start, start + count));
  return bytes.length >= 12 && (
    (text(0,4) === 'RIFF' && text(8,4) === 'WAVE') || text(0,4) === 'fLaC' || text(0,4) === 'OggS' ||
    text(0,3) === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) || text(4,4) === 'ftyp'
  );
}
export async function importAudioFile(file: File, context: BaseAudioContext, bpm: number): Promise<TakeMeta> {
  if (file.size < 12 || file.size > 64 * 1024 * 1024) throw new Error('Choose an audio file smaller than 64 MB.');
  if (file.type && !file.type.startsWith('audio/') && file.type !== 'application/octet-stream' && file.type !== 'video/mp4') throw new Error('Choose a supported audio file.');
  const bytes = await file.arrayBuffer();
  if (!isSupportedAudioHeader(new Uint8Array(bytes, 0, Math.min(32, bytes.byteLength)))) throw new Error('The file does not contain a supported audio signature.');
  let buffer: AudioBuffer;
  try { buffer = await context.decodeAudioData(bytes); } catch { throw new Error('Your browser could not decode this audio. Try a WAV file.'); }
  if (buffer.duration <= 0 || buffer.duration > 600 || buffer.numberOfChannels > 2) throw new Error('Import a mono or stereo recording up to 10 minutes long.');
  if (buffer.duration > 1024 * (60 / bpm / 4)) throw new Error('This audio exceeds the 64-bar timeline at the current tempo. Lower the tempo or import a shorter section.');
  const channelCount = buffer.numberOfChannels as 1 | 2;
  const pcm = new Float32Array(buffer.length * channelCount);
  let peak = 0;
  for (let channel = 0; channel < channelCount; channel++) {
    const samples = buffer.getChannelData(channel);
    for (let frame = 0; frame < samples.length; frame++) { pcm[frame * channelCount + channel] = samples[frame]; peak = Math.max(peak, Math.abs(samples[frame])); }
  }
  const id = `take_${crypto.randomUUID()}`;
  await audioAssets.save({ id, sampleRate: buffer.sampleRate, pcm, ...(channelCount === 2 ? { channelCount: 2 } : {}) });
  return { id, name: file.name.replace(/\.[^.]+$/, '').slice(0,32) || 'Imported audio', offsetSteps: 0, durationSteps: Math.min(1024, Math.max(1, Math.ceil(buffer.duration / (60 / bpm / 4)))), deviceId: '', deviceLabel: 'Imported audio', latencyMs: 0, peak: Math.min(1, peak) };
}
