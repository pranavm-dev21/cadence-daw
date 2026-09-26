/* Pure command executors — (Project, Command) → Project.
 * Total functions: they never throw and never mutate their input; unknown or
 * out-of-range values are clamped or ignored. The bus is their only caller. */

import {
  AutomationEvent, AutomationLane, Clip, Note, Placement, Project, STEPS_PER_BAR, Track, uid,
} from "../types";
import { Command, PlacementPatch } from "./commands";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function updateTrack(p: Project, trackId: string, fn: (t: Track) => Track): Project {
  if (!p.tracks.some((t) => t.id === trackId)) return p;
  return { ...p, tracks: p.tracks.map((t) => (t.id === trackId ? fn(t) : t)) };
}

function updateClip(p: Project, clipId: string, fn: (c: Clip) => Clip): Project {
  const clip = p.clips[clipId];
  if (!clip) return p;
  return { ...p, clips: { ...p.clips, [clipId]: fn(clip) } };
}

export function execCommand(p: Project, c: Command): Project {
  switch (c.op) {
    case "set_lyrics": return { ...p, lyrics: c.text.slice(0, 10000) };
    case "set_project_name":
      return { ...p, name: c.name.slice(0, 48) || p.name };

    case "set_tempo":
      return { ...p, bpm: Math.round(clamp(c.bpm, 55, 200)) };

    case "set_key":
      return { ...p, rootMidi: clamp(Math.round(c.rootMidi), 36, 84), scale: c.scale };

    case "set_length": {
      const bars = clamp(Math.round(c.bars), 1, 64);
      let next = { ...p, lengthBars: bars };
      // drop placements that now fall outside the timeline
      next = {
        ...next,
        tracks: next.tracks.map((t) => ({ ...t, placements: t.placements.filter((pl) => pl.bar < bars) })),
      };
      return next;
    }

    case "set_track_volume":
      return updateTrack(p, c.trackId, (t) => ({ ...t, volume: clamp(c.value, 0, 1.25) }));

    case "set_track_pan":
      return updateTrack(p, c.trackId, (t) => ({ ...t, pan: clamp(c.value, -1, 1) }));

    case "set_track_mute":
      return updateTrack(p, c.trackId, (t) => ({ ...t, mute: c.value }));

    case "set_track_solo":
      return updateTrack(p, c.trackId, (t) => ({ ...t, solo: c.value }));

    case "set_track_fx":
      return updateTrack(p, c.trackId, (t) => ({
        ...t,
          fx: {
            ...((c.fx.vocal ?? t.fx.vocal) ? { vocal: c.fx.vocal ?? t.fx.vocal } : {}),
            ...((c.fx.vocalBypass ?? t.fx.vocalBypass) !== undefined ? { vocalBypass: c.fx.vocalBypass ?? t.fx.vocalBypass } : {}),
          reverb: clamp(c.fx.reverb ?? t.fx.reverb, 0, 1),
          delay: clamp(c.fx.delay ?? t.fx.delay, 0, 1),
          cutoff: clamp(c.fx.cutoff ?? t.fx.cutoff, 300, 18000),
          drive: clamp(c.fx.drive ?? t.fx.drive, 0, 1),
        },
      }));

    case "rename_track":
      return updateTrack(p, c.trackId, (t) => ({ ...t, name: c.name.slice(0, 24) || t.name }));

    case "add_track":
      if (p.tracks.some((t) => t.id === c.track.id)) return p;
      return { ...p, tracks: [...p.tracks, c.track] };

    case "remove_track": {
      const track = p.tracks.find((t) => t.id === c.trackId);
      if (!track || p.tracks.length <= 1) return p;
      const usedElsewhere = new Set<string>();
      for (const t of p.tracks) if (t.id !== c.trackId) t.clipIds.forEach((id) => usedElsewhere.add(id));
      const clips = { ...p.clips };
      for (const id of track.clipIds) if (!usedElsewhere.has(id)) delete clips[id];
      return { ...p, tracks: p.tracks.filter((t) => t.id !== c.trackId), clips };
    }

    case "create_clip": {
      const track = p.tracks.find((t) => t.id === c.trackId);
      if (!track) return p;
      let next: Project = { ...p, clips: { ...p.clips, [c.clip.id]: c.clip } };
      next = updateTrack(next, c.trackId, (t) => ({
        ...t,
        clipIds: t.clipIds.includes(c.clip.id) ? t.clipIds : [...t.clipIds, c.clip.id],
        sourceClipId: c.makeSource === false ? t.sourceClipId : c.clip.id,
        placements: [
          ...t.placements.filter((pl) => !(c.placeBars ?? []).includes(pl.bar)),
          ...(c.placeBars ?? []).map((bar): Placement => ({ id: uid("pl"), clipId: c.clip.id, bar })),
        ],
      }));
      return next;
    }

    case "delete_clip": {
      const track = p.tracks.find((t) => t.id === c.trackId);
      if (!track || track.clipIds.length <= 1) return p;
      const clips = { ...p.clips };
      delete clips[c.clipId];
      return updateTrack({ ...p, clips }, c.trackId, (t) => {
        const clipIds = t.clipIds.filter((id) => id !== c.clipId);
        return {
          ...t,
          clipIds,
          sourceClipId: t.sourceClipId === c.clipId ? clipIds[0] : t.sourceClipId,
          placements: t.placements.filter((pl) => pl.clipId !== c.clipId),
        };
      });
    }

    case "set_clip_content":
      return updateClip(p, c.clipId, (clip) => ({
        ...clip,
        name: c.name ?? clip.name,
        lengthBars: c.lengthBars ? clamp(Math.round(c.lengthBars), 1, 8) : clip.lengthBars,
        notes: c.notes,
      }));

    case "add_notes":
      return updateClip(p, c.clipId, (clip) => ({ ...clip, notes: [...clip.notes, ...c.notes] }));

    case "transpose_clip":
      return updateClip(p, c.clipId, (clip) => ({
        ...clip,
        notes: clip.notes.map((n): Note => ({ ...n, pitch: n.pitch + c.semitones })),
      }));

    case "place_clip": {
      const track = p.tracks.find((t) => t.id === c.trackId);
      const clip = p.clips[c.clipId];
      if (!track || !clip || c.bar < 0 || c.bar >= p.lengthBars) return p;
      if (track.clipIds.includes(c.clipId) === false) return p;
      return updateTrack(p, c.trackId, (t) => ({
        ...t,
        placements: [
          ...t.placements.filter((pl) => pl.bar !== c.bar),
          { id: uid("pl"), clipId: c.clipId, bar: c.bar },
        ],
      }));
    }

    case "remove_placement":
      return updateTrack(p, c.trackId, (t) => ({
        ...t,
        placements: t.placements.filter((pl) => pl.id !== c.placementId),
      }));

    case "clear_placements":
      return {
        ...p,
        tracks: p.tracks.map((t) => {
          if (c.trackId && t.id !== c.trackId) return t;
          return {
            ...t,
            placements: t.placements.filter((pl) => {
              if (c.range) return pl.bar < c.range[0] || pl.bar >= c.range[1];
              return false;
            }),
          };
        }),
      };

    /* ---------------- arrangement ---------------- */

    case "update_placement":
      return updatePlacementIn(p, c.trackId, c.placementId, c.patch);

    case "split_placement": {
      const track = p.tracks.find((t) => t.id === c.trackId);
      const pl = track?.placements.find((x) => x.id === c.placementId);
      const clip = pl ? p.clips[pl.clipId] : undefined;
      if (!track || !pl || !clip) return p;
      const clipSteps = clip.lengthBars * 16;
      const off = pl.offsetSteps ?? 0;
      const vis = pl.lengthBars !== undefined ? Math.round(pl.lengthBars * 16) : clipSteps - off;
      const k = c.atStep;
      // the split point must fall strictly inside the visible window
      if (k <= off || k >= off + vis) return p;
      const leftVis = k - off;
      const rightVis = vis - leftVis;
      const halfL = Math.max(1, Math.floor(leftVis / 2));
      const halfR = Math.max(1, Math.floor(rightVis / 2));
      const left: Placement = {
        id: pl.id, clipId: pl.clipId, bar: pl.bar,
        ...(off > 0 ? { offsetSteps: off } : {}),
        lengthBars: leftVis / 16,
        ...(pl.fadeIn ? { fadeIn: Math.min(pl.fadeIn, halfL) } : {}),
        ...(pl.fadeOut ? { fadeOut: Math.min(pl.fadeOut, halfL) } : {}),
      };
      const right: Placement = {
        id: uid("pl"), clipId: pl.clipId, bar: pl.bar + leftVis / 16,
        offsetSteps: k,
        lengthBars: rightVis / 16,
        ...(pl.fadeIn ? { fadeIn: Math.min(pl.fadeIn, halfR) } : {}),
        ...(pl.fadeOut ? { fadeOut: Math.min(pl.fadeOut, halfR) } : {}),
      };
      return updateTrack(p, c.trackId, (t) => ({
        ...t,
        placements: t.placements.flatMap((x) => (x.id === pl.id ? [left, right] : [x])),
      }));
    }

    case "duplicate_placement": {
      const track = p.tracks.find((t) => t.id === c.trackId);
      const pl = track?.placements.find((x) => x.id === c.placementId);
      if (!track || !pl) return p;
      const copy: Placement = { ...pl, id: uid("pl"), bar: Math.max(0, pl.bar + c.deltaBars) };
      return updateTrack(p, c.trackId, (t) => ({ ...t, placements: [...t.placements, copy] }));
    }

    case "set_markers":
      return { ...p, markers: [...c.markers].sort((a, b) => a.bar - b.bar) };

    case "set_loop_region":
      return { ...p, loopRegion: c.region };

    case "set_track_group":
      return updateTrack(p, c.trackId, (t) => ({ ...t, groupId: c.groupId }));

    case "set_track_color":
      return updateTrack(p, c.trackId, (t) => ({ ...t, color: c.color }));

    /* ---------------- recording ---------------- */

    case "set_track_record_arm":
      return updateTrack(p, c.trackId, (t) => ({ ...t, recordArm: c.value }));

    case "set_track_monitor":
      return updateTrack(p, c.trackId, (t) => ({ ...t, monitor: c.value }));

    case "add_take":
      return updateTrack(p, c.trackId, (t) => ({
        ...t,
        takes: [...t.takes, c.take],
        activeTakeId: c.setActive === false ? t.activeTakeId : c.take.id,
      }));

    case "remove_take":
      return updateTrack(p, c.trackId, (t) => ({
        ...t,
        takes: t.takes.filter((tk) => tk.id !== c.takeId),
        activeTakeId: t.activeTakeId === c.takeId ? null : t.activeTakeId,
      }));

    case "set_active_take":
      return updateTrack(p, c.trackId, (t) => ({ ...t, activeTakeId: c.takeId }));

    case "set_punch_region":
      return { ...p, punchRegion: c.region };

    /* ---------------- automation ---------------- */

    case "upsert_automation_lane": {
      const lane = sanitizeLane(c.lane);
      const existing = p.automation.some((l) => l.id === lane.id);
      return {
        ...p,
        automation: existing
          ? p.automation.map((l) => (l.id === lane.id ? lane : l))
          : [...p.automation, lane],
      };
    }

    case "set_automation_points": {
      const points = sanitizePoints(c.points);
      return {
        ...p,
        automation: p.automation.map((l) => (l.id === c.laneId ? { ...l, points } : l)),
      };
    }

    case "remove_automation_lane":
      return { ...p, automation: p.automation.filter((l) => l.id !== c.laneId) };

    case "set_automation_lock":
      return {
        ...p,
        automation: p.automation.map((l) => (l.id === c.laneId ? { ...l, locked: c.locked } : l)),
      };

    default:
      return p;
  }
}

