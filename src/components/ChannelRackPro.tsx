import React, { useState } from "react";
import { useStore } from "../state/store";
import { useHint } from "../state/hintContext";
import { audio } from "../core";
import { DRUM_LANES, Note, STEPS_PER_BAR, uid, InstrumentKind, INSTRUMENT_META } from "../types";
import { makeTrackWithClip } from "../ai/commands";
import { IconPlus, IconDice, IconEraser, IconZap } from "./icons";

const LANE_COLORS = ["#ff6f61", "#ffb45e", "#00f5ff", "#35e0c2", "#a78bfa"];

export default function ChannelRackPro() {
  const { state, apply, selectTrack, setWorkspaceView } = useStore();
  const { bindHint } = useHint();
  const p = state.project;

  const [activeGroup, setActiveGroup] = useState<string>("all");
  const [activePatternIndex, setActivePatternIndex] = useState(1);
  const [showGraphEditor, setShowGraphEditor] = useState(false);
  const [graphMode, setGraphMode] = useState<"vel" | "pan" | "pitch">("vel");
  const [swing, setSwing] = useState(0);

  // Group filter
  const filteredTracks = p.tracks.filter((t) => {
    if (activeGroup === "all") return true;
    if (activeGroup === "drums") return t.instrument === "drumkit";
    if (activeGroup === "bass") return t.instrument === "bass";
    if (activeGroup === "synths") return ["keys", "pluck", "pad"].includes(t.instrument);
    return true;
  });

  const selectedTrack = p.tracks.find((t) => t.id === state.selectedTrackId);

  const toggleStep = (trackId: string, step: number) => {
    const track = p.tracks.find((t) => t.id === trackId);
    if (!track) return;
    const clipId = track.sourceClipId;
    const clip = p.clips[clipId];
    if (!clip) return;

    const isDrum = track.instrument === "drumkit";
    const pitch = isDrum ? 0 : p.rootMidi + 12; // kick for drums, C4 for synth

    const existing = clip.notes.find((n) => n.start === step && (!isDrum || n.pitch === 0));
    if (!existing) {
      const newNote: Note = {
        id: uid("n"),
        pitch,
        start: step,
        dur: 1,
        vel: 0.85,
      };
      apply("Add step", [{ op: "set_clip_content", clipId, notes: [...clip.notes, newNote] }]);
      audio.previewNote(track.id, pitch, 0.85, 0.3);
    } else {
      apply("Remove step", [{ op: "set_clip_content", clipId, notes: clip.notes.filter((n) => n.id !== existing.id) }]);
    }
  };

  const addInstrument = (kind: InstrumentKind) => {
    const meta = INSTRUMENT_META[kind];
    const count = p.tracks.filter((t) => t.instrument === kind).length;
    const name = count === 0 ? meta.label : `${meta.label} ${count + 1}`;
    const { track, clip } = makeTrackWithClip(kind, name, meta.color);
    apply(`Add ${name}`, [
      { op: "add_track", track },
      { op: "create_clip", trackId: track.id, clip },
    ]);
    selectTrack(track.id);
  };

  const stepsCount = 16;

  return (
    <div className="panel flex-1 min-h-0 flex flex-col anim-fade-up select-none overflow-hidden">
      {/* Top Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-ink-800 bg-ink-950/80 shrink-0 flex-wrap">
        <span className="font-bold text-xs tracking-wider uppercase text-ink-100 flex items-center gap-2">
          Channel Rack
        </span>

        {/* Pattern Selector */}
        <div className="flex items-center gap-1 bg-ink-900 border border-ink-700/80 rounded px-2 py-0.5 text-xs">
          <span className="text-ink-400 font-mono text-[10px]">PAT</span>
          <select
            value={activePatternIndex}
            onChange={(e) => setActivePatternIndex(Number(e.target.value))}
            className="bg-transparent text-amber-glow font-bold focus:outline-none cursor-pointer"
          >
            {Array.from({ length: 8 }, (_, i) => (
              <option key={i + 1} value={i + 1} className="bg-ink-900 text-ink-100">
                Pattern {i + 1}
              </option>
            ))}
          </select>
        </div>

        {/* Channel Group Tabs */}
        <div className="flex items-center gap-0.5 bg-ink-900 border border-ink-800 rounded p-0.5 text-[10px] font-semibold">
          {["all", "drums", "synths", "bass"].map((grp) => (
            <button
              key={grp}
              onClick={() => setActiveGroup(grp)}
              className={`px-2 py-0.5 rounded capitalize transition ${
                activeGroup === grp ? "bg-ink-700 text-ink-100" : "text-ink-400 hover:text-ink-200"
              }`}
            >
              {grp}
            </button>
          ))}
        </div>

        {/* Global Swing */}
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-ink-400 border-l border-ink-800 pl-2">
          <span>Swing:</span>
          <input
            type="range"
            min={0}
            max={100}
            value={swing}
            onChange={(e) => setSwing(Number(e.target.value))}
            className="w-16 h-2 accent-amber-glow"
            {...bindHint("Swing", "Adds human groove and delay to off-beat 16th steps", undefined, `${swing}%`)}
          />
          <span className="text-ink-200 w-6">{swing}%</span>
        </div>

        <div className="flex-1" />

        {/* Graph Editor toggle */}
        <button
          onClick={() => setShowGraphEditor((v) => !v)}
          className={`btn py-0.5! px-2! text-[10px]! ${showGraphEditor ? "btn-primary" : "btn-ghost"}`}
          title="Open per-step Graph Editor (Velocity/Pan/Pitch)"
        >
          Graph Editor
        </button>

        {/* Add Channel */}
        <div className="relative group">
          <button className="btn py-0.5! px-2! text-[10px]! gap-1">
            <IconPlus size={11} /> Add
          </button>
          <div className="hidden group-hover:block absolute right-0 top-full mt-1 w-44 bg-ink-900 border border-ink-700 rounded-md shadow-2xl py-1 z-50">
            {(Object.keys(INSTRUMENT_META) as InstrumentKind[]).map((kind) => (
              <button
                key={kind}
                onClick={() => addInstrument(kind)}
                className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-amber-glow/20 text-ink-200 hover:text-ink-50 flex items-center justify-between"
              >
                <span>{INSTRUMENT_META[kind].label}</span>
                <span className="w-2 h-2 rounded-full" style={{ background: INSTRUMENT_META[kind].color }} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Channel Strip List & Step Grid */}
      <div className="flex-1 min-h-0 overflow-auto p-2 space-y-1.5 bg-ink-950/60">
        {filteredTracks.map((t, trackIdx) => {
          const isSelected = t.id === state.selectedTrackId;
          const clip = p.clips[t.sourceClipId];
          const isDrum = t.instrument === "drumkit";

          return (
            <div
              key={t.id}
              className={`flex items-center gap-2 p-1.5 rounded-lg border transition ${
                isSelected ? "bg-ink-850 border-ink-600 shadow-md" : "bg-ink-900/70 border-ink-800/80 hover:bg-ink-850/60"
              }`}
            >
              {/* Channel controls: mute, solo, vol, pan, mixer track */}
              <div className="flex items-center gap-1.5 w-60 shrink-0">
                {/* Mute LED */}
                <button
                  onClick={() => apply("Toggle mute", [{ op: "set_track_mute", trackId: t.id, value: !t.mute }])}
                  className={`w-3.5 h-3.5 rounded-xs transition shadow-xs ${
                    !t.mute ? "bg-teal shadow-[0_0_6px_rgba(62,207,178,0.7)]" : "bg-ink-700"
                  }`}
                  {...bindHint(t.name, "Mute / Unmute channel", undefined, t.mute ? "MUTED" : "ON")}
                />

                {/* Pan & Vol knobs */}
                <div className="flex items-center gap-1 text-[9px] font-mono text-ink-400">
                  <label title="Pan" className="flex items-center">
                    <span className="text-[8px] mr-0.5">P</span>
                    <input
                      type="range"
                      min={-1}
                      max={1}
                      step={0.05}
                      value={t.pan}
                      onChange={(e) => apply("Set pan", [{ op: "set_track_pan", trackId: t.id, value: Number(e.target.value) }])}
                      className="w-10 h-1.5 accent-teal"
                      {...bindHint(`${t.name} Pan`, "Stereo panorama", undefined, `${Math.round(t.pan * 100)}%`)}
                    />
                  </label>

                  <label title="Volume" className="flex items-center">
                    <span className="text-[8px] mr-0.5">V</span>
                    <input
                      type="range"
                      min={0}
                      max={1.25}
                      step={0.05}
                      value={t.volume}
                      onChange={(e) => apply("Set volume", [{ op: "set_track_volume", trackId: t.id, value: Number(e.target.value) }])}
                      className="w-12 h-1.5 accent-amber-glow"
                      {...bindHint(`${t.name} Vol`, "Channel gain", undefined, `${Math.round(t.volume * 100)}%`)}
                    />
                  </label>
                </div>

                {/* Target Mixer Track */}
                <div
                  className="bg-ink-950 border border-ink-700 rounded px-1 text-[9px] font-mono text-ink-300 cursor-pointer"
                  title="Target Mixer Track (click to jump to Mixer)"
                  onClick={() => setWorkspaceView("mixer")}
                >
                  Trk {trackIdx + 1}
                </div>

                {/* Channel Name Button */}
                <button
                  onClick={() => {
                    selectTrack(t.id);
                    if (!isDrum) setWorkspaceView("pianoroll");
                  }}
                  className="flex-1 truncate text-left px-2 py-1 rounded bg-ink-800 hover:bg-ink-750 flex items-center justify-between text-xs font-semibold text-ink-100 border border-ink-700/60"
                  {...bindHint(t.name, "Click to open in Piano Roll / Channel settings")}
                >
                  <span className="truncate">{t.name}</span>
                  <span className="w-2 h-2 rounded-xs shrink-0" style={{ background: t.color }} />
                </button>
              </div>

              {/* 16-Step Button Grid (FL Studio 4-beat color blocks) */}
              <div className="flex items-center gap-1 flex-1 overflow-x-auto">
                {Array.from({ length: stepsCount }, (_, s) => {
                  const beatGroup = Math.floor(s / 4);
                  const isBeatAlt = beatGroup % 2 === 1;
                  const hasNote = clip?.notes.some((n) => n.start === s);

                  return (
                    <button
                      key={s}
                      onClick={() => toggleStep(t.id, s)}
                      className={`h-7 flex-1 min-w-[20px] max-w-[34px] rounded-xs border transition-all duration-75 relative ${
                        hasNote
                          ? "bg-amber-glow border-amber-glow shadow-[0_0_8px_rgba(255,180,84,0.4)] scale-95"
                          : isBeatAlt
                          ? "bg-ink-800 border-ink-700 hover:bg-ink-700/70"
                          : "bg-ink-850 border-ink-750 hover:bg-ink-750"
                      }`}
                      {...bindHint(`${t.name} [Step ${s + 1}]`, hasNote ? "Hit active — click to remove" : "Click to place hit")}
                    >
                      {hasNote && (
                        <span className="absolute inset-0 bg-white/20 rounded-xs" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Graph Editor for selected track */}
      {showGraphEditor && selectedTrack && (
        <div className="h-28 border-t border-ink-800 bg-ink-950 p-2 flex flex-col shrink-0 anim-fade-up">
          <div className="flex items-center justify-between pb-1 text-[10px] font-mono text-ink-400 border-b border-ink-800/80">
            <span>GRAPH EDITOR — {selectedTrack.name}</span>
            <div className="flex gap-1">
              <button
                onClick={() => setGraphMode("vel")}
                className={`px-1.5 py-0.5 rounded ${graphMode === "vel" ? "bg-amber-glow text-ink-950 font-bold" : "hover:text-ink-200"}`}
              >
                Velocity
              </button>
              <button
                onClick={() => setGraphMode("pan")}
                className={`px-1.5 py-0.5 rounded ${graphMode === "pan" ? "bg-amber-glow text-ink-950 font-bold" : "hover:text-ink-200"}`}
              >
                Pan
              </button>
              <button
                onClick={() => setGraphMode("pitch")}
                className={`px-1.5 py-0.5 rounded ${graphMode === "pitch" ? "bg-amber-glow text-ink-950 font-bold" : "hover:text-ink-200"}`}
              >
                Pitch
              </button>
            </div>
          </div>

          <div className="flex-1 flex items-end gap-1 pt-2">
            {Array.from({ length: stepsCount }, (_, s) => {
              const clip = p.clips[selectedTrack.sourceClipId];
              const note = clip?.notes.find((n) => n.start === s);
              const heightPct = note ? Math.round(note.vel * 100) : 0;

              return (
                <div key={s} className="flex-1 h-full flex flex-col justify-end items-center group">
                  <div
                    className="w-full bg-amber-glow/70 group-hover:bg-amber-glow rounded-xs transition-all"
                    style={{ height: `${heightPct}%` }}
                    title={`Step ${s + 1}: ${heightPct}%`}
                  />
                  <span className="text-[8px] font-mono text-ink-500 pt-0.5">{s + 1}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
