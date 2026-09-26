import React, { useState } from "react";
import { useStore } from "../state/store";
import { useHint } from "../state/hintContext";
import { audio, buildEmptyProject, buildDemoProject } from "../core";
import { makeTrackWithClip } from "../ai/commands";
import { InstrumentKind, INSTRUMENT_META } from "../types";
import {
  IconDrum,
  IconPiano,
  IconWave,
  IconZap,
  IconPlus,
  IconFolderOpen,
  IconBook,
} from "./icons";

interface SampleItem {
  id: string;
  name: string;
  category: "drums" | "bass" | "synths" | "fx" | "loops";
  instrumentKind?: InstrumentKind;
  pitchOrLane: number;
  tags: string[];
}

const BUILT_IN_SAMPLES: SampleItem[] = [
  // Drums
  { id: "s_kick_punch", name: "Punchy 808 Kick", category: "drums", instrumentKind: "drumkit", pitchOrLane: 0, tags: ["kick", "808", "punch"] },
  { id: "s_snare_trap", name: "Crisp Trap Snare", category: "drums", instrumentKind: "drumkit", pitchOrLane: 1, tags: ["snare", "trap", "tight"] },
  { id: "s_hat_tight", name: "Tite Hi-Hat Closed", category: "drums", instrumentKind: "drumkit", pitchOrLane: 2, tags: ["hat", "closed", "cymbals"] },
  { id: "s_hat_open", name: "Sizzle Open Hat", category: "drums", instrumentKind: "drumkit", pitchOrLane: 3, tags: ["hat", "open", "air"] },
  { id: "s_clap_layer", name: "Snap Studio Clap", category: "drums", instrumentKind: "drumkit", pitchOrLane: 4, tags: ["clap", "snap", "studio"] },
  // Bass
  { id: "s_bass_sub", name: "Deep Sub 808", category: "bass", instrumentKind: "bass", pitchOrLane: 36, tags: ["bass", "sub", "808", "sine"] },
  { id: "s_bass_acid", name: "Acid 303 Resonance", category: "bass", instrumentKind: "bass", pitchOrLane: 48, tags: ["bass", "acid", "saw"] },
  // Synths & Keys
  { id: "s_keys_warm", name: "Warm Rhodes Chord", category: "synths", instrumentKind: "keys", pitchOrLane: 60, tags: ["keys", "rhodes", "chords"] },
  { id: "s_pluck_neon", name: "Neon Pluck Lead", category: "synths", instrumentKind: "pluck", pitchOrLane: 72, tags: ["pluck", "lead", "synthwave"] },
  { id: "s_pad_ethereal", name: "Ethereal Horizon Pad", category: "synths", instrumentKind: "pad", pitchOrLane: 64, tags: ["pad", "ambient", "soft"] },
];

