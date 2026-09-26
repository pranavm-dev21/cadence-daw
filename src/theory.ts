/* Music theory + deterministic pattern generators.
 * All generators are pure: (rng, project-ish params) => Note[]
 * The AI and the demo-project seeder share exactly the same code paths. */

import { Note, ScaleType, STEPS_PER_BAR, uid } from "./types";

/* ---------------- seeded RNG ---------------- */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export type Rng = () => number;
export const pick = <T,>(rng: Rng, arr: T[]): T => arr[Math.floor(rng() * arr.length)];
export const chance = (rng: Rng, p: number) => rng() < p;

/* ---------------- scales & chords ---------------- */
export const SCALES: Record<ScaleType, number[]> = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
};
/** chord quality per scale degree (0=min,1=maj,2=dim) */
const QUALITY: Record<ScaleType, number[]> = {
  minor: [0, 2, 1, 0, 0, 1, 1],
  major: [1, 0, 0, 1, 1, 0, 2],
};
export const MINOR_PENTA = [0, 3, 5, 7, 10];
export const MAJOR_PENTA = [0, 2, 4, 7, 9];

export const scaleDegree = (rootMidi: number, scale: ScaleType, degree: number) => {
  const s = SCALES[scale];
  const oct = Math.floor(degree / 7);
  return rootMidi + s[((degree % 7) + 7) % 7] + oct * 12;
};

export const isChordTone = (rootMidi: number, scale: ScaleType, degree: number, midi: number) => {
  const rel = (((midi - rootMidi) % 12) + 12) % 12;
  const tones = [0, 2, 4].map((i) => ((SCALES[scale][(degree + i) % 7] + (degree + i >= 7 ? 12 : 0)) % 12 + 12) % 12);
  return tones.includes(rel);
};

/** Diatonic triad at a scale degree, voiced around `center`. */
export function triad(rootMidi: number, scale: ScaleType, degree: number, center: number): number[] {
  const s = SCALES[scale];
  const notes = [0, 2, 4].map((i) => {
    const d = degree + i;
    return rootMidi + s[d % 7] + Math.floor(d / 7) * 12;
  });
  // shift voicing near center
  return notes.map((n) => {
    let v = n;
    while (v < center - 6) v += 12;
    while (v > center + 9) v -= 12;
    return v;
  });
}

export const PROGRESSIONS: Record<ScaleType, number[][]> = {
  minor: [[0, 5, 2, 6], [0, 3, 5, 4], [0, 5, 3, 4], [0, 2, 5, 6]],
  major: [[0, 5, 3, 4], [0, 3, 5, 4], [0, 4, 5, 3]],
};

export const ROMAN: Record<ScaleType, string[]> = {
  minor: ["i", "ii°", "III", "iv", "v", "VI", "VII"],
  major: ["I", "ii", "iii", "IV", "V", "vi", "vii°"],
};

const note = (pitch: number, start: number, dur: number, vel: number): Note => ({
  id: uid("n"), pitch, start, dur, vel,
});

/* ---------------- generators ---------------- */

/** energy: 0 sparse .. 2 dense */
export function genDrums(rng: Rng, energy: number, lengthBars: number, opts?: { fill?: boolean }): Note[] {
  const out: Note[] = [];
  const S = STEPS_PER_BAR;
  for (let bar = 0; bar < lengthBars; bar++) {
    const o = bar * S;
    const lastBar = bar === lengthBars - 1;
    const fill = opts?.fill && lastBar;

    // kick
    const kickSteps = energy >= 2 ? [0, 6, 8, 14] : energy === 1 ? [0, 8, 10] : [0, 8];
    for (const s of kickSteps) if (!(fill && s === 8)) out.push(note(0, o + s, 1, s === 0 ? 1 : 0.88));
    if (energy >= 1 && chance(rng, 0.5) && !fill) out.push(note(0, o + pick(rng, [3, 11]), 1, 0.7));

    // snare on 4 & 12
    out.push(note(1, o + 4, 1, 0.95));
    out.push(note(1, o + 12, 1, 0.95));
    if (fill) for (let i = 0; i < 4; i++) out.push(note(1, o + 12 + i, 1, 0.55 + i * 0.14));

    // hats
    const hatEvery = energy >= 2 ? 1 : 2;
    for (let s = 0; s < S; s += hatEvery) {
      if (fill && s < 12 && s % 2 === 0) continue;
      if (energy === 0 && s % 4 === 2) continue;
      out.push(note(2, o + s, 1, s % 4 === 0 ? 0.85 : 0.55 + rng() * 0.15));
    }
    // open hat
    if (energy >= 1 && !fill) out.push(note(3, o + (energy >= 2 ? 14 : 6), 2, 0.7));
    // clap layered with snare when energetic
    if (energy >= 1 && !fill) { out.push(note(4, o + 4, 1, 0.6)); out.push(note(4, o + 12, 1, 0.66)); }
  }
  return out;
}

