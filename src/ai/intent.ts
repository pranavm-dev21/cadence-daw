/* Cadence Copilot — the AI layer.
 *
 * Scope contract: the copilot is a MUSIC-CONTENT copilot. It generates and
 * edits MIDI — parts, patterns, energy, arrangement, tempo and key. It is not
 * a general assistant: no filesystem, shell, network or mixing-console
 * access. Mixer moves (volume, pan, mute, solo, FX) stay with the human.
 *
 * Safety contract: it never touches state directly. It parses intent →
 * emits DawCommands → the user approves plans → the shared executor applies
 * them → every batch is undoable. Deterministic seeded generators replace
 * heavyweight inference, so the copilot costs ~0 CPU/GPU when idle and stays
 * instant on low-spec machines — the real-time audio path is never blocked. */

import {
  Clip, DawCommand, InstrumentKind, Note, Project, Track, uid,
} from "../types";
import {
  genBass, genChords, genDrums, genMelody, mulberry32, padFromChords, Rng,
} from "../theory";
import { makeTrackWithClip } from "../core/executors";

export interface PlanItem { label: string; command: DawCommand; }
export type AiResult =
  | { kind: "reply"; text: string }
  | { kind: "run"; text: string; commands: DawCommand[] }
  | { kind: "plan"; title: string; summary: string; items: PlanItem[] };

/* ---------------- helpers ---------------- */

const INSTRUMENT_WORD: Record<string, InstrumentKind> = {
  drum: "drumkit", drums: "drumkit", kit: "drumkit", beat: "drumkit", percussion: "drumkit",
  kick: "drumkit", snare: "drumkit", hat: "drumkit", hats: "drumkit", clap: "drumkit",
  bass: "bass", sub: "bass",
  keys: "keys", chord: "keys", chords: "keys", piano: "keys", keyboard: "keys",
  lead: "pluck", pluck: "pluck", melody: "pluck", hook: "pluck",
  pad: "pad", atmosphere: "pad", ambient: "pad",
};

const TRACK_NAMES: Record<InstrumentKind, [string, string]> = {
  drumkit: ["Drums", "#ff6f61"],
  bass: ["Bass", "#ffb45e"],
  keys: ["Keys", "#3ecfb2"],
  pluck: ["Lead", "#58b7f5"],
  pad: ["Pad", "#a78bfa"],
};

function findTrack(p: Project, text: string): Track | null {
  for (const t of p.tracks) {
    if (text.includes(t.name.toLowerCase())) return t;
  }
  for (const [word, kind] of Object.entries(INSTRUMENT_WORD)) {
    if (new RegExp(`\\b${word}`).test(text)) {
      const t = p.tracks.find((tr) => tr.instrument === kind);
      if (t) return t;
    }
  }
  return null;
}

const findKind = (p: Project, kind: InstrumentKind) => p.tracks.find((t) => t.instrument === kind) ?? null;