export default function BrowserPro({ onToast }: { onToast: (m: string) => void }) {
  const { state, apply, selectTrack, loadProject } = useStore();
  const { bindHint } = useHint();
  const p = state.project;

  const [activeTab, setActiveTab] = useState<"packs" | "project" | "plugins" | "favorites">("packs");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [favorites, setFavorites] = useState<Set<string>>(new Set(["s_kick_punch", "s_pluck_neon"]));
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  // Audition sample
  const auditionSample = (sample: SampleItem) => {
    setPreviewingId(sample.id);
    const drumTrack = p.tracks.find((t) => t.instrument === "drumkit");
    const melodicTrack = p.tracks.find((t) => t.instrument === (sample.instrumentKind || "keys"));

    if (sample.category === "drums" && drumTrack) {
      audio.previewNote(drumTrack.id, sample.pitchOrLane, 0.9, 0.4);
    } else if (melodicTrack) {
      audio.previewNote(melodicTrack.id, sample.pitchOrLane, 0.85, 0.6);
    } else if (p.tracks.length > 0) {
      audio.previewNote(p.tracks[0].id, sample.pitchOrLane, 0.85, 0.5);
    }
    setTimeout(() => setPreviewingId(null), 400);
  };

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const addInstrument = (kind: InstrumentKind) => {
    const meta = INSTRUMENT_META[kind];
    const count = p.tracks.filter((t) => t.instrument === kind).length;
    const name = count === 0 ? meta.label.replace(/ (Machine|Synth|Lead|Pad)/, "") : `${meta.label.split(" ")[0]} ${count + 1}`;
    const { track, clip } = makeTrackWithClip(kind, name, meta.color);
    apply(`Add ${name} track`, [
      { op: "add_track", track },
      { op: "create_clip", trackId: track.id, clip },
    ]);
    selectTrack(track.id);
    onToast(`Added ${name} to project`);
  };

  const filteredSamples = BUILT_IN_SAMPLES.filter((s) => {
    if (activeTab === "favorites" && !favorites.has(s.id)) return false;
    if (categoryFilter !== "all" && s.category !== categoryFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.tags.some((t) => t.includes(q));
    }
    return true;
  });

  return (
    <aside className="w-[230px] shrink-0 hidden lg:flex flex-col gap-1.5 min-h-0 select-none anim-fade-up">
      {/* Top search & browser header */}
      <div className="panel p-2 flex flex-col gap-2 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-ink-100 flex items-center gap-1.5">
            <IconFolderOpen size={13} /> Browser
          </span>
          <span className="text-[9px] font-mono text-ink-400 bg-ink-800 px-1.5 py-0.5 rounded">PRO</span>
        </div>

        {/* Search input */}
        <input
          type="text"
          placeholder="Search samples, presets..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-ink-800 border border-ink-700/80 rounded px-2 py-1 text-[11px] text-ink-100 placeholder:text-ink-400 focus:outline-none focus:border-amber-glow/60"
        />

        {/* Tab pills */}
        <div className="grid grid-cols-4 gap-0.5 bg-ink-800/80 p-0.5 rounded text-[9.5px] font-semibold text-center">
          <button
            onClick={() => setActiveTab("packs")}
            className={`py-1 rounded transition ${activeTab === "packs" ? "bg-amber-glow text-ink-950" : "text-ink-300 hover:text-ink-100"}`}
          >
            Packs
          </button>
          <button
            onClick={() => setActiveTab("project")}
            className={`py-1 rounded transition ${activeTab === "project" ? "bg-amber-glow text-ink-950" : "text-ink-300 hover:text-ink-100"}`}
          >
            Project
          </button>
          <button
            onClick={() => setActiveTab("plugins")}
            className={`py-1 rounded transition ${activeTab === "plugins" ? "bg-amber-glow text-ink-950" : "text-ink-300 hover:text-ink-100"}`}
          >
            Plugins
          </button>
          <button
            onClick={() => setActiveTab("favorites")}
            className={`py-1 rounded transition ${activeTab === "favorites" ? "bg-amber-glow text-ink-950" : "text-ink-300 hover:text-ink-100"}`}
          >
            ★ Favs
          </button>
        </div>
      </div>

      {/* Main browser content area */}
      <div className="panel p-2 flex-1 min-h-0 flex flex-col gap-2 overflow-hidden">
        {activeTab === "packs" || activeTab === "favorites" ? (
          <>
            {/* Category filter pills */}
            <div className="flex gap-1 overflow-x-auto pb-1 text-[9px] shrink-0">
              {["all", "drums", "bass", "synths"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2 py-0.5 rounded-full capitalize transition ${
                    categoryFilter === cat ? "bg-ink-600 text-ink-100" : "bg-ink-800 text-ink-400 hover:text-ink-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Sample list */}
            <div className="flex-1 overflow-y-auto flex flex-col gap-1 pr-1">
              {filteredSamples.length === 0 ? (
                <div className="text-[10px] text-ink-400 text-center py-6">No matching samples</div>
              ) : (
                filteredSamples.map((sample) => (
                  <div
                    key={sample.id}
                    onClick={() => auditionSample(sample)}
                    className={`group flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition text-left text-[11px] border border-transparent ${
                      previewingId === sample.id ? "bg-amber-glow/20 border-amber-glow/40 text-amber-glow" : "hover:bg-ink-800 text-ink-200"
                    }`}
                    {...bindHint(sample.name, `Click to audition · ${sample.category.toUpperCase()}`)}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-[9px] text-ink-400">▶</span>
                      <span className="truncate">{sample.name}</span>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button
                        onClick={(e) => toggleFavorite(sample.id, e)}
                        className={`text-[11px] px-1 rounded ${favorites.has(sample.id) ? "text-amber-glow opacity-100" : "text-ink-400 hover:text-amber-glow"}`}
                      >
                        ★
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : activeTab === "plugins" ? (
          <div className="flex-1 overflow-y-auto flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-ink-400 uppercase tracking-wider mb-1">Built-in Synths</span>
            {(Object.keys(INSTRUMENT_META) as InstrumentKind[]).map((kind) => {
              const meta = INSTRUMENT_META[kind];
              return (
                <button
                  key={kind}
                  onClick={() => addInstrument(kind)}
                  className="flex items-center justify-between p-2 rounded bg-ink-800/60 hover:bg-ink-800 border border-ink-700/60 transition text-left"
                >
                  <div className="truncate">
                    <span className="block text-xs font-semibold text-ink-100">{meta.label}</span>
                    <span className="block text-[9px] text-ink-400 truncate">{meta.hint}</span>
                  </div>
                  <span className="text-amber-glow text-xs">+</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto flex flex-col gap-2">
            <span className="text-[10px] font-bold text-ink-400 uppercase tracking-wider">Project Assets</span>
            <div className="text-[11px] text-ink-300 space-y-1">
              <div className="flex justify-between"><span>Tracks:</span><span className="font-mono text-ink-100">{p.tracks.length}</span></div>
              <div className="flex justify-between"><span>Patterns:</span><span className="font-mono text-ink-100">{Object.keys(p.clips).length}</span></div>
              <div className="flex justify-between"><span>Markers:</span><span className="font-mono text-ink-100">{p.markers.length}</span></div>
              <div className="flex justify-between"><span>Tempo:</span><span className="font-mono text-ink-100">{p.bpm} BPM</span></div>
            </div>

            <div className="pt-2 border-t border-ink-800 flex flex-col gap-1">
              <button
                className="btn btn-ghost text-[10px]! justify-start!"
                onClick={() => { loadProject(buildDemoProject()); onToast("Loaded demo song"); }}
              >
                <IconWave size={12} /> Open Demo Song
              </button>
              <button
                className="btn btn-ghost text-[10px]! justify-start!"
                onClick={() => { loadProject(buildEmptyProject()); onToast("New session ready"); }}
              >
                <IconBook size={12} /> New Blank Project
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
