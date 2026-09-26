import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { IndexedDbAssets } from './assets';
describe('IndexedDB transactions', () => {
  it('commits binary PCM and reopens it without relying on the memory cache', async () => {
    const asset = { id: 'idb_roundtrip', sampleRate: 44100, pcm: new Float32Array([0.25, -0.5]) };
    await new IndexedDbAssets().put(asset);
    expect(await new IndexedDbAssets().get(asset.id)).toEqual(asset);
  });
  it('cannot overwrite an immutable recording and retains the original after abort', async () => {
    const storage = new IndexedDbAssets();
    const asset = { id: 'idb_immutable', sampleRate: 48000, pcm: new Float32Array([0.1]) };
    await storage.put(asset);
    await expect(storage.put({ ...asset, pcm: new Float32Array([0.9]) })).rejects.toThrow();
    expect(await storage.get(asset.id)).toEqual(asset);
  });
});
