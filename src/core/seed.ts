/* Demo + starter projects. The demo song "First Light" is generated with the
 * exact same generators the AI copilot uses — nothing is hand-placed. */

import { Clip, InstrumentKind, Project, Track, uid } from "../types";
import { genBass, genChords, genDrums, genMelody, mulberry32, padFromChords } from "../theory";
import { makeTrack } from "./executors";

const PROG = [0, 5, 2, 6]; // i – VI – III – VII  (Am F C G in A minor)

function wire(track: Track, clip: Clip, bars: number[], clips: Record<string, Clip>) {
  clips[clip.id] = clip;
  track.clipIds = [clip.id];
  track.sourceClipId = clip.id;
  track.placements = bars.map((bar) => ({ id: uid("pl"), clipId: clip.id, bar }));
}

export function buildDemoProject(): Project {
  const rng = mulberry32(20240517);
  const rootMidi = 57; // A3 → project key A minor
  const clips: Record<string, Clip> = {};

  const drums = makeTrack("drumkit", "Pulse Kit", "#ff6f61");
  wire(drums, { id: uid("clip"), name: "Beat A", lengthBars: 1, notes: genDrums(rng, 1, 1) }, [0, 1, 2, 3, 4, 5, 6, 7], clips);
  drums.volume = 0.95;
  drums.groupId = "A"; // rhythm section

  const bass = makeTrack("bass", "Subline", "#ffb45e");
  wire(bass, { id: uid("clip"), name: "Bass A", lengthBars: 2, notes: genBass(rng, rootMidi, "minor", 2, 1, PROG) }, [0, 2, 4, 6], clips);
  bass.groupId = "A";

  const keys = makeTrack("keys", "Glass Keys", "#3ecfb2");
  const chordNotes = genChords(rng, rootMidi, "minor", 4, 1, PROG);
  wire(keys, { id: uid("clip"), name: "Chords A", lengthBars: 4, notes: chordNotes }, [0, 4], clips);
  keys.volume = 0.7;
  keys.pan = -0.15;
  keys.groupId = "B"; // harmony section

  const lead = makeTrack("pluck", "Neon Pluck", "#58b7f5");
  wire(lead, { id: uid("clip"), name: "Hook", lengthBars: 2, notes: genMelody(rng, rootMidi, "minor", 2, 1) }, [2, 4, 6], clips);
  lead.pan = 0.18;
  lead.groupId = "B";

  const pad = makeTrack("pad", "Air Pad", "#a78bfa");
  wire(pad, { id: uid("clip"), name: "Wash", lengthBars: 4, notes: padFromChords(chordNotes, rootMidi) }, [0, 4], clips);
  pad.volume = 0.6;
  pad.pan = 0.1;
  pad.groupId = "B";

  const now = Date.now();
  return {
    name: "First Light",
    bpm: 100,
    rootMidi,
    scale: "minor",
    lengthBars: 8,
    timeSignature: { numerator: 4, denominator: 4 },
    automation: [],
    markers: [
      { id: uid("mk"), bar: 0, label: "Intro" },
      { id: uid("mk"), bar: 2, label: "Verse" },
      { id: uid("mk"), bar: 4, label: "Chorus" },
      { id: uid("mk"), bar: 6, label: "Outro" },
    ],
    loopRegion: null,
    punchRegion: null,
    tracks: [drums, bass, keys, lead, pad],
    clips,
    createdAt: now,
    modifiedAt: now,
  };
}

const STARTER: InstrumentKind[] = ["drumkit", "bass", "keys", "pluck"];
const STARTER_META: Record<string, [string, string]> = {
  drumkit: ["Drums", "#ff6f61"],
  bass: ["Bass", "#ffb45e"],
  keys: ["Keys", "#3ecfb2"],
  pluck: ["Lead", "#58b7f5"],
};

export function buildEmptyProject(): Project {
  const clips: Record<string, Clip> = {};
  const tracks = STARTER.map((kind) => {
    const t = makeTrack(kind, STARTER_META[kind][0], STARTER_META[kind][1]);
    clips[t.clipIds[0]] = { id: t.clipIds[0], name: `${t.name} 1`, lengthBars: 1, notes: [] };
    return t;
  });
  const now = Date.now();
  return {
    name: "Untitled Session",
    bpm: 110,
    rootMidi: 57,
    scale: "minor",
    lengthBars: 8,
    timeSignature: { numerator: 4, denominator: 4 },
    automation: [],
    markers: [],
    loopRegion: null,
    punchRegion: null,
    tracks,
    clips,
    createdAt: now,
    modifiedAt: now,
  };
}
