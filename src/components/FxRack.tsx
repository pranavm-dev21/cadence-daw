import { useEffect, useRef, useState } from "react";
import {
  FxChain, FxNode, FxKind, FX_KINDS, createFx, estimateGraphCost, NODE_COST,
  ParametricEq, Compressor, Limiter, Reverb, Delay, Distortion, Utility,
} from "../audio/fx";
import { playDrum, playNote } from "../audio/synth";
import { IconZap, IconTrash, IconChevronDown, IconPlay, IconStop } from "./icons";

/* Module-level singletons: context + chain survive view switches. */
let rackCtx: AudioContext | null = null;
let rackChain: FxChain | null = null;
let rackIn: GainNode | null = null;

function ensureRack(): { ctx: AudioContext; chain: FxChain; input: GainNode } {
  if (!rackCtx) {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    rackCtx = new Ctx();
    const master = rackCtx.createGain();
    master.gain.value = 0.8;
    const comp = rackCtx.createDynamicsCompressor();
    master.connect(comp);
    comp.connect(rackCtx.destination);
    rackChain = new FxChain(rackCtx);
    rackIn = rackCtx.createGain();
    rackIn.connect(rackChain.input);
    rackChain.output.connect(master);
  }
  if (rackCtx.state === "suspended") void rackCtx.resume();
  return { ctx: rackCtx, chain: rackChain!, input: rackIn! };
}

/* 16-step house groove for the source (kick/clap/hat/bass). */
const STEP = 0.125; // 120 BPM 16ths
const KICK = [0, 4, 8, 12];
const CLAP = [4, 12];
const HAT = [0, 2, 4, 6, 8, 10, 12, 14];
const BASS = [0, 3, 6, 8, 11, 14];

interface Slot { key: number; node: FxNode; }
let slotKey = 0;