export function genChords(
  rng: Rng, rootMidi: number, scale: ScaleType, lengthBars: number, energy: number,
  progression?: number[],
): Note[] {
  const prog = progression ?? pick(rng, PROGRESSIONS[scale]);
  const out: Note[] = [];
  const S = STEPS_PER_BAR;
  for (let bar = 0; bar < lengthBars; bar++) {
    const deg = prog[bar % prog.length];
    const chord = triad(rootMidi, scale, deg, rootMidi + 15);
    const o = bar * S;
    if (energy <= 0) {
      chord.forEach((p) => out.push(note(p, o, S, 0.62)));
    } else if (energy === 1) {
      chord.forEach((p) => { out.push(note(p, o, 8, 0.66)); out.push(note(p, o + 8, 8, 0.6)); });
    } else {
      for (const s of [0, 3, 6, 8, 11, 14]) {
        const stab = s % 4 === 0 ? chord : [pick(rng, chord), chord[1]];
        stab.forEach((p) => out.push(note(p, o + s, 2, s % 4 === 0 ? 0.6 : 0.42)));
      }
    }
  }
  return out;
}

export function genBass(
  rng: Rng, rootMidi: number, scale: ScaleType, lengthBars: number, energy: number,
  progression?: number[],
): Note[] {
  const prog = progression ?? pick(rng, PROGRESSIONS[scale]);
  const out: Note[] = [];
  const S = STEPS_PER_BAR;
  const s = SCALES[scale];
  for (let bar = 0; bar < lengthBars; bar++) {
    const deg = prog[bar % prog.length];
    const root = rootMidi - 12 + s[deg % 7];
    const fifth = root + 7;
    const o = bar * S;
    if (energy <= 0) {
      out.push(note(root, o, S, 0.85));
    } else if (energy === 1) {
      for (const st of [0, 4, 8, 12]) out.push(note(root, o + st, 3, st === 0 ? 0.9 : 0.74));
      if (chance(rng, 0.6)) out.push(note(fifth, o + 14, 2, 0.7));
    } else {
      for (const st of [0, 3, 6, 8, 11]) out.push(note(root, o + st, 2, st === 0 ? 0.92 : 0.72));
      out.push(note(chance(rng, 0.5) ? root + 12 : fifth, o + 14, 2, 0.78));
    }
  }
  return out;
}

export function genMelody(
  rng: Rng, rootMidi: number, scale: ScaleType, lengthBars: number, energy: number,
): Note[] {
  const out: Note[] = [];
  const S = STEPS_PER_BAR;
  const penta = (scale === "minor" ? MINOR_PENTA : MAJOR_PENTA).map((i) => rootMidi + 12 + i);
  const hi = rootMidi + 12 + 12;
  let idx = Math.floor(rng() * penta.length);

  // build a 1-bar motif, then repeat/vary it — the oldest trick in songwriting
  const motif: { start: number; dur: number; offset: number }[] = [];
  const rhythmPool =
    energy >= 2 ? [[0, 2], [2, 2], [4, 2], [6, 2], [8, 4], [12, 2], [14, 2]]
    : energy === 1 ? [[0, 4], [4, 2], [6, 2], [8, 4], [12, 4]]
    : [[0, 6], [8, 4], [12, 4]];
  for (const [start, dur] of rhythmPool) motif.push({ start, dur, offset: Math.floor(rng() * penta.length) - idx });

  for (let bar = 0; bar < lengthBars; bar++) {
    const o = bar * S;
    const vary = bar % 2 === 1;
    const last = bar === lengthBars - 1;
    for (const m of motif) {
      if (chance(rng, 0.16) && !last) continue; // drop a note for groove
      if (vary && chance(rng, 0.3)) continue;
      idx = Math.min(penta.length - 1, Math.max(0, idx + m.offset + (vary ? Math.floor(rng() * 3) - 1 : 0)));
      let p = penta[idx];
      if (last && m.start === 0) p = hi; // resolve home
      out.push(note(p, o + m.start, m.dur, m.start % 4 === 0 ? 0.85 : 0.62 + rng() * 0.18));
    }
  }
  return out;
}

export function padFromChords(chordNotes: Note[], rootMidi: number): Note[] {
  // long sustained chord tones, one octave down, gentle velocity
  const bars = Math.max(1, Math.ceil(Math.max(...chordNotes.map((n) => n.start + n.dur)) / STEPS_PER_BAR));
  const out: Note[] = [];
  const seen = new Set<string>();
  const S = STEPS_PER_BAR;
  for (let bar = 0; bar < bars; bar++) {
    const chord = new Set(
      chordNotes.filter((n) => Math.floor(n.start / S) === bar).map((n) => n.pitch),
    );
    chord.forEach((p) => {
      const key = `${bar}:${p}`;
      if (seen.has(key)) return;
      seen.add(key);
      let v = p;
      while (v > rootMidi + 8) v -= 12;
      out.push(note(v, bar * S, S, 0.4));
    });
  }
  return out;
}
