import { useEffect, useMemo, useState } from "react";
import { useStore } from "../state/store";
import { deserialize } from "../core/format";
import { IconAlert, IconRestore, IconTrash } from "./icons";

/**
 * Shown on launch when an orphaned recovery snapshot is detected — work that
 * was autosaved but is newer than the last known-good save. The user chooses
 * to restore it (loads + pins it as the save) or discard it (clears it).
 */
export default function RecoveryPrompt() {
  const { state, restoreRecovery, discardRecovery } = useStore();
  const rec = state.recovery;
  const [leaving, setLeaving] = useState(false);

  const meta = useMemo(() => {
    if (!rec) return null;
    const res = deserialize(rec.json);
    return res.ok ? { name: res.project.name, tracks: res.project.tracks.length } : null;
  }, [rec]);

  const when = useMemo(() => {
    if (!rec) return "";
    const d = new Date(rec.savedAt);
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }, [rec]);

  // Gentle entrance / exit so dismissing feels deliberate, not jarring.
  useEffect(() => {
    if (!rec) return;
    setLeaving(false);
  }, [rec]);

  if (!rec) return null;

  const close = (action: () => void) => {
    setLeaving(true);
    window.setTimeout(action, 160);
  };

  return (
    <div
      className={`fixed inset-0 z-[70] flex items-center justify-center bg-ink-950/70 backdrop-blur-sm transition-opacity duration-150 ${leaving ? "opacity-0" : "opacity-100"}`}
      role="dialog"
      aria-modal="true"
      aria-label="Recovery snapshot found"
    >
      <div
        className={`w-[min(420px,92vw)] panel overflow-hidden shadow-2xl transition-all duration-150 ${leaving ? "scale-95 translate-y-2 opacity-0" : "scale-100 opacity-100 anim-pop"}`}
      >
        {/* accent strip */}
        <div className="h-[3px] bg-gradient-to-r from-amber-glow via-teal to-amber-glow" />

        <div className="p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 w-9 h-9 shrink-0 rounded-lg bg-amber-glow/12 border border-amber-glow/30 flex items-center justify-center">
              <IconAlert size={18} className="text-amber-glow" />
            </span>
            <div className="min-w-0">
              <h2 className="font-display font-semibold text-[16px] text-ink-100 leading-tight">Unsaved session found</h2>
              <p className="mt-1 text-[12px] text-ink-300 leading-relaxed">
                Cadence recovered an autosaved snapshot{meta ? <> of <strong className="text-ink-100">{meta.name}</strong> ({meta.tracks} tracks)</> : null} from{" "}
                <strong className="text-ink-100">{when}</strong> that's newer than your last save. Restore it, or discard it to keep your current project.
              </p>
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <button
              className="btn btn-primary flex-1 justify-center"
              onClick={() => close(restoreRecovery)}
              autoFocus
            >
              <IconRestore size={14} /> Restore snapshot
            </button>
            <button
              className="btn flex-1 justify-center"
              onClick={() => close(discardRecovery)}
            >
              <IconTrash size={14} /> Discard
            </button>
          </div>

          <p className="mt-3 text-[10px] font-mono text-ink-400 text-center">
            Restoring writes it as your save · discarding can't be undone
          </p>
        </div>
      </div>
    </div>
  );
}
