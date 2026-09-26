/* Open DAW project file format — versioned JSON.
 *
 * Envelope (v1):
 * {
 *   "format": "open-daw",            // constant magic — never changes
 *   "version": 1,                    // integer, bumped on breaking changes
 *   "metadata":  { name, created, modified }        // ISO-8601 timestamps
 *   "tempo":     { bpm }
 *   "timeSignature": { numerator, denominator }     // optional, default 4/4
 *   "lengthBars": 8                                  // timeline extent
 *   "key":       { rootMidi, scale }
 *   "tracks":    [{ id, name, color, instrumentId, volume, pan, mute, solo,
 *                   clipIds, sourceClipId, placements[] }]
 *   "clips":     [{ id, name, lengthBars, notes[] }]
 *   "instruments": [{ id, kind, name, presetId }]   // tracks reference by id
 *   "effects":   [{ id, trackId, type, params }]    // per-track channel strips
 *   "automation": [{ id, trackId, param, points[] }]
 *   "routing":   { outputs[], assignments[] }       // all tracks → master today
 *   "samples":   []                                 // reserved — synthesis-only for now
 *   "presets":   []                                 // reserved — user presets
 * }
 *
 * Contract:
 *  - serialize(project) is a pure function of state (timestamps included),
 *    so save → reload is lossless and deep-equal.
 *  - deserialize(json) NEVER throws: it returns { ok, project } or
 *    { ok: false, error } with a human-readable reason — malformed file,
 *    unknown format, or a version from the future.
 *  - Old files are upgraded through MIGRATIONS instead of breaking; a file
 *    newer than the app is rejected with an explicit "update the app" error. */

import {
  AutomationLane, AutomationParam, Clip, CurveKind, InstrumentKind, Note, Placement,
  Project, PunchRegion, ScaleType, TakeMeta, TimeSignature, Track, TrackFx,
} from "../types";
import { validateProject } from "./validate";

export const FORMAT_ID = "open-daw";
export const CURRENT_VERSION = 1;

export type FileResult =
  | { ok: true; project: Project }
  | { ok: false; error: string };

/* ---------------- envelope shapes ---------------- */

interface FilePlacement { id: string; clipId: string; bar: number; }
interface FileNote { id: string; pitch: number; start: number; dur: number; vel: number; }
interface FileClip { id: string; name: string; lengthBars: number; notes: FileNote[]; }
/** Take metadata only — raw PCM lives separately in IndexedDB. */
interface FileTake { id: string; name: string; offsetSteps: number; durationSteps: number; deviceId: string; deviceLabel: string; latencyMs: number; peak: number; }
interface FileTrack {
  id: string; name: string; color: string; instrumentId: string;
  volume: number; pan: number; mute: boolean; solo: boolean;
  clipIds: string[]; sourceClipId: string; placements: FilePlacement[];
  groupId: string | null;
  recordArm: boolean; monitor: boolean;
  takes: FileTake[]; activeTakeId: string | null;
}
interface FileInstrument { id: string; kind: InstrumentKind; name: string; presetId: string | null; }
interface FileEffect { id: string; trackId: string; type: "channel-strip"; params: TrackFx; }
interface FileAutomation { id: string; trackId: string; param: AutomationParam; locked?: boolean; points: { step: number; value: number; curve?: CurveKind }[]; }
interface FileRouting {
  outputs: { id: string; name: string }[];
  assignments: { trackId: string; output: string }[];
}

export interface ProjectFileV1 {
  format: typeof FORMAT_ID;
  version: 1;
  metadata: { name: string; created: string; modified: string };
  lyrics?: string;
  tempo: { bpm: number };
  timeSignature: { numerator: number; denominator: number };
  lengthBars: number;
  key: { rootMidi: number; scale: ScaleType };
  tracks: FileTrack[];
  clips: FileClip[];
  instruments: FileInstrument[];
  effects: FileEffect[];
  automation: FileAutomation[];
  routing: FileRouting;
  samples: unknown[];
  presets: unknown[];
  /** Arrangement markers pinned to bars. */
  markers: { id: string; bar: number; label: string }[];
  /** Loop region in bars, or null = loop the whole timeline. */
  loopRegion: { startBar: number; endBar: number } | null;
  /** Punch-in/out region for audio recording, or null = no punch. */
  punchRegion: { startBar: number; endBar: number } | null;
}

