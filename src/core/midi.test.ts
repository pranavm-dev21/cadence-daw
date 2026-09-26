import { describe, expect, it } from "vitest";
import type { Note } from "../types";
import {
  applyRecordedAppNotes, applySwing, clipEvents, fromMidi, normalizeNotes,
  pumpClipEvents, quantizeAppNotes, quantizeNotes, snapToGrid, toMidi,
  type MidiClip, type StepClock,
} from "./midi";

const n = (pitch: number, start: number, dur = 1, vel = 0.8): Note => ({
  id: `n${pitch}-${start}`, pitch, start, dur, vel,
});

/* A deterministic fake clock: step 0 at t=1.0s, each step 0.25s (60 BPM 16ths). */
const clock: StepClock = { timeOf: (step) => 1.0 + step * 0.25 };

describe("canonical model", () => {
  it("round-trips Note <-> MidiNote losslessly", () => {
    const note = n(60, 3.5, 2, 0.9);
    expect(fromMidi(toMidi(note))).toEqual(note);
  });
});

describe("normalizeNotes", () => {
  it("sorts by start then pitch, clamps velocity, drops out-of-range notes", () => {
    const total = 16;
    const out = normalizeNotes(
      [
        { id: "b", pitch: 62, velocity: 1.7, start: 4, duration: 1 },
        { id: "a", pitch: 60, velocity: 0.5, start: 4, duration: 1 },
        { id: "late", pitch: 64, velocity: 0.5, start: 99, duration: 1 }, // beyond clip
        { id: "neg", pitch: 50, velocity: 0.5, start: -2, duration: 1 }, // negative
      ],
      total,
    );
    expect(out.map((x) => x.id)).toEqual(["a", "b"]);
    expect(out[1].velocity).toBe(1); // clamped
  });
});

describe("quantize", () => {
  it("snaps to the grid at full strength", () => {
    const out = quantizeNotes(
      [{ id: "x", pitch: 60, velocity: 1, start: 1.3, duration: 1 }],
      { grid: 1, strength: 1 },
    );
    expect(out[0].start).toBe(1);
  });

  it("is a no-op at strength 0", () => {
    const out = quantizeNotes(
      [{ id: "x", pitch: 60, velocity: 1, start: 1.3, duration: 1 }],
      { grid: 1, strength: 0 },
    );
    expect(out[0].start).toBeCloseTo(1.3);
  });

  it("blends toward the grid at partial strength", () => {
    const out = quantizeNotes(
      [{ id: "x", pitch: 60, velocity: 1, start: 1.4, duration: 1 }],
      { grid: 1, strength: 0.5 },
    );
    // 1.4 + (1 - 1.4) * 0.5 = 1.2
    expect(out[0].start).toBeCloseTo(1.2);
  });

  it("swing delays off-beat notes but leaves on-grid notes alone", () => {
    // off-beat note at 0.5 (second half of a 1-step cell) with grid 1
    const off = applySwing(0.5, 1, 1);
    expect(off).toBeCloseTo(1.0); // pushed by swing * grid/2 = 0.5
    // on-grid note at 0.0 stays put
    expect(applySwing(0, 1, 1)).toBe(0);
  });

  it("quantizes app-format notes (bus shape)", () => {
    const out = quantizeAppNotes([n(60, 2.6, 1, 0.8)], { grid: 2, strength: 1 });
    expect(out[0].start).toBe(2); // 2.6 snaps to 2 on a 1/8 grid
    expect(out[0].dur).toBe(1);
  });
});

describe("recording modes", () => {
  const existing = [n(60, 0), n(62, 2)];
  const incoming = [n(64, 4), n(60, 0)]; // note 60@0 duplicates an existing one

  it("overdub appends and de-duplicates", () => {
    const out = applyRecordedAppNotes(existing, incoming, "overdub", 16);
    expect(out.map((x) => x.pitch)).toEqual([60, 62, 64]); // 60@0 not duplicated
  });

  it("replace clears the whole clip when no range given", () => {
    const out = applyRecordedAppNotes(existing, incoming, "replace", 16);
    expect(out.map((x) => ({ pitch: x.pitch, start: x.start }))).toEqual([{ pitch: 60, start: 0 }, { pitch: 64, start: 4 }]); // only the take, in canonical onset order
  });

  it("replace only clears the target range", () => {
    const out = applyRecordedAppNotes(existing, [n(64, 4)], "replace", 16, [4, 8]);
    // notes at 0 and 2 survive (outside [4,8)); new note lands at 4
    expect(out.map((x) => x.start).sort()).toEqual([0, 2, 4]);
  });
});

describe("sample-accurate playback (clock-driven)", () => {
  const clip: MidiClip = {
    id: "c", name: "C", lengthBars: 1,
    notes: [
      { id: "a", pitch: 60, velocity: 0.9, start: 0, duration: 2 },
      { id: "b", pitch: 62, velocity: 0.7, start: 1.5, duration: 1 }, // fractional start
    ],
  };

  it("emits on/off events at exact audio-clock times", () => {
    const ev = clipEvents(clip, 0, clock);
    const onA = ev.find((e) => e.noteId === "a" && e.type === "on")!;
    const offA = ev.find((e) => e.noteId === "a" && e.type === "off")!;
    const onB = ev.find((e) => e.noteId === "b" && e.type === "on")!;
    expect(onA.time).toBeCloseTo(1.0); // step 0
    expect(offA.time).toBeCloseTo(1.5); // step 0 + dur 2 -> 0.5s
    expect(onB.time).toBeCloseTo(1.375); // step 1.5 -> 1.0 + 1.5*0.25
  });

  it("pump advances a cursor over the scheduling horizon only", () => {
    const ev = clipEvents(clip, 0, clock).filter((e) => e.type === "on");
    const seen: number[] = [];
    const cursor = pumpClipEvents(ev, 0, 1.1, 0.2, (e) => seen.push(e.pitch));
    // horizon 1.1..1.3 catches only note a (on at 1.0 <= 1.3); note b at 1.375 is later
    expect(seen).toEqual([60]);
    expect(cursor).toBe(1);
  });
});

