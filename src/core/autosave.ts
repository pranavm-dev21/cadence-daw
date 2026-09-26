/* Autosave & crash-recovery persistence.
 *
 * Two deliberately separate locations, because a crash must never destroy the
 * user's last known-good save:
 *
 *   GOOD_KEY      the user's save — written ONLY by an explicit "Save" action
 *   RECOVERY_KEY  an autosave snapshot — written every N seconds while the
 *                 project is dirty, and on page hide / beforeunload
 *
 * Atomicity (never corrupt, never truncate):
 *   Every write goes to a ".tmp" key first, is read back and verified, and
 *   only then committed to the real key (the logical "rename"), after which
 *   the temp key is removed. If the process dies at any point:
 *     - before the commit  → only the temp key exists; the real key is intact
 *     - after the commit   → the temp key is cleaned up on next read
 *   So the real key always holds either the previous complete payload or the
 *   new complete payload — never a partial write.
 *
 * Recovery on launch:
 *   readRecovery() returns a snapshot that deserializes cleanly. It is an
 *   "orphan" worth offering to the user when it is NEWER than the last
 *   known-good save (or no known-good save exists) — i.e. there is work that
 *   was autosaved but never saved by hand. The UI decides restore vs discard;
 *   this module never loads a recovery into the project on its own.
 */

import { Project } from "../types";
import { deserialize, serialize } from "./format";

/* ---------------- storage locations ---------------- */

export const GOOD_KEY = "openDaw.save.v1";
export const RECOVERY_KEY = "openDaw.recovery.v1";
export const INTERVAL_KEY = "openDaw.autosaveInterval";
const GOOD_TMP = GOOD_KEY + ".tmp";
const RECOVERY_TMP = RECOVERY_KEY + ".tmp";
/** Pre-format autosave location — migrated on first read, then left alone. */
const LEGACY_KEY = "cadence.project.v1";

export const DEFAULT_INTERVAL_MS = 60_000;
const MIN_INTERVAL_MS = 5_000;
const MAX_INTERVAL_MS = 10 * 60_000;

/* ---------------- envelope ---------------- */

/** What we actually persist: bus version + wall-clock time + serialized file. */
export interface SaveEnvelope {
  /** Bus version at write time — for in-session dirty tracking. */
  v: number;
  /** Epoch ms — for cross-session "is the recovery newer than my save?". */
  t: number;
  /** The full open-daw JSON document. */
  json: string;
}

export interface RecoveryCandidate {
  savedAt: number;
  version: number;
  json: string;
}

/* ---------------- low-level safe storage ---------------- */

function tryGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // storage blocked / unavailable
  }
}

function tryRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* non-fatal */
  }
}

/**
 * Write `payload` to `key` atomically: temp write → read-back verify → commit
 * (rename) → temp cleanup. Returns false if any step fails; on failure `key`
 * is guaranteed to still hold its previous complete value (or nothing).
 */
function atomicWrite(key: string, tmpKey: string, payload: string): boolean {
  try {
    localStorage.setItem(tmpKey, payload);
    // Verify the write actually landed before we trust it.
    if (localStorage.getItem(tmpKey) !== payload) return false;
    // Commit: this is the "rename". Only after this is the new state visible.
    localStorage.setItem(key, payload);
    localStorage.removeItem(tmpKey);
    return true;
  } catch {
    // Quota exceeded / blocked — clean up the temp and report failure.
    tryRemove(tmpKey);
    return false;
  }
}

function readEnvelope(key: string, tmpKey: string): SaveEnvelope | null {
  // A leftover temp key means a previous write was interrupted before commit —
  // it is by definition not the committed state, so drop it.
  if (tryGet(tmpKey) !== null) tryRemove(tmpKey);

  const raw = tryGet(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SaveEnvelope>;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.v === "number" &&
      typeof parsed.t === "number" &&
      typeof parsed.json === "string"
    ) {
      return { v: parsed.v, t: parsed.t, json: parsed.json };
    }
    return null;
  } catch {
    return null; // corrupted envelope — treat as absent rather than crash
  }
}

/* ---------------- the user's known-good save ---------------- */

/** Explicit "Save". The ONLY writer of GOOD_KEY. */
export function saveKnownGood(project: Project, version: number): boolean {
  const envelope: SaveEnvelope = {
    v: version,
    t: Date.now(),
    json: serialize(project),
  };
  return atomicWrite(GOOD_KEY, GOOD_TMP, JSON.stringify(envelope));
}

export interface KnownGood {
  project: Project;
  version: number;
  savedAt: number;
}

/**
 * Load the user's save. Falls back to the legacy pre-format autosave location
 * so upgrading users keep their work; a corrupt save yields null (→ demo).
 */
export function loadKnownGood(): KnownGood | null {
  const envelope = readEnvelope(GOOD_KEY, GOOD_TMP);
  const source = envelope?.json ?? tryGet(LEGACY_KEY);
  if (!source) return null;

  const res = deserialize(source);
  if (!res.ok) return null;

  // Opportunistically upgrade a legacy save into the new envelope location so
  // future reads are fast and versioned. Failure here is harmless.
  if (!envelope) {
    saveKnownGood(res.project, 0);
  }

  return {
    project: res.project,
    version: envelope?.v ?? 0,
    savedAt: envelope?.t ?? res.project.modifiedAt,
  };
}

/* ---------------- the autosave recovery snapshot ---------------- */

/** Autosave writer. Never touches GOOD_KEY. */
export function saveRecovery(project: Project, version: number): boolean {
  const envelope: SaveEnvelope = {
    v: version,
    t: Date.now(),
    json: serialize(project),
  };
  return atomicWrite(RECOVERY_KEY, RECOVERY_TMP, JSON.stringify(envelope));
}

