import { validVocalSettings } from "./vocal";
/* Command vocabulary — the discrete, named operations that mutate a Project.
 *
 * Rules of the house:
 *  - A Command is a plain, serializable object with an `op` discriminant.
 *  - Commands never execute themselves; the bus validates them and hands them
 *    to the pure executors (src/core/executors.ts).
 *  - User gestures, the AI copilot and file imports all speak this same
 *    vocabulary — there is exactly one mutation path. */

import { AutomationEvent, AutomationLane, Clip, CurveKind, LoopRegion, Marker, Note, PunchRegion, ScaleType, TakeMeta, Track, TrackFx } from "../types";

export type Command =
  | { op: "set_lyrics"; text: string }
  | { op: "set_project_name"; name: string }
  | { op: "set_tempo"; bpm: number }
  | { op: "set_key"; rootMidi: number; scale: ScaleType }
  | { op: "set_length"; bars: number }
  | { op: "set_track_volume"; trackId: string; value: number }
  | { op: "set_track_pan"; trackId: string; value: number }
  | { op: "set_track_mute"; trackId: string; value: boolean }
  | { op: "set_track_solo"; trackId: string; value: boolean }
  | { op: "set_track_fx"; trackId: string; fx: Partial<TrackFx> }
  | { op: "rename_track"; trackId: string; name: string }
  | { op: "add_track"; track: Track }
  | { op: "remove_track"; trackId: string }
  | { op: "create_clip"; trackId: string; clip: Clip; placeBars?: number[]; makeSource?: boolean }
  | { op: "delete_clip"; trackId: string; clipId: string }
  | { op: "set_clip_content"; clipId: string; notes: Note[]; lengthBars?: number; name?: string }
  | { op: "add_notes"; clipId: string; notes: Note[] }
  | { op: "transpose_clip"; clipId: string; semitones: number }
  | { op: "place_clip"; trackId: string; clipId: string; bar: number }
  | { op: "remove_placement"; trackId: string; placementId: string }
  | { op: "clear_placements"; trackId?: string; range?: [number, number] }
  /* arrangement: placement trim/fade, split, duplicate, markers, loop region, grouping */
  | { op: "update_placement"; trackId: string; placementId: string; patch: PlacementPatch }
  | { op: "split_placement"; trackId: string; placementId: string; atStep: number }
  | { op: "duplicate_placement"; trackId: string; placementId: string; deltaBars: number }
  | { op: "set_markers"; markers: Marker[] }
  | { op: "set_loop_region"; region: LoopRegion | null }
  | { op: "set_track_group"; trackId: string; groupId: string | null }
  | { op: "set_track_color"; trackId: string; color: string }
  /* recording: per-track arm/monitor, takes (metadata), comp selection, punch */
  | { op: "set_track_record_arm"; trackId: string; value: boolean }
  | { op: "set_track_monitor"; trackId: string; value: boolean }
  | { op: "add_take"; trackId: string; take: TakeMeta; setActive?: boolean }
  | { op: "remove_take"; trackId: string; takeId: string }
  | { op: "set_active_take"; trackId: string; takeId: string | null }
  | { op: "set_punch_region"; region: PunchRegion | null }
  /* automation lanes */
  | { op: "upsert_automation_lane"; lane: AutomationLane }
  | { op: "set_automation_points"; laneId: string; points: AutomationEvent[] }
  | { op: "remove_automation_lane"; laneId: string }
  | { op: "set_automation_lock"; laneId: string; locked: boolean };

/** Partial placement edit — every field optional, all values clamped by the executor. */
export interface PlacementPatch {
  bar?: number;
  offsetSteps?: number;
  /** Audible length in bars (undefined = leave untouched). */
  lengthBars?: number;
  fadeIn?: number;
  fadeOut?: number;
}

export type CommandCategory = "structure" | "mix" | "midi" | "automation";

