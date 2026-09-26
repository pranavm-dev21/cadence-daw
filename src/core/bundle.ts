import { serialize, deserialize } from './format';
import type { Project } from '../types';
import { audioAssets, validateAsset, type AudioAsset, type AudioAssetLibrary } from '../audio/assets';

const MAGIC = 'CADENCE2';
const MAX_BYTES = 256 * 1024 * 1024;
const MAX_METADATA = 8 * 1024 * 1024;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const takeIds = (project: Project) => [...new Set(project.tracks.flatMap(track => track.takes.map(take => take.id)))];

/** Lossless portable container. PCM remains outside the undoable project document. */
export async function createProjectBundle(project: Project, library = audioAssets): Promise<Blob> {
  const metadata = encoder.encode(serialize(project));
  if (metadata.length > MAX_METADATA) throw new Error('Project metadata exceeds 8 MB.');
  const assets: AudioAsset[] = [];
  let size = 16 + metadata.length;
  for (const id of takeIds(project)) {
    const asset = await library.load(id);
    size += 16 + encoder.encode(id).length + asset.pcm.byteLength;
    if (size > MAX_BYTES) throw new Error('Project backup exceeds 256 MB. Export individual recordings or use a smaller project.');
    assets.push(asset);
  }
  const header = new Uint8Array(16);
  header.set(encoder.encode(MAGIC));
  const view = new DataView(header.buffer);
  view.setUint32(8, metadata.length, true); view.setUint32(12, assets.length, true);
  const parts: BlobPart[] = [header, metadata];
  for (const asset of assets) {
    const id = encoder.encode(asset.id); const assetHeader = new Uint8Array(16);
    const view = new DataView(assetHeader.buffer);
    view.setUint32(0, id.length, true); view.setUint32(4, asset.sampleRate, true); view.setUint32(8, asset.pcm.length, true);
    view.setUint32(12, asset.channelCount ?? 1, true);
    // Explicit little-endian float32 makes archives portable across platforms.
    const samples = new ArrayBuffer(asset.pcm.byteLength); const pcmView = new DataView(samples);
    for (let i = 0; i < asset.pcm.length; i++) pcmView.setFloat32(i * 4, asset.pcm[i], true);
    parts.push(assetHeader, id, samples);
  }
  return new Blob(parts, { type: 'application/octet-stream' });
}
export function decodeProjectBundle(bytes: ArrayBuffer): { project: Project; assets: AudioAsset[] } {
  if (bytes.byteLength < 16 || bytes.byteLength > MAX_BYTES) throw new Error('Invalid project backup size (maximum 256 MB).');
  const data = new DataView(bytes);
  let offset = 0;
  const read = (length: number) => {
    if (length < 0 || offset + length > bytes.byteLength) throw new Error('Project backup is truncated.');
    const result = new Uint8Array(bytes, offset, length); offset += length; return result;
  };
  const magic = decoder.decode(read(8));
  if (magic !== MAGIC && magic !== 'CADENCE1') throw new Error('Unsupported project backup format.');
  const metadataLength = data.getUint32(8, true); const count = data.getUint32(12, true); offset = 16;
  if (metadataLength > MAX_METADATA || count > 4096) throw new Error('Project backup exceeds supported limits.');
  const parsed = deserialize(decoder.decode(read(metadataLength)));
  if (!parsed.ok) throw new Error(parsed.error);
  const expected = new Set(takeIds(parsed.project));
  if (count !== expected.size) throw new Error('Project backup does not contain every referenced recording.');
  const seen = new Set<string>(); const assets: AudioAsset[] = [];
  for (let index = 0; index < count; index++) {
    const header = read(magic === 'CADENCE1' ? 12 : 16); const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
    const idLength = view.getUint32(0, true); const sampleRate = view.getUint32(4, true); const frames = view.getUint32(8, true);
    const channelCount = magic === 'CADENCE1' ? 1 : view.getUint32(12, true);
    if (![1,2].includes(channelCount) || idLength < 1 || idLength > 128 || sampleRate < 8000 || sampleRate > 192000 || frames < 1 || frames > sampleRate * 600 * channelCount) throw new Error('Invalid recording in project backup.');
    const id = decoder.decode(read(idLength));
    if (seen.has(id) || !expected.has(id)) throw new Error('Duplicate or unrelated recording in project backup.');
    seen.add(id);
    const samples = read(frames * 4); const pcmView = new DataView(samples.buffer, samples.byteOffset, samples.byteLength);
    const pcm = new Float32Array(frames);
    for (let i = 0; i < frames; i++) pcm[i] = pcmView.getFloat32(i * 4, true);
    const asset: AudioAsset = { id, sampleRate, pcm, ...(channelCount === 2 ? { channelCount: 2 } : {}) }; validateAsset(asset); assets.push(asset);
  }
  if (offset !== bytes.byteLength) throw new Error('Unexpected data after project backup.');
  return { project: parsed.project, assets };
}
export async function openProjectBundle(bytes: ArrayBuffer, library: AudioAssetLibrary = audioAssets): Promise<Project> {
  const decoded = decodeProjectBundle(bytes);
  // Validate the entire archive before writing anything; metadata is only opened
  // after every asset commits. Failed imports never replace the current project.
  for (const asset of decoded.assets) await library.import(asset);
  return decoded.project;
}
