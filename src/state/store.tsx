function readPreference(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } }
function writePreference(key: string, value: string): void { try { localStorage.setItem(key, value); } catch { /* Keep the preference for this session when storage is unavailable. */ } }
/* React binding for the command bus.
 *
 * The bus (src/core/bus.ts) is the single source of truth for project state.
 * This provider mirrors it into React and layers UI-local state on top
 * (UX mode, selection, mixer visibility). Components never write state
 * directly — they call apply(), which dispatches named Commands through
 * the bus; undo/redo are bus operations too, so user edits and AI edits
 * share one history. */

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { MODE_ORDER, Mode, Project, WorkspaceView } from "../types";
import { Command } from "../core/commands";
import { RecordMode } from "../core/midi";
import { bus, CommandValidationError } from "../core/bus";
import {
  AutosaveService, AutosaveStatus, RecoveryCandidate,
  clearRecovery, getAutosaveIntervalMs, isOrphanedRecovery,
  readRecovery, saveKnownGood,
} from "../core/autosave";
import { deserialize } from "../core/format";

export interface StoreState {
  project: Project;
  mode: Mode;
  workspaceView: WorkspaceView;
  aiPanelOpen: boolean;
  selectedTrackId: string;
  editorClipId: string | null;
  mixerOpen: boolean;
  /** MIDI recording mode: append to the clip, or replace the recorded region. */
  recordMode: RecordMode;
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
  /** Orphaned recovery snapshot awaiting a restore/discard decision. */
  recovery: RecoveryCandidate | null;
  autosave: { status: AutosaveStatus; intervalMs: number; lastSavedAt: number };
}

/** Detect an orphaned recovery snapshot once, before first paint. */
function detectRecovery(): RecoveryCandidate | null {
  try {
    const rec = readRecovery();
    return rec && isOrphanedRecovery(rec) ? rec : null;
  } catch {
    return null;
  }
}

const MODE_KEY = "cadence.mode";
const VIEW_KEY = "cadence.workspaceView";
const AI_KEY = "cadence.aiPanelOpen";

const readMode = (): Mode => {
  const m = readPreference(MODE_KEY);
  return m === "producer" || m === "advanced" ? m : "beginner";
};

const readView = (): WorkspaceView => {
  const v = readPreference(VIEW_KEY);
  return v === "pianoroll" || v === "mixer" || v === "synth" || v === "groove" || v === "fx" || v === "vocal" || v === "projects" ? v : "arrangement";
};

const readAiOpen = (): boolean => readPreference(AI_KEY) !== "0";

const RECORD_KEY = "cadence.recordMode";
const readRecordMode = (): RecordMode =>
  readPreference(RECORD_KEY) === "replace" ? "replace" : "overdub";

/** Merge the bus's current truth into React state, keeping selection valid. */
function syncFromBus(s: StoreState): StoreState {
  const p = bus.getState();
  const selectedTrackId = p.tracks.some((t) => t.id === s.selectedTrackId)
    ? s.selectedTrackId
    : p.tracks[0]?.id ?? "";
  const selected = p.tracks.find((t) => t.id === selectedTrackId);
  const editorClipId = s.editorClipId && p.clips[s.editorClipId]
    ? s.editorClipId
    : selected?.sourceClipId ?? null;
  return {
    ...s,
    project: p,
    selectedTrackId,
    editorClipId,
    canUndo: bus.canUndo,
    canRedo: bus.canRedo,
    undoLabel: bus.undoLabel(),
    redoLabel: bus.redoLabel(),
  };
}

function initState(): StoreState {
  const p = bus.getState();
  return syncFromBus({
    project: p,
    mode: readMode(),
    workspaceView: readView(),
    aiPanelOpen: readAiOpen(),
    selectedTrackId: p.tracks[0]?.id ?? "",
    editorClipId: p.tracks[0]?.sourceClipId ?? null,
    mixerOpen: true,
    recordMode: readRecordMode(),
    canUndo: bus.canUndo,
    canRedo: bus.canRedo,
    undoLabel: bus.undoLabel(),
    redoLabel: bus.redoLabel(),
    recovery: detectRecovery(),
    autosave: { status: "idle", intervalMs: getAutosaveIntervalMs(), lastSavedAt: 0 },
  });
}

