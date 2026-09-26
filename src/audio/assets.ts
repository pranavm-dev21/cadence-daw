/** Immutable, origin-private PCM assets. Metadata stays in the command bus. */
export interface AudioAsset { id: string; sampleRate: number; pcm: Float32Array<ArrayBuffer>; channelCount?: 1 | 2; }
export interface AssetStorage { put(asset: AudioAsset): Promise<void>; get(id: string): Promise<AudioAsset | undefined>; }
export function validateAsset(asset: AudioAsset): void {
  const channels = asset.channelCount ?? 1;
  if (![1,2].includes(channels) || !/^[\w-]{1,128}$/.test(asset.id) || !Number.isInteger(asset.sampleRate) || asset.sampleRate < 8000 || asset.sampleRate > 192000 || !(asset.pcm instanceof Float32Array) || !asset.pcm.length || asset.pcm.length % channels !== 0 || asset.pcm.length > asset.sampleRate * 600 * channels) throw new Error('Invalid audio asset (maximum 10 minutes).');
  for (const sample of asset.pcm) if (!Number.isFinite(sample)) throw new Error('Audio contains invalid samples.');
}
export class IndexedDbAssets implements AssetStorage {
  private async open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('cadence-audio-v1', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('assets', { keyPath: 'id' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Audio storage is unavailable.'));
      request.onblocked = () => reject(new Error('Close other Cadence tabs and retry.'));
    });
  }
  async put(asset: AudioAsset): Promise<void> {
    validateAsset(asset);
    const db = await this.open();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('assets', 'readwrite');
        // add, not put: immutable IDs cannot replace a previous recording.
        tx.objectStore('assets').add(asset);
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(new Error('Audio could not be saved. Free device storage and retry.'));
        tx.onerror = () => reject(new Error('Audio could not be saved. Free device storage and retry.'));
      });
    } finally { db.close(); }
  }
  async get(id: string): Promise<AudioAsset | undefined> {
    const db = await this.open();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('assets', 'readonly');
        const request = tx.objectStore('assets').get(id);
        tx.oncomplete = () => resolve(request.result);
        tx.onabort = () => reject(new Error('Audio could not be read.'));
        tx.onerror = () => reject(new Error('Audio could not be read.'));
      });
    } finally { db.close(); }
  }
}
export class AudioAssetLibrary {
  private cache = new Map<string, AudioAsset>();
  constructor(private storage: AssetStorage) {}
  async save(asset: AudioAsset): Promise<void> {
    validateAsset(asset);
    await this.storage.put(asset);
    this.cache.set(asset.id, asset);
  }
  async import(asset: AudioAsset): Promise<void> {
    validateAsset(asset);
    const existing = await this.storage.get(asset.id);
    if (existing) {
      validateAsset(existing);
      if ((existing.channelCount ?? 1) !== (asset.channelCount ?? 1) || existing.sampleRate !== asset.sampleRate || existing.pcm.length !== asset.pcm.length || existing.pcm.some((value, i) => value !== asset.pcm[i])) throw new Error('A different recording already uses this ID. The existing audio has been preserved.');
      this.cache.set(asset.id, existing);
    } else await this.save(asset);
  }
  async load(id: string): Promise<AudioAsset> {
    let asset = this.cache.get(id);
    if (!asset) asset = await this.storage.get(id);
    if (!asset) throw new Error('A recording is missing on this device. Open this project in the browser where it was recorded.');
    validateAsset(asset);
    this.cache.set(id, asset);
    return asset;
  }
}
export const audioAssets = new AudioAssetLibrary(new IndexedDbAssets());
