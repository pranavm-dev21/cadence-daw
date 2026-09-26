import { useRecordingBusy } from "./state/useRecordingBusy";
import { AccountProvider } from "./cloud/account";
import CloudProjects from "./components/CloudProjects";
import { useEffect, useRef, useState } from "react";
import { Note, uid } from "./types";
import { StoreProvider, StoreApi, useStore } from "./state/store";
import { audio, snapToGrid } from "./core";
import TopBar from "./components/TopBar";
import Transport from "./components/Transport";
import WorkspaceSwitcher from "./components/WorkspaceSwitcher";
import Timeline from "./components/Timeline";
import StepSequencer from "./components/StepSequencer";
import PianoRoll from "./components/PianoRoll";
import Mixer from "./components/Mixer";
import SynthLab from "./components/SynthLab";
import GrooveBox from "./components/GrooveBox";
import FxRack from "./components/FxRack";
import VocalWorkspace from "./components/VocalWorkspace";
import AIPanel from "./components/AIPanel";
import Browser from "./components/Browser";
import BrowserPro from "./components/BrowserPro";
import ChannelRackPro from "./components/ChannelRackPro";
import MenuBar from "./components/MenuBar";
import StatusBar from "./components/StatusBar";
import SettingsModal from "./components/SettingsModal";
import { HintProvider } from "./state/hintContext";
import { createProjectBundle, openProjectBundle } from "./core/bundle";
import { parseProjectFile } from "./core";
import RecoveryPrompt from "./components/RecoveryPrompt";

const NOTE_KEYS: Record<string, number> = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14, p: 15 };
const DRUM_KEYS: Record<string, number> = { z: 0, x: 1, c: 2, v: 3, b: 4 };

interface Toast { id: number; msg: string; }
let toastId = 0;

export default function App() {
  return (
    <AccountProvider>
      <StoreProvider>
        <HintProvider>
          <Workbench />
        </HintProvider>
      </StoreProvider>
    </AccountProvider>
  );
}