/* Automation sanitization — clamp + sort so executors stay total. */
function sanitizePoints(points: AutomationEvent[]): AutomationEvent[] {
  return points
    .map((pt) => ({
      step: clamp(pt.step, 0, 4096),
      value: clamp(pt.value, 0, 1),
      ...(pt.curve ? { curve: pt.curve } : {}),
    }))
    .sort((a, b) => a.step - b.step);
}

function sanitizeLane(lane: AutomationLane): AutomationLane {
  return {
    id: lane.id,
    trackId: lane.trackId,
    param: lane.param,
    points: sanitizePoints(lane.points),
    ...(lane.locked !== undefined ? { locked: lane.locked } : {}),
  };
}

/** Merge a patch into one placement, keeping the audible window coherent:
 *  offset ≥ 0, visible length ≥ 1 step, window never past the clip's tail,
 *  fades capped at half the visible length. A left-trim (offset shift) moves the
 *  bar position with it so the block's right edge stays put. */
function updatePlacementIn(p: Project, trackId: string, placementId: string, patch: PlacementPatch): Project {
  const track = p.tracks.find((t) => t.id === trackId);
  const pl = track?.placements.find((x) => x.id === placementId);
  const clip = pl ? p.clips[pl.clipId] : undefined;
  if (!track || !pl || !clip) return p;
  const clipSteps = clip.lengthBars * 16;

  let bar = pl.bar;
  let off = pl.offsetSteps ?? 0;
  let vis = pl.lengthBars !== undefined ? Math.round(pl.lengthBars * 16) : clipSteps - off;
  let fi = pl.fadeIn ?? 0;
  let fo = pl.fadeOut ?? 0;

  if (patch.bar !== undefined) bar = clamp(patch.bar, 0, 4096);
  if (patch.offsetSteps !== undefined) {
    const newOff = clamp(Math.round(patch.offsetSteps), 0, clipSteps - 1);
    const d = newOff - off;
    bar = Math.max(0, bar + d / 16);
    off = newOff;
    vis = clamp(vis - d, 1, clipSteps - off);
  }
  if (patch.lengthBars !== undefined) vis = clamp(Math.round(patch.lengthBars * 16), 1, clipSteps - off);
  if (patch.fadeIn !== undefined) fi = clamp(Math.round(patch.fadeIn), 0, 256);
  if (patch.fadeOut !== undefined) fo = clamp(Math.round(patch.fadeOut), 0, 256);
  const half = Math.max(1, Math.floor(vis / 2));
  fi = Math.min(fi, half);
  fo = Math.min(fo, half);

  const next: Placement = {
    id: pl.id,
    clipId: pl.clipId,
    bar,
    ...(off > 0 ? { offsetSteps: off } : {}),
    ...(off > 0 || vis < clipSteps ? { lengthBars: vis / 16 } : {}),
    ...(fi > 0 ? { fadeIn: fi } : {}),
    ...(fo > 0 ? { fadeOut: fo } : {}),
  };
  return updateTrack(p, trackId, (t) => ({
    ...t,
    placements: t.placements.map((x) => (x.id === placementId ? next : x)),
  }));
}

