import React, { useEffect, useRef, useState } from "react";
import { useStore } from "../state/store";
import { useHint } from "../state/hintContext";
import { audio } from "../core";

interface Props {
  playing: boolean;
  recording: boolean;
}

export default function StatusBar({ playing, recording }: Props) {
  const { state, setAutosaveInterval, gate } = useStore();
  const { hint } = useHint();
  const [stepInfo, setStepInfo] = useState({ bar: 1, beat: 1, s16: 1, tick: 0 });
  const [stats, setStats] = useState({ cpu: 0, lat: 0, voices: 0, maxVoices: 32 });

  useEffect(() => {
    let raf = 0;
    const update = () => {
      const step = audio.getCurrentStep();
      const bar = Math.floor(step / 16) + 1;
      const beat = Math.floor((step % 16) / 4) + 1;
      const s16 = Math.floor(step % 4) + 1;
      const tick = Math.floor((step % 1) * 96);

      setStepInfo({ bar, beat, s16, tick });
      setStats({
        cpu: Math.round(audio.getLoad() * 100),
        lat: audio.getLatencyMs(),
        voices: audio.getActiveVoices(),
        maxVoices: audio.getMaxPolyphony(),
      });
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, []);

  const { status, intervalMs, lastSavedAt } = state.autosave;
  const showInterval = gate("producer");

  return (
    <footer className="h-7 shrink-0 border-t border-ink-800 bg-ink-950/95 flex items-center justify-between px-3 text-[10px] font-mono text-ink-400 select-none z-40">
      {/* Left: Interactive Hint Panel */}
      <div className="flex items-center gap-2 min-w-0 max-w-[45%]">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${playing ? (recording ? "bg-rec animate-pulse shadow-[0_0_6px_rgba(255,111,97,0.9)]" : "bg-teal shadow-[0_0_6px_rgba(62,207,178,0.9)]") : "bg-ink-600"}`} />
        {hint ? (
          <div className="truncate flex items-center gap-2">
            <span className="font-semibold text-amber-glow/90">{hint.title}</span>
            {hint.description && <span className="text-ink-300 hidden sm:inline">— {hint.description}</span>}
            {hint.value !== undefined && <span className="text-ink-100 bg-ink-800 px-1 py-0.5 rounded">[{hint.value}]</span>}
            {hint.shortcut && <span className="text-teal/80 bg-ink-800/80 px-1 py-0.5 rounded">[{hint.shortcut}]</span>}
          </div>
        ) : (
          <span className="text-ink-400 truncate">
            {playing ? (recording ? "REC (audio & MIDI)" : "Playback active") : "Ready · Hover controls for info"}
          </span>
        )}
      </div>

      {/* Center: Position clock */}
      <div className="hidden md:flex items-center gap-2 bg-ink-900 border border-ink-800 px-2 py-0.5 rounded text-ink-200">
        <span>TIME:</span>
        <span className="font-bold text-teal">
          {String(stepInfo.bar).padStart(3, "0")}:{stepInfo.beat}:{stepInfo.s16}:{String(stepInfo.tick).padStart(2, "0")}
        </span>
      </div>

      {/* Right: Engine metrics & autosave */}
      <div className="flex items-center gap-3 shrink-0">
        <span className="hidden lg:inline text-ink-400" title="Active polyphony voices">
          Voices: <span className="text-ink-200 font-semibold">{stats.voices}</span>/{stats.maxVoices}
        </span>

        <span className="hidden sm:inline text-ink-400" title="Audio processing thread load">
          CPU: <span className={`font-semibold ${stats.cpu > 75 ? "text-rec" : stats.cpu > 40 ? "text-amber-glow" : "text-teal"}`}>{stats.cpu}%</span>
        </span>

        <span className="hidden sm:inline text-ink-400" title="Round-trip buffer latency">
          {stats.lat}ms
        </span>

        <span className="w-px h-3.5 bg-ink-800" />

        {/* Autosave status */}
        <span className="flex items-center gap-1.5" title="Autosave recovery system">
          <span className={`w-1.5 h-1.5 rounded-full ${
            status === "saved" ? "bg-teal" : status === "saving" ? "bg-amber-glow animate-pulse" : "bg-ink-600"
          }`} />
          <span className="hidden xl:inline">
            {status === "saved" ? "Saved" : status === "saving" ? "Saving..." : "Autosave"}
          </span>
        </span>

        {showInterval && (
          <select
            value={intervalMs}
            onChange={(e) => setAutosaveInterval(Number(e.target.value))}
            className="bg-ink-900 border border-ink-800 rounded px-1 py-0 text-[9px] text-ink-300 focus:outline-none"
            title="Autosave interval"
          >
            <option value={15000}>15s</option>
            <option value={30000}>30s</option>
            <option value={60000}>1m</option>
            <option value={300000}>5m</option>
          </select>
        )}

        <span className="text-amber-glow/90 font-bold uppercase tracking-wider text-[9px] bg-amber-glow/10 border border-amber-glow/30 px-1.5 py-0.5 rounded">
          {state.mode}
        </span>
      </div>
    </footer>
  );
}
