import { describe, expect, it } from 'vitest';
import { AudioAssetLibrary, validateAsset, type AudioAsset } from './assets';
describe('durable recording assets', () => {
  it('restores exact samples and the original sample rate in a fresh library', async () => {
    const rows = new Map<string, AudioAsset>();
    const storage = { put: async (a: AudioAsset) => { rows.set(a.id, structuredClone(a)); }, get: async (id: string) => rows.get(id) };
    const asset = { id: 'take_one', sampleRate: 48000, pcm: new Float32Array([0.1, -0.9, 0]) };
    await new AudioAssetLibrary(storage).save(asset);
    expect(await new AudioAssetLibrary(storage).load(asset.id)).toEqual(asset);
  });
  it('does not report a failed write as saved or cache it as durable', async () => {
    const library = new AudioAssetLibrary({ put: async () => { throw new Error('quota'); }, get: async () => undefined });
    await expect(library.save({ id: 'take_one', sampleRate: 48000, pcm: new Float32Array([1]) })).rejects.toThrow('quota');
    await expect(library.load('take_one')).rejects.toThrow('missing');
  });
  it('rejects malformed samples, paths, rates and empty recordings', () => {
    for (const asset of [
      { id: '../bad', sampleRate: 48000, pcm: new Float32Array([0]) },
      { id: 'take', sampleRate: 0, pcm: new Float32Array([0]) },
      { id: 'take', sampleRate: 48000, pcm: new Float32Array([NaN]) },
      { id: 'take', sampleRate: 48000, pcm: new Float32Array() },
    ]) expect(() => validateAsset(asset)).toThrow();
  });
});
