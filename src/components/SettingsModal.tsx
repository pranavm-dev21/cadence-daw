import React, { useState } from "react";
import { useStore } from "../state/store";
import { NOTE_NAMES, ScaleType } from "../types";

interface Props {
  initialTab?: string;
  onClose: () => void;
  onToast: (msg: string) => void;
}

export default function SettingsModal({ initialTab = "audio", onClose, onToast }: Props) {
  const { state, apply } = useStore();
  const [tab, setTab] = useState(initialTab);

  // Audio settings state
  const [driver, setDriver] = useState("tauri_asio");
  const [sampleRate, setSampleRate] = useState("48000");
  const [bufferSize, setBufferSize] = useState("256");
  const [multithread, setMultithread] = useState(true);

  // MIDI settings state
  const [midiInEnabled, setMidiInEnabled] = useState(true);
  const [clockSync, setClockSync] = useState(false);
  const [midiPreset, setMidiPreset] = useState("generic");

  // Project state
  const [projName, setProjName] = useState(state.project.name);
  const [bpm, setBpm] = useState(state.project.bpm);
  const [rootMidi, setRootMidi] = useState(state.project.rootMidi);
  const [scale, setScale] = useState<ScaleType>(state.project.scale);

  // Theme state
  const [theme, setTheme] = useState("default");
  const [uiScale, setUiScale] = useState("100%");

  const saveProjectSettings = () => {
    apply("Update project settings", [
      { op: "set_project_name", name: projName },
      { op: "set_tempo", bpm },
      { op: "set_key", rootMidi, scale },
    ]);
    onToast("Project settings updated");
    onClose();
  };

  const tabs = [
    { id: "audio", label: "Audio / ASIO" },
    { id: "midi", label: "MIDI Controllers" },
    { id: "project", label: "Project Info" },
    { id: "theme", label: "Theme & UI" },
    { id: "shortcuts", label: "Shortcuts" },
    { id: "about", label: "About" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-ink-900 border border-ink-700 w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-ink-800 bg-ink-950/80">
          <h2 className="text-sm font-semibold tracking-wider text-ink-100 uppercase">Cadence Settings & Preferences</h2>
          <button
            onClick={onClose}
            className="text-ink-400 hover:text-ink-100 text-lg px-2 rounded hover:bg-ink-800"
          >
            ✕
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-ink-800 bg-ink-950/50 px-5 gap-1 pt-2 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-t-md transition ${
                tab === t.id
                  ? "bg-ink-900 text-amber-glow border-t-2 border-amber-glow"
                  : "text-ink-400 hover:text-ink-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 text-xs text-ink-200 space-y-4">
          {tab === "audio" && (
            <div className="space-y-4">
              <div>
                <label className="block text-ink-400 font-semibold mb-1">Audio Device / Driver</label>
                <select
                  value={driver}
                  onChange={(e) => setDriver(e.target.value)}
                  className="w-full bg-ink-800 border border-ink-700 rounded px-3 py-1.5 text-ink-100"
                >
                  <option value="tauri_asio">Tauri Native ASIO (Low Latency Windows)</option>
                  <option value="wasapi">Windows WASAPI (Exclusive Mode)</option>
                  <option value="webaudio">Standard Web Audio Context</option>
                </select>
                <p className="text-[10px] text-ink-400 mt-1">Native ASIO provides sub-5ms latency when running as a compiled desktop application.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-ink-400 font-semibold mb-1">Sample Rate</label>
                  <select
                    value={sampleRate}
                    onChange={(e) => setSampleRate(e.target.value)}
                    className="w-full bg-ink-800 border border-ink-700 rounded px-3 py-1.5 text-ink-100"
                  >
                    <option value="44100">44.1 kHz (CD Quality)</option>
                    <option value="48000">48.0 kHz (Studio Standard)</option>
                    <option value="96000">96.0 kHz (Hi-Res Audio)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-ink-400 font-semibold mb-1">Buffer Size</label>
                  <select
                    value={bufferSize}
                    onChange={(e) => setBufferSize(e.target.value)}
                    className="w-full bg-ink-800 border border-ink-700 rounded px-3 py-1.5 text-ink-100"
                  >
                    <option value="64">64 samples (~1.4 ms)</option>
                    <option value="128">128 samples (~2.7 ms)</option>
                    <option value="256">256 samples (~5.3 ms - Recommended)</option>
                    <option value="512">512 samples (~10.7 ms)</option>
                    <option value="1024">1024 samples (~21.3 ms)</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-ink-800 pt-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={multithread}
                    onChange={(e) => setMultithread(e.target.checked)}
                    className="rounded text-amber-glow"
                  />
                  <span>Enable Multi-threaded Audio Graph Execution (VoicePool worker)</span>
                </label>
              </div>
            </div>
          )}

          {tab === "midi" && (
            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={midiInEnabled}
                    onChange={(e) => setMidiInEnabled(e.target.checked)}
                    className="rounded text-amber-glow"
                  />
                  <span className="font-semibold text-ink-100">Enable Hardware MIDI In (WebMIDI / midir)</span>
                </label>
                <p className="text-[10px] text-ink-400">Captures real-time pitch, velocity, and mod wheel from USB keyboards.</p>
              </div>

              <div>
                <label className="block text-ink-400 font-semibold mb-1">Controller Script / Mapping Profile</label>
                <select
                  value={midiPreset}
                  onChange={(e) => setMidiPreset(e.target.value)}
                  className="w-full bg-ink-800 border border-ink-700 rounded px-3 py-1.5 text-ink-100"
                >
                  <option value="generic">Generic USB MIDI Keyboard</option>
                  <option value="akai_mpk">Akai MPK Mini (Pads 1-8 + Knobs)</option>
                  <option value="novation">Novation Launchkey (Transport + Sliders)</option>
                  <option value="arturia">Arturia KeyLab Essential</option>
                </select>
              </div>

              <div className="border-t border-ink-800 pt-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clockSync}
                    onChange={(e) => setClockSync(e.target.checked)}
                    className="rounded text-amber-glow"
                  />
                  <span>Transmit MIDI Clock Sync to External Synthesizers</span>
                </label>
              </div>
            </div>
          )}

          {tab === "project" && (
            <div className="space-y-4">
              <div>
                <label className="block text-ink-400 font-semibold mb-1">Project Name</label>
                <input
                  type="text"
                  value={projName}
                  onChange={(e) => setProjName(e.target.value)}
                  className="w-full bg-ink-800 border border-ink-700 rounded px-3 py-1.5 text-ink-100"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-ink-400 font-semibold mb-1">BPM / Tempo</label>
                  <input
                    type="number"
                    min={40}
                    max={250}
                    value={bpm}
                    onChange={(e) => setBpm(Number(e.target.value))}
                    className="w-full bg-ink-800 border border-ink-700 rounded px-3 py-1.5 text-ink-100"
                  />
                </div>

                <div>
                  <label className="block text-ink-400 font-semibold mb-1">Key Root</label>
                  <select
                    value={rootMidi}
                    onChange={(e) => setRootMidi(Number(e.target.value))}
                    className="w-full bg-ink-800 border border-ink-700 rounded px-3 py-1.5 text-ink-100"
                  >
                    {NOTE_NAMES.map((name, i) => (
                      <option key={name} value={60 + i}>{name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-ink-400 font-semibold mb-1">Scale Type</label>
                  <select
                    value={scale}
                    onChange={(e) => setScale(e.target.value as ScaleType)}
                    className="w-full bg-ink-800 border border-ink-700 rounded px-3 py-1.5 text-ink-100"
                  >
                    <option value="minor">Natural Minor</option>
                    <option value="major">Major</option>
                  </select>
                </div>
              </div>

              <button
                onClick={saveProjectSettings}
                className="btn btn-primary w-full justify-center"
              >
                Apply Project Changes
              </button>
            </div>
          )}

          {tab === "theme" && (
            <div className="space-y-4">
              <div>
                <label className="block text-ink-400 font-semibold mb-1">Color Palette Theme</label>
                <select
                  value={theme}
                  onChange={(e) => {
                    setTheme(e.target.value);
                    onToast(`Applied ${e.target.value} theme`);
                  }}
                  className="w-full bg-ink-800 border border-ink-700 rounded px-3 py-1.5 text-ink-100"
                >
                  <option value="default">Studio Amber (Classic)</option>
                  <option value="fl_dark">FL Dark Slate</option>
                  <option value="cyberpunk">Cyberpunk Neon Cyan</option>
                  <option value="midnight">Midnight Violet</option>
                </select>
              </div>

              <div>
                <label className="block text-ink-400 font-semibold mb-1">Interface Scaling</label>
                <select
                  value={uiScale}
                  onChange={(e) => setUiScale(e.target.value)}
                  className="w-full bg-ink-800 border border-ink-700 rounded px-3 py-1.5 text-ink-100"
                >
                  <option value="90%">90% (High Density)</option>
                  <option value="100%">100% (Default)</option>
                  <option value="115%">115% (Comfortable)</option>
                  <option value="125%">125% (4K Monitor)</option>
                </select>
              </div>
            </div>
          )}

          {tab === "shortcuts" && (
            <div className="space-y-3 font-mono text-[11px]">
              <div className="grid grid-cols-2 gap-2 border-b border-ink-800 pb-2">
                <span className="text-ink-400">Space</span>
                <span className="text-ink-100">Play / Pause</span>
                <span className="text-ink-400">Ctrl+Z / Ctrl+Y</span>
                <span className="text-ink-100">Undo / Redo</span>
                <span className="text-ink-400">Ctrl+S</span>
                <span className="text-ink-100">Save Project</span>
                <span className="text-ink-400">Ctrl+Q</span>
                <span className="text-ink-100">Quantize Clip</span>
                <span className="text-ink-400">A – K</span>
                <span className="text-ink-100">Musical Typing (White/Black keys)</span>
                <span className="text-ink-400">Z – B</span>
                <span className="text-ink-100">Drum Pads (Kick, Snare, Hats)</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <span className="text-ink-400">1 / F5</span>
                <span className="text-ink-100">Arrangement / Playlist</span>
                <span className="text-ink-400">2 / F7</span>
                <span className="text-ink-100">Piano Roll / Channel Rack</span>
                <span className="text-ink-400">3 / F9</span>
                <span className="text-ink-100">Mixer Console</span>
                <span className="text-ink-400">4, 5, 6, 7</span>
                <span className="text-ink-100">Synth Lab, Groove, FX, Vocal</span>
              </div>
            </div>
          )}

          {tab === "about" && (
            <div className="space-y-2 text-center py-4">
              <h3 className="text-base font-bold text-amber-glow tracking-wider">CADENCE DAW PRO</h3>
              <p className="text-ink-300">Next-generation native desktop audio workstation.</p>
              <div className="text-[10px] text-ink-400 font-mono pt-3">
                <p>Engine: Web Audio & Tauri CPAL Bridge</p>
                <p>Version: 0.2.0-pro (Build 2026.09)</p>
                <p>Architecture: React 18 + TypeScript + Rust / Tauri</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-5 py-3 border-t border-ink-800 bg-ink-950/80">
          <button onClick={onClose} className="btn btn-primary px-5">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