/** Human-readable metadata per op — used by inspectors/logs and future tooling. */
export const COMMAND_META: Record<Command["op"], { name: string; category: CommandCategory }> = {
  set_lyrics: { name: "Edit lyrics", category: "structure" },
  set_project_name: { name: "Rename project", category: "structure" },
  set_tempo: { name: "Set tempo", category: "structure" },
  set_key: { name: "Set key", category: "structure" },
  set_length: { name: "Resize timeline", category: "structure" },
  set_track_volume: { name: "Set track volume", category: "mix" },
  set_track_pan: { name: "Set track pan", category: "mix" },
  set_track_mute: { name: "Toggle mute", category: "mix" },
  set_track_solo: { name: "Toggle solo", category: "mix" },
  set_track_fx: { name: "Adjust track FX", category: "mix" },
  rename_track: { name: "Rename track", category: "structure" },
  add_track: { name: "Add track", category: "structure" },
  remove_track: { name: "Remove track", category: "structure" },
  create_clip: { name: "Create clip", category: "midi" },
  delete_clip: { name: "Delete clip", category: "midi" },
  set_clip_content: { name: "Edit clip notes", category: "midi" },
  add_notes: { name: "Add notes", category: "midi" },
  transpose_clip: { name: "Transpose clip", category: "midi" },
  place_clip: { name: "Place clip on timeline", category: "midi" },
  remove_placement: { name: "Remove clip block", category: "midi" },
  clear_placements: { name: "Clear timeline blocks", category: "midi" },
  update_placement: { name: "Edit clip block", category: "midi" },
  split_placement: { name: "Split clip block", category: "midi" },
  duplicate_placement: { name: "Duplicate clip block", category: "midi" },
  set_markers: { name: "Edit markers", category: "structure" },
  set_loop_region: { name: "Set loop region", category: "structure" },
  set_track_group: { name: "Set track group", category: "structure" },
  set_track_color: { name: "Set track color", category: "structure" },
  set_track_record_arm: { name: "Arm track for recording", category: "structure" },
  set_track_monitor: { name: "Toggle input monitoring", category: "mix" },
  add_take: { name: "Add recorded take", category: "structure" },
  remove_take: { name: "Delete take", category: "structure" },
  set_active_take: { name: "Select take (comp)", category: "structure" },
  set_punch_region: { name: "Set punch region", category: "structure" },
  upsert_automation_lane: { name: "Upsert automation lane", category: "automation" },
  set_automation_points: { name: "Edit automation points", category: "automation" },
  remove_automation_lane: { name: "Remove automation lane", category: "automation" },
  set_automation_lock: { name: "Lock/unlock automation lane", category: "automation" },
};

/* ---------------- schema validation ----------------
 * The bus rejects any command that fails this check — atomically, before a
 * single executor runs. Executors additionally clamp values, so validation is
 * a coarse gate (types, enums, sane bounds) rather than a duplicate of the
 * executor's fine-grained clamps. */

const isStr = (v: unknown, max = 512): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= max;
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isBool = (v: unknown): v is boolean => typeof v === "boolean";
const inRange = (v: number, lo: number, hi: number) => v >= lo && v <= hi;
const isInt = (v: number) => Number.isInteger(v);

const INSTRUMENTS: readonly string[] = ["drumkit", "bass", "keys", "pluck", "pad"];

function checkNotes(notes: unknown): string | null {
  if (!Array.isArray(notes)) return "notes must be an array";
  if (notes.length > 8192) return "too many notes in one command (> 8192)";
  for (const n of notes) {
    if (typeof n !== "object" || n === null) return "note must be an object";
    const note = n as Record<string, unknown>;
    if (!isStr(note.id, 128)) return "note.id must be a non-empty string";
    if (!isNum(note.pitch) || !isInt(note.pitch) || !inRange(note.pitch, 0, 127)) return "note.pitch must be an integer 0–127";
    if (!isNum(note.start) || !isInt(note.start) || !inRange(note.start, 0, 4096)) return "note.start must be an integer 0–4096";
    if (!isNum(note.dur) || !isInt(note.dur) || !inRange(note.dur, 1, 256)) return "note.dur must be an integer 1–256";
    if (!isNum(note.vel) || !inRange(note.vel, 0, 1)) return "note.vel must be a number 0–1";
  }
  return null;
}