/* ---------------- serialize ---------------- */

export function serialize(project: Project): string {
  return JSON.stringify(toV1Doc(project), null, 2);
}

/** Pure state → v1 envelope (also reused by the v0→v1 migration). */
export function toV1Doc(p: Project): ProjectFileV1 {
  const instruments: FileInstrument[] = p.tracks.map((t) => ({
    id: `inst_${t.id}`,
    kind: t.instrument,
    name: t.name,
    presetId: null,
  }));
  const effects: FileEffect[] = p.tracks.map((t) => ({
    id: `fx_${t.id}`,
    trackId: t.id,
    type: "channel-strip" as const,
    params: { ...t.fx },
  }));
  return {
    format: FORMAT_ID,
    ...(p.lyrics !== undefined ? { lyrics: p.lyrics } : {}),
    version: 1,
    metadata: {
      name: p.name,
      created: new Date(p.createdAt).toISOString(),
      modified: new Date(p.modifiedAt).toISOString(),
    },
    tempo: { bpm: p.bpm },
    timeSignature: { ...p.timeSignature },
    lengthBars: p.lengthBars,
    key: { rootMidi: p.rootMidi, scale: p.scale },
    tracks: p.tracks.map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      instrumentId: `inst_${t.id}`,
      volume: t.volume,
      pan: t.pan,
      mute: t.mute,
      solo: t.solo,
      clipIds: [...t.clipIds],
      sourceClipId: t.sourceClipId,
      placements: t.placements.map((pl) => ({ ...pl })),
      groupId: t.groupId ?? null,
      recordArm: t.recordArm,
      monitor: t.monitor,
      takes: t.takes.map((tk) => ({ ...tk })),
      activeTakeId: t.activeTakeId,
    })),
    clips: Object.values(p.clips).map((c) => ({
      id: c.id,
      name: c.name,
      lengthBars: c.lengthBars,
      notes: c.notes.map((n) => ({ ...n })),
    })),
    instruments,
    effects,
    automation: p.automation.map((a) => ({
      id: a.id,
      trackId: a.trackId,
      param: a.param,
      ...(a.locked !== undefined ? { locked: a.locked } : {}),
      points: a.points.map((pt) => ({ step: pt.step, value: pt.value, ...(pt.curve ? { curve: pt.curve } : {}) })),
    })),
    routing: {
      outputs: [{ id: "master", name: "Master" }],
      assignments: p.tracks.map((t) => ({ trackId: t.id, output: "master" })),
    },
    samples: [],
    presets: [],
    markers: p.markers.map((m) => ({ ...m })),
    loopRegion: p.loopRegion ? { ...p.loopRegion } : null,
    punchRegion: p.punchRegion ? { ...p.punchRegion } : null,
  };
}

/* ---------------- migrations ---------------- */

export interface Migration {
  from: number;
  to: number;
  migrate: (doc: Record<string, unknown>) => Record<string, unknown>;
}

/** v0 = pre-format saves: the raw Project JSON, or the old
 *  { app: "cadence", format: 1, ...project } wrapper this app shipped briefly. */
function migrateV0ToV1(doc: Record<string, unknown>): Record<string, unknown> {
  const raw = (doc.legacy ?? doc) as Record<string, unknown>;
  const inner = (raw.project && typeof raw.project === "object" ? raw.project : raw) as Record<string, unknown>;
  const res = validateProject(inner);
  if (!res.ok) throw new Error(`legacy file could not be upgraded: ${res.error}`);
  const now = Date.now();
  const stamped: Project = { ...res.project, createdAt: res.project.createdAt || now, modifiedAt: now };
  return toV1Doc(stamped) as unknown as Record<string, unknown>;
}

/** Add an entry per breaking change; the registry walks files forward step by step. */
export const MIGRATIONS: Migration[] = [
  { from: 0, to: 1, migrate: migrateV0ToV1 },
];

