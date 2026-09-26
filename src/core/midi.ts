/* MIDI engine — the canonical MIDI data model + playback/record/quantize logic.
 *
 * This is the application-layer MIDI core. It is pure and clock-agnostic: it never
 * touches an AudioContext or a DOM node, so it runs identically in tests, in the
 * (future) native backend, and in the AI worker. The single integration point with
 * real time is the `StepClock` interface — satisfied by the audio-clock-driven
 * `TransportClock` (src/audio/scheduler.ts). Because every event time is derived
 * from `clock.timeOf(step)`, MIDI playback is scheduled through the *same* audio
 * clock as the transport (Phase 2.1) — never a separate JS timer.
 *
 * Data model
 * ----------
 * The canonical MIDI note is `MidiNote { id, pitch, velocity, start, duration }`.
 * The app's wire format (`Note` in src/types.ts) uses the shorter `vel`/`dur`
 * field names in 1/16-step units; `fromApp`/`toApp` map between the two losslessly.
 * All algorithms operate on the canonical shape. */

import type { Clip, Note } from "../types";

/* ================= canonical model ================= */

export interface MidiNote {
  id: string;
  /** MIDI pitch 0..127 (melodic) or drum lane index. */
  pitch: number;
  /** Note velocity 0..1. */
  velocity: number;
  /** Start, in 1/16 steps, relative to the containing clip. */
  start: number;
  /** Duration, in 1/16 steps. */
  duration: number;
}

export const toMidi = (n: Note): MidiNote => ({
  id: n.id, pitch: n.pitch, velocity: n.vel, start: n.start, duration: n.dur,
});
export const fromMidi = (m: MidiNote): Note => ({
  id: m.id, pitch: m.pitch, vel: m.velocity, start: m.start, dur: m.duration,
});

/** A clip is a container of notes plus its extent. Structural, no audio. */
export interface MidiClip {
  id: string;
  name: string;
  lengthBars: number;
  notes: MidiNote[];
}
export const clipToMidi = (c: Clip): MidiClip => ({
  id: c.id, name: c.name, lengthBars: c.lengthBars, notes: c.notes.map(toMidi),
});

/** Total length of a clip in 1/16 steps. */
export const clipSteps = (c: { lengthBars: number }): number => c.lengthBars * 16;

/* ================= clip helpers ================= */

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Normalize a note set: sort by (start, pitch), clamp ranges, round positions to
 * a 1/64-step resolution, drop zero/negative durations and out-of-range notes.
 * Deterministic and total — safe to run on any imported/recorded data.
 */
export function normalizeNotes(notes: MidiNote[], totalSteps: number): MidiNote[] {
  const out: MidiNote[] = [];
  for (const n of notes) {
    const start = Math.round(n.start * 64) / 64;
    const duration = Math.max(0.25, Math.round(n.duration * 64) / 64);
    if (start < 0 || start >= totalSteps) continue;
    if (n.pitch < 0 || n.pitch > 127) continue;
    out.push({
      id: n.id,
      pitch: Math.round(n.pitch),
      velocity: clamp01(n.velocity),
      start,
      duration: Math.min(duration, totalSteps - start),
    });
  }
  out.sort((a, b) => a.start - b.start || a.pitch - b.pitch);
  return out;
}