/** Read the recovery snapshot, or null if absent/corrupt. Validates the JSON. */
export function readRecovery(): RecoveryCandidate | null {
  const envelope = readEnvelope(RECOVERY_KEY, RECOVERY_TMP);
  if (!envelope) { clearRecovery(); return null; }
  const res = deserialize(envelope.json);
  if (!res.ok) {
    // A recovery that can't be parsed is useless — drop it so we don't prompt.
    clearRecovery();
    return null;
  }
  return { savedAt: envelope.t, version: envelope.v, json: envelope.json };
}

export function clearRecovery(): void {
  tryRemove(RECOVERY_KEY);
  tryRemove(RECOVERY_TMP);
}

/**
 * Is this recovery newer than the user's last known-good save (or is there no
 * known-good save)? If so it likely holds work the user never saved by hand —
 * an orphan worth offering to restore.
 */
export function isOrphanedRecovery(recovery: RecoveryCandidate): boolean {
  const good = loadKnownGood();
  if (!good) return true;
  return recovery.savedAt > good.savedAt;
}

/* ---------------- autosave interval configuration ---------------- */

export function getAutosaveIntervalMs(): number {
  const raw = tryGet(INTERVAL_KEY);
  if (raw === null) return DEFAULT_INTERVAL_MS;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_INTERVAL_MS;
  return Math.min(MAX_INTERVAL_MS, Math.max(MIN_INTERVAL_MS, Math.round(n)));
}

export function setAutosaveIntervalMs(ms: number): number {
  const clamped = Math.min(MAX_INTERVAL_MS, Math.max(MIN_INTERVAL_MS, Math.round(ms)));
  try {
    localStorage.setItem(INTERVAL_KEY, String(clamped));
  } catch {
    /* non-fatal */
  }
  return clamped;
}

/* ---------------- the interval-driven autosave driver ---------------- */

/**
 * Minimal view of the bus the driver needs. Keeping this an interface (rather
 * than importing the bus singleton) means this module stays free of circular
 * dependencies and is trivially testable with a fake source.
 */
export interface AutosaveSource {
  getState(): Project;
  getVersion(): number;
}

export type AutosaveStatus = "idle" | "clean" | "dirty" | "saving" | "saved" | "error";

/* Environment-agnostic handles so this module also runs under test (node)
 * and degrades gracefully anywhere a global is missing. */
const g = globalThis as unknown as {
  setInterval?: (fn: () => void, ms: number) => number;
  clearInterval?: (id: number) => void;
  addEventListener?: (type: string, fn: () => void) => void;
  removeEventListener?: (type: string, fn: () => void) => void;
};

export class AutosaveService {
  private timer: number | null = null;
  private intervalMs: number;
  private lastWrittenVersion = 0;
  private lastSavedAt = 0;
  private status: AutosaveStatus = "idle";
  private onStatus?: (s: AutosaveStatus, at: number) => void;

  constructor(private source: AutosaveSource, opts?: { intervalMs?: number; onStatus?: AutosaveService["onStatus"] }) {
    this.intervalMs = opts?.intervalMs ?? getAutosaveIntervalMs();
    this.onStatus = opts?.onStatus;
  }

  /** Baseline to the current version so merely loading a project isn't "dirty". */
  start(): void {
    this.lastWrittenVersion = this.source.getVersion();
    this.setStatus(this.isDirty() ? "dirty" : "clean");
    this.schedule();
    // Safety nets: flush a recovery snapshot when the tab hides or unloads.
    g.addEventListener?.("visibilitychange", this.handleVisibility);
    g.addEventListener?.("beforeunload", this.handleUnload);
  }

  stop(): void {
    if (this.timer !== null) g.clearInterval?.(this.timer);
    this.timer = null;
    g.removeEventListener?.("visibilitychange", this.handleVisibility);
    g.removeEventListener?.("beforeunload", this.handleUnload);
  }

  setInterval(ms: number): void {
    this.intervalMs = setAutosaveIntervalMs(ms);
    if (this.timer !== null) {
      g.clearInterval?.(this.timer);
      this.schedule();
    }
  }

  getIntervalMs(): number {
    return this.intervalMs;
  }

  getStatus(): AutosaveStatus {
    return this.status;
  }

  getLastSavedAt(): number {
    return this.lastSavedAt;
  }

  /** True when the project has changed since the last recovery write. */
  isDirty(): boolean {
    return this.source.getVersion() !== this.lastWrittenVersion;
  }

  /** Write a recovery snapshot now (used by the interval and the safety nets). */
  flush(): boolean {
    if (!this.isDirty()) return true;
    this.setStatus("saving");
    const ok = saveRecovery(this.source.getState(), this.source.getVersion());
    if (ok) {
      this.lastWrittenVersion = this.source.getVersion();
      this.lastSavedAt = Date.now();
      this.setStatus("saved");
    } else {
      this.setStatus("error");
    }
    return ok;
  }

  /** Called after an explicit known-good Save so autosave isn't immediately "dirty". */
  markClean(version: number): void {
    this.lastWrittenVersion = version;
    this.setStatus("clean");
  }

  private schedule(): void {
    if (!g.setInterval) return; // no timer available — interval autosave disabled
    this.timer = g.setInterval(() => {
      if (this.isDirty()) this.flush();
      else this.setStatus("clean");
    }, this.intervalMs);
  }

  private setStatus(s: AutosaveStatus): void {
    if (this.status === s) return;
    this.status = s;
    this.onStatus?.(s, this.lastSavedAt);
  }

  private handleVisibility = (): void => {
    const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
    if (hidden) this.flush();
    else this.setStatus(this.isDirty() ? "dirty" : "clean");
  };

  private handleUnload = (): void => {
    this.flush();
  };
}

