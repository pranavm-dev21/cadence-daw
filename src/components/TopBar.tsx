import { useRecordingBusy } from "../state/useRecordingBusy";
import { useEffect, useRef, useState } from "react";
import { Mode } from "../types";
import { createProjectBundle, openProjectBundle } from "../core/bundle";
import { useStore } from "../state/store";
import { audio, buildEmptyProject, parseProjectFile, serialize } from "../core";
import { BrandMark, IconDownload, IconFolderOpen, IconPlus, IconRedo, IconSave, IconUndo } from "./icons";

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "beginner", label: "Beginner", hint: "The essentials only — just make music" },
  { id: "producer", label: "Moderate", hint: "Panning, solo, clip tools" },
  { id: "advanced", label: "Master", hint: "Sends, filters, drive, diagnostics" },
];

export default function TopBar({ onToast, playing }: { onToast: (msg: string) => void; playing: boolean }) {
  const { state, apply, undo, redo, setMode, loadProject, saveNow } = useStore();
  const [name, setName] = useState(state.project.name);
  const [exporting, setExporting] = useState(false);
  const [sampleRate, setSampleRate] = useState<44100 | 48000>(48000);
  const [bitDepth, setBitDepth] = useState<16 | 24>(24);
  const [fileBusy, setFileBusy] = useState(false);
  const recordingBusy = useRecordingBusy();

  // stay in sync when a template/new session is loaded
  useEffect(() => setName(state.project.name), [state.project.name]);

  const commitName = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== state.project.name) {
      apply("Rename project", [{ op: "set_project_name", name: trimmed }]);
    } else {
      setName(state.project.name);
    }
  };

  const exportWav = async () => {
    setExporting(true);
    try {
      const blob = await audio.exportWav(state.project, { sampleRate, bitDepth });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${state.project.name.replace(/[^\w\- ]+/g, "") || "cadence-mix"}.wav`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      onToast(`Rendered ${bitDepth}-bit WAV at ${sampleRate / 1000} kHz — check your downloads`);
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Export failed. Please retry.");
    } finally {
      setExporting(false);
    }
  };

  const fileRef = useRef<HTMLInputElement>(null);

  const saveFile = async () => {
    setFileBusy(true);
    try {
    const blob = await createProjectBundle(state.project);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.project.name.replace(/[^\w\- ]+/g, "").trim() || "session"}.cadenceproject`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    onToast("Project backup downloaded with all recorded takes.");
    } catch (error) { onToast(error instanceof Error ? error.message : "Project backup failed."); }
    finally { setFileBusy(false); }
  };

  const openFile = async (file: File) => {
    setFileBusy(true);
    try {
    if (file.name.toLowerCase().endsWith(".cadenceproject")) {
      if (file.size > 256 * 1024 * 1024) { onToast("Project backup is too large (maximum 256 MB)."); return; }
      const project = await openProjectBundle(await file.arrayBuffer());
      audio.stop(); loadProject(project); onToast("Opened project and restored its recordings."); return;
    }
    if (file.size > 8 * 1024 * 1024) { onToast("Project file is too large (maximum 8 MB)."); return; }
    const text = await file.text();
    const res = parseProjectFile(text);
    if (!res.ok) {
      onToast(`Can't open that file — ${res.error.toLowerCase()}`);
      return;
    }
    loadProject(res.project);
    onToast(`Opened "${res.project.name}" — validated ${res.project.tracks.length} tracks`);
    } finally { setFileBusy(false); }
  };

  const lastUndo = state.undoLabel;
  const lastRedo = state.redoLabel;

  return (
    <header className="flex items-center gap-3 px-3 py-2 min-h-14 flex-wrap border-b border-ink-700 bg-ink-900/90 shrink-0 anim-fade-up">
      <div className="flex items-center gap-2.5 min-w-0">
        <BrandMark size={30} />
        <div className="leading-none">
          <div className="font-display font-semibold tracking-[0.12em] text-[14px] text-ink-100">CADENCE</div>
          <div className="text-[9px] tracking-[0.14em] uppercase text-ink-400 mt-1">open-source AI DAW</div>
        </div>
        <div className={`flex items-end gap-[2.5px] h-4 ml-1 ${playing ? "eq-playing" : ""}`} aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="eq-bar" style={{ height: playing ? undefined : `${22 + i * 12}%`, opacity: playing ? 1 : 0.35 }} />
          ))}
        </div>
      </div>

      <div className="w-px h-7 bg-ink-700 mx-1" />

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="bg-ink-800 border border-ink-700 rounded-lg px-3 py-1.5 text-[13px] font-semibold text-ink-100 w-44 focus:outline-none focus:border-amber-glow/60 focus:ring-2 focus:ring-amber-glow/15 transition"
        aria-label="Project name"
      />

      <button className="btn btn-ghost" disabled={recordingBusy} title="Start a blank session (undoable)" onClick={() => { loadProject(buildEmptyProject()); onToast("Blank session ready — ask the copilot for a beat"); }}>
        <IconPlus size={14} /> New
      </button>

      <div className="flex-1" />

      {/* mode switch */}
      <div className="flex items-center bg-ink-800 border border-ink-700 rounded-lg p-0.5" role="tablist" aria-label="Interface mode">
        {MODES.map((m) => (
          <button
            key={m.id}
            role="tab"
            title={m.hint}
            aria-selected={state.mode === m.id}
            onClick={() => { setMode(m.id); onToast(`${m.label} mode — ${m.hint.toLowerCase()}`); }}
            className={`px-3 py-1.5 rounded-md text-[11.5px] font-semibold tracking-wide transition-all duration-150 ${
              state.mode === m.id
                ? "bg-amber-glow text-ink-950 shadow-[0_2px_10px_rgba(255,180,84,0.3)]"
                : "text-ink-400 hover:text-ink-100"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="w-px h-7 bg-ink-700 mx-1" />

      <button className="btn btn-ghost" onClick={undo} disabled={!state.canUndo || recordingBusy} title={lastUndo ? `Undo: ${lastUndo}` : "Undo (Ctrl+Z)"}>
        <IconUndo size={15} />
      </button>
      <button className="btn btn-ghost" onClick={redo} disabled={!state.canRedo || recordingBusy} title={lastRedo ? `Redo: ${lastRedo}` : "Redo (Ctrl+Shift+Z)"}>
        <IconRedo size={15} />
      </button>

      <div className="w-px h-7 bg-ink-700 mx-1" />

      <button
        className="btn"
        onClick={() => {
          // Atomic known-good save: temp write → verify → rename. Autosave
          // recovery snapshots never touch this location.
          const ok = saveNow();
          onToast(ok ? "Project saved" : "Save failed — storage unavailable");
        }}
        disabled={recordingBusy} title="Save as your known-good project (atomic write)"
      >
        <IconSave size={14} /> Save
      </button>
      <button className="btn" disabled={fileBusy || recordingBusy} onClick={() => fileRef.current?.click()} title="Open a portable project backup or legacy JSON project">
        <IconFolderOpen size={14} /> Open
      </button>
      <button className="btn" disabled={fileBusy || recordingBusy} onClick={() => void saveFile()} title="Download the project with all recorded audio">
        <IconDownload size={14} /> {fileBusy ? "Working…" : "Save file"}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".json,.cadence,.cadenceproject,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) openFile(f).catch(error => onToast(error instanceof Error ? error.message : "Couldn't read that file"));
          e.target.value = "";
        }}
      />
      {state.mode === "advanced" && <div className="flex gap-2">
        <select aria-label="WAV sample rate" className="bg-ink-800 rounded text-xs p-1" value={sampleRate} onChange={e => setSampleRate(Number(e.target.value) as 44100 | 48000)}><option value={44100}>44.1 kHz</option><option value={48000}>48 kHz</option></select>
        <select aria-label="WAV bit depth" className="bg-ink-800 rounded text-xs p-1" value={bitDepth} onChange={e => setBitDepth(Number(e.target.value) as 16 | 24)}><option value={16}>16-bit</option><option value={24}>24-bit</option></select>
      </div>}
      <button className="btn btn-primary" onClick={exportWav} disabled={exporting || recordingBusy} title="Render the whole song to a WAV file">
        <IconDownload size={14} /> {exporting ? "Rendering…" : "Export WAV"}
      </button>
    </header>
  );
}




