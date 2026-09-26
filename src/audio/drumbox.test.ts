import { describe, it, expect } from "vitest";
import {
  DRUM_SLOTS, SLOT_META, boomBapPattern, trapPattern, housePattern, starterPatterns,
  makePattern, setHit, setStepVel, setStepCount, duplicatePattern,
} from "./drumbox";

const lane = (slot: (typeof DRUM_SLOTS)[number]) => DRUM_SLOTS.indexOf(slot);

describe("drum slots", () => {
  it("exposes the seven requested slots in order", () => {
    expect(DRUM_SLOTS).toEqual(["kick", "snare", "closedhat", "openhat", "clap", "perc", "808"]);
  });
  it("every slot has display metadata", () => {
    for (const s of DRUM_SLOTS) {
      expect(SLOT_META[s].label.length).toBeGreaterThan(0);
      expect(SLOT_META[s].color).toMatch(/^#/);
    }
  });
});

describe("starter patterns", () => {
  it("provides the three named starters with 7 lanes each", () => {
    const starters = starterPatterns();
    expect(starters).toHaveLength(3);
    for (const p of starters) {
      expect(p.steps).toHaveLength(7);
      for (const row of p.steps) expect(row).toHaveLength(p.stepCount);
      expect(p.swing).toBeGreaterThanOrEqual(0);
      expect(p.swing).toBeLessThanOrEqual(1);
    }
  });

  it("boom bap: swung, kick on 1, snares on 2 & 4", () => {
    const p = boomBapPattern();
    expect(p.stepCount).toBe(16);
    expect(p.swing).toBeGreaterThan(0.5);
    expect(p.steps[lane("kick")][0].on).toBe(true);
    expect(p.steps[lane("snare")][4].on).toBe(true);
    expect(p.steps[lane("snare")][12].on).toBe(true);
  });

  it("trap: straight, 808 present, snare on the 3", () => {
    const p = trapPattern();
    expect(p.swing).toBe(0);
    expect(p.steps[lane("808")][0].on).toBe(true);
    expect(p.steps[lane("snare")][8].on).toBe(true);
  });

  it("house: four-on-the-floor kicks, off-beat open hats", () => {
    const p = housePattern();
    for (const s of [0, 4, 8, 12]) expect(p.steps[lane("kick")][s].on).toBe(true);
    for (const s of [2, 6, 10, 14]) expect(p.steps[lane("openhat")][s].on).toBe(true);
  });
});

describe("step operations", () => {
  it("setHit toggles on/off and stores velocity", () => {
    let p = makePattern("t", 16);
    p = setHit(p, 0, 3, true, 0.6);
    expect(p.steps[0][3]).toEqual({ on: true, vel: 0.6 });
    p = setHit(p, 0, 3, false);
    expect(p.steps[0][3].on).toBe(false);
  });

  it("setHit ignores out-of-range steps", () => {
    const p = makePattern("t", 8);
    expect(setHit(p, 0, 31, true)).toBe(p);
  });

  it("setStepVel clamps to [0.05, 1]", () => {
    let p = setHit(makePattern("t", 16), 2, 5, true);
    p = setStepVel(p, 2, 5, 5);
    expect(p.steps[2][5].vel).toBe(1);
    p = setStepVel(p, 2, 5, -1);
    expect(p.steps[2][5].vel).toBe(0.05);
  });

  it("setStepCount resizes and preserves existing hits", () => {
    let p = setHit(makePattern("t", 8), 0, 2, true, 0.9);
    p = setStepCount(p, 16);
    expect(p.stepCount).toBe(16);
    expect(p.steps[0]).toHaveLength(16);
    expect(p.steps[0][2].on).toBe(true);
    expect(p.steps[0][2].vel).toBe(0.9);
  });

  it("duplicatePattern deep-copies under a new id", () => {
    const a = setHit(makePattern("orig", 16), 1, 4, true, 0.7);
    const b = duplicatePattern(a);
    expect(b.id).not.toBe(a.id);
    expect(b.steps[1][4]).toEqual({ on: true, vel: 0.7 });
    // mutating the copy must not affect the original
    const c = setHit(b, 1, 4, false);
    expect(a.steps[1][4].on).toBe(true);
    expect(c.steps[1][4].on).toBe(false);
  });
});
