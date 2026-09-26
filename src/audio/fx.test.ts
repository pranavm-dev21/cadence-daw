/* Unit tests for the FX framework's context-free logic:
 * the CPU-cost model and every effect's parameter normalization. */

import { describe, expect, it } from "vitest";
import {
  NODE_COST,
  estimateGraphCost,
  normalizeEqParams,
  normalizeCompParams,
  normalizeLimiterParams,
  normalizeReverbParams,
  normalizeDelayParams,
  normalizeDistortionParams,
  normalizeUtilityParams,
  EQ_DEFAULT,
  COMP_DEFAULT,
  LIMITER_DEFAULT,
  REVERB_DEFAULT,
  DELAY_DEFAULT,
  DISTORTION_DEFAULT,
  UTILITY_DEFAULT,
  FX_KINDS,
} from "./fx";

describe("cpu cost model", () => {
  it("orders node types by weight (convolver heaviest, gain lightest)", () => {
    expect(NODE_COST.ConvolverNode).toBeGreaterThan(NODE_COST.DynamicsCompressorNode);
    expect(NODE_COST.DynamicsCompressorNode).toBeGreaterThan(NODE_COST.WaveShaperNode);
    expect(NODE_COST.WaveShaperNode).toBeGreaterThan(NODE_COST.BiquadFilterNode);
    expect(NODE_COST.BiquadFilterNode).toBeGreaterThan(NODE_COST.GainNode);
  });

  it("sums weights across a node list", () => {
    const cost = estimateGraphCost(["GainNode", "BiquadFilterNode", "ConvolverNode"]);
    expect(cost).toBe(NODE_COST.GainNode + NODE_COST.BiquadFilterNode + NODE_COST.ConvolverNode);
  });

  it("treats unknown nodes as cost 1 and empty graphs as 0", () => {
    expect(estimateGraphCost(["SomethingUnknown"])).toBe(1);
    expect(estimateGraphCost([])).toBe(0);
  });
});

describe("parameter normalization (clamping)", () => {
  it("EQ: clamps freq/gain/q and caps at 4 bands", () => {
    const p = normalizeEqParams({
      bands: [
        { type: "bell", freq: 999999, gain: 99, q: 99 },
        { type: "highpass", freq: -5, gain: -99, q: 0 },
        { type: "bell", freq: 100, gain: 0, q: 1 },
        { type: "bell", freq: 200, gain: 0, q: 1 },
        { type: "bell", freq: 300, gain: 0, q: 1 }, // 5th — dropped
      ],
    });
    expect(p.bands).toHaveLength(4);
    expect(p.bands[0].freq).toBe(20000);
    expect(p.bands[0].gain).toBe(24);
    expect(p.bands[0].q).toBe(18);
    expect(p.bands[1].freq).toBe(20);
    expect(p.bands[1].gain).toBe(-24);
    expect(p.bands[1].q).toBe(0.1);
  });

  it("Compressor: clamps into legal compressor ranges", () => {
    const p = normalizeCompParams({
      threshold: 10, ratio: 100, attack: 5, release: -1, knee: 99, makeup: 99,
    });
    expect(p.threshold).toBe(0);
    expect(p.ratio).toBe(20);
    expect(p.attack).toBeLessThanOrEqual(1);
    expect(p.release).toBeGreaterThanOrEqual(0.01);
    expect(p.knee).toBe(40);
    expect(p.makeup).toBe(8);
  });

  it("Limiter: clamps threshold/ceiling/release", () => {
    const p = normalizeLimiterParams({ threshold: 10, ceiling: 6, release: 99 });
    expect(p.threshold).toBe(0);
    expect(p.ceiling).toBe(0);
    expect(p.release).toBe(1);
  });

  it("Reverb: clamps and keeps decay below self-oscillation", () => {
    const p = normalizeReverbParams({ roomSize: 5, decay: 5, damping: -1, mix: 9 });
    expect(p.roomSize).toBe(1);
    expect(p.decay).toBeLessThanOrEqual(0.98);
    expect(p.damping).toBe(0);
    expect(p.mix).toBe(1);
  });

  it("Delay: clamps time/feedback/offset/mix", () => {
    const p = normalizeDelayParams({
      sync: "free", timeMs: 99999, feedback: 5, stereoOffsetMs: -5, mix: 3,
    });
    expect(p.timeMs).toBe(2000);
    expect(p.feedback).toBe(0.95);
    expect(p.stereoOffsetMs).toBe(0);
    expect(p.mix).toBe(1);
  });

  it("Distortion: clamps drive/tone/mix to 0..1", () => {
    const p = normalizeDistortionParams({ drive: 3, tone: -2, mix: 7 });
    expect(p.drive).toBe(1);
    expect(p.tone).toBe(0);
    expect(p.mix).toBe(1);
  });

  it("Utility: clamps gain/width and preserves booleans", () => {
    const p = normalizeUtilityParams({ gain: 99, invert: true, width: 9, mono: true });
    expect(p.gain).toBe(4);
    expect(p.width).toBe(2);
    expect(p.invert).toBe(true);
    expect(p.mono).toBe(true);
  });
});

describe("defaults are already normalized (idempotent)", () => {
  it("every default equals its own normalization", () => {
    expect(normalizeEqParams(EQ_DEFAULT)).toEqual(EQ_DEFAULT);
    expect(normalizeCompParams(COMP_DEFAULT)).toEqual(COMP_DEFAULT);
    expect(normalizeLimiterParams(LIMITER_DEFAULT)).toEqual(LIMITER_DEFAULT);
    expect(normalizeReverbParams(REVERB_DEFAULT)).toEqual(REVERB_DEFAULT);
    expect(normalizeDelayParams(DELAY_DEFAULT)).toEqual(DELAY_DEFAULT);
    expect(normalizeDistortionParams(DISTORTION_DEFAULT)).toEqual(DISTORTION_DEFAULT);
    expect(normalizeUtilityParams(UTILITY_DEFAULT)).toEqual(UTILITY_DEFAULT);
  });

  it("exposes all 7 effect kinds with labels", () => {
    expect(FX_KINDS).toHaveLength(7);
    for (const k of FX_KINDS) {
      expect(k.label.length).toBeGreaterThan(0);
      expect(k.blurb.length).toBeGreaterThan(0);
    }
  });
});