const AUTOMATION_PARAMS = new Set<string>(["volume", "pan", "reverb", "delay", "cutoff", "drive"]);
const CURVES = new Set<string>(["linear", "smooth", "expUp", "expDown"]);
const isParam = (v: unknown): v is string => typeof v === "string" && AUTOMATION_PARAMS.has(v);

function checkAutomationPoints(points: unknown): string | null {
  if (!Array.isArray(points)) return "points must be an array";
  if (points.length > 4096) return "too many automation points (max 4096)";
  for (const p of points) {
    if (typeof p !== "object" || p === null) return "point must be an object";
    const pt = p as Record<string, unknown>;
    if (!isNum(pt.step) || !inRange(pt.step, 0, 4096)) return "point.step must be a number 0–4096";
    if (!isNum(pt.value) || !inRange(pt.value, 0, 1)) return "point.value must be a number 0–1";
    if (pt.curve !== undefined && (typeof pt.curve !== "string" || !CURVES.has(pt.curve))) {
      return "point.curve must be one of linear/smooth/expUp/expDown";
    }
  }
  return null;
}

function checkClipShape(clip: unknown): string | null {
  if (typeof clip !== "object" || clip === null) return "clip must be an object";
  const c = clip as Record<string, unknown>;
  if (!isStr(c.id, 128)) return "clip.id must be a non-empty string";
  if (!isStr(c.name, 64)) return "clip.name must be a non-empty string";
  if (!isNum(c.lengthBars) || !isInt(c.lengthBars) || !inRange(c.lengthBars, 1, 64)) return "clip.lengthBars must be an integer 1–64";
  return checkNotes(c.notes);
}

