import { useEffect, useRef, useState } from "react";
import { NOTE_NAMES, ScaleType } from "../types";
import { useStore } from "../state/store";
import { audio } from "../core";
import { IconLoop, IconPause, IconPlay, IconRecord, IconStop } from "./icons";

interface Props {
  playing: boolean;
  recording: boolean;
  onTogglePlay: () => void;
  onStop: () => void;
  onToggleRecord: () => void;
  loop: boolean;
  onToggleLoop: () => void;
}

export default function Transport({ playing, recording, onTogglePlay, onStop, onToggleRecord, loop, onToggleLoop }: Props) {
  const { state, apply, gate, setRecordMode } = useStore();
  const p = state.project;
  const [bpmDraft, setBpmDraft] = useState(p.bpm);
  const posRef = useRef<HTMLSpanElement>(null);
  const meterRef = useRef<HTMLDivElement>(null);
  const cpuRef = useRef<HTMLSpanElement>(null);
  const latRef = useRef<HTMLSpanElement>(null);
  const specRef = useRef<HTMLCanvasElement>(null);

  /* master spectrum — read-only tap off the analyser, drawn on its own rAF */
  useEffect(() => {
    const cv = specRef.current;
    const g = cv?.getContext("2d");
    if (!cv || !g) return;
    const buf = new Uint8Array(1024);
    const BARS = 26;
    const smooth = new Float32Array(BARS);
    let raf = 0;
    const draw = () => {
      audio.getSpectrum(buf);
      g.clearRect(0, 0, cv.width, cv.height);
      const bw = cv.width / BARS;
      for (let i = 0; i < BARS; i++) {
        const lo = Math.floor(Math.pow(i / BARS, 1.8) * 500);
        const hi = Math.max(lo + 1, Math.floor(Math.pow((i + 1) / BARS, 1.8) * 500));
        let v = 0;
        for (let j = lo; j < hi; j++) v = Math.max(v, buf[j]);
        const target = v / 255;
        smooth[i] += (target - smooth[i]) * (target > smooth[i] ? 0.5 : 0.16);
        const h = Math.max(2, smooth[i] * (cv.height - 4));
        const x = i * bw + 1;
        g.fillStyle = `rgba(0,245,255,${0.22 + smooth[i] * 0.6})`;
        g.fillRect(x, cv.height - h, bw - 2, h);
        g.fillStyle = `rgba(0,245,255,${0.5 + smooth[i] * 0.5})`;
        g.fillRect(x, cv.height - h - 3, bw - 2, 2);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => setBpmDraft(p.bpm), [p.bpm]);

  useEffect(() => {
    const engine = audio;
    let raf = 0;
    let last = "";
    const tick = () => {
      const step = engine.getCurrentStep();
      const bar = Math.floor(step / 16) + 1;
      const beat = Math.floor((step % 16) / 4) + 1;
      const s16 = Math.floor(step % 4) + 1;
      const txt = `${String(bar).padStart(2, "0")}.${beat}.${s16}`;
      if (posRef.current && txt !== last) { posRef.current.textContent = txt; last = txt; }
      if (meterRef.current) {
        const lvl = engine.getMasterLevel();
        meterRef.current.style.height = `${Math.min(100, lvl * 240)}%`;
      }
      if (cpuRef.current) cpuRef.current.textContent = `${Math.round(engine.getLoad() * 100)}%`;
      if (latRef.current) latRef.current.textContent = `${engine.getLatencyMs()}ms`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const commitBpm = () => {
    const bpm = Math.max(55, Math.min(200, Math.round(bpmDraft)));
    setBpmDraft(bpm);
    if (bpm !== p.bpm) apply("Set tempo", [{ op: "set_tempo", bpm }]);
  };

  const setKey = (rootMidi: number, scale: ScaleType) =>
    apply("Change key", [{ op: "set_key", rootMidi, scale }]);

  const advanced = gate("advanced");
  const beginner = !gate("producer");

  return (
    <div className="panel px-3 py-2 flex flex-wrap items-center gap-4 shrink-0 anim-fade-up" style={{ animationDelay: "40ms" }}>
      {/* transport buttons */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={onTogglePlay}
          title="Play / pause (Space)"
          className={`w-11 h-11 rounded-full flex flex-wrap items-center justify-center transition-all duration-150 active:scale-90 ${
            playing
              ? "bg-ink-700 text-amber-glow border border-ink-600 shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)]"
              : "btn-primary"
          }`}
        >
          {playing ? <IconPause size={18} /> : <IconPlay size={18} className="translate-x-[1px]" />}
        </button>
        <button onClick={onStop} title="Stop and return to bar 1" className="btn w-9 h-9 justify-center p-0!"><IconStop size={15} /></button>
        <button
          onClick={onToggleRecord}
          title="Arm recording — then play notes with your computer keyboard (A–K row)"
          className={`w-9 h-9 rounded-lg flex flex-wrap items-center justify-center border transition-all duration-150 active:scale-90 ${
            recording
              ? "bg-rec/20 border-rec text-rec rec-active"
              : "bg-ink-800 border-ink-700 text-ink-400 hover:text-rec hover:border-rec/50"
          }`}
        >
          <IconRecord size={15} />
        </button>

        {/* MIDI recording mode — overdub layers notes, replace clears the region */}
        <div
          className="flex flex-wrap items-center rounded-lg border border-ink-700 bg-ink-800 p-0.5 select-none"
          title="MIDI recording mode"
          role="group"
          aria-label="Recording mode"
        >
          {(["overdub", "replace"] as const).map((m) => {
            const on = state.recordMode === m;
            return (
              <button
                key={m}
                onClick={() => setRecordMode(m)}
                title={m === "overdub" ? "Overdub — new notes layer onto the clip" : "Replace — the recorded region is cleared first"}
                className={`px-2 py-1 rounded-md text-[10px] font-bold tracking-wide uppercase transition-all duration-150 ${
                  on
                    ? m === "replace"
                      ? "bg-rec/25 text-rec shadow-[0_0_10px_rgba(255,111,97,0.25)]"
                      : "bg-teal/20 text-teal shadow-[0_0_10px_rgba(62,207,178,0.25)]"
                    : "text-ink-400 hover:text-ink-200"
                }`}
              >
                {m}
              </button>
            );
          })}
        </div>

        <button
          onClick={onToggleLoop}
          title={loop ? "Looping on — click to play once" : "Looping off"}
          className={`w-9 h-9 rounded-lg flex flex-wrap items-center justify-center border transition-all duration-150 active:scale-90 ${
            loop ? "bg-teal/15 border-teal/50 text-teal" : "bg-ink-800 border-ink-700 text-ink-400 hover:text-ink-100"
          }`}
        >
          <IconLoop size={15} />
        </button>
      </div>

      {/* position + master meter */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="text-right leading-none">
          <div className="panel-title mb-1">Bar.Beat</div>
          <span ref={posRef} className="font-mono text-[22px] font-semibold text-ink-100 tabular-nums tracking-tight">01.1.1</span>
        </div>
        <div className="w-2.5 h-10 bg-ink-950 rounded-sm border border-ink-700 overflow-hidden flex items-end" title="Master level">
          <div ref={meterRef} className="w-full rounded-sm transition-[height] duration-75" style={{ height: "0%", background: "linear-gradient(180deg, #ff6f61, #ffb454 40%, #3ecfb2)" }} />
        </div>
      </div>

      <div className="w-px h-9 bg-ink-700" />

      {/* tempo */}
      <div className="leading-none">
        <div className="panel-title mb-1">Tempo</div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[26px] font-semibold text-amber-glow tabular-nums w-14 text-right">{bpmDraft}</span>
          <div className="flex flex-col gap-1">
            <input type="range" min={55} max={200} value={bpmDraft} onChange={(e) => setBpmDraft(Number(e.target.value))} onPointerUp={commitBpm} onKeyUp={(e) => (e.key === "ArrowLeft" || e.key === "ArrowRight") && commitBpm()} className="w-28" aria-label="Tempo" />
            <span className="text-[9px] text-ink-400 font-mono">BPM</span>
          </div>
        </div>
      </div>

      {/* key */}
      <div className="leading-none">
        <div className="panel-title mb-1">Key</div>
        {beginner ? (
          <div className="font-mono text-[14px] text-ink-200 pt-1.5">{NOTE_NAMES[p.rootMidi % 12]} {p.scale}</div>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <select
              value={p.rootMidi % 12}
              onChange={(e) => setKey(p.rootMidi - (p.rootMidi % 12) + Number(e.target.value), p.scale)}
              className="bg-ink-800 border border-ink-700 rounded-md text-[12px] font-mono px-1.5 py-1 text-ink-100 focus:outline-none focus:border-amber-glow/60"
              aria-label="Key root"
            >
              {NOTE_NAMES.map((n, i) => <option key={n} value={i}>{n}</option>)}
            </select>
            <select
              value={p.scale}
              onChange={(e) => setKey(p.rootMidi, e.target.value as ScaleType)}
              className="bg-ink-800 border border-ink-700 rounded-md text-[12px] px-1.5 py-1 text-ink-100 focus:outline-none focus:border-amber-glow/60"
              aria-label="Scale"
            >
              <option value="minor">minor</option>
              <option value="major">major</option>
            </select>
          </div>
        )}
      </div>

      <div className="flex-1" />

      {/* master spectrum */}
      <div className="hidden lg:block leading-none" title="Master output spectrum">
        <div className="panel-title mb-1">Spectrum</div>
        <canvas ref={specRef} width={300} height={68} className="w-[150px] h-[34px] rounded-sm bg-ink-950/70 border border-ink-750" />
      </div>

      {/* diagnostics */}
      <div className="hidden md:flex flex-wrap items-center gap-4 text-[10px] font-mono text-ink-400">
        {advanced && (
          <>
            <span title="Scheduler load — stays tiny on purpose">CPU <span ref={cpuRef} className="text-teal">0%</span></span>
            <span title="Output latency">LAT <span ref={latRef} className="text-teal">–</span></span>
          </>
        )}
        <span className={`flex flex-wrap items-center gap-1.5 ${playing ? "text-teal" : "text-ink-400"}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${playing ? "bg-teal shadow-[0_0_8px_rgba(62,207,178,0.9)]" : "bg-ink-600"}`} />
          {playing ? "ENGINE LIVE" : "ENGINE READY"}
        </span>
      </div>
    </div>
  );
}

