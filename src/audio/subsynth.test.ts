import { describe, expect, it } from "vitest";
import { SUBSYNTH_PRESETS, SynthPatch } from "./subsynth";

const WAVES = new Set(["sine", "triangle", "sawtooth", "square", "noise"]);
const FILTERS = new Set(["lowpass", "highpass", "bandpass"]);
const TARGETS = new Set(["pitch", "amplitude"]);

describe("SubSynth factory presets", () => {
  it("ships exactly 8 presets covering bass, pad, lead and pluck", () => {
    expect(SUBSYNTH_PRESETS).toHaveLength(8);
    const cats = new Set(SUBSYNTH_PRESETS.map((p) => p.category));
    expect(cats).toEqual(new Set(["bass", "pad", "lead", "pluck"]));
    for (const c of ["bass", "pad", "lead", "pluck"]) {
      expect(SUBSYNTH_PRESETS.filter((p) => p.category === c).length).toBeGreaterThanOrEqual(2);
    }
  });

  it("every preset has in-range, well-formed parameters", () => {
    for (const p of SUBSYNTH_PRESETS as SynthPatch[]) {
      expect(p.name.length).toBeGreaterThan(0);
      expect(["mono", "poly"]).toContain(p.mode);
      expect(p.glide).toBeGreaterThanOrEqual(0);

      expect(WAVES.has(p.osc1Wave)).toBe(true);
      expect(WAVES.has(p.osc2Wave)).toBe(true);
      expect(p.oscMix).toBeGreaterThanOrEqual(0);
      expect(p.oscMix).toBeLessThanOrEqual(1);

      expect(p.unison).toBeGreaterThanOrEqual(1);
      expect(p.unison).toBeLessThanOrEqual(8);
      expect(p.unisonSpread).toBeGreaterThanOrEqual(0);

      expect(FILTERS.has(p.filterType)).toBe(true);
      expect(p.cutoff).toBeGreaterThanOrEqual(20);
      expect(p.cutoff).toBeLessThanOrEqual(20000);
      expect(p.resonance).toBeGreaterThanOrEqual(0);

      for (const env of [p.amp, p.filterEnv]) {
        expect(env.attack).toBeGreaterThanOrEqual(0);
        expect(env.decay).toBeGreaterThanOrEqual(0);
        expect(env.sustain).toBeGreaterThanOrEqual(0);
        expect(env.sustain).toBeLessThanOrEqual(1);
        expect(env.release).toBeGreaterThanOrEqual(0);
      }
      expect(p.ampLevel).toBeGreaterThan(0);
      expect(p.ampLevel).toBeLessThanOrEqual(1);

      expect(p.lfoRate).toBeGreaterThanOrEqual(0);
      expect(p.lfoDepth).toBeGreaterThanOrEqual(0);
      expect(p.lfoDepth).toBeLessThanOrEqual(1);
      expect(TARGETS.has(p.lfoTarget)).toBe(true);
    }
  });

  it("mono presets reserve glide for bass/lead, pads stay poly", () => {
    for (const p of SUBSYNTH_PRESETS) {
      if (p.category === "pad") expect(p.mode).toBe("poly");
      if (p.mode === "mono") expect(["bass", "lead"]).toContain(p.category);
    }
  });
});