export interface StoreApi {
  state: StoreState;
  /**
   * Progressive disclosure, expressed as "visible from this mode".
   * gate("producer") is true in Producer AND Advanced; gate("advanced") only in
   * Advanced. Components reveal controls with this instead of comparing mode
   * strings, so the Beginner ⊂ Producer ⊂ Advanced ordering lives in one place.
   */
  gate: (threshold: Mode) => boolean;
  /** Dispatch commands through the bus; snapshot before → one undo reverts the batch. */
  apply: (label: string, commands: Command[]) => void;
  /** Same pipeline, no history entry (used while live-recording notes). */
  applySilent: (commands: Command[]) => void;
  /** Mark an undo checkpoint (e.g. before a recording take). */
  snapshot: (label: string) => void;
  undo: () => void;
  redo: () => void;
  setMode: (mode: Mode) => void;
  setWorkspaceView: (view: WorkspaceView) => void;
  setAiPanel: (open: boolean) => void;
  selectTrack: (trackId: string) => void;
  setEditorClip: (clipId: string) => void;
  toggleMixer: () => void;
  /** Choose MIDI recording behaviour: overdub (append) or replace (clear region). */
  setRecordMode: (mode: RecordMode) => void;
  loadProject: (project: Project) => void;
  /** Explicit known-good Save (atomic). Returns false if storage failed. */
  saveNow: () => boolean;
  /** Accept the orphaned recovery snapshot: load it, pin it as known-good. */
  restoreRecovery: () => void;
  /** Reject the orphaned recovery snapshot and clear it. */
  discardRecovery: () => void;
  /** Configure the autosave cadence (clamped to a sane range). */
  setAutosaveInterval: (ms: number) => void;
}

const Ctx = createContext<StoreApi | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StoreState>(initState);
  const autosaveRef = useRef<AutosaveService | null>(null);

  useEffect(() => bus.subscribe(() => setState((s) => syncFromBus(s))), []);

  /* Interval-driven autosave → recovery snapshots (never the known-good save). */
  useEffect(() => {
    const svc = new AutosaveService(bus, {
      intervalMs: getAutosaveIntervalMs(),
      onStatus: (status, lastSavedAt) =>
        setState((s) => ({ ...s, autosave: { ...s.autosave, status, lastSavedAt } })),
    });
    autosaveRef.current = svc;
    svc.start();
    return () => {
      svc.stop();
      autosaveRef.current = null;
    };
  }, []);

  const api = useMemo<StoreApi>(() => ({
    state,
    gate: (threshold) => MODE_ORDER[state.mode] >= MODE_ORDER[threshold],
    apply: (label, commands) => {
      try {
        bus.dispatch(label, commands);
      } catch (e) {
        if (e instanceof CommandValidationError) {
          console.warn(`[command-bus] rejected batch "${label}" — [${e.op}] ${e.message}`);
        } else {
          console.error("[command-bus] dispatch failed", e);
        }
      }
    },
    applySilent: (commands) => {
      try {
        bus.dispatchSilent(commands);
      } catch (e) {
        console.warn("[command-bus] silent dispatch rejected", e);
      }
    },
    snapshot: (label) => bus.snapshot(label),
    undo: () => bus.undo(),
    redo: () => bus.redo(),
    setMode: (mode) => {
      writePreference(MODE_KEY, mode);
      setState((s) => ({ ...s, mode }));
    },
    setRecordMode: (recordMode) => {
      writePreference(RECORD_KEY, recordMode);
      setState((s) => ({ ...s, recordMode }));
    },
    setWorkspaceView: (workspaceView) => {
      writePreference(VIEW_KEY, workspaceView);
      setState((s) => ({ ...s, workspaceView }));
    },
    setAiPanel: (aiPanelOpen) => {
      writePreference(AI_KEY, aiPanelOpen ? "1" : "0");
      setState((s) => ({ ...s, aiPanelOpen }));
    },
    selectTrack: (trackId) =>
      setState((s) => {
        const track = bus.getState().tracks.find((t) => t.id === trackId);
        if (!track) return s;
        return { ...s, selectedTrackId: trackId, editorClipId: track.sourceClipId };
      }),
    setEditorClip: (clipId) => setState((s) => ({ ...s, editorClipId: clipId })),
    toggleMixer: () => setState((s) => ({ ...s, mixerOpen: !s.mixerOpen })),
    loadProject: (project) => bus.replace(project),
    saveNow: () => {
      const ok = saveKnownGood(bus.getState(), bus.getVersion());
      if (ok) {
        clearRecovery(); // the known-good save is now newest — recovery is stale
        autosaveRef.current?.markClean(bus.getVersion());
      }
      return ok;
    },
    restoreRecovery: () => {
      const rec = state.recovery;
      if (!rec) return;
      const res = deserialize(rec.json);
      if (res.ok) {
        bus.replace(res.project);
        saveKnownGood(res.project, bus.getVersion());
        clearRecovery();
        autosaveRef.current?.markClean(bus.getVersion());
      }
      setState((s) => ({ ...s, recovery: null }));
    },
    discardRecovery: () => {
      clearRecovery();
      setState((s) => ({ ...s, recovery: null }));
    },
    setAutosaveInterval: (ms) => {
      const svc = autosaveRef.current;
      const clamped = svc ? (svc.setInterval(ms), svc.getIntervalMs()) : getAutosaveIntervalMs();
      setState((s) => ({ ...s, autosave: { ...s.autosave, intervalMs: clamped } }));
    },
  }), [state]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useStore(): StoreApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore outside StoreProvider");
  return ctx;
}