/** Returns an error message, or null when the command is well-formed. */
export function validateCommand(c: Command): string | null {
  if (typeof c !== "object" || c === null || typeof (c as { op?: unknown }).op !== "string") {
    return "command must be an object with an op";
  }
  switch (c.op) {
    case "set_lyrics":
      return typeof c.text === "string" && c.text.length <= 10000 ? null : "Lyrics must be at most 10000 characters";
    case "set_project_name":
      return isStr(c.name, 64) ? null : "name must be a non-empty string (≤ 64 chars)";
    case "set_tempo":
      return isNum(c.bpm) && inRange(c.bpm, 30, 300) ? null : "bpm must be a number 30–300";
    case "set_key":
      if (!isNum(c.rootMidi) || !isInt(c.rootMidi) || !inRange(c.rootMidi, 24, 108)) return "rootMidi must be an integer 24–108";
      return c.scale === "minor" || c.scale === "major" ? null : "scale must be 'minor' or 'major'";
    case "set_length":
      return isNum(c.bars) && isInt(c.bars) && inRange(c.bars, 1, 512) ? null : "bars must be an integer 1–512";
    case "set_track_volume":
      if (!isStr(c.trackId, 128)) return "trackId must be a non-empty string";
      return isNum(c.value) && inRange(c.value, 0, 2) ? null : "value must be a number 0–2";
    case "set_track_pan":
      if (!isStr(c.trackId, 128)) return "trackId must be a non-empty string";
      return isNum(c.value) && inRange(c.value, -1, 1) ? null : "value must be a number -1–1";
    case "set_track_mute":
    case "set_track_solo":
      if (!isStr(c.trackId, 128)) return "trackId must be a non-empty string";
      return isBool(c.value) ? null : "value must be a boolean";
    case "set_track_fx": {
      if (!isStr(c.trackId, 128)) return "trackId must be a non-empty string";
      if (typeof c.fx !== "object" || c.fx === null) return "fx must be an object";
      const fx = c.fx as Record<string, unknown>;
      if (fx.vocalBypass !== undefined && typeof fx.vocalBypass !== "boolean") return "Invalid vocal bypass";
      if (fx.vocal !== undefined && !validVocalSettings(fx.vocal)) return "Invalid vocal processing parameters";
      const bounds: [keyof TrackFx, number, number][] = [
        ["reverb", 0, 1], ["delay", 0, 1], ["cutoff", 50, 20000], ["drive", 0, 1],
      ];
      for (const [key, lo, hi] of bounds) {
        const v = fx[key];
        if (v !== undefined && (!isNum(v) || !inRange(v, lo, hi))) return `fx.${key} must be a number ${lo}–${hi}`;
      }
      return null;
    }
    case "rename_track":
      if (!isStr(c.trackId, 128)) return "trackId must be a non-empty string";
      return isStr(c.name, 40) ? null : "name must be a non-empty string (≤ 40 chars)";
    case "add_track": {
      const t = c.track as unknown as Record<string, unknown>;
      if (typeof t !== "object" || t === null) return "track must be an object";
      if (!isStr(t.id, 128)) return "track.id must be a non-empty string";
      if (!isStr(t.name, 40)) return "track.name must be a non-empty string";
      if (typeof t.instrument !== "string" || !INSTRUMENTS.includes(t.instrument)) return "track.instrument is not a known instrument";
      if (!isNum(t.volume) || !inRange(t.volume, 0, 2)) return "track.volume must be a number 0–2";
      if (!isNum(t.pan) || !inRange(t.pan, -1, 1)) return "track.pan must be a number -1–1";
      if (!Array.isArray(t.clipIds)) return "track.clipIds must be an array";
      return null;
    }
    case "remove_track":
      return isStr(c.trackId, 128) ? null : "trackId must be a non-empty string";
    case "create_clip": {
      if (!isStr(c.trackId, 128)) return "trackId must be a non-empty string";
      const clipErr = checkClipShape(c.clip);
      if (clipErr) return clipErr;
      if (c.placeBars !== undefined) {
        if (!Array.isArray(c.placeBars) || c.placeBars.length > 512) return "placeBars must be an array (≤ 512)";
        for (const b of c.placeBars) if (!isNum(b) || !isInt(b) || !inRange(b, 0, 4096)) return "placeBars entries must be integers 0–4096";
      }
      if (c.makeSource !== undefined && !isBool(c.makeSource)) return "makeSource must be a boolean";
      return null;
    }
    case "delete_clip":
      if (!isStr(c.trackId, 128)) return "trackId must be a non-empty string";
      return isStr(c.clipId, 128) ? null : "clipId must be a non-empty string";
    case "set_clip_content": {
      if (!isStr(c.clipId, 128)) return "clipId must be a non-empty string";
      const notesErr = checkNotes(c.notes);
      if (notesErr) return notesErr;
      if (c.lengthBars !== undefined && (!isNum(c.lengthBars) || !isInt(c.lengthBars) || !inRange(c.lengthBars, 1, 64))) {
        return "lengthBars must be an integer 1–64";
      }
      if (c.name !== undefined && !isStr(c.name, 64)) return "name must be a non-empty string (≤ 64 chars)";
      return null;
    }
    case "add_notes": {
      if (!isStr(c.clipId, 128)) return "clipId must be a non-empty string";
      return checkNotes(c.notes);
    }
    case "transpose_clip":
      if (!isStr(c.clipId, 128)) return "clipId must be a non-empty string";
      return isNum(c.semitones) && isInt(c.semitones) && inRange(c.semitones, -48, 48)
        ? null
        : "semitones must be an integer -48–48";
    case "place_clip":
      if (!isStr(c.trackId, 128)) return "trackId must be a non-empty string";
      if (!isStr(c.clipId, 128)) return "clipId must be a non-empty string";
      return isNum(c.bar) && isInt(c.bar) && inRange(c.bar, 0, 4096) ? null : "bar must be an integer 0–4096";
    case "remove_placement":
      if (!isStr(c.trackId, 128)) return "trackId must be a non-empty string";
      return isStr(c.placementId, 128) ? null : "placementId must be a non-empty string";
    case "clear_placements": {
      if (c.trackId !== undefined && !isStr(c.trackId, 128)) return "trackId must be a non-empty string";
      if (c.range !== undefined) {
        if (!Array.isArray(c.range) || c.range.length !== 2) return "range must be a [start, end] pair";
        for (const b of c.range) if (!isNum(b) || !isInt(b) || !inRange(b, 0, 4096)) return "range entries must be integers 0–4096";
      }
      return null;
    }
    case "update_placement": {
      if (!isStr(c.trackId, 128)) return "trackId must be a non-empty string";
      if (!isStr(c.placementId, 128)) return "placementId must be a non-empty string";
      if (typeof c.patch !== "object" || c.patch === null) return "patch must be an object";
      const pt = c.patch as Record<string, unknown>;
      if (pt.bar !== undefined && (!isNum(pt.bar) || !inRange(pt.bar, 0, 4096))) return "patch.bar must be a number 0–4096";
      if (pt.offsetSteps !== undefined && (!isNum(pt.offsetSteps) || !isInt(pt.offsetSteps) || !inRange(pt.offsetSteps, 0, 4096))) return "patch.offsetSteps must be an integer 0–4096";
      if (pt.lengthBars !== undefined && (!isNum(pt.lengthBars) || !inRange(pt.lengthBars, 1 / 16, 64))) return "patch.lengthBars must be a number ≥ 1/16";
      if (pt.fadeIn !== undefined && (!isNum(pt.fadeIn) || !isInt(pt.fadeIn) || !inRange(pt.fadeIn, 0, 256))) return "patch.fadeIn must be an integer 0–256";
      if (pt.fadeOut !== undefined && (!isNum(pt.fadeOut) || !isInt(pt.fadeOut) || !inRange(pt.fadeOut, 0, 256))) return "patch.fadeOut must be an integer 0–256";
      return null;
    }
    case "split_placement":
      if (!isStr(c.trackId, 128)) return "trackId must be a non-empty string";
      if (!isStr(c.placementId, 128)) return "placementId must be a non-empty string";
      return isNum(c.atStep) && isInt(c.atStep) && inRange(c.atStep, 1, 4095)
        ? null
        : "atStep must be an integer 1–4095";
    case "duplicate_placement":
      if (!isStr(c.trackId, 128)) return "trackId must be a non-empty string";
      if (!isStr(c.placementId, 128)) return "placementId must be a non-empty string";
      return isNum(c.deltaBars) && inRange(c.deltaBars, -4096, 4096) ? null : "deltaBars must be a number";
    case "set_markers": {
      if (!Array.isArray(c.markers)) return "markers must be an array";
      if (c.markers.length > 64) return "too many markers (max 64)";
      for (const m of c.markers) {
        if (typeof m !== "object" || m === null) return "marker must be an object";
        const mk = m as unknown as Record<string, unknown>;
        if (!isStr(mk.id, 128)) return "marker.id must be a non-empty string";
        if (!isNum(mk.bar) || !inRange(mk.bar, 0, 4096)) return "marker.bar must be a number 0–4096";
        if (!isStr(mk.label, 24)) return "marker.label must be a non-empty string (≤ 24 chars)";
      }
      return null;
    }
    case "set_loop_region": {
      if (c.region === null) return null;
      if (typeof c.region !== "object") return "region must be an object or null";
      const r = c.region as unknown as Record<string, unknown>;
      if (!isNum(r.startBar) || !inRange(r.startBar, 0, 4096)) return "region.startBar must be a number 0–4096";
      if (!isNum(r.endBar) || !inRange(r.endBar, 0, 4096)) return "region.endBar must be a number 0–4096";
      return r.endBar > r.startBar ? null : "region.endBar must be greater than startBar";
    }
    case "set_track_group":
      if (!isStr(c.trackId, 128)) return "trackId must be a non-empty string";
      if (c.groupId === null) return null;
      return isStr(c.groupId, 16) ? null : "groupId must be a non-empty string (≤ 16 chars) or null";
    case "set_track_color":
      if (!isStr(c.trackId, 128)) return "trackId must be a non-empty string";
      return isStr(c.color, 16) && /^#[0-9a-fA-F]{6}$/.test(c.color) ? null : "color must be a #rrggbb hex string";
    case "set_track_record_arm":
    case "set_track_monitor":
      if (!isStr(c.trackId, 128)) return "trackId must be a non-empty string";
      return isBool(c.value) ? null : "value must be a boolean";
    case "add_take": {
      if (!isStr(c.trackId, 128)) return "trackId must be a non-empty string";
      const t = c.take as unknown as Record<string, unknown>;
      if (typeof t !== "object" || t === null) return "take must be an object";
      if (!isStr(t.id, 128)) return "take.id must be a non-empty string";
      if (!isNum(t.offsetSteps) || !isInt(t.offsetSteps) || !inRange(t.offsetSteps, 0, 16 * 64)) return "take.offsetSteps must be an integer 0–1024";
      if (!isNum(t.durationSteps) || !isInt(t.durationSteps) || !inRange(t.durationSteps, 1, 16 * 64)) return "take.durationSteps must be an integer 1–1024";
      if (c.setActive !== undefined && !isBool(c.setActive)) return "setActive must be a boolean";
      return null;
    }
    case "remove_take":
      if (!isStr(c.trackId, 128)) return "trackId must be a non-empty string";
      return isStr(c.takeId, 128) ? null : "takeId must be a non-empty string";
    case "set_active_take":
      if (!isStr(c.trackId, 128)) return "trackId must be a non-empty string";
      return c.takeId === null || isStr(c.takeId, 128) ? null : "takeId must be a non-empty string or null";
    case "set_punch_region": {
      if (c.region === null) return null;
      if (typeof c.region !== "object") return "region must be an object or null";
      const r = c.region as unknown as Record<string, unknown>;
      if (!isNum(r.startBar) || !inRange(r.startBar, 0, 4096)) return "region.startBar must be a number 0–4096";
      if (!isNum(r.endBar) || !inRange(r.endBar, 0, 4096)) return "region.endBar must be a number 0–4096";
      return r.endBar > r.startBar ? null : "region.endBar must be greater than startBar";
    }
    case "upsert_automation_lane": {
      const l = c.lane as unknown as Record<string, unknown>;
      if (typeof l !== "object" || l === null) return "lane must be an object";
      if (!isStr(l.id, 128)) return "lane.id must be a non-empty string";
      if (!isStr(l.trackId, 128)) return "lane.trackId must be a non-empty string";
      if (!isParam(l.param)) return "lane.param is not an automatable parameter";
      if (!Array.isArray(l.points)) return "lane.points must be an array";
      const ptsErr = checkAutomationPoints(l.points);
      if (ptsErr) return ptsErr;
      return null;
    }
    case "set_automation_points":
      if (!isStr(c.laneId, 128)) return "laneId must be a non-empty string";
      return checkAutomationPoints(c.points);
    case "remove_automation_lane":
      return isStr(c.laneId, 128) ? null : "laneId must be a non-empty string";
    case "set_automation_lock":
      if (!isStr(c.laneId, 128)) return "laneId must be a non-empty string";
      return isBool(c.locked) ? null : "locked must be a boolean";
    default:
      return "unknown command op";
  }
}

