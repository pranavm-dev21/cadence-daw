/* Autosave & recovery persistence tests.
 *
 * Runs in the node environment, so a minimal in-memory localStorage stub is
 * installed before the module's functions are exercised (autosave.ts only
 * touches `localStorage` inside its functions, never at import time). */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AutosaveService, AutosaveSource,
  clearRecovery, getAutosaveIntervalMs, isOrphanedRecovery, loadKnownGood,
  readRecovery, saveKnownGood, saveRecovery, setAutosaveIntervalMs,
  GOOD_KEY, RECOVERY_KEY, DEFAULT_INTERVAL_MS,
} from "./autosave";
import { buildDemoProject, buildEmptyProject } from "./seed";
import { Project } from "../types";

/* ---------------- in-memory localStorage stub ---------------- */

function makeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
    _map: store,
  };
}

const ls = makeLocalStorage();
(globalThis as unknown as { localStorage: unknown }).localStorage = ls;

const demo = buildDemoProject();
const empty = buildEmptyProject();

beforeEach(() => {
  ls.clear();
  vi.useRealTimers();
});

/* ---------------- atomic write guarantees ---------------- */

describe("atomic known-good save", () => {
  it("round-trips a project through save → load", () => {
    expect(saveKnownGood(demo, 7)).toBe(true);
    const loaded = loadKnownGood();
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(7);
    expect(loaded!.project).toEqual(demo);
  });

  it("leaves no temp key behind after a successful save", () => {
    saveKnownGood(demo, 1);
    expect(ls.getItem(GOOD_KEY + ".tmp")).toBeNull();
    expect(ls.getItem(GOOD_KEY)).not.toBeNull();
  });

  it("does not corrupt the previous save when a write fails mid-flight", () => {
    saveKnownGood(demo, 1);
    const goodBefore = ls.getItem(GOOD_KEY);

    // Simulate a failure AFTER the temp write but BEFORE the commit: make
    // setItem throw for the real key only.
    const realSetItem = ls.setItem.bind(ls);
    ls.setItem = (k: string, v: string) => {
      if (k === GOOD_KEY) throw new Error("quota exceeded");
      realSetItem(k, v);
    };

    expect(saveKnownGood(empty, 99)).toBe(false);

    // The known-good key still holds the original complete payload.
    expect(ls.getItem(GOOD_KEY)).toBe(goodBefore);
    const loaded = loadKnownGood();
    expect(loaded!.project).toEqual(demo);
    // …and the temp key was cleaned up.
    expect(ls.getItem(GOOD_KEY + ".tmp")).toBeNull();

    ls.setItem = realSetItem;
  });

  it("returns null for a corrupt save instead of throwing", () => {
    ls.setItem(GOOD_KEY, "{not-json");
    expect(loadKnownGood()).toBeNull();
  });
});

/* ---------------- recovery snapshot separation ---------------- */

describe("recovery snapshots", () => {
  it("writes to the recovery location, never the known-good location", () => {
    saveRecovery(demo, 3);
    expect(ls.getItem(RECOVERY_KEY)).not.toBeNull();
    expect(ls.getItem(GOOD_KEY)).toBeNull();
  });

  it("reads back a valid recovery candidate", () => {
    saveRecovery(demo, 3);
    const rec = readRecovery();
    expect(rec).not.toBeNull();
    expect(rec!.version).toBe(3);
    expect(typeof rec!.savedAt).toBe("number");
  });

  it("clears the recovery on demand", () => {
    saveRecovery(demo, 3);
    clearRecovery();
    expect(readRecovery()).toBeNull();
    expect(ls.getItem(RECOVERY_KEY)).toBeNull();
    expect(ls.getItem(RECOVERY_KEY + ".tmp")).toBeNull();
  });

  it("drops an unparseable recovery rather than surfacing it", () => {
    ls.setItem(RECOVERY_KEY, "garbage");
    expect(readRecovery()).toBeNull();
    expect(ls.getItem(RECOVERY_KEY)).toBeNull(); // cleaned up
  });
});

