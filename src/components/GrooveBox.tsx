import { useCallback, useEffect, useRef, useState } from "react";
import {
  DRUM_SLOTS, DrumPattern, GroovePosition, SLOT_META, StepCount,
  duplicatePattern, getDrumBox, makePattern, setHit, setStepCount, setStepVel, starterPatterns,
} from "../audio/drumbox";
import { useStore } from "../state/store";
import { IconDrum, IconLoop, IconPlay, IconPlus, IconStop, IconTrash, IconX, IconZap } from "./icons";

const STORAGE_KEY = "cadence.drumbox.v1";

type EditMode = "steps" | "velocity";

interface Stored {
  patterns: DrumPattern[];
  chain: string[];
}

function loadInitial(): Stored {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw) as Stored;
      if (Array.isArray(data.patterns) && data.patterns.length > 0 && Array.isArray(data.chain)) return data;
    }
  } catch {
    /* fall through to starters */
  }
  const patterns = starterPatterns();
  return { patterns, chain: patterns.map((p) => p.id) };
}

export default function GrooveBox() {
  const { state, apply } = useStore();
  const engine = getDrumBox();

  const [stored, setStored] = useState<Stored>(loadInitial);
  const [currentId, setCurrentId] = useState(stored.patterns[0]?.id ?? "");
  const [editMode, setEditMode] = useState<EditMode>("steps");
  const [songMode, setSongMode] = useState(false);
  const [pos, setPos] = useState<GroovePosition | null>(null);
  const [flash, setFlash] = useState<Set<string>>(new Set());
  const dragRef = useRef(false);
  /** While dragging in steps mode: the on/off value being painted. */
  const paintRef = useRef<boolean>(true);

  const patterns = stored.patterns;
  const chain = stored.chain;
  const current = patterns.find((p) => p.id === currentId) ?? patterns[0];

  /* persist */
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {
      /* non-fatal */
    }
  }, [stored]);

  /* push data + tempo into the engine */
  useEffect(() => {
    engine.setPatterns(patterns);
    engine.setChain(chain);
  }, [engine, patterns, chain]);
  useEffect(() => {
    engine.setBpm(state.project.bpm);
  }, [engine, state.project.bpm]);

  /* poll transport position for the playhead */
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      setPos(engine.getPosition());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  /* pad-flash on trigger (visual sync) */
  useEffect(() => {
    engine.onTrigger = (patternId, lane, step) => {
      const key = `${patternId}:${lane}:${step}`;
      setFlash((prev) => new Set(prev).add(key));
      window.setTimeout(() => {
        setFlash((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }, 110);
    };
    return () => {
      engine.onTrigger = null;
    };
  }, [engine]);

  const mutateCurrent = useCallback(
    (fn: (p: DrumPattern) => DrumPattern) => {
      setStored((s) => ({ ...s, patterns: s.patterns.map((p) => (p.id === current?.id ? fn(p) : p)) }));
    },
    [current?.id],
  );

  /**
   * isDown = fresh mousedown (decides the paint value); otherwise a drag-enter
   * that keeps painting the value chosen at mousedown. Right-click always erases.
   */
  const handleCell = (lane: number, step: number, e: React.MouseEvent<HTMLDivElement>, isDown: boolean) => {
    if (!current) return;
    if (e.button === 2) {
      mutateCurrent((p) => setHit(p, lane, step, false));
      return;
    }
    if (editMode === "steps") {
      if (isDown) paintRef.current = !(current.steps[lane][step]?.on ?? false);
      mutateCurrent((p) => setHit(p, lane, step, paintRef.current));
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const frac = 1 - (e.clientY - rect.top) / rect.height; // top = loud
      mutateCurrent((p) => setStepVel(setHit(p, lane, step, true), lane, step, Math.max(0.08, frac)));
    }
  };

  const addPattern = () => {
    const p = makePattern(`Pattern ${String.fromCharCode(65 + patterns.length)}`, 16, 0);
    setStored((s) => ({ patterns: [...s.patterns, p], chain: [...s.chain, p.id] }));
    setCurrentId(p.id);
  };

  const duplicateCurrent = () => {
    if (!current) return;
    const copy = duplicatePattern(current);
    setStored((s) => ({ patterns: [...s.patterns, copy], chain: [...s.chain, copy.id] }));
    setCurrentId(copy.id);
  };

  const deleteCurrent = () => {
    if (patterns.length <= 1) return;
    const next = patterns.filter((p) => p.id !== current?.id);
    setStored((s) => ({ patterns: next, chain: s.chain.filter((id) => id !== current?.id) }));
    setCurrentId(next[0].id);
  };

  const clearCurrent = () => mutateCurrent((p) => makePattern(p.name, p.stepCount, p.swing));

  const play = (asSong: boolean) => {
    setSongMode(asSong);
    engine.stop();
    engine.play(current?.id ?? patterns[0].id, asSong);
  };
  const stop = () => {
    engine.stop();
    setSongMode(false);
  };

  const setBpm = (bpm: number) => apply("Set tempo", [{ op: "set_tempo", bpm }]);

  /* append a pattern to the song chain (click a pattern tab while holding shift) */
  const appendToChain = (id: string) => setStored((s) => ({ ...s, chain: [...s.chain, id] }));
  const removeFromChain = (idx: number) => setStored((s) => ({ ...s, chain: s.chain.filter((_, i) => i !== idx) }));

  const stepCounts: StepCount[] = [8, 16, 32];
  const isPlaying = pos?.playing ?? false;

  return (
    <section className="panel flex-1 min-h-0 flex flex-col anim-fade-up overflow-hidden" style={{ animationDelay: "160ms" }}>
      {/* header */}
      <div className="flex items-center gap-3 px-3 h-[46px] shrink-0 border-b border-ink-700/60 flex-wrap">
        <IconDrum size={16} className="text-amber-glow shrink-0" />
        <span className="panel-title">Groove Box</span>

        {/* transport */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => (isPlaying && !songMode ? stop() : play(false))}
            title="Play this pattern"
            className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all active:scale-90 ${
              isPlaying && !songMode ? "bg-amber-glow/20 border-amber-glow/60 text-amber-glow" : "bg-ink-800 border-ink-700 text-ink-300 hover:text-amber-glow hover:border-amber-glow/40"
            }`}
          >
            {isPlaying && !songMode ? <IconStop size={13} /> : <IconPlay size={13} className="translate-x-[1px]" />}
          </button>
          <button
            onClick={() => (isPlaying && songMode ? stop() : play(true))}
            title="Play the whole song chain"
            className={`h-8 px-2.5 rounded-lg flex items-center gap-1.5 border text-[11px] font-semibold transition-all active:scale-95 ${
              isPlaying && songMode ? "bg-teal/20 border-teal/60 text-teal" : "bg-ink-800 border-ink-700 text-ink-300 hover:text-teal hover:border-teal/40"
            }`}
          >
            <IconLoop size={13} /> Song
          </button>
        </div>

        {/* bpm */}
        <div className="flex items-center gap-1.5">
          <button className="btn btn-ghost px-1.5! py-0.5! text-[12px]!" onClick={() => setBpm(state.project.bpm - 1)} title="Slower">−</button>
          <span className="font-mono text-[15px] font-semibold text-amber-glow tabular-nums w-9 text-center">{state.project.bpm}</span>
          <button className="btn btn-ghost px-1.5! py-0.5! text-[12px]!" onClick={() => setBpm(state.project.bpm + 1)} title="Faster">+</button>
          <span className="text-[9px] text-ink-400 font-mono">BPM</span>
        </div>

        <div className="flex-1" />

        {/* live readout */}
        {pos && (
          <span className="font-mono text-[11px] text-ink-400 tabular-nums hidden sm:block">
            {isPlaying ? `${songMode ? "SONG" : "PAT"} · step ${pos.step + 1}/${pos.stepCount}` : "stopped"}
          </span>
        )}
      </div>

      {/* pattern tabs + edit controls */}
      <div className="flex items-center gap-2 px-3 py-2 shrink-0 border-b border-ink-700/40 flex-wrap">
        <div className="flex items-center gap-1">
          {patterns.map((p) => {
            const active = p.id === current?.id;
            return (
              <button
                key={p.id}
                onClick={() => setCurrentId(p.id)}
                onDoubleClick={() => appendToChain(p.id)}
                title={`${p.name} — click to edit · double-click to add to song chain`}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-all ${
                  active ? "bg-amber-glow/15 border-amber-glow/50 text-amber-glow" : "bg-ink-800 border-ink-700 text-ink-400 hover:text-ink-100"
                }`}
              >
                {p.name}
              </button>
            );
          })}
          <button onClick={addPattern} title="New pattern" className="w-7 h-7 rounded-md border border-dashed border-ink-600 text-ink-400 hover:text-amber-glow hover:border-amber-glow/50 flex items-center justify-center transition-colors">
            <IconPlus size={13} />
          </button>
        </div>

        <div className="w-px h-5 bg-ink-700" />

        {/* pattern name */}
        {current && (
          <input
            key={current.id + current.name}
            defaultValue={current.name}
            onBlur={(e) => e.target.value.trim() && mutateCurrent((p) => ({ ...p, name: e.target.value.trim() }))}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className="bg-ink-800 border border-ink-700 rounded-md px-2 py-1 text-[11px] font-semibold w-24 focus:outline-none focus:border-amber-glow/60"
            aria-label="Pattern name"
          />
        )}

        {/* step count */}
        <div className="flex items-center gap-1 text-[10px] text-ink-400">
          steps
          {stepCounts.map((c) => (
            <button
              key={c}
              onClick={() => current && mutateCurrent((p) => setStepCount(p, c))}
              className={`px-1.5 py-0.5 rounded font-mono border transition-colors ${current?.stepCount === c ? "border-amber-glow/60 text-amber-glow bg-amber-glow/10" : "border-ink-700 text-ink-400 hover:text-ink-100"}`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* swing */}
        {current && (
          <label className="flex items-center gap-1.5 text-[10px] text-ink-400" title="Groove: delays off-beat 16ths">
            <IconZap size={12} className="text-amber-glow" />
            swing
            <input
              type="range" min={0} max={100} value={Math.round(current.swing * 100)}
              onChange={(e) => mutateCurrent((p) => ({ ...p, swing: Number(e.target.value) / 100 }))}
              className="w-20 h-3"
            />
            <span className="font-mono w-8 text-ink-300">{Math.round(current.swing * 100)}%</span>
          </label>
        )}

        <div className="flex-1" />

        {/* edit mode */}
        <div className="flex items-center rounded-md border border-ink-700 overflow-hidden">
          {(["steps", "velocity"] as EditMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setEditMode(m)}
              className={`px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors ${editMode === m ? "bg-amber-glow/15 text-amber-glow" : "text-ink-400 hover:text-ink-100"}`}
            >
              {m}
            </button>
          ))}
        </div>

        <button onClick={duplicateCurrent} title="Duplicate pattern" className="btn btn-ghost px-2! py-1! text-[10px]!">
          <IconPlus size={11} /> dup
        </button>
        <button onClick={clearCurrent} title="Clear all steps" className="btn btn-ghost px-2! py-1! text-[10px]!">
          <IconTrash size={11} /> clear
        </button>
        <button onClick={deleteCurrent} disabled={patterns.length <= 1} title="Delete pattern" className="btn btn-ghost btn-danger px-2! py-1! text-[10px]!">
          <IconX size={11} />
        </button>
      </div>

      {/* the grid */}
      <div className="flex-1 min-h-0 overflow-auto px-3 py-2" onMouseLeave={() => (dragRef.current = false)}>
        {current && <Grid pattern={current} editMode={editMode} pos={pos} flash={flash} onCell={handleCell} engine={engine} dragRef={dragRef} />}
      </div>

      {/* song chain */}
      <div className="shrink-0 border-t border-ink-700/60 px-3 py-2 bg-ink-850/60">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400 flex items-center gap-1.5">
            <IconLoop size={12} className="text-teal" /> Song chain
          </span>
          {chain.length === 0 && <span className="text-[10px] text-ink-500 italic">double-click a pattern tab to add it</span>}
          <div className="flex items-center gap-1 flex-wrap">
            {chain.map((id, i) => {
              const p = patterns.find((x) => x.id === id);
              if (!p) return null;
              const active = isPlaying && songMode && pos?.chainIndex === i;
              return (
                <span
                  key={`${id}_${i}`}
                  className={`group inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-semibold transition-all ${
                    active ? "bg-teal/20 border-teal/60 text-teal shadow-[0_0_10px_rgba(62,207,178,0.35)]" : "bg-ink-800 border-ink-700 text-ink-300"
                  }`}
                  title={p.name}
                >
                  {i + 1}·{p.name}
                  <button onClick={() => removeFromChain(i)} className="opacity-40 group-hover:opacity-100 hover:text-rec transition-opacity" title="Remove from chain">
                    <IconX size={10} />
                  </button>
                </span>
              );
            })}
          </div>
          <div className="flex-1" />
          <span className="text-[9px] text-ink-500 hidden md:block">plays top→bottom, loops · {chain.length} section{chain.length === 1 ? "" : "s"}</span>
        </div>
      </div>
    </section>
  );
}

