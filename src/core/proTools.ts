/* Pro editing algorithms for Piano Roll and Channel Rack
 * - Chord stamping & voicings
 * - Arpeggiation engine
 * - Guitar/keys strumming offset
 * - Humanizer & micro-timing randomizer
 * - Flam (grace note) generator
 * - Expanded scale and mode definitions
 */

import { Note, uid } from "../types";

export interface ChordTemplate {
  name: string;
  category: "Major" | "Minor" | "Dominant" | "Extended" | "Suspended";
  intervals: number[]; // semitone offsets from root
}

export const CHORD_TEMPLATES: ChordTemplate[] = [
  // Major family
  { name: "Major Triad", category: "Major", intervals: [0, 4, 7] },
  { name: "Major 7th (Maj7)", category: "Major", intervals: [0, 4, 7, 11] },
  { name: "Major 9th (Maj9)", category: "Major", intervals: [0, 4, 7, 11, 14] },
  { name: "Major 6th (6)", category: "Major", intervals: [0, 4, 7, 9] },

  // Minor family
  { name: "Minor Triad", category: "Minor", intervals: [0, 3, 7] },
  { name: "Minor 7th (m7)", category: "Minor", intervals: [0, 3, 7, 10] },
  { name: "Minor 9th (m9)", category: "Minor", intervals: [0, 3, 7, 10, 14] },
  { name: "Minor 6th (m6)", category: "Minor", intervals: [0, 3, 7, 9] },

  // Dominant & Diminished
  { name: "Dominant 7th (7)", category: "Dominant", intervals: [0, 4, 7, 10] },
  { name: "Dominant 9th (9)", category: "Dominant", intervals: [0, 4, 7, 10, 14] },
  { name: "Diminished (dim)", category: "Dominant", intervals: [0, 3, 6] },
  { name: "Diminished 7th (dim7)", category: "Dominant", intervals: [0, 3, 6, 9] },
  { name: "Half-Diminished (m7b5)", category: "Dominant", intervals: [0, 3, 6, 10] },

  // Suspended & Add
  { name: "Suspended 2 (sus2)", category: "Suspended", intervals: [0, 2, 7] },
  { name: "Suspended 4 (sus4)", category: "Suspended", intervals: [0, 5, 7] },
  { name: "Add 9 (add9)", category: "Suspended", intervals: [0, 4, 7, 14] },
];

export interface ScaleDefinition {
  name: string;
  intervals: number[];
}

export const EXTENDED_SCALES: Record<string, ScaleDefinition> = {
  minor: { name: "Natural Minor (Aeolian)", intervals: [0, 2, 3, 5, 7, 8, 10] },
  major: { name: "Major (Ionian)", intervals: [0, 2, 4, 5, 7, 9, 11] },
  harmonic_minor: { name: "Harmonic Minor", intervals: [0, 2, 3, 5, 7, 8, 11] },
  dorian: { name: "Dorian Mode", intervals: [0, 2, 3, 5, 7, 9, 10] },
  phrygian: { name: "Phrygian Mode", intervals: [0, 1, 3, 5, 7, 8, 10] },
  lydian: { name: "Lydian Mode", intervals: [0, 2, 4, 6, 7, 9, 11] },
  mixolydian: { name: "Mixolydian Mode", intervals: [0, 2, 4, 5, 7, 9, 10] },
  minor_penta: { name: "Minor Pentatonic", intervals: [0, 3, 5, 7, 10] },
  major_penta: { name: "Major Pentatonic", intervals: [0, 2, 4, 7, 9] },
  blues: { name: "Blues Scale", intervals: [0, 3, 5, 6, 7, 10] },
};

/** Strum tool: offsets note start times within chords to simulate physical picking. */
export function applyStrum(notes: Note[], strumOffsetSteps = 0.25, direction: "up" | "down" = "up"): Note[] {
  // Group notes that start at approximately the same step
  const groups: Note[][] = [];
  const sorted = [...notes].sort((a, b) => a.start - b.start || a.pitch - b.pitch);

  let currentGroup: Note[] = [];
  for (const n of sorted) {
    if (currentGroup.length === 0 || Math.abs(n.start - currentGroup[0].start) < 0.2) {
      currentGroup.push(n);
    } else {
      groups.push(currentGroup);
      currentGroup = [n];
    }
  }
  if (currentGroup.length > 0) groups.push(currentGroup);

  const result: Note[] = [];
  for (const group of groups) {
    if (group.length <= 1) {
      result.push(...group);
      continue;
    }

    // Sort by pitch for strum order
    const byPitch = [...group].sort((a, b) => direction === "up" ? a.pitch - b.pitch : b.pitch - a.pitch);
    byPitch.forEach((n, idx) => {
      const offset = idx * strumOffsetSteps;
      result.push({
        ...n,
        start: n.start + offset,
        dur: Math.max(0.5, n.dur - offset * 0.5),
      });
    });
  }

  return result;
}

/** Humanizer: applies subtle timing and velocity jitter. */
export function applyHumanize(notes: Note[], timingAmount = 0.08, velocityAmount = 0.12): Note[] {
  return notes.map((n) => {
    const timingJitter = (Math.random() * 2 - 1) * timingAmount;
    const velJitter = (Math.random() * 2 - 1) * velocityAmount;

    return {
      ...n,
      start: Math.max(0, n.start + timingJitter),
      vel: Math.min(1.0, Math.max(0.1, n.vel + velJitter)),
    };
  });
}

/** Arpeggiator: generates an arpeggiated sequence from a list of notes or chords. */
export function applyArp(
  notes: Note[],
  pattern: "up" | "down" | "upDown" | "random" = "up",
  rateSteps = 1,
  octaves = 1,
): Note[] {
  if (notes.length === 0) return [];

  // Extract distinct pitches
  const pitches = Array.from(new Set(notes.map((n) => n.pitch))).sort((a, b) => a - b);
  const expandedPitches: number[] = [];

  for (let oct = 0; oct < octaves; oct++) {
    for (const p of pitches) {
      expandedPitches.push(p + oct * 12);
    }
  }

  let sequence: number[] = [];
  if (pattern === "up") {
    sequence = [...expandedPitches];
  } else if (pattern === "down") {
    sequence = [...expandedPitches].reverse();
  } else if (pattern === "upDown") {
    sequence = [...expandedPitches, ...[...expandedPitches].reverse().slice(1, -1)];
  } else {
    sequence = [...expandedPitches].sort(() => Math.random() - 0.5);
  }

  if (sequence.length === 0) sequence = pitches;

  const minStart = Math.min(...notes.map((n) => n.start));
  const maxEnd = Math.max(...notes.map((n) => n.start + n.dur));
  const totalLength = maxEnd - minStart;
  const stepCount = Math.max(1, Math.floor(totalLength / rateSteps));

  const result: Note[] = [];
  for (let i = 0; i < stepCount; i++) {
    const pitch = sequence[i % sequence.length];
    result.push({
      id: uid("arp"),
      pitch,
      start: minStart + i * rateSteps,
      dur: rateSteps * 0.9,
      vel: 0.85,
    });
  }

  return result;
}

/** Flam tool: adds a short grace note immediately before each note. */
export function applyFlam(notes: Note[], offsetSteps = 0.25, velocityScale = 0.6): Note[] {
  const result: Note[] = [];
  for (const n of notes) {
    if (n.start >= offsetSteps) {
      result.push({
        id: uid("flam"),
        pitch: n.pitch,
        start: n.start - offsetSteps,
        dur: offsetSteps * 0.8,
        vel: n.vel * velocityScale,
      });
    }
    result.push(n);
  }
  return result;
}
