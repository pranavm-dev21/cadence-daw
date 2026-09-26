import { describe, expect, it } from "vitest";
import {
  trimBuffer,
  normalizeBuffer,
  reverseBufferRegion,
  silenceRegion,
  applyFadeRegion,
  detectSlicePoints,
  createAudioBuffer,
} from "./sampleOperations";

describe("sampleOperations audio algorithms", () => {
  function makeTestBuffer(length = 1000, sampleRate = 44100): AudioBuffer {
    const buf = createAudioBuffer(1, length, sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = (i / length) * 0.5; // ramp from 0 to 0.5
    }
    return buf;
  }

  it("trims buffer to specified fractional range", () => {
    const buf = makeTestBuffer(1000);
    const trimmed = trimBuffer(buf, 0.2, 0.8);
    expect(trimmed.length).toBe(600);
  });

  it("normalizes buffer to target dBFS", () => {
    const buf = makeTestBuffer(1000);
    const normalized = normalizeBuffer(buf, 0); // 0 dBFS = peak 1.0
    const data = normalized.getChannelData(0);
    let max = 0;
    for (let i = 0; i < data.length; i++) {
      if (Math.abs(data[i]) > max) max = Math.abs(data[i]);
    }
    expect(max).toBeCloseTo(1.0, 2);
  });

  it("reverses a region in buffer", () => {
    const buf = makeTestBuffer(100);
    const reversed = reverseBufferRegion(buf, 0, 1);
    const data = reversed.getChannelData(0);
    // originally ramped 0 -> 0.5, so now data[0] should be around 0.5
    expect(data[0]).toBeGreaterThan(data[99]);
  });

  it("silences a region in buffer", () => {
    const buf = makeTestBuffer(100);
    const silenced = silenceRegion(buf, 0.25, 0.75);
    const data = silenced.getChannelData(0);
    expect(data[50]).toBe(0);
    expect(data[10]).toBeGreaterThan(0);
  });

  it("applies fade in to a region", () => {
    const buf = makeTestBuffer(100);
    const faded = applyFadeRegion(buf, "in", 0, 1);
    const data = faded.getChannelData(0);
    expect(data[0]).toBe(0);
    expect(data[99]).toBeGreaterThan(0);
  });

  it("detects slice points in buffer", () => {
    const buf = makeTestBuffer(4410); // 100ms
    const slices = detectSlicePoints(buf);
    expect(slices.length).toBeGreaterThanOrEqual(1);
    expect(slices[0]).toBe(0);
  });
});
