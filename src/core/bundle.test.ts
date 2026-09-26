import { describe, expect, it } from 'vitest';
import { AudioAssetLibrary, type AudioAsset } from '../audio/assets';
import { buildEmptyProject } from './seed';
import { execCommand } from './executors';
import { createProjectBundle, decodeProjectBundle, openProjectBundle } from './bundle';
const memory = () => { const rows = new Map<string, AudioAsset>(); return { rows, library: new AudioAssetLibrary({ put: async a => { rows.set(a.id, structuredClone(a)); }, get: async id => rows.get(id) }) }; };
async function fixture() {
  const origin = memory(); let project = buildEmptyProject();
  const take = { id: 'take_backup', name: 'Backup test', offsetSteps: 0, durationSteps: 4, deviceId: '', deviceLabel: 'Test', latencyMs: 0, peak: 0.5 };
  project = execCommand(project, { op: 'add_take', trackId: project.tracks[0].id, take });
  const asset = { id: take.id, sampleRate: 48000, pcm: new Float32Array([0.5, -0.25, 0, 0.125]) };
  await origin.library.save(asset);
  return { project, asset, bytes: await (await createProjectBundle(project, origin.library)).arrayBuffer() };
}
describe('portable project backups', () => {
  it('restores every take and exact PCM in an independent device store', async () => {
    const { project, asset, bytes } = await fixture(); const destination = memory();
    const restored = await openProjectBundle(bytes, destination.library);
    expect(restored.tracks[0].takes).toEqual(project.tracks[0].takes);
    expect(await destination.library.load(asset.id)).toEqual(asset);
    await expect(openProjectBundle(bytes, destination.library)).resolves.toEqual(restored);
  });
  it('preserves stereo channel order in a portable backup', async () => {
    const { project, asset } = await fixture(); const origin = memory();
    const stereo = { ...asset, channelCount: 2 as const, pcm: new Float32Array([0.1, -0.2, 0.3, -0.4]) };
    await origin.library.save(stereo);
    const decoded = decodeProjectBundle(await (await createProjectBundle(project, origin.library)).arrayBuffer());
    expect(decoded.assets[0]).toEqual(stereo);
  });
  it('continues reading the original mono backup format', async () => {
    const { bytes, asset } = await fixture(); const offset = 16 + new DataView(bytes).getUint32(8, true) + 12;
    const legacy = new Uint8Array(bytes.byteLength - 4);
    legacy.set(new Uint8Array(bytes, 0, offset)); legacy.set(new Uint8Array(bytes, offset + 4), offset);
    legacy.set(new TextEncoder().encode('CADENCE1'));
    expect(decodeProjectBundle(legacy.buffer).assets[0]).toEqual(asset);
  });
  it('rejects truncated, wrong-format and trailing data without writing assets', async () => {
    const { bytes } = await fixture();
    for (const input of [bytes.slice(0, bytes.byteLength - 1), new ArrayBuffer(20), new Uint8Array([...new Uint8Array(bytes), 0]).buffer]) {
      const destination = memory(); await expect(openProjectBundle(input, destination.library)).rejects.toThrow(); expect(destination.rows.size).toBe(0);
    }
  });
  it('fails export when audio is missing instead of creating an incomplete backup', async () => {
    const { project } = await fixture(); await expect(createProjectBundle(project, memory().library)).rejects.toThrow('missing');
  });
  it('preserves an existing recording on an ID collision with different audio', async () => {
    const { bytes, asset } = await fixture(); const destination = memory();
    const original = { ...asset, pcm: new Float32Array([0.9]) }; await destination.library.save(original);
    await expect(openProjectBundle(bytes, destination.library)).rejects.toThrow('preserved');
    expect(await destination.library.load(asset.id)).toEqual(original);
  });
  it('rejects malicious sample values and incorrect asset counts', async () => {
    const { bytes } = await fixture();
    const invalid = bytes.slice(0); new DataView(invalid).setFloat32(invalid.byteLength - 4, NaN, true);
    expect(() => decodeProjectBundle(invalid)).toThrow('invalid samples');
    const count = bytes.slice(0); new DataView(count).setUint32(12, 0, true);
    expect(() => decodeProjectBundle(count)).toThrow('every referenced');
  });
});

