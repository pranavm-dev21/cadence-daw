/* Audio buffer editing algorithms for the Edison sample editor:
 * - Trimming & cropping
 * - Normalization to target dBFS
 * - Reversal (full or selection)
 * - Fade in / Fade out
 * - Silence selection
 * - Transient slice detection
 */

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function createAudioBuffer(channels: number, length: number, sampleRate: number): AudioBuffer {
  if (typeof AudioBuffer !== "undefined") {
    try {
      return new AudioBuffer({ length, numberOfChannels: channels, sampleRate });
    } catch {
      // fallback
    }
  }
  if (typeof OfflineAudioContext !== "undefined") {
    try {
      const ctx = new OfflineAudioContext(channels, length, sampleRate);
      return ctx.createBuffer(channels, length, sampleRate);
    } catch {
      // fallback
    }
  }

  // Node/Vitest test environment fallback
  const channelData: Float32Array[] = [];
  for (let c = 0; c < channels; c++) {
    channelData.push(new Float32Array(length));
  }

  return {
    numberOfChannels: channels,
    length,
    sampleRate,
    duration: length / sampleRate,
    getChannelData(c: number) {
      return channelData[c];
    },
    copyToChannel(src: Float32Array, c: number, offset = 0) {
      channelData[c].set(src, offset);
    },
    copyFromChannel(dst: Float32Array, c: number, offset = 0) {
      dst.set(channelData[c].subarray(offset, offset + dst.length));
    },
  } as unknown as AudioBuffer;
}

/** Creates a deep copy of an AudioBuffer. */
export function cloneAudioBuffer(buf: AudioBuffer): AudioBuffer {
  const out = createAudioBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    out.getChannelData(ch).set(buf.getChannelData(ch));
  }
  return out;
}

/** Trims an AudioBuffer to the specified fractional range [startFrac, endFrac]. */
export function trimBuffer(buf: AudioBuffer, startFrac: number, endFrac: number): AudioBuffer {
  const sFrac = clamp01(Math.min(startFrac, endFrac));
  const eFrac = clamp01(Math.max(startFrac, endFrac));
  const startFrame = Math.floor(sFrac * buf.length);
  const endFrame = Math.max(startFrame + 1, Math.ceil(eFrac * buf.length));
  const newLen = endFrame - startFrame;

  const out = createAudioBuffer(buf.numberOfChannels, newLen, buf.sampleRate);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const src = buf.getChannelData(ch).subarray(startFrame, endFrame);
    out.getChannelData(ch).set(src);
  }
  return out;
}

/** Normalizes the AudioBuffer so the absolute peak equals targetDbfs (-0.1 dBFS by default). */
export function normalizeBuffer(buf: AudioBuffer, targetDbfs = -0.1): AudioBuffer {
  const out = cloneAudioBuffer(buf);
  let peak = 0;

  for (let ch = 0; ch < out.numberOfChannels; ch++) {
    const data = out.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      const a = Math.abs(data[i]);
      if (a > peak) peak = a;
    }
  }

  if (peak < 0.00001) return out;

  const targetLinear = Math.pow(10, targetDbfs / 20);
  const gain = targetLinear / peak;

  for (let ch = 0; ch < out.numberOfChannels; ch++) {
    const data = out.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      data[i] *= gain;
    }
  }
  return out;
}

/** Reverses the entire buffer or a selected fractional range. */
export function reverseBufferRegion(buf: AudioBuffer, startFrac = 0, endFrac = 1): AudioBuffer {
  const out = cloneAudioBuffer(buf);
  const sFrac = clamp01(Math.min(startFrac, endFrac));
  const eFrac = clamp01(Math.max(startFrac, endFrac));
  const s = Math.floor(sFrac * buf.length);
  const e = Math.ceil(eFrac * buf.length);

  for (let ch = 0; ch < out.numberOfChannels; ch++) {
    const data = out.getChannelData(ch);
    const sub = data.subarray(s, e);
    const len = sub.length;
    for (let i = 0; i < Math.floor(len / 2); i++) {
      const tmp = sub[i];
      sub[i] = sub[len - 1 - i];
      sub[len - 1 - i] = tmp;
    }
  }
  return out;
}

/** Silences the selected fractional range. */
export function silenceRegion(buf: AudioBuffer, startFrac: number, endFrac: number): AudioBuffer {
  const out = cloneAudioBuffer(buf);
  const sFrac = clamp01(Math.min(startFrac, endFrac));
  const eFrac = clamp01(Math.max(startFrac, endFrac));
  const s = Math.floor(sFrac * buf.length);
  const e = Math.ceil(eFrac * buf.length);

  for (let ch = 0; ch < out.numberOfChannels; ch++) {
    const data = out.getChannelData(ch);
    for (let i = s; i < e; i++) {
      data[i] = 0;
    }
  }
  return out;
}

/** Applies a linear or smooth fade in or out across the fractional range. */
export function applyFadeRegion(
  buf: AudioBuffer,
  direction: "in" | "out",
  startFrac: number,
  endFrac: number,
): AudioBuffer {
  const out = cloneAudioBuffer(buf);
  const sFrac = clamp01(Math.min(startFrac, endFrac));
  const eFrac = clamp01(Math.max(startFrac, endFrac));
  const s = Math.floor(sFrac * buf.length);
  const e = Math.ceil(eFrac * buf.length);
  const span = Math.max(1, e - s);

  for (let ch = 0; ch < out.numberOfChannels; ch++) {
    const data = out.getChannelData(ch);
    for (let i = s; i < e; i++) {
      const progress = (i - s) / span;
      const gain = direction === "in" ? progress : 1 - progress;
      data[i] *= gain;
    }
  }
  return out;
}

/** Detects transient slice points (in 0..1 fractions of the buffer). */
export function detectSlicePoints(buf: AudioBuffer, threshold = 0.25): number[] {
  const len = buf.length;
  if (len < 512) return [0];

  const ch0 = buf.getChannelData(0);
  const ch1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : ch0;
  const blockSize = 256;
  const numBlocks = Math.floor(len / blockSize);
  const energies = new Float32Array(numBlocks);

  let maxFlux = 0;
  let prevEnergy = 0;

  for (let b = 0; b < numBlocks; b++) {
    let sum = 0;
    const offset = b * blockSize;
    for (let i = 0; i < blockSize; i++) {
      const s0 = ch0[offset + i];
      const s1 = ch1[offset + i];
      sum += (s0 * s0 + s1 * s1) * 0.5;
    }
    const currentEnergy = Math.sqrt(sum / blockSize);
    const flux = Math.max(0, currentEnergy - prevEnergy);
    energies[b] = flux;
    if (flux > maxFlux) maxFlux = flux;
    prevEnergy = currentEnergy;
  }

  const slices: number[] = [0];
  if (maxFlux < 0.001) return slices;

  const minDistanceBlocks = Math.floor((0.08 * buf.sampleRate) / blockSize); // ~80ms minimum gap
  let lastSliceBlock = -minDistanceBlocks;

  for (let b = 1; b < numBlocks - 1; b++) {
    const flux = energies[b];
    if (flux > maxFlux * threshold && b - lastSliceBlock >= minDistanceBlocks) {
      if (flux > energies[b - 1] && flux >= energies[b + 1]) {
        slices.push(Number(((b * blockSize) / len).toFixed(4)));
        lastSliceBlock = b;
      }
    }
  }

  return slices;
}
