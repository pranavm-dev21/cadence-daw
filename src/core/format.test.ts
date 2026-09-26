/* Unit tests for the versioned project file format.
 * Run with: npx vitest run */

import { describe, expect, it } from "vitest";
import { AutomationLane, Project } from "../types";
import { buildDemoProject, buildEmptyProject } from "./seed";
import {
  CURRENT_VERSION, FORMAT_ID, deserialize, MIGRATIONS, serialize,
} from "./format";

/** A project with fixed timestamps so assertions are fully deterministic. */
function fixture(): Project {
  const p = buildEmptyProject();
  p.createdAt = 1_700_000_000_000;
  p.modifiedAt = 1_700_000_000_000;
  return p;
}

function withAutomation(p: Project): Project {
  const lane: AutomationLane = {
    id: "auto_test1",
    trackId: p.tracks[1].id,
    param: "volume",
    points: [
      { step: 0, value: 0.2 },
      { step: 32, value: 0.9 },
      { step: 64, value: 0.55 },
    ],
  };
  return { ...p, automation: [lane] };
}

describe("serialize → deserialize round-trip", () => {
  it("reloads a project with deep equality", () => {
    for (const original of [fixture(), withAutomation(fixture()), buildDemoProject()]) {
      const json = serialize(original);
      const res = deserialize(json);
      expect(res.ok, res.ok ? "" : res.error).toBe(true);
      if (res.ok) expect(res.project).toEqual(original);
    }
  });

  it("is a pure function of state (same state → same bytes)", () => {
    const p = fixture();
    expect(serialize(p)).toBe(serialize(p));
  });

  it("preserves automation lanes end to end", () => {
    const res = deserialize(serialize(withAutomation(fixture())));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.project.automation).toHaveLength(1);
    expect(res.project.automation[0].param).toBe("volume");
    expect(res.project.automation[0].points).toHaveLength(3);
    expect(res.project.automation[0].points[1]).toEqual({ step: 32, value: 0.9 });
  });
});

describe("file envelope", () => {
  it("writes every documented top-level field", () => {
    const doc = JSON.parse(serialize(fixture())) as Record<string, unknown>;
    expect(doc.format).toBe(FORMAT_ID);
    expect(doc.version).toBe(CURRENT_VERSION);
    for (const field of [
      "metadata", "tempo", "timeSignature", "lengthBars", "key", "tracks",
      "clips", "instruments", "effects", "automation", "routing", "samples", "presets",
    ]) {
      expect(doc, `missing field "${field}"`).toHaveProperty(field);
    }
    const meta = doc.metadata as { name: string; created: string; modified: string };
    expect(meta.name).toBe("Untitled Session");
    expect(new Date(meta.created).getTime()).toBe(1_700_000_000_000);
    expect((doc.tempo as { bpm: number }).bpm).toBe(110);
    expect(doc.timeSignature).toEqual({ numerator: 4, denominator: 4 });
    expect(doc.key).toEqual({ rootMidi: 57, scale: "minor" });
  });

  it("links tracks to instruments[] and effects[] by id", () => {
    const p = fixture();
    const doc = JSON.parse(serialize(p)) as {
      tracks: { id: string; instrumentId: string }[];
      instruments: { id: string; kind: string }[];
      effects: { trackId: string; type: string; params: Record<string, number> }[];
      routing: { assignments: { trackId: string; output: string }[] };
    };
    expect(doc.instruments).toHaveLength(p.tracks.length);
    expect(doc.effects).toHaveLength(p.tracks.length);
    for (const t of doc.tracks) {
      expect(doc.instruments.some((i) => i.id === t.instrumentId)).toBe(true);
      expect(doc.effects.some((e) => e.trackId === t.id && e.type === "channel-strip")).toBe(true);
    }
    expect(doc.routing.assignments.every((a) => a.output === "master")).toBe(true);
  });
});

describe("error handling", () => {
  it("rejects non-JSON input with a clear error", () => {
    const res = deserialize("this is not json {");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/not valid JSON/);
  });

  it("rejects files with an unknown format id", () => {
    const res = deserialize(JSON.stringify({ format: "ableton-set", version: 1 }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Unknown file format/);
  });

  it("rejects malformed envelopes field by field", () => {
    const bad = (patch: Record<string, unknown>) =>
      deserialize(JSON.stringify({
        format: FORMAT_ID, version: CURRENT_VERSION,
        metadata: { name: "x", created: "2026-01-01T00:00:00.000Z", modified: "2026-01-01T00:00:00.000Z" },
        tempo: { bpm: 120 }, key: { rootMidi: 57, scale: "minor" },
        tracks: [], clips: [],
        ...patch,
      }));
    let res = bad({ tempo: { bpm: "fast" } });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/tempo\.bpm/);
    res = bad({ key: { rootMidi: 57, scale: "dorian" } });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/key\.scale/);
    res = bad({ metadata: { name: "x", created: "not-a-date", modified: "2026-01-01T00:00:00.000Z" } });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/metadata\.created/);
  });

  it("rejects files from a future version with an upgrade hint", () => {
    const res = deserialize(JSON.stringify({ format: FORMAT_ID, version: CURRENT_VERSION + 41 }));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatch(/newer version/);
      expect(res.error).toContain(`v${CURRENT_VERSION + 41}`);
    }
  });
});

describe("migration registry", () => {
  it("registers an upgrade path for every version below current", () => {
    expect(MIGRATIONS.some((m) => m.from === 0 && m.to === 1)).toBe(true);
    // every reachable old version has a forward step
    for (let v = 0; v < CURRENT_VERSION; v++) {
      expect(MIGRATIONS.some((m) => m.from === v)).toBe(true);
    }
  });

  it("upgrades legacy pre-format autosaves (raw project JSON)", () => {
    const legacy = {
      name: "Old Tune", bpm: 96, rootMidi: 57, scale: "minor", lengthBars: 8,
      tracks: [{
        id: "trk_old1", name: "Keys", color: "#3ecfb2", instrument: "keys",
        volume: 0.8, pan: 0, mute: false, solo: false,
        fx: { reverb: 0.1, delay: 0, cutoff: 12000, drive: 0 },
        clipIds: ["clip_old1"], sourceClipId: "clip_old1", placements: [],
      }],
      clips: { clip_old1: { id: "clip_old1", name: "Keys 1", lengthBars: 1, notes: [] } },
    };
    const res = deserialize(JSON.stringify(legacy));
    expect(res.ok, res.ok ? "" : res.error).toBe(true);
    if (!res.ok) return;
    expect(res.project.name).toBe("Old Tune");
    expect(res.project.bpm).toBe(96);
    expect(res.project.tracks[0].instrument).toBe("keys");
    expect(res.project.timeSignature).toEqual({ numerator: 4, denominator: 4 });
    expect(res.project.createdAt).toBeGreaterThan(0);
  });

  it("upgrades the old cadence wrapper format", () => {
    const wrapped = { app: "cadence", format: 1, name: "Wrapped", bpm: 90, rootMidi: 60, scale: "major", lengthBars: 4, tracks: [], clips: {} };
    const res = deserialize(JSON.stringify(wrapped));
    // no usable tracks → still a clear, graceful failure rather than a crash
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/no usable tracks/i);
  });

  it("fails clearly when no upgrade path exists", () => {
    const res = deserialize(JSON.stringify({ format: FORMAT_ID, version: -3 }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/No upgrade path/);
  });
});