export function execCommands(p: Project, commands: Command[]): Project {
  return commands.reduce((acc, c) => {
    try {
      return execCommand(acc, c);
    } catch (err) {
      console.error("[command-bus] executor failed", c, err);
      return acc;
    }
  }, p);
}

/* ---------------- factories shared by UI + AI ---------------- */

export function makeClip(name: string, lengthBars = 1, notes: Note[] = []): Clip {
  return { id: uid("clip"), name, lengthBars, notes };
}

export function makeTrack(kind: Track["instrument"], name: string, color: string): Track {
  const clip = makeClip(`${name} 1`);
  return {
    id: uid("trk"),
    name,
    color,
    instrument: kind,
    volume: kind === "drumkit" ? 0.95 : kind === "bass" ? 0.85 : 0.75,
    pan: 0,
    mute: false,
    solo: false,
    fx: {
      reverb: kind === "pad" ? 0.45 : kind === "pluck" ? 0.2 : 0.08,
      delay: kind === "pluck" ? 0.22 : 0,
      cutoff: kind === "bass" ? 4200 : kind === "pad" ? 7500 : 18000,
      drive: 0,
    },
    clipIds: [clip.id],
    sourceClipId: clip.id,
    placements: [],
    groupId: null,
    recordArm: false,
    monitor: false,
    takes: [],
    activeTakeId: null,
  };
}

/** Track factory that also surfaces the starter clip for the clips map. */
export function makeTrackWithClip(kind: Track["instrument"], name: string, color: string): { track: Track; clip: Clip } {
  const clip = makeClip(`${name} 1`);
  const track = makeTrack(kind, name, color);
  track.clipIds = [clip.id];
  track.sourceClipId = clip.id;
  return { track, clip };
}

export function noteOf(pitch: number, start: number, dur: number, vel: number): Note {
  return { id: uid("n"), pitch, start, dur, vel };
}

export function clipWith(notes: Note[], name: string, lengthBars = 1): Clip {
  return { id: uid("clip"), name, lengthBars, notes };
}

export { STEPS_PER_BAR };