function runMigrations(doc: Record<string, unknown>): { ok: true; doc: Record<string, unknown> } | { ok: false; error: string } {
  let version = typeof doc.version === "number" ? doc.version : NaN;
  if (!Number.isInteger(version)) return { ok: false, error: "'version' must be an integer" };
  if (version > CURRENT_VERSION) {
    return {
      ok: false,
      error: `This file uses project format v${version}, but this build of Open DAW supports up to v${CURRENT_VERSION}. It was saved by a newer version — please update the app to open it.`,
    };
  }
  let current = doc;
  let guard = 0;
  while (version < CURRENT_VERSION) {
    if (++guard > 64) return { ok: false, error: "Migration chain is broken (loop detected)" };
    const m = MIGRATIONS.find((x) => x.from === version);
    if (!m) return { ok: false, error: `No upgrade path exists from file version ${version} to v${CURRENT_VERSION}.` };
    try {
      current = m.migrate(current);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : `Migration from v${version} failed.` };
    }
    version = typeof current.version === "number" ? current.version : NaN;
    if (!Number.isInteger(version)) return { ok: false, error: `Migration from v${m.from} produced a document without a valid version.` };
  }
  return { ok: true, doc: current };
}

/* ---------------- deserialize ---------------- */

const err = (error: string): FileResult => ({ ok: false, error });

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function deserialize(json: string): FileResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json.slice(0, 8 * 1024 * 1024)); // 8 MB hard cap
  } catch {
    return err("File is not valid JSON — it may be truncated or corrupted.");
  }
  if (!isObj(parsed)) return err("File is not an Open DAW project (expected a JSON object).");

  /* detect legacy pre-format saves and route them through the registry as v0 */
  if (parsed.format !== FORMAT_ID) {
    const looksLegacy = Array.isArray(parsed.tracks) && typeof parsed.bpm === "number";
    const looksCadence = parsed.app === "cadence" && Array.isArray(parsed.tracks);
    if (looksLegacy || looksCadence) {
      parsed = { format: FORMAT_ID, version: 0, legacy: parsed };
    } else {
      return err(`Unknown file format${typeof parsed.format === "string" ? ` "${String(parsed.format)}"` : ""} — expected "${FORMAT_ID}".`);
    }
  }

  const migrated = runMigrations(parsed as Record<string, unknown>);
  if (!migrated.ok) return err(migrated.error);
  return fromV1Doc(migrated.doc);
}

