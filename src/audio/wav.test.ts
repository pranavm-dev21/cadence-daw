import { describe, expect, it } from 'vitest';
import { encodeWav } from './synth';
describe('WAV file validity', () => {
  it('encodes a stereo PCM file with consistent header, data size and readable samples', async () => {
    const channels = [new Float32Array([0.5, -0.5]), new Float32Array([0.25, -0.25])];
    const blob = encodeWav({ sampleRate: 48000, length: 2, getChannelData: (i: number) => channels[i] } as AudioBuffer);
    const bytes = await blob.arrayBuffer(); const view = new DataView(bytes);
    const text = (offset: number, count: number) => String.fromCharCode(...new Uint8Array(bytes, offset, count));
    expect(text(0, 4)).toBe('RIFF'); expect(text(8, 4)).toBe('WAVE');
    expect(view.getUint32(4, true) + 8).toBe(bytes.byteLength);
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(24, true)).toBe(48000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(8);
    expect(view.getInt16(44, true)).toBeCloseTo(16383, 0);
    expect(view.getInt16(48, true)).toBe(-16384);
  });
});