function Workbench() {
  const store = useStore();
  const { state } = store;
  const recordingBusy = useRecordingBusy();
  const storeRef = useRef<StoreApi>(store);
  storeRef.current = store;

  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [loop, setLoop] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const heldNotes = useRef(new Map<string, { noteId: string; clipId: string; startStep: number; voice: { stop: () => void } }>());
  const recRef = useRef(false);
  recRef.current = recording;
  /* MIDI recording mode (overdub vs replace) — mirrored for the key handler. */
  const recModeRef = useRef(state.recordMode);
  recModeRef.current = state.recordMode;
  /* Replace mode clears the target clip once per take, on the first recorded note. */
  const takeClearedRef = useRef(false);

  const onToast = (msg: string) => {
    const id = toastId++;
    setToasts((t) => [...t.slice(-2), { id, msg }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  };
  const toastRef = useRef(onToast);
  toastRef.current = onToast;

  /* keep the audio backend in sync with the project graph
   * (this composition root is the only place UI-land meets the backend) */
  useEffect(() => {
    audio.setProject(state.project);
    audio.setOnTransport((value) => { setPlaying(value); setLoop(audio.loop); });
    return () => audio.setOnTransport(null);
  }, [state.project]);

  /* Autosave is driven by the store's AutosaveService (interval + page-hide
   * flush) into a dedicated recovery location — it never touches the user's
   * known-good save, which only an explicit Save writes. */

  /* keyboard performance + shortcuts */
  useEffect(() => {
    const isFormEl = (el: EventTarget | null) =>
      el instanceof HTMLElement && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);

    const down = (e: KeyboardEvent) => {
      if (isFormEl(e.target)) return;
      const engine = audio;
      const s = storeRef.current;

      if (e.code === "Space") {
        // let focused buttons activate natively instead of double-toggling transport
        if (e.target instanceof HTMLElement && e.target.tagName === "BUTTON") return;
        e.preventDefault();
        if (engine.playing) engine.pause(); else void engine.play().catch((error) => toastRef.current(error.message));
        return;
      }
      if ((["capturing", "paused", "saving"].includes(audio.recorder.status) || audio.recorder.canRetrySave) && e.code !== "Space") return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) s.redo(); else s.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        s.redo();
        return;
      }
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;

      const key = e.key.toLowerCase();

      /* FL Studio & Cadence shortcuts */
      if (e.code === "F5" || key === "1") { e.preventDefault(); s.setWorkspaceView("arrangement"); return; }
      if (e.code === "F6") { e.preventDefault(); s.setWorkspaceView("channelrack"); return; }
      if (e.code === "F7" || key === "2") { e.preventDefault(); s.setWorkspaceView("pianoroll"); return; }
      if (e.code === "F9" || key === "3") { e.preventDefault(); s.setWorkspaceView("mixer"); return; }
      if (key === "4") { s.setWorkspaceView("synth"); return; }
      if (key === "5") { s.setWorkspaceView("groove"); return; }
      if (key === "6") { s.setWorkspaceView("fx"); return; }
      if (key === "7") { s.setWorkspaceView("vocal"); return; }

      /* Synth Lab, Groove Box & FX Rack own the note/pad keys while open — don't double-trigger. */
      if (s.state.workspaceView === "vocal" || s.state.workspaceView === "synth" || s.state.workspaceView === "groove" || s.state.workspaceView === "fx") return;

      /* drum pads */
      if (key in DRUM_KEYS) {
        const drumTrack = s.state.project.tracks.find((t) => t.instrument === "drumkit");
        if (drumTrack) engine.previewNote(drumTrack.id, DRUM_KEYS[key], 0.95, 0.5);
        return;
      }

      /* piano keys */
      if (key in NOTE_KEYS && !heldNotes.current.has(key)) {
        const proj = s.state.project;
        const selected = proj.tracks.find((t) => t.id === s.state.selectedTrackId);
        const melodic = selected && selected.instrument !== "drumkit"
          ? selected
          : proj.tracks.find((t) => t.instrument !== "drumkit");
        if (!melodic) return;
        const midi = proj.rootMidi + 12 + NOTE_KEYS[key];
        const voice = engine.previewNote(melodic.id, midi, 0.85);

        /* record into the open clip */
        if (recRef.current && engine.playing) {
          const clipId = melodic.id === s.state.selectedTrackId && s.state.editorClipId && melodic.clipIds.includes(s.state.editorClipId)
            ? s.state.editorClipId
            : melodic.sourceClipId;
          const clip = proj.clips[clipId];
          if (clip) {
            /* Replace mode: wipe the target clip once per take, before the first
             * note lands. Undoable as a single entry; overdub never clears. */
            if (recModeRef.current === "replace" && !takeClearedRef.current) {
              s.apply("Replace take: clear clip", [{ op: "set_clip_content", clipId, notes: [] }]);
              takeClearedRef.current = true;
            }
            const clipSteps = clip.lengthBars * 16;
            /* Record quantization: snap the captured (fractional) playhead to the
             * nearest 1/16, using the same MIDI quantize primitive as editing. */
            const startStep = ((Math.round(snapToGrid(engine.getCurrentStep(), 1)) % clipSteps) + clipSteps) % clipSteps;
            const noteId = uid("n");
            const note: Note = { id: noteId, pitch: midi, start: startStep, dur: 1, vel: 0.85 };
            s.applySilent([{ op: "add_notes", clipId, notes: [note] }]);
            heldNotes.current.set(key, { noteId, clipId, startStep, voice });
            return;
          }
        }
        heldNotes.current.set(key, { noteId: "", clipId: "", startStep: 0, voice });
      }
    };

    const up = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const held = heldNotes.current.get(key);
      if (!held) return;
      heldNotes.current.delete(key);
      held.voice.stop();
      /* close the recorded note's duration */
      if (held.noteId) {
        const s = storeRef.current;
        const engine = audio;
        const clip = s.state.project.clips[held.clipId];
        if (clip) {
          const clipSteps = clip.lengthBars * 16;
          const now = Math.floor(engine.getCurrentStep()) % clipSteps;
          const dur = Math.max(1, Math.min(clipSteps, now - held.startStep || 1));
          s.applySilent([{ op: "set_clip_content", clipId: held.clipId, notes: clip.notes.map((n) => (n.id === held.noteId ? { ...n, dur } : n)) }]);
        }
      }
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const togglePlay = () => {
    const engine = audio;
    if (engine.playing) engine.pause(); else void engine.play().catch((error) => toastRef.current(error.message));
  };

  const toggleRecord = () => {
    const engine = audio;
    if (!recording) {
      storeRef.current.snapshot("Take: recorded notes");
      takeClearedRef.current = false; // fresh take — replace mode may clear again
      setRecording(true);
      if (!engine.playing) void engine.play().catch((error) => { setRecording(false); onToast(error.message); });
      onToast(
        recModeRef.current === "replace"
          ? "Recording (replace) — the open clip is cleared on your first note"
          : "Recording (overdub) — play the A–K keys; notes layer onto the open clip",
      );
    } else {
      setRecording(false);
      onToast("Recording stopped");
    }
  };

  const selectedTrack = state.project.tracks.find((t) => t.id === state.selectedTrackId);
  const isDrum = selectedTrack?.instrument === "drumkit";

  const [settingsTab, setSettingsTab] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportStems = async () => {
    onToast("Rendering separate stems for all tracks...");
    try {
      const stems = await audio.exportStems(state.project);
      for (const stem of stems) {
        const url = URL.createObjectURL(stem.blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = stem.fileName;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      }
      onToast(`Rendered ${stems.length} track stems`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Stem export failed");
    }
  };

  const handleExportWav = async () => {
    try {
      const blob = await audio.exportWav(state.project, { sampleRate: 48000, bitDepth: 24 });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${state.project.name.replace(/[^\w\- ]+/g, "") || "cadence-mix"}.wav`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      onToast("Rendered 24-bit WAV at 48 kHz");
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Export failed");
    }
  };

  const handleSaveFile = async () => {
    try {
      const blob = await createProjectBundle(state.project);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${state.project.name.replace(/[^\w\- ]+/g, "").trim() || "session"}.cadenceproject`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      onToast("Project backup downloaded with all recorded takes.");
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Project backup failed");
    }
  };

  const handleOpenFile = async (file: File) => {
    try {
      if (file.name.toLowerCase().endsWith(".cadenceproject")) {
        if (file.size > 256 * 1024 * 1024) { onToast("Project backup is too large (max 256 MB)"); return; }
        const project = await openProjectBundle(await file.arrayBuffer());
        audio.stop();
        store.loadProject(project);
        onToast("Opened project and restored its recordings");
        return;
      }
      if (file.size > 8 * 1024 * 1024) { onToast("Project file is too large (max 8 MB)"); return; }
      const text = await file.text();
      const res = parseProjectFile(text);
      if (!res.ok) { onToast(`Can't open file: ${res.error}`); return; }
      store.loadProject(res.project);
      onToast(`Opened "${res.project.name}"`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Couldn't read file");
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden relative">
      <TopBar onToast={onToast} playing={playing} />

      {/* Pro DAW Menu Bar */}
      <MenuBar
        onOpenSettings={(tab) => setSettingsTab(tab || "audio")}
        onOpenShortcuts={() => setSettingsTab("shortcuts")}
        onToast={onToast}
        onTriggerImport={() => fileInputRef.current?.click()}
        onTriggerSaveFile={handleSaveFile}
        onTriggerOpenFile={() => fileInputRef.current?.click()}
        onTriggerExportWav={handleExportWav}
        onTriggerExportStems={handleExportStems}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.cadence,.cadenceproject,audio/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleOpenFile(f);
          e.target.value = "";
        }}
      />

      {/* transport bar — persistent, spans the top of the work area */}
      <div className="px-2 pt-2 shrink-0">
        <Transport
          playing={playing}
          recording={recording}
          onTogglePlay={togglePlay}
          onStop={() => audio.stop()}
          onToggleRecord={toggleRecord}
          loop={loop}
          onToggleLoop={() => { setLoop((l) => !l); audio.setLoop(!loop); }}
        />
      </div>

      {/* persistent regions: browser (left) · workspace (center) · copilot (right) */}
      <div className="flex-1 min-h-0 flex gap-2 px-2 py-2">
        <fieldset disabled={recordingBusy} className="contents"><BrowserPro onToast={onToast} /></fieldset>

        <main className="flex-1 min-w-0 flex flex-col gap-2">
          <WorkspaceSwitcher />
          <div className="flex-1 min-h-0 flex flex-col">
            {state.workspaceView === "arrangement" && <Timeline />}
            {state.workspaceView === "channelrack" && <ChannelRackPro />}
            {state.workspaceView === "pianoroll" && (isDrum ? <StepSequencer /> : <PianoRoll />)}
            {state.workspaceView === "mixer" && <Mixer />}
            {state.workspaceView === "synth" && <SynthLab />}
            {state.workspaceView === "groove" && <GrooveBox />}
            {state.workspaceView === "fx" && <FxRack />}
            {state.workspaceView === "vocal" && <VocalWorkspace onToast={onToast} />}
            {state.workspaceView === "projects" && <CloudProjects />}
          </div>
        </main>

        <fieldset disabled={recordingBusy} className="contents"><AIPanel /></fieldset>
      </div>

      {/* status bar with reactive hint panel */}
      <StatusBar playing={playing} recording={recording} />

      {/* Settings Modal */}
      {settingsTab && (
        <SettingsModal
          initialTab={settingsTab}
          onClose={() => setSettingsTab(null)}
          onToast={onToast}
        />
      )}

      {/* orphaned-recovery prompt (restore / discard) */}
      <RecoveryPrompt />

      {/* toasts */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="toast-anim bg-ink-800 border border-ink-600 text-ink-100 text-[12px] font-semibold px-4 py-2 rounded-lg shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}