/* ---------------- the step grid ---------------- */

function Grid({
  pattern, editMode, pos, flash, onCell, engine, dragRef,
}: {
  pattern: DrumPattern;
  editMode: EditMode;
  pos: GroovePosition | null;
  flash: Set<string>;
  onCell: (lane: number, step: number, e: React.MouseEvent<HTMLDivElement>, isDown: boolean) => void;
  engine: ReturnType<typeof getDrumBox>;
  dragRef: React.MutableRefObject<boolean>;
}) {
  const n = pattern.stepCount;
  const activeHere = pos?.playing && pos.patternId === pattern.id;
  const playhead = activeHere ? pos!.step : -1;

  return (
    <div className="min-w-max select-none" onMouseUp={() => (dragRef.current = false)}>
      {/* step ruler */}
      <div className="flex" style={{ marginLeft: 92 }}>
        {Array.from({ length: n }, (_, s) => (
          <div
            key={s}
            className={`text-center font-mono text-[8px] pb-1 ${s % 16 === 0 ? "text-amber-glow/80" : s % 4 === 0 ? "text-ink-400" : "text-ink-600"}`}
            style={{ width: cellW(n) }}
          >
            {s % 4 === 0 ? s / 4 + 1 : ""}
          </div>
        ))}
      </div>

      {DRUM_SLOTS.map((slot, li) => {
        const meta = SLOT_META[slot];
        return (
          <div key={slot} className="flex items-stretch">
            {/* lane label / pad */}
            <button
              onMouseDown={() => engine.preview(slot)}
              className="shrink-0 sticky left-0 z-10 bg-ink-850 hover:bg-ink-800 active:bg-ink-750 border-r border-ink-700 flex items-center gap-2 px-2.5 transition-colors"
              style={{ width: 92, boxShadow: `inset 3px 0 0 ${meta.color}` }}
              title={`Preview ${meta.label}`}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: meta.color, boxShadow: `0 0 7px ${meta.color}66` }} />
              <span className="text-[11px] font-semibold text-ink-200">{meta.label}</span>
            </button>

            {/* steps */}
            <div className="flex py-[3px]">
              {Array.from({ length: n }, (_, s) => {
                const st = pattern.steps[li][s];
                const on = st?.on ?? false;
                const vel = st?.vel ?? 0.8;
                const isPlayhead = s === playhead;
                const isFlash = flash.has(`${pattern.id}:${li}:${s}`);
                const barStart = s % 16 === 0;
                const beatStart = s % 4 === 0;
                const altBar = Math.floor(s / 16) % 2 === 1;

                return (
                  <div
                    key={s}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      dragRef.current = true;
                      onCell(li, s, e, true);
                    }}
                    onMouseEnter={(e) => dragRef.current && onCell(li, s, e, false)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      onCell(li, s, e, true);
                    }}
                    title={on ? `${meta.label} · vel ${Math.round(vel * 127)}` : `Add ${meta.label}`}
                    className="relative cursor-pointer overflow-hidden transition-transform duration-75 hover:scale-y-105"
                    style={{
                      width: cellW(n) - 2,
                      height: 30,
                      margin: "0 1px",
                      borderRadius: 4,
                      borderLeft: barStart ? "2px solid var(--color-ink-600)" : beatStart ? "2px solid var(--color-ink-750)" : "2px solid transparent",
                      background: altBar ? "rgba(15,18,24,0.9)" : "rgba(26,32,44,0.8)",
                      boxShadow: isPlayhead
                        ? `0 0 0 1px ${meta.color}, 0 0 12px ${meta.color}55, inset 0 0 8px rgba(0,0,0,0.4)`
                        : "inset 0 1px 3px rgba(0,0,0,0.45)",
                    }}
                  >
                    {/* velocity fill */}
                    <div
                      className="absolute inset-x-0 bottom-0 transition-all duration-100"
                      style={{
                        height: on ? `${Math.round(vel * 100)}%` : "0%",
                        background: isFlash ? "#ffffff" : `linear-gradient(180deg, #fff4, ${meta.color})`,
                        boxShadow: on ? `0 0 10px ${meta.color}${isFlash ? "ff" : "88"}` : "none",
                      }}
                    />
                    {/* accent tick for on-steps in velocity mode */}
                    {on && editMode === "velocity" && <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: meta.color }} />}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function cellW(n: number): number {
  return n === 8 ? 44 : n === 16 ? 27 : 18;
}