/* ---------------- orphan detection ---------------- */

describe("orphan detection", () => {
  it("flags a recovery as orphaned when there is no known-good save", () => {
    saveRecovery(demo, 1);
    const rec = readRecovery()!;
    expect(isOrphanedRecovery(rec)).toBe(true);
  });

  it("flags a recovery newer than the last save as orphaned", () => {
    saveKnownGood(demo, 1);
    const goodAt = loadKnownGood()!.savedAt;

    // A recovery saved strictly after the known-good save.
    saveRecovery(demo, 2);
    const recRaw = readRecovery()!;
    const rec = { ...recRaw, savedAt: goodAt + 5000 };
    expect(isOrphanedRecovery(rec)).toBe(true);
  });

  it("does NOT flag a recovery older than the last save", () => {
    saveRecovery(demo, 1);
    const recRaw = readRecovery()!;
    saveKnownGood(demo, 2); // save happens after the recovery
    const goodAt = loadKnownGood()!.savedAt;
    const rec = { ...recRaw, savedAt: goodAt - 5000 };
    expect(isOrphanedRecovery(rec)).toBe(false);
  });
});

/* ---------------- interval configuration ---------------- */

describe("autosave interval", () => {
  it("defaults to 60s when unset", () => {
    expect(getAutosaveIntervalMs()).toBe(DEFAULT_INTERVAL_MS);
  });

  it("clamps to the allowed range", () => {
    expect(setAutosaveIntervalMs(1)).toBe(5000);
    expect(setAutosaveIntervalMs(10_000_000)).toBe(600_000);
    expect(getAutosaveIntervalMs()).toBe(600_000);
  });

  it("ignores garbage stored values", () => {
    ls.setItem("openDaw.autosaveInterval", "not-a-number");
    expect(getAutosaveIntervalMs()).toBe(DEFAULT_INTERVAL_MS);
  });
});

/* ---------------- the interval driver ---------------- */

function makeSource(project: Project): AutosaveSource & { bump: () => void } {
  let version = 0;
  return {
    getState: () => project,
    getVersion: () => version,
    bump: () => {
      version += 1;
    },
  };
}

describe("AutosaveService", () => {
  it("is not dirty immediately after start (loading isn't a change)", () => {
    const src = makeSource(demo);
    const svc = new AutosaveService(src, { intervalMs: 60_000 });
    svc.start();
    expect(svc.isDirty()).toBe(false);
    svc.stop();
  });

  it("becomes dirty when the source version advances and flushes to recovery", () => {
    const src = makeSource(demo);
    const svc = new AutosaveService(src, { intervalMs: 60_000 });
    svc.start();

    src.bump();
    expect(svc.isDirty()).toBe(true);

    expect(svc.flush()).toBe(true);
    expect(svc.isDirty()).toBe(false);
    expect(readRecovery()).not.toBeNull();
    expect(ls.getItem(GOOD_KEY)).toBeNull(); // still never the known-good save
    svc.stop();
  });

  it("writes a recovery snapshot on the interval when dirty", () => {
    vi.useFakeTimers();
    const src = makeSource(demo);
    const svc = new AutosaveService(src, { intervalMs: 1000 });
    svc.start();

    src.bump();
    vi.advanceTimersByTime(1100);

    expect(readRecovery()).not.toBeNull();
    expect(svc.getStatus()).toBe("saved");
    svc.stop();
  });

  it("markClean resets dirty tracking after an explicit save", () => {
    const src = makeSource(demo);
    const svc = new AutosaveService(src, { intervalMs: 60_000 });
    svc.start();

    src.bump();
    expect(svc.isDirty()).toBe(true);
    svc.markClean(src.getVersion());
    expect(svc.isDirty()).toBe(false);
    svc.stop();
  });
});