function fromV1Doc(raw: Record<string, unknown>): FileResult {
  const at = (path: string, cond: boolean, msg: string): string | null => (cond ? null : `${path}: ${msg}`);

  let problem: string | null = null;
  const need = (p: string, cond: boolean, msg: string) => { if (!problem) problem = at(p, cond, msg); };

  need("version", raw.version === CURRENT_VERSION, `expected ${CURRENT_VERSION} after migration, got ${String(raw.version)}`);
  need("metadata", isObj(raw.metadata), "must be an object");
  const meta = isObj(raw.metadata) ? raw.metadata : {};
  need("metadata.name", typeof meta.name === "string" && meta.name.length > 0, "must be a non-empty string");
  need("tempo", isObj(raw.tempo), "must be an object like { \"bpm\": 120 }");
  const tempo = isObj(raw.tempo) ? raw.tempo : {};
  need("tempo.bpm", typeof tempo.bpm === "number" && Number.isFinite(tempo.bpm), "must be a number");
  need("key", isObj(raw.key), "must be an object like { \"rootMidi\": 57, \"scale\": \"minor\" }");
  const key = isObj(raw.key) ? raw.key : {};
  need("key.rootMidi", typeof key.rootMidi === "number" && Number.isFinite(key.rootMidi), "must be a MIDI note number");
  need("key.scale", key.scale === "minor" || key.scale === "major", "must be \"minor\" or \"major\"");
  need("tracks", Array.isArray(raw.tracks), "must be an array");
  need("clips", Array.isArray(raw.clips), "must be an array");
  if (raw.lengthBars !== undefined) {
    need("lengthBars", typeof raw.lengthBars === "number" && Number.isInteger(raw.lengthBars) && raw.lengthBars >= 1, "must be a positive integer");
  }
  for (const f of ["instruments", "effects", "automation", "samples", "presets"] as const) {
    if (raw[f] !== undefined) need(f, Array.isArray(raw[f]), "must be an array");
  }
  if (raw.routing !== undefined) need("routing", isObj(raw.routing), "must be an object");

  const parseTs = (v: unknown): number | null => {
    if (typeof v !== "string") return null;
    const ms = Date.parse(v);
    return Number.isFinite(ms) ? ms : null;
  };
  if (!problem) {
    if (meta.created !== undefined && parseTs(meta.created) === null) problem = "metadata.created: must be a valid ISO-8601 timestamp";
    if (meta.modified !== undefined && parseTs(meta.modified) === null) problem = "metadata.modified: must be a valid ISO-8601 timestamp";
  }
  if (problem) return err(`Malformed Open DAW project file — ${problem}`);

  /* assemble runtime state from the envelope; instruments/effects are looked
   * up by reference, exactly as the format intends */
  const instrumentKind = new Map<string, InstrumentKind>();
  for (const inst of (raw.instruments ?? []) as Record<string, unknown>[]) {
    if (isObj(inst) && typeof inst.id === "string" && typeof inst.kind === "string") {
      instrumentKind.set(inst.id, inst.kind as InstrumentKind);
    }
  }
  const trackFx = new Map<string, TrackFx>();
  for (const fx of (raw.effects ?? []) as Record<string, unknown>[]) {
    if (isObj(fx) && typeof fx.trackId === "string" && isObj(fx.params)) {
      trackFx.set(fx.trackId, fx.params as unknown as TrackFx);
    }
  }

  const now = Date.now();
  const assembled = {
    ...(typeof raw.lyrics === "string" ? { lyrics: raw.lyrics } : {}),
    name: String(meta.name),
    bpm: Number(tempo.bpm),
    rootMidi: Number(key.rootMidi),
    scale: key.scale as ScaleType,
    lengthBars: typeof raw.lengthBars === "number" ? raw.lengthBars : 8,
    timeSignature: isObj(raw.timeSignature)
      ? { numerator: raw.timeSignature.numerator, denominator: raw.timeSignature.denominator }
      : { numerator: 4, denominator: 4 },
    automation: Array.isArray(raw.automation) ? raw.automation : [],
    tracks: (raw.tracks as unknown[]).map((t) => {
      const tr = (isObj(t) ? t : {}) as Record<string, unknown>;
      const id = typeof tr.id === "string" ? tr.id : "";
      return {
        ...tr,
        id,
        instrument: (typeof tr.instrumentId === "string" && instrumentKind.get(tr.instrumentId)) || tr.instrument,
        fx: trackFx.get(id) ?? tr.fx,
      };
    }),
    clips: Object.fromEntries(
      ((raw.clips as unknown[]) ?? []).map((c) => {
        const cl = (isObj(c) ? c : {}) as Record<string, unknown>;
        return [typeof cl.id === "string" ? cl.id : "", c];
      }),
    ),
    markers: Array.isArray(raw.markers) ? raw.markers : [],
    loopRegion: isObj(raw.loopRegion) ? raw.loopRegion : null,
    punchRegion: isObj(raw.punchRegion) ? raw.punchRegion : null,
    createdAt: parseTs(meta.created) ?? now,
    modifiedAt: parseTs(meta.modified) ?? now,
  };

  /* final safety net: the shared sanitizer clamps/caps anything the envelope
   * checks let through, so hostile files still can't reach the engine raw */
  const validated = validateProject(assembled);
  if (!validated.ok) return err(`Malformed Open DAW project file — ${validated.error.toLowerCase()}`);
  return { ok: true, project: validated.project };
}

/* ---------------- convenience for file pickers ---------------- */

/** Read a .open-daw.json file's text into a project. Never throws. */
export function parseProjectFile(text: string): FileResult {
  return deserialize(text);
}

export type { AutomationLane, TimeSignature };

