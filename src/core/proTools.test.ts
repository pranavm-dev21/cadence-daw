import { describe, expect, it } from "vitest";
import {
  applyStrum,
  applyHumanize,
  applyArp,
  applyFlam,
  CHORD_TEMPLATES,
  EXTENDED_SCALES,
} from "./proTools";
import { Note } from "../types";

describe("proTools music algorithms", () => {
  const sampleChord: Note[] = [
    { id: "n1", pitch: 60, start: 0, dur: 4, vel: 0.8 },
    { id: "n2", pitch: 64, start: 0, dur: 4, vel: 0.8 },
    { id: "n3", pitch: 67, start: 0, dur: 4, vel: 0.8 },
  ];

  it("applies strumming offset across simultaneous notes", () => {
    const strummed = applyStrum(sampleChord, 0.25, "up");
    expect(strummed.length).toBe(3);
    expect(strummed[0].start).toBe(0);
    expect(strummed[1].start).toBe(0.25);
    expect(strummed[2].start).toBe(0.5);
  });

  it("applies humanize without breaking note validity", () => {
    const humanized = applyHumanize(sampleChord, 0.1, 0.1);
    expect(humanized.length).toBe(3);
    for (const n of humanized) {
      expect(n.start).toBeGreaterThanOrEqual(0);
      expect(n.vel).toBeGreaterThan(0);
      expect(n.vel).toBeLessThanOrEqual(1.0);
    }
  });

  it("generates an arpeggiated sequence", () => {
    const arp = applyArp(sampleChord, "up", 1, 1);
    expect(arp.length).toBe(4); // 4 steps in a 4-beat duration
    expect(arp[0].pitch).toBe(60);
    expect(arp[1].pitch).toBe(64);
    expect(arp[2].pitch).toBe(67);
    expect(arp[3].pitch).toBe(60); // repeats
  });

  it("adds flam grace notes", () => {
    const notes: Note[] = [{ id: "snare", pitch: 60, start: 4, dur: 1, vel: 0.9 }];
    const flammed = applyFlam(notes, 0.25, 0.5);
    expect(flammed.length).toBe(2);
    expect(flammed[0].start).toBe(3.75); // grace note
    expect(flammed[1].start).toBe(4);    // original note
  });

  it("has valid chord templates and scale definitions", () => {
    expect(CHORD_TEMPLATES.length).toBeGreaterThanOrEqual(12);
    expect(EXTENDED_SCALES.blues.intervals).toContain(6); // tritone
  });
});