export default function FxRack() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [version, setVersion] = useState(0);
  const [groove, setGroove] = useState(false);
  const bump = () => setVersion((v) => v + 1);
  const slotsRef = useRef(slots);
  slotsRef.current = slots;

  /* groove scheduler (audio-clock lookahead) */
  useEffect(() => {
    if (!groove) return;
    const { ctx, input } = ensureRack();
    let step = 0;
    let next = ctx.currentTime + 0.06;
    const tick = () => {
      while (next < ctx.currentTime + 0.25) {
        const s = step % 16;
        if (KICK.includes(s)) playDrum(ctx, input, 0, next, 0.9);
        if (CLAP.includes(s)) playDrum(ctx, input, 4, next, 0.7);
        if (HAT.includes(s)) playDrum(ctx, input, 2, next, s % 4 === 2 ? 0.5 : 0.3);
        if (BASS.includes(s)) playNote(ctx, input, "bass", 33, next, STEP * 1.8, 0.5);
        next += STEP;
        step++;
      }
    };
    tick();
    const id = window.setInterval(tick, 60);
    return () => window.clearInterval(id);
  }, [groove]);

  const addFx = (kind: FxKind) => {
    const { chain } = ensureRack();
    const node = createFx(rackCtx!, kind);
    chain.push(node);
    setSlots((s) => [...s, { key: slotKey++, node }]);
    bump();
  };
  const removeFx = (key: number) => {
    const { chain } = ensureRack();
    const slot = slotsRef.current.find((s) => s.key === key);
    if (slot) chain.remove(slot.node);
    setSlots((s) => s.filter((x) => x.key !== key));
    bump();
  };
  const moveFx = (key: number, dir: -1 | 1) => {
    const { chain } = ensureRack();
    const i = slotsRef.current.findIndex((s) => s.key === key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= slotsRef.current.length) return;
    chain.move(i, j);
    setSlots((s) => {
      const next = [...s];
      const [n] = next.splice(i, 1);
      next.splice(j, 0, n);
      return next;
    });
    bump();
  };
  const toggleBypass = (key: number) => {
    const slot = slotsRef.current.find((s) => s.key === key);
    if (slot) {
      slot.node.setBypass(!slot.node.bypassed);
      bump();
    }
  };

  /* keyboard-playable notes through the chain */
  useEffect(() => {
    const isForm = (el: EventTarget | null) =>
      el instanceof HTMLElement && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
    const OFFSETS: Record<string, number> = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12 };
    const down = (e: KeyboardEvent) => {
      if (isForm(e.target) || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const off = OFFSETS[e.key.toLowerCase()];
      if (off === undefined) return;
      const { ctx, input } = ensureRack();
      playNote(ctx, input, "pluck", 57 + off, ctx.currentTime, 0.4, 0.6);
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, []);

  const chainCost = slots.reduce((a, s) => a + s.node.getCpuCost(), 0);
  const maxStatic = Math.max(1, ...slots.map((s) => s.node.getStaticCost()));

  return (
    <section className="panel flex-1 min-h-0 flex flex-col anim-fade-up overflow-hidden" style={{ animationDelay: "180ms" }}>
      {/* header */}
      <div className="flex items-center gap-2 px-3 h-[42px] shrink-0 border-b border-ink-700/60">
        <IconZap size={15} className="text-amber-glow" />
        <span className="panel-title">FX Rack</span>
        <span className="text-[10px] font-mono text-ink-400">chainable effect slots · true bypass · live CPU cost</span>
        <div className="flex-1" />
        <button
          className="btn !py-1 !px-2.5 !text-[11px]"
          onClick={() => setGroove((g) => !g)}
          title="Play a groove through the rack"
        >
          {groove ? <IconStop size={12} /> : <IconPlay size={12} />} {groove ? "Stop groove" : "Play groove"}
        </button>
      </div>

      <div className="flex-1 min-h-0 flex">
        {/* palette */}
        <div className="w-[190px] shrink-0 border-r border-ink-700/60 p-2.5 overflow-y-auto">
          <div className="text-[9px] font-mono uppercase tracking-wider text-ink-400 mb-2">Add effect</div>
          <div className="flex flex-col gap-1.5">
            {FX_KINDS.map((k) => (
              <button
                key={k.kind}
                onClick={() => addFx(k.kind)}
                className="text-left px-2.5 py-2 rounded-md border border-ink-700 bg-ink-800/60 hover:border-amber-glow/50 hover:bg-ink-750 transition-colors group"
              >
                <div className="text-[12px] font-semibold text-ink-100 group-hover:text-amber-glow transition-colors">{k.label}</div>
                <div className="text-[9px] font-mono text-ink-400 mt-0.5">{k.blurb}</div>
              </button>
            ))}
          </div>
          <div className="mt-4 text-[9px] leading-relaxed text-ink-400">
            Signal flows top → bottom. Play the groove or press <kbd className="px-1 rounded bg-ink-800 border border-ink-700 text-ink-200">A</kbd>–<kbd className="px-1 rounded bg-ink-800 border border-ink-700 text-ink-200">K</kbd> to hear the chain.
          </div>
        </div>

        {/* chain */}
        <div className="flex-1 min-w-0 overflow-y-auto p-3">
          {slots.length === 0 && (
            <div className="h-full flex items-center justify-center text-[12px] text-ink-400">
              Empty rack — add an effect from the left. The chain is a clean passthrough until you do.
            </div>
          )}
          <div className="flex flex-col gap-2 max-w-[640px]">
            {slots.map((s, i) => (
              <FxSlot
                key={s.key}
                slot={s}
                index={i}
                count={slots.length}
                maxStatic={maxStatic}
                onBypass={() => toggleBypass(s.key)}
                onRemove={() => removeFx(s.key)}
                onMove={(d) => moveFx(s.key, d)}
                onChange={bump}
              />
            ))}
          </div>
        </div>

        {/* cost meter */}
        <div className="w-[170px] shrink-0 border-l border-ink-700/60 p-3 flex flex-col">
          <div className="text-[9px] font-mono uppercase tracking-wider text-ink-400 mb-2">DSP load</div>
          <div className="text-[26px] font-bold text-ink-100 leading-none tabular-nums">{Math.round(chainCost)}</div>
          <div className="text-[9px] font-mono text-ink-400 mt-1">total cost units</div>
          <div className="mt-2 h-1.5 rounded-full bg-ink-950 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(100, (chainCost / (estimateGraphCost(["ConvolverNode"]) * 4)) * 100)}%`,
                background: "linear-gradient(90deg, #3ecfb2, #ffb454, #ff6f61)",
              }}
            />
          </div>
          <div className="mt-5 flex flex-col gap-1.5">
            {slots.map((s) => (
              <div key={s.key} className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${s.node.bypassed ? "bg-ink-600" : "bg-teal"}`} />
                <span className="text-[9px] font-mono text-ink-300 flex-1 truncate">{s.node.label}</span>
                <span className="text-[9px] font-mono text-ink-400 tabular-nums">{s.node.getCpuCost()}</span>
              </div>
            ))}
            {slots.length === 0 && <div className="text-[9px] font-mono text-ink-500">no effects</div>}
          </div>
          <div className="mt-auto pt-3 text-[8px] leading-relaxed text-ink-500">
            Cost is an analytic estimate from the node graph (convolver ≈ {NODE_COST.ConvolverNode}, biquad ≈ {NODE_COST.BiquadFilterNode}, gain ≈ {NODE_COST.GainNode}). Bypassed effects read 0 — true bypass disconnects them.
          </div>
        </div>
      </div>
    </section>
  );
}

function FxSlot({
  slot, index, count, maxStatic, onBypass, onRemove, onMove, onChange,
}: {
  slot: Slot;
  index: number;
  count: number;
  maxStatic: number;
  onBypass: () => void;
  onRemove: () => void;
  onMove: (d: -1 | 1) => void;
  onChange: () => void;
}) {
  const n = slot.node;
  const active = !n.bypassed;
  const load = (n.getCpuCost() / maxStatic) * 100;

  return (
    <div className={`rounded-lg border transition-all ${active ? "border-ink-600 bg-ink-800/80" : "border-ink-750 bg-ink-900/50 opacity-75"}`}>
      <div className="flex items-center gap-2 px-3 pt-2">
        <span className="text-[10px] font-mono text-ink-500 w-4">{index + 1}</span>
        <span className={`text-[13px] font-bold ${active ? "text-ink-100" : "text-ink-400 line-through"}`}>{n.label}</span>
        {/* per-effect CPU load */}
        <div className="w-16 h-1 rounded-full bg-ink-950 overflow-hidden" title={`cost ${n.getCpuCost()} / static ${n.getStaticCost()}`}>
          <div className="h-full rounded-full bg-teal transition-all duration-300" style={{ width: `${load}%`, opacity: active ? 1 : 0.2 }} />
        </div>
        <span className="text-[9px] font-mono text-ink-400 tabular-nums">{n.getCpuCost()}</span>
        <div className="flex-1" />
        <button onClick={() => onMove(-1)} disabled={index === 0} className="w-5 h-5 flex items-center justify-center rounded text-ink-400 hover:text-ink-100 hover:bg-ink-700 disabled:opacity-30 disabled:pointer-events-none transition-colors" title="Move up"><IconChevronDown size={12} className="rotate-180" /></button>
        <button onClick={() => onMove(1)} disabled={index === count - 1} className="w-5 h-5 flex items-center justify-center rounded text-ink-400 hover:text-ink-100 hover:bg-ink-700 disabled:opacity-30 disabled:pointer-events-none transition-colors" title="Move down"><IconChevronDown size={12} /></button>
        <button onClick={onBypass} className={`text-[9px] font-bold px-2 py-0.5 rounded border transition-colors ${active ? "border-teal/60 text-teal bg-teal/10" : "border-ink-600 text-ink-400"}`} title="Toggle bypass">
          {active ? "ON" : "BYPASS"}
        </button>
        <button onClick={onRemove} className="w-5 h-5 flex items-center justify-center rounded text-ink-400 hover:text-rec hover:bg-rec/10 transition-colors" title="Remove"><IconTrash size={12} /></button>
      </div>
      <div className={`px-3 py-2 ${active ? "" : "pointer-events-none"}`}>
        <FxParams node={n} onChange={onChange} />
      </div>
    </div>
  );
}

/* compact per-kind parameter editors */
function Slider({ label, value, min, max, step, fmt, onInput }: {
  label: string; value: number; min: number; max: number; step: number;
  fmt?: (v: number) => string; onInput: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-[9px] font-mono text-ink-400">
      <span className="w-9 shrink-0">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onInput(Number(e.target.value))} className="flex-1 h-3" />
      <span className="w-12 text-right text-ink-300 tabular-nums">{fmt ? fmt(value) : value}</span>
    </label>
  );
}

function FxParams({ node, onChange }: { node: FxNode; onChange: () => void }) {
  switch (node.kind) {
    case "eq": {
      const eq = node as ParametricEq;
      const p = eq.getParams();
      return (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {p.bands.map((b, i) => (
            <div key={i} className="flex items-center gap-1 text-[9px] font-mono text-ink-400">
              <select
                value={b.type}
                onChange={(e) => { const bands = [...p.bands]; bands[i] = { ...b, type: e.target.value as typeof b.type }; eq.setParams({ bands }); onChange(); }}
                className="bg-ink-900 border border-ink-700 rounded px-1 py-0.5 text-[9px] text-ink-200"
              >
                <option value="bell">bell</option><option value="lowshelf">lo-shelf</option>
                <option value="highshelf">hi-shelf</option><option value="highpass">HP</option><option value="lowpass">LP</option>
              </select>
              <input type="range" min={20} max={20000} step={1} value={b.freq}
                onChange={(e) => { const bands = [...p.bands]; bands[i] = { ...b, freq: Number(e.target.value) }; eq.setParams({ bands }); onChange(); }}
                className="flex-1 h-3" title={`Band ${i + 1} frequency`} />
              <span className="w-10 text-right tabular-nums">{b.freq >= 1000 ? (b.freq / 1000).toFixed(1) + "k" : Math.round(b.freq)}</span>
              <input type="range" min={-24} max={24} step={0.5} value={b.gain}
                onChange={(e) => { const bands = [...p.bands]; bands[i] = { ...b, gain: Number(e.target.value) }; eq.setParams({ bands }); onChange(); }}
                className="w-14 h-3" title={`Band ${i + 1} gain`} />
            </div>
          ))}
        </div>
      );
    }
    case "compressor": {
      const c = node as Compressor;
      const p = c.getParams();
      return (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <Slider label="thresh" value={p.threshold} min={-60} max={0} step={1} fmt={(v) => v + "dB"} onInput={(v) => { c.setParams({ ...p, threshold: v }); onChange(); }} />
          <Slider label="ratio" value={p.ratio} min={1} max={20} step={0.5} fmt={(v) => v + ":1"} onInput={(v) => { c.setParams({ ...p, ratio: v }); onChange(); }} />
          <Slider label="attack" value={p.attack * 1000} min={0.5} max={200} step={0.5} fmt={(v) => Math.round(v) + "ms"} onInput={(v) => { c.setParams({ ...p, attack: v / 1000 }); onChange(); }} />
          <Slider label="release" value={p.release * 1000} min={10} max={1000} step={5} fmt={(v) => Math.round(v) + "ms"} onInput={(v) => { c.setParams({ ...p, release: v / 1000 }); onChange(); }} />
          <Slider label="knee" value={p.knee} min={0} max={40} step={1} fmt={(v) => v + "dB"} onInput={(v) => { c.setParams({ ...p, knee: v }); onChange(); }} />
          <Slider label="makeup" value={p.makeup} min={0} max={8} step={0.1} fmt={(v) => v.toFixed(1) + "x"} onInput={(v) => { c.setParams({ ...p, makeup: v }); onChange(); }} />
        </div>
      );
    }
    case "limiter": {
      const l = node as Limiter;
      const p = l.getParams();
      return (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <Slider label="thresh" value={p.threshold} min={-40} max={0} step={0.5} fmt={(v) => v + "dB"} onInput={(v) => { l.setParams({ ...p, threshold: v }); onChange(); }} />
          <Slider label="ceiling" value={p.ceiling} min={-24} max={0} step={0.1} fmt={(v) => v + "dB"} onInput={(v) => { l.setParams({ ...p, ceiling: v }); onChange(); }} />
          <Slider label="release" value={p.release * 1000} min={10} max={500} step={5} fmt={(v) => Math.round(v) + "ms"} onInput={(v) => { l.setParams({ ...p, release: v / 1000 }); onChange(); }} />
        </div>
      );
    }
    case "reverb": {
      const r = node as Reverb;
      const p = r.getParams();
      return (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <Slider label="size" value={p.roomSize * 100} min={0} max={100} step={1} fmt={(v) => v + "%"} onInput={(v) => { r.setParams({ ...p, roomSize: v / 100 }); onChange(); }} />
          <Slider label="decay" value={p.decay * 100} min={0} max={98} step={1} fmt={(v) => v + "%"} onInput={(v) => { r.setParams({ ...p, decay: v / 100 }); onChange(); }} />
          <Slider label="damp" value={p.damping * 100} min={0} max={100} step={1} fmt={(v) => v + "%"} onInput={(v) => { r.setParams({ ...p, damping: v / 100 }); onChange(); }} />
          <Slider label="mix" value={p.mix * 100} min={0} max={100} step={1} fmt={(v) => v + "%"} onInput={(v) => { r.setParams({ ...p, mix: v / 100 }); onChange(); }} />
        </div>
      );
    }
    case "delay": {
      const d = node as Delay;
      const p = d.getParams();
      return (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <label className="flex items-center gap-1.5 text-[9px] font-mono text-ink-400">
            <span className="w-9 shrink-0">time</span>
            <select value={p.sync} onChange={(e) => { d.setParams({ ...p, sync: e.target.value as typeof p.sync }); onChange(); }}
              className="bg-ink-900 border border-ink-700 rounded px-1 py-0.5 text-[9px] text-ink-200">
              <option value="free">free</option><option value="1/1">1/1</option><option value="1/2">1/2</option>
              <option value="1/4">1/4</option><option value="1/8">1/8</option><option value="1/8.">1/8.</option>
              <option value="1/16">1/16</option><option value="1/16.">1/16.</option>
            </select>
            {p.sync === "free" ? (
              <input type="range" min={10} max={2000} step={5} value={p.timeMs} className="flex-1 h-3"
                onChange={(e) => { d.setParams({ ...p, timeMs: Number(e.target.value) }); onChange(); }} />
            ) : (
              <span className="flex-1 text-[9px] text-ink-300">≈ {Math.round(d.getTimeMs())} ms @120</span>
            )}
          </label>
          <Slider label="feedbk" value={p.feedback * 100} min={0} max={95} step={1} fmt={(v) => v + "%"} onInput={(v) => { d.setParams({ ...p, feedback: v / 100 }); onChange(); }} />
          <Slider label="offset" value={p.stereoOffsetMs} min={0} max={100} step={1} fmt={(v) => v + "ms"} onInput={(v) => { d.setParams({ ...p, stereoOffsetMs: v }); onChange(); }} />
          <Slider label="mix" value={p.mix * 100} min={0} max={100} step={1} fmt={(v) => v + "%"} onInput={(v) => { d.setParams({ ...p, mix: v / 100 }); onChange(); }} />
        </div>
      );
    }
    case "distortion": {
      const d = node as Distortion;
      const p = d.getParams();
      return (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <Slider label="drive" value={p.drive * 100} min={0} max={100} step={1} fmt={(v) => v + "%"} onInput={(v) => { d.setParams({ ...p, drive: v / 100 }); onChange(); }} />
          <Slider label="tone" value={p.tone * 100} min={0} max={100} step={1} fmt={(v) => v + "%"} onInput={(v) => { d.setParams({ ...p, tone: v / 100 }); onChange(); }} />
          <Slider label="mix" value={p.mix * 100} min={0} max={100} step={1} fmt={(v) => v + "%"} onInput={(v) => { d.setParams({ ...p, mix: v / 100 }); onChange(); }} />
        </div>
      );
    }
    case "utility": {
      const u = node as Utility;
      const p = u.getParams();
      return (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 items-center">
          <Slider label="gain" value={p.gain} min={0} max={4} step={0.05} fmt={(v) => v.toFixed(2) + "x"} onInput={(v) => { u.setParams({ ...p, gain: v }); onChange(); }} />
          <Slider label="width" value={p.width * 100} min={0} max={200} step={5} fmt={(v) => v + "%"} onInput={(v) => { u.setParams({ ...p, width: v / 100 }); onChange(); }} />
          <label className="flex items-center gap-1.5 text-[9px] font-mono text-ink-400">
            <input type="checkbox" checked={p.invert} onChange={(e) => { u.setParams({ ...p, invert: e.target.checked }); onChange(); }} className="accent-[#00f5ff]" />
            phase invert
          </label>
          <label className="flex items-center gap-1.5 text-[9px] font-mono text-ink-400">
            <input type="checkbox" checked={p.mono} onChange={(e) => { u.setParams({ ...p, mono: e.target.checked }); onChange(); }} className="accent-[#00f5ff]" />
            mono sum
          </label>
        </div>
      );
    }
    default:
      return null;
  }
}
