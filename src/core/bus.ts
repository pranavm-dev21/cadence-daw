/* The command bus — the ONLY entry point for project-state mutation.
 *
 * Lifecycle of every change (user gesture, AI plan, file import, recording):
 *
 *   dispatch(label, commands)
 *     1. validate every command against the schema (atomic: one bad command
 *        rejects the whole batch before anything runs)
 *     2. run the pure executors:  before → after
 *     3. push { label, before, commands } on the undo stack, clear redo
 *     4. notify subscribers (React bindings, engine sync, autosave)
 *
 * Undo restores the stored pre-state snapshot; redo replays the stored
 * commands through the very same executors — so there is one code path in
 * both directions and no second implementation to drift. */

import { Project } from "../types";
import { Command, validateCommand } from "./commands";
import { execCommand } from "./executors";
import { loadKnownGood } from "./autosave";
import { validateProject } from "./validate";
import { buildDemoProject } from "./seed";

export const HISTORY_CAP = 64;

export class CommandValidationError extends Error {
  constructor(public readonly op: string, message: string) {
    super(message);
    this.name = "CommandValidationError";
  }
}

interface Batch {
  label: string;
  /** Pre-state snapshot — restoring it is what "undo" means. */
  before: Project;
  /** The commands themselves — replayed by "redo". */
  commands: Command[];
}

export class CommandBus {
  private state: Project;
  private undoStack: Batch[] = [];
  private redoStack: Batch[] = [];
  private listeners = new Set<() => void>();
  private version = 0;

  constructor(initial: Project) {
    this.state = initial;
  }

  /* ---------------- queries ---------------- */

  getState(): Project {
    return this.state;
  }

  /** Monotonic — increments on every state change, handy for effect deps. */
  getVersion(): number {
    return this.version;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undoLabel(): string | null {
    return this.undoStack[this.undoStack.length - 1]?.label ?? null;
  }

  redoLabel(): string | null {
    return this.redoStack[this.redoStack.length - 1]?.label ?? null;
  }

  /** Read-only view of the undo history (newest last) for inspectors. */
  history(): readonly string[] {
    return this.undoStack.map((b) => b.label);
  }

  /* ---------------- mutations ---------------- */

  /** Apply a batch of commands atomically, as one undoable unit. */
  dispatch(label: string, commands: Command[]): void {
    if (!Array.isArray(commands) || commands.length === 0) return;
    for (const c of commands) {
      const err = validateCommand(c);
      if (err) throw new CommandValidationError((c as { op?: string }).op ?? "?", err);
    }
    const before = this.state;
    let next = before;
    for (const c of commands) {
      try {
        next = execCommand(next, c);
      } catch (err) {
        // executors are total; this is a belt-and-braces guard
        console.error("[command-bus] executor error", c, err);
      }
    }
    if (next === before) return; // every command was a no-op — leave history untouched
    next = { ...next, modifiedAt: Date.now() };
    this.state = next;
    this.undoStack.push({ label, before, commands });
    if (this.undoStack.length > HISTORY_CAP) this.undoStack.shift();
    this.redoStack = [];
    this.emit();
  }

  /** Same pipeline minus the history entry — used for live note recording,
   * where a take is bookended by snapshot()/undo instead. */
  dispatchSilent(commands: Command[]): void {
    if (!Array.isArray(commands) || commands.length === 0) return;
    for (const c of commands) {
      const err = validateCommand(c);
      if (err) throw new CommandValidationError((c as { op?: string }).op ?? "?", err);
    }
    const before = this.state;
    let next = before;
    for (const c of commands) next = execCommand(next, c);
    if (next === before) return;
    this.state = { ...next, modifiedAt: Date.now() };
    this.emit();
  }

  /** Mark the current state as an undo checkpoint (e.g. before a take). */
  snapshot(label: string): void {
    this.undoStack.push({ label, before: this.state, commands: [] });
    if (this.undoStack.length > HISTORY_CAP) this.undoStack.shift();
    this.redoStack = [];
    this.emit();
  }

  /** Restore the pre-state of the most recent batch. Returns its label. */
  undo(): string | null {
    const batch = this.undoStack.pop();
    if (!batch) return null;
    this.redoStack.push(batch);
    this.state = batch.before;
    this.emit();
    return batch.label;
  }

  /** Re-apply the most recently undone batch through the executors. */
  redo(): string | null {
    const batch = this.redoStack.pop();
    if (!batch) return null;
    let next = this.state;
    for (const c of batch.commands) next = execCommand(next, c);
    this.state = next;
    this.undoStack.push(batch);
    this.emit();
    return batch.label;
  }

  /** Swap in a fully-formed project (template, file import). Clears history —
   * the caller decides what "undoing a load" should mean. */
  replace(project: Project): void {
    const res = validateProject(project);
    this.state = res.ok ? res.project : project;
    this.undoStack = [];
    this.redoStack = [];
    this.emit();
  }

  /* ---------------- observation ---------------- */

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit(): void {
    this.version += 1;
    this.listeners.forEach((fn) => fn());
  }
}

/* ---------------- bootstrap ---------------- */

function loadInitialProject(): Project {
  // Boot from the last KNOWN-GOOD save only. Recovery snapshots are never
  // auto-loaded — the UI detects an orphaned one and offers restore/discard,
  // so an interrupted session can't silently shadow the user's real save.
  // loadKnownGood() handles envelope unwrapping, the legacy save location and
  // the migration registry; a corrupt save yields null → demo song.
  try {
    const good = loadKnownGood();
    if (good) return good.project;
  } catch {
    /* corrupted or blocked storage — fall through to the demo song */
  }
  return buildDemoProject();
}

/** The app's single source of truth for project state. */
export const bus = new CommandBus(loadInitialProject());