const rngNow = (): Rng => mulberry32((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);

function drumEnergy(clip: Clip | undefined): number {
  if (!clip || clip.notes.length === 0) return 0;
  const perBar = clip.notes.length / clip.lengthBars;
  return perBar > 26 ? 2 : perBar > 14 ? 1 : 0;
}

function ensureTrack(p: Project, kind: InstrumentKind, items: PlanItem[], clipsToCreate: Clip[], name: string, color: string): Track {
  const existing = findKind(p, kind);
  if (existing) return existing;
  const { track, clip } = makeTrackWithClip(kind, name, color);
  track.volume = 0.8;
  track.fx = { reverb: kind === "pad" ? 0.4 : 0.1, delay: 0, cutoff: kind === "bass" ? 4200 : 12000, drive: 0 };
  clipsToCreate.push(clip);
  items.push({ label: `Add a new ${name} track`, command: { op: "add_track", track } });
  return track;
}

function emptyBars(p: Project, track: Track | null): number[] {
  const used = new Set((track?.placements ?? []).map((pl) => pl.bar));
  const bars: number[] = [];
  for (let b = 0; b < p.lengthBars; b++) if (!used.has(b)) bars.push(b);
  return bars;
}

function keyName(p: Project) {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  return `${names[((p.rootMidi % 12) + 12) % 12]} ${p.scale}`;
}

const SCOPE_REPLY =
  "That's outside my scope — I only generate and edit musical content (MIDI notes, patterns, arrangement, tempo, key). Levels, panning and effects live in the mixer and stay in your hands. Try \"add a melody\", \"make it more energetic\" or \"arrange my song\".";

/* ---------------- the parser ---------------- */

export function aiRespond(raw: string, p: Project): AiResult {
  const text = raw.toLowerCase().trim();
  const rng = rngNow();

  /* -- hard scope guards -- */
  if (/(export|download|upload|install|\bplugin|vst|folder|browse the web|internet|email|save (the )?(project|song|file)|open (a |the )?(file|project))/.test(text)) {
    return { kind: "reply", text: SCOPE_REPLY };
  }

  /* -- questions: redirect, don't lecture -- */
  if (text.endsWith("?") || /^(what|how|why|where|explain|define|tell me about|help me understand)\b/.test(text)) {
    if (/\b(help|what can you do|commands)\b/.test(text)) return { kind: "reply", text: CAPABILITIES };
    return {
      kind: "reply",
      text: "I'm a music copilot, not a tutor — for concepts, hover anything or check the guide in the left panel. What I can do is write music: \"add a bassline\", \"make the chorus more energetic\", \"arrange my song\"…",
    };
  }
  if (/\b(help|what can you do|commands)\b/.test(text) && text.length < 40) {
    return { kind: "reply", text: CAPABILITIES };
  }

  /* -- mixer-shaped requests are human territory -- */
  if (/(louder|quieter|volume|\bmute\b|\bsolo\b|\bpan\b|compress|eq\b|reverb|delay send|limiter|fx|effect)/.test(text)) {
    return {
      kind: "reply",
      text: "Mixing moves (volume, pan, mute, solo, FX) are yours — the mixer panel handles those, and every fader move is undoable. I stay in the notes: want me to add a part, reshape the energy, or arrange the song instead?",
    };
  }

  /* -- tempo -- */
  const bpmMatch = text.match(/(?:tempo|bpm|speed)\D{0,8}(\d{2,3})/) ?? text.match(/(\d{2,3})\s*bpm/);
  if (bpmMatch) {
    const bpm = Math.max(55, Math.min(200, parseInt(bpmMatch[1], 10)));
    return { kind: "run", text: `Setting the project tempo to ${bpm} BPM.`, commands: [{ op: "set_tempo", bpm }] };
  }
  if (/(faster|speed up)/.test(text)) return { kind: "run", text: `Nudging the tempo up to ${Math.min(200, p.bpm + 6)} BPM.`, commands: [{ op: "set_tempo", bpm: p.bpm + 6 }] };
  if (/(slower|slow down)/.test(text)) return { kind: "run", text: `Easing the tempo down to ${Math.max(55, p.bpm - 6)} BPM.`, commands: [{ op: "set_tempo", bpm: p.bpm - 6 }] };

  /* -- key -- */
  const keyMatch = text.match(/(?:key|scale)\s+(?:to|of|in)?\s*([a-g])(#|b|sharp|flat)?\s*(minor|major|maj|min)?/);
  if (keyMatch && /(change|switch|set|to|in)\b/.test(text)) {
    const idxMap: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
    let idx = idxMap[keyMatch[1].toLowerCase()];
    if (keyMatch[2] === "#" || keyMatch[2] === "sharp") idx += 1;
    if (keyMatch[2] === "b" || keyMatch[2] === "flat") idx -= 1;
    idx = ((idx % 12) + 12) % 12;
    let root = 48 + idx;
    while (root < 52) root += 12;
    const scale = keyMatch[3]?.startsWith("maj") ? "major" : "minor";
    return {
      kind: "run",
      text: `Switching the project key to ${["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"][idx]} ${scale}. New notes I write will follow it — existing clips keep their pitches.`,
      commands: [{ op: "set_key", rootMidi: root, scale }],
    };
  }

  /* -- transpose (MIDI edit) -- */
  const trMatch = text.match(/transpose\s+(\w+)?\s*(up|down)?\s*(\d+)?/);
  if (trMatch) {
    const t = findTrack(p, text) ?? findKind(p, "pluck") ?? p.tracks[0];
    const n = parseInt(trMatch[3] ?? "2", 10);
    const dir = trMatch[2] === "down" ? -1 : 1;
    const clip = p.clips[t.sourceClipId];
    if (clip && t.instrument !== "drumkit") {
      return { kind: "run", text: `Transposing ${clip.name} ${dir > 0 ? "up" : "down"} ${n} semitone${n > 1 ? "s" : ""}.`, commands: [{ op: "transpose_clip", clipId: clip.id, semitones: dir * n }] };
    }
  }

  /* -- arrangement -- */
  if (/(arrange|structure|full song|into a song|sections|intro.*chorus|verse)/.test(text)) {
    return arrangePlan(p, rng);
  }

  /* -- energy shaping -- */
  if (/(more energy|energetic|punchier|hype|intense|bigger drop|exciting|build( up)?)/.test(text)) return energyPlan(p, rng, +1);
  if (/(chill|calm|relax|softer vibe|mellow|less energy|laid back|lofi|lo-fi|strip(back|ped)?|minimal)/.test(text)) return energyPlan(p, rng, -1);

  /* -- part generation -- */
  if (/(drum|beat|groove|percussion|fill)\b/.test(text)) return partPlan(p, rng, "drumkit", text);
  if (/(bass(line)?)\b/.test(text)) return partPlan(p, rng, "bass", text);
  if (/(chord|harmony|keys|piano)\b/.test(text)) return partPlan(p, rng, "keys", text);
  if (/(melody|lead|hook|topline)\b/.test(text)) return partPlan(p, rng, "pluck", text);
  if (/(pad|atmosphere|texture|ambient)\b/.test(text)) return partPlan(p, rng, "pad", text);

  /* -- track scaffolding -- */
  if (/add (a |an )?track/.test(text)) {
    for (const [word, kind] of Object.entries(INSTRUMENT_WORD)) {
      if (text.includes(word)) {
        const items: PlanItem[] = [];
        const clips: Clip[] = [];
        const t = ensureTrack(p, kind, items, clips, TRACK_NAMES[kind][0], TRACK_NAMES[kind][1]);
        if (items.length === 0) return { kind: "reply", text: `You already have a ${TRACK_NAMES[kind][0]} track (${t.name}). Try "make a melody" or "add a pad".` };
        for (const c of clips) items.unshift({ label: `Create starter clip ${c.name}`, command: { op: "create_clip", trackId: t.id, clip: c } });
        return { kind: "plan", title: `Add ${TRACK_NAMES[kind][0]} track`, summary: "One new track with an empty starter clip, ready to paint onto the timeline.", items };
      }
    }
  }
  if (/(clear|empty) (the )?(clip|pattern|track)/.test(text)) {
    const t = findTrack(p, text) ?? p.tracks[0];
    const clip = p.clips[t.sourceClipId];
    if (clip) return { kind: "run", text: `Cleared ${clip.name} on ${t.name}. Undo brings it back.`, commands: [{ op: "set_clip_content", clipId: clip.id, notes: [] }] };
  }

  return {
    kind: "reply",
    text: `I didn't catch a music task in that. I compose and edit MIDI — try "add a melody", "make the drums busier", "set tempo to 128", "change key to C minor", "make it more energetic", or "arrange my song".`,
  };
}

/* ---------------- plan builders ---------------- */

function partPlan(p: Project, rng: Rng, kind: InstrumentKind, text: string): AiResult {
  const items: PlanItem[] = [];
  const clipsToCreate: Clip[] = [];
  const track = ensureTrack(p, kind, items, clipsToCreate, TRACK_NAMES[kind][0], TRACK_NAMES[kind][1]);
  const energetic = /(energetic|dense|busy|full)/.test(text);
  const sparse = /(simple|sparse|minimal|basic)/.test(text);
  const energy = energetic ? 2 : sparse ? 0 : 1;

  const existingClip = p.clips[track.sourceClipId];
  let notes: Note[];
  let label: string;
  if (kind === "drumkit") { notes = genDrums(rng, energy, 1); label = `Write a ${["minimal", "grooving", "dense"][energy]} drum pattern`; }
  else if (kind === "bass") { notes = genBass(rng, p.rootMidi, p.scale, 2, energy); label = `Compose a ${["root-note", "moving", "driving"][energy]} bassline (2 bars)`; }
  else if (kind === "keys") { notes = genChords(rng, p.rootMidi, p.scale, 4, energy); label = `Voice a 4-bar chord progression in ${keyName(p)}`; }
  else if (kind === "pluck") { notes = genMelody(rng, p.rootMidi, p.scale, 2, energy); label = `Sketch a ${["sparse", "singable", "busy"][energy]} melody (2 bars)`; }
  else {
    const chords = genChords(rng, p.rootMidi, p.scale, 4, 0);
    notes = padFromChords(chords, p.rootMidi);
    label = "Sustain soft pad chords under the progression";
  }

  const clipId = existingClip ? existingClip.id : (clipsToCreate[0]?.id ?? uid("clip"));
  if (!existingClip && clipsToCreate.length > 0) {
    // ensureTrack already queued add_track; fill the starter clip it created
    clipsToCreate[0].notes = notes;
    clipsToCreate[0].lengthBars = kind === "keys" || kind === "pad" ? 4 : kind === "drumkit" ? 1 : 2;
  }
  items.push({
    label,
    command: { op: "set_clip_content", clipId, notes, lengthBars: kind === "keys" || kind === "pad" ? 4 : kind === "drumkit" ? 1 : 2 },
  });

  const bars = emptyBars(p, track);
  if (bars.length > 0) {
    const clipLen = kind === "keys" || kind === "pad" ? 4 : kind === "drumkit" ? 1 : 2;
    const chosen: number[] = [];
    for (const b of bars) {
      if (chosen.some((c) => Math.abs(b - c) < clipLen)) continue;
      chosen.push(b);
    }
    items.push({
      label: `Place it on the timeline (bars ${chosen.map((b) => b + 1).join(", ")})`,
      command: { op: "create_clip", trackId: track.id, clip: { id: clipId, name: existingClip?.name ?? `${track.name} 1`, lengthBars: clipLen, notes }, placeBars: chosen, makeSource: false },
    });
  }

  return {
    kind: "plan",
    title: `${TRACK_NAMES[kind][0]} ${kind === "drumkit" ? "beat" : "part"} for "${p.name}"`,
    summary: `Generated in ${keyName(p)} at ${p.bpm} BPM. Approve to apply — one Ctrl+Z reverts everything.`,
    items,
  };
}

function energyPlan(p: Project, rng: Rng, dir: 1 | -1): AiResult {
  const items: PlanItem[] = [];
  const up = dir === 1;
  const drums = findKind(p, "drumkit");
  const bass = findKind(p, "bass");
  const lead = findKind(p, "pluck");

  const newBpm = Math.max(60, Math.min(165, p.bpm + dir * 6));
  if (newBpm !== p.bpm) {
    items.push({ label: `Tempo ${p.bpm} → ${newBpm} BPM`, command: { op: "set_tempo", bpm: newBpm } });
  }

  if (drums) {
    const clip = p.clips[drums.sourceClipId];
    const e = Math.max(0, Math.min(2, drumEnergy(clip) + dir));
    items.push({
      label: `Rewrite drums at energy ${e + 1}/3 (${up ? "tighter kicks, busier hats" : "sparser, more space"})`,
      command: { op: "set_clip_content", clipId: drums.sourceClipId, notes: genDrums(rng, e, clip?.lengthBars ?? 1) },
    });
    if (up) {
      items.push({
        label: `Snare fill into bar ${p.lengthBars}`,
        command: {
          op: "create_clip",
          trackId: drums.id,
          clip: { id: uid("clip"), name: "Fill", lengthBars: 1, notes: genDrums(rng, 2, 1, { fill: true }) },
          placeBars: [p.lengthBars - 1],
        },
      });
    }
  }

  if (bass) {
    const len = p.clips[bass.sourceClipId]?.lengthBars ?? 2;
    items.push({
      label: up ? "Bass: octave jumps and passing notes" : "Bass: long root notes only",
      command: { op: "set_clip_content", clipId: bass.sourceClipId, notes: genBass(rng, p.rootMidi, p.scale, len, up ? 2 : 0) },
    });
  }

  if (lead) {
    const len = p.clips[lead.sourceClipId]?.lengthBars ?? 2;
    items.push({
      label: up ? "Lead: denser, more motion" : "Lead: sparse, only the strong beats",
      command: { op: "set_clip_content", clipId: lead.sourceClipId, notes: genMelody(rng, p.rootMidi, p.scale, len, up ? 2 : 0) },
    });
  }

  return {
    kind: "plan",
    title: up ? "Raise the energy" : "Bring it down a notch",
    summary: up
      ? "Density and motion go up — tempo, drum density, a fill into the last bar, busier bass and lead. Pure MIDI; your mixer levels are untouched. Fully undoable."
      : "Space and calm go up — slower tempo, sparser drums, resting bass and lead. Pure MIDI; your mixer levels are untouched. Fully undoable.",
    items,
  };
}

function arrangePlan(p: Project, rng: Rng): AiResult {
  const items: PlanItem[] = [];
  const bars = 16;
  const rootMidi = p.rootMidi;
  const scale = p.scale;

  items.push({ label: "Extend the timeline to 16 bars", command: { op: "set_length", bars } });
  items.push({ label: "Clear current placements to re-structure", command: { op: "clear_placements" } });

  const mk = (name: string, notes: Note[], lengthBars: number): Clip => ({ id: uid("clip"), name, lengthBars, notes });

  const drums = ensureTrack(p, "drumkit", items, [], TRACK_NAMES.drumkit[0], TRACK_NAMES.drumkit[1]);
  const bass = ensureTrack(p, "bass", items, [], TRACK_NAMES.bass[0], TRACK_NAMES.bass[1]);
  const keys = ensureTrack(p, "keys", items, [], TRACK_NAMES.keys[0], TRACK_NAMES.keys[1]);
  const lead = ensureTrack(p, "pluck", items, [], TRACK_NAMES.pluck[0], TRACK_NAMES.pluck[1]);
  const pad = ensureTrack(p, "pad", items, [], TRACK_NAMES.pad[0], TRACK_NAMES.pad[1]);

  const introPerc = mk("Intro Perc", genDrums(rng, 0, 1), 1);
  const verseBeat = mk("Verse Beat", genDrums(rng, 1, 1), 1);
  const chorusBeat = mk("Chorus Beat", genDrums(rng, 2, 1), 1);
  const fill = mk("Fill", genDrums(rng, 2, 1, { fill: true }), 1);
  items.push({ label: "Intro: sparse percussion (bar 2)", command: { op: "create_clip", trackId: drums.id, clip: introPerc, placeBars: [1] } });
  items.push({ label: "Verse: steady groove (bars 3–6)", command: { op: "create_clip", trackId: drums.id, clip: verseBeat, placeBars: [2, 3, 4, 5] } });
  items.push({ label: "Chorus: full drums (bars 7–10, 13–15)", command: { op: "create_clip", trackId: drums.id, clip: chorusBeat, placeBars: [6, 7, 8, 9, 12, 13, 14] } });
  items.push({ label: "Drum fill into the final bar", command: { op: "create_clip", trackId: drums.id, clip: fill, placeBars: [15] } });

  const verseBass = mk("Verse Bass", genBass(rng, rootMidi, scale, 2, 1), 2);
  const chorusBass = mk("Chorus Bass", genBass(rng, rootMidi, scale, 2, 2), 2);
  items.push({ label: "Bass: verse motion (bars 3–6)", command: { op: "create_clip", trackId: bass.id, clip: verseBass, placeBars: [2, 4] } });
  items.push({ label: "Bass: driving chorus (bars 7–10, 13–16)", command: { op: "create_clip", trackId: bass.id, clip: chorusBass, placeBars: [6, 8, 12, 14] } });

  const verseChords = mk("Verse Chords", genChords(rng, rootMidi, scale, 4, 1), 4);
  const chorusChords = mk("Chorus Stabs", genChords(rng, rootMidi, scale, 4, 2), 4);
  items.push({ label: "Chords: verse voicing (bars 3–6)", command: { op: "create_clip", trackId: keys.id, clip: verseChords, placeBars: [2] } });
  items.push({ label: "Chords: chorus stabs (bars 7–10)", command: { op: "create_clip", trackId: keys.id, clip: chorusChords, placeBars: [6] } });
  items.push({ label: "Chords reprise (bars 13–16)", command: { op: "place_clip", trackId: keys.id, clipId: chorusChords.id, bar: 12 } });

  const hook = mk("Chorus Hook", genMelody(rng, rootMidi, scale, 2, 1), 2);
  items.push({ label: "Hook melody over both choruses", command: { op: "create_clip", trackId: lead.id, clip: hook, placeBars: [6, 8, 12, 14] } });

  const wash = mk("Intro Wash", padFromChords(genChords(rng, rootMidi, scale, 4, 0), rootMidi), 4);
  items.push({ label: "Pad wash across the intro (bars 1–4)", command: { op: "create_clip", trackId: pad.id, clip: wash, placeBars: [0] } });
  items.push({ label: "Pad returns for the bridge (bars 11–12)", command: { op: "place_clip", trackId: pad.id, clipId: wash.id, bar: 10 } });

  return {
    kind: "plan",
    title: "Structure: intro → verse → chorus → bridge → chorus",
    summary: `Turns your ${p.lengthBars}-bar loop into a 16-bar arrangement with contrast between sections — the fastest way to hear a "song" instead of a loop. Everything lands as normal clips you can edit afterwards.`,
    items,
  };
}

/* ---------------- capabilities ---------------- */

const CAPABILITIES = `I'm your music copilot — I write and edit MIDI, nothing else. Every change is one Ctrl+Z away:

• Create parts — "make a beat", "add a melody", "add chords", "add a bassline", "add a pad"
• Shape energy — "make it more energetic" or "make it chill"
• Structure — "arrange my song" (turns your loop into intro/verse/chorus)
• Direct edits — "set tempo to 128", "change key to C minor", "transpose the lead up 3", "clear the drum pattern"

Levels, panning and effects are human territory — that's what the mixer is for.`;
