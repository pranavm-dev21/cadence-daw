import { describe, expect, it } from "vitest";
import {
  normalizeSoftClipperParams,
  normalizeStereoShaperParams,
  normalizeChorusParams,
  SOFT_CLIPPER_DEFAULT,
  STEREO_SHAPER_DEFAULT,
  CHORUS_DEFAULT,
} from "./advancedFx";

describe("advancedFx parameter normalization", () => {
  it("clamps soft clipper values", () => {
    const res = normalizeSoftClipperParams({ threshold: -50, postGain: 30 });
    expect(res.threshold).toBe(-24);
    expect(res.postGain).toBe(12);

    const normal = normalizeSoftClipperParams(SOFT_CLIPPER_DEFAULT);
    expect(normal.threshold).toBe(-2);
    expect(normal.postGain).toBe(0);
  });

  it("clamps stereo shaper values", () => {
    const res = normalizeStereoShaperParams({
      width: 5,
      delayMs: 100,
      sideHighpass: 1000,
      phaseInvertL: true,
      phaseInvertR: false,
    });
    expect(res.width).toBe(2);
    expect(res.delayMs).toBe(30);
    expect(res.sideHighpass).toBe(400);
    expect(res.phaseInvertL).toBe(true);
  });

  it("clamps chorus values", () => {
    const res = normalizeChorusParams({ rate: 20, depth: 50, mix: 2, voices: 8 });
    expect(res.rate).toBe(8);
    expect(res.depth).toBe(10);
    expect(res.mix).toBe(1);
    expect(res.voices).toBe(3);
  });
});