/** Remove exact duplicates (same pitch + start), keeping the first occurrence. */
export function dedupeNotes(notes: MidiNote[]): MidiNote[] {
  const seen = new Set<string>();
  return notes.filter((n) => {
    const k = `${n.pitch}@${n.start}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/* ================= quantization ================= */

/** Quantize grid expressed in 1/16-step units. */
export const QUANTIZE_GRIDS: { label: string; steps: number }[] = [
  { label: "1/4", steps: 4 },
  { label: "1/8", steps: 2 },
  { label: "1/16", steps: 1 },
  { label: "1/32", steps: 0.5 },
];

export interface QuantizeOptions {
  /** Grid in 1/16 steps (e.g. 1 = 1/16, 0.5 = 1/32). */
  grid: number;
  /** 0 = leave as-is, 1 = hard snap. Values between give "humanize-preserving" partial quantize. */
  strength: number;
  /** 0..1 — delays off-grid (off-beat) notes by up to swing * grid/2. */
  swing?: number;
  /** Also snap note ends (duration). Default false. */
  duration?: boolean;
}

/** Snap a single position to the nearest multiple of `grid`. */
export function snapToGrid(value: number, grid: number): number {
  if (grid <= 0) return value;
  return Math.round(value / grid) * grid;
}

/**
 * Apply swing: notes that sit on the *off* half of a grid cell are delayed by
 * `swing * grid / 2`. On-grid notes are untouched. `swing` is 0..1.
 */
export function applySwing(value: number, grid: number, swing: number): number {
  if (grid <= 0 || swing <= 0) return value;
  const cell = Math.floor(value / grid);
  const half = grid / 2;
  const into = value - cell * grid;
  // off-beat if within the second half of the cell (tolerance = quarter cell)
  const isOff = Math.abs(into - half) < grid / 4;
  return isOff ? value + swing * half : value;
}

/**
 * Quantize note starts (and optionally ends). Pure: returns a new array.
 * `strength` blends original and snapped positions for musical, non-robotic results.
 */
export function quantizeNotes(notes: MidiNote[], opts: QuantizeOptions): MidiNote[] {
  const { grid, strength } = opts;
  const swing = opts.swing ?? 0;
  const s = clamp01(strength);
  if (grid <= 0 || s === 0) return notes.map((n) => ({ ...n }));

  return notes.map((n) => {
    const snappedStart = snapToGrid(n.start, grid);
    let start = n.start + (snappedStart - n.start) * s;
    start = applySwing(start, grid, swing * s);
    start = Math.max(0, Math.round(start * 64) / 64);

    let duration = n.duration;
    if (opts.duration) {
      const snappedEnd = snapToGrid(n.start + n.duration, grid);
      const end = n.start + n.duration + (snappedEnd - (n.start + n.duration)) * s;
      duration = Math.max(0.25, end - start);
    }
    return { ...n, start, duration };
  });
}

/** Quantize an app-format note array (the shape the command bus consumes). */
export function quantizeAppNotes(notes: Note[], opts: QuantizeOptions): Note[] {
  return quantizeNotes(notes.map(toMidi), opts).map(fromMidi);
}

/* ================= recording modes ================= */

export type RecordMode = "overdub" | "replace";

/**
 * Merge freshly recorded notes into a clip according to the recording mode.
 *  - `overdub`: keep everything already there, append the new notes, de-duplicated.
 *  - `replace`: clear the target `range` first (or the whole clip if omitted),
 *    then write the new notes.
 * Both paths normalize + sort so the result is always well-formed.
 */
export function applyRecordedNotes(
  existing: MidiNote[],
  incoming: MidiNote[],
  mode: RecordMode,
  totalSteps: number,
  range?: [number, number],
): MidiNote[] {
  const clean = normalizeNotes(incoming, totalSteps);
  if (mode === "overdub") {
    return normalizeNotes(dedupeNotes([...existing, ...clean]), totalSteps);
  }
  // replace
  const [lo, hi] = range ?? [0, totalSteps];
  const kept = existing.filter((n) => n.start < lo || n.start >= hi);
  return normalizeNotes([...kept, ...clean], totalSteps);
}

export function applyRecordedAppNotes(
  existing: Note[],
  incoming: Note[],
  mode: RecordMode,
  totalSteps: number,
  range?: [number, number],
): Note[] {
  return applyRecordedNotes(existing.map(toMidi), incoming.map(toMidi), mode, totalSteps, range).map(fromMidi);
}

/* ================= sample-accurate playback ================= */

/**
 * The minimal clock the MIDI playback engine needs. `TransportClock` implements
 * `timeOf` — so MIDI events are timed by the exact same audio clock as the
 * transport, making playback sample-accurate and jitter-immune.
 */
export interface StepClock {
  /** Audio-clock time (seconds) at which a given 1/16 step should sound. */
  timeOf(step: number): number;
}

export interface MidiEvent {
  type: "on" | "off";
  pitch: number;
  velocity: number;
  /** Absolute audio-clock time in seconds. */
  time: number;
  /** The clip-relative step this event corresponds to. */
  step: number;
  noteId: string;
}

/**
 * Expand a clip's notes into a flat, time-sorted stream of note-on/off events.
 * `clipStartStep` is where the clip sits on the transport timeline; the clock
 * converts every (clip-relative) step into an absolute audio-clock timestamp.
 *
 * This is deliberately *backend-agnostic*: it produces the timing plan only. The
 * engine (Web Audio today, native tomorrow) consumes the plan and triggers voices.
 * Keeping event generation pure means the scheduling math is unit-testable and
 * identical across backends.
 */
export function clipEvents(clip: MidiClip, clipStartStep: number, clock: StepClock): MidiEvent[] {
  const events: MidiEvent[] = [];
  for (const n of clip.notes) {
    const onStep = clipStartStep + n.start;
    const offStep = onStep + n.duration;
    events.push({ type: "on", pitch: n.pitch, velocity: n.velocity, time: clock.timeOf(onStep), step: onStep, noteId: n.id });
    events.push({ type: "off", pitch: n.pitch, velocity: n.velocity, time: clock.timeOf(offStep), step: offStep, noteId: n.id });
  }
  events.sort((a, b) => a.time - b.time || (a.type === "on" ? -1 : 1));
  return events;
}

/**
 * Drive playback: walk a clip's events and hand each to `emit` once its audio-clock
 * time is within the scheduling window `[now, now + horizon]`. Returns the events
 * consumed (so the caller can advance its cursor). Pure clock math — no timers.
 */
export function pumpClipEvents(
  events: MidiEvent[],
  cursor: number,
  now: number,
  horizon: number,
  emit: (e: MidiEvent) => void,
): number {
  let i = cursor;
  while (i < events.length && events[i].time <= now + horizon) {
    emit(events[i]);
    i++;
  }
  return i;
}
