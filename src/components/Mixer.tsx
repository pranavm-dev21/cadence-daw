import { useEffect, useRef } from "react";
import { Track, TrackFx, dbLabel } from "../types";
import { useStore } from "../state/store";
import { audio, RETURN_DEFS } from "../core";
import { IconMixer } from "./icons";

const cutoffToSlider = (f: number) => Math.round((100 * Math.log(f / 300)) / Math.log(60));
const sliderToCutoff = (v: number) => Math.round(300 * Math.pow(60, v / 100));

export default function Mixer() {
  const { state, apply, applySilent, snapshot, gate } = useStore();
  const p = state.project;
  /* Meters are read-only realtime telemetry from the audio backend (never the
   * undo stack). All *writes* (volume/pan/mute/solo/fx) go through the bus. */
  const rmsRefs = useRef(new Map<string, HTMLDivElement>());
  const peakRefs = useRef(new Map<string, HTMLDivElement>());
  const returnRefs = useRef(new Map<string, HTMLDivElement>());
  const loadRefs = useRef(new Map<string, HTMLDivElement>());
  const masterRmsRef = useRef<HTMLDivElement>(null);
  const masterPeakRef = useRef<HTMLDivElement>(null);
  const totalLoadRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const engine = audio;
    let raf = 0;
    const tick = () => {
      // per-channel relative DSP load (normalized so the hottest strip reads 100%)
      const costs = p.tracks.map((t) => engine.getChannelCpuCost(t.id));
      const maxCost = Math.max(1, ...costs);
      p.tracks.forEach((t, i) => {
        const el = loadRefs.current.get(t.id);
        if (el) el.style.width = `${Math.round((costs[i] / maxCost) * 100)}%`;
      });
      if (totalLoadRef.current) totalLoadRef.current.textContent = String(Math.round(engine.getTotalCpuCost()));

      // channel strips: RMS fill + peak cap (post-fader, reflects mute/solo)
      for (const t of p.tracks) {
        const m = engine.getChannelMeter(t.id);
        const rmsEl = rmsRefs.current.get(t.id);
        const peakEl = peakRefs.current.get(t.id);
        if (rmsEl) rmsEl.style.height = `${Math.min(100, m.rms * 260)}%`;
        if (peakEl) peakEl.style.bottom = `${Math.min(100, m.peak * 260)}%`;
      }
      // return buses
      for (const r of engine.getReturnInfos()) {
        const el = returnRefs.current.get(r.id);
        if (el) el.style.height = `${Math.min(100, r.level * 300)}%`;
      }
      // master bus
      const mm = engine.getMasterMeter();
      if (masterRmsRef.current) masterRmsRef.current.style.height = `${Math.min(100, mm.rms * 240)}%`;
      if (masterPeakRef.current) masterPeakRef.current.style.bottom = `${Math.min(100, mm.peak * 240)}%`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [p.tracks]);

  const fxOn = gate("advanced");      // sends, filters, drive — Advanced only
  const extended = gate("producer");  // pan, solo, mute labels — Producer & up
  const beginner = !extended;

  const volGesture = (t: Track, value: number) => {
    snapshot(`${t.name} volume`);
    applySilent([{ op: "set_track_volume", trackId: t.id, value }]);
  };

  return (
    <section className="panel flex-1 min-h-0 flex flex-col anim-fade-up" style={{ animationDelay: "160ms" }}>
      <div className="flex items-center gap-2 px-3 h-[38px] shrink-0 border-b border-ink-700/60">
        <IconMixer size={14} className="text-amber-glow" />
        <span className="panel-title">Mixer</span>
        <span className="text-[10px] font-mono text-ink-400">{p.tracks.length} tracks + master</span>
        <span className="text-[9px] font-mono text-ink-500" title="Total relative DSP load of the mixer (channels + returns + master)">
          DSP <span ref={totalLoadRef} className="text-teal tabular-nums">0</span>
        </span>
        <div className="flex-1" />
        {extended && !fxOn && <span className="text-[9px] text-ink-400 hidden md:block">switch to Advanced for sends, filters & drive</span>}
        {beginner && <span className="text-[9px] text-ink-400 hidden md:block">volume & mute — that's all you need for now</span>}
      </div>

      <div className="flex-1 min-h-0 flex gap-2 overflow-x-auto px-2.5 py-2">
          {p.tracks.map((t) => (
            <Strip
              key={t.id}
              t={t}
              fxOn={fxOn}
              extended={extended}
              rmsEl={(el) => { if (el) rmsRefs.current.set(t.id, el); else rmsRefs.current.delete(t.id); }}
              peakEl={(el) => { if (el) peakRefs.current.set(t.id, el); else peakRefs.current.delete(t.id); }}
              loadEl={(el) => { if (el) loadRefs.current.set(t.id, el); else loadRefs.current.delete(t.id); }}
              volGesture={volGesture}
              apply={apply}
              applySilent={applySilent}
              snapshot={snapshot}
            />
          ))}

          {/* return buses (sends destinations) */}
          {fxOn && (
            <div className="flex gap-2 shrink-0 border-l border-ink-700/60 pl-2">
              {RETURN_DEFS.map((r) => (
                <div key={r.id} className="w-[64px] rounded-lg border border-ink-700 bg-ink-800/50 flex flex-col overflow-hidden">
                  <div className="h-[3px] bg-ink-600" />
                  <div className="px-1.5 pt-1.5 text-[9px] font-bold text-ink-300 uppercase tracking-wide truncate" title={`${r.name} return bus`}>{r.name}</div>
                  <div className="flex-1 min-h-0 flex items-stretch px-1.5 py-1.5">
                    <div className="w-2 rounded-sm bg-ink-950 border border-ink-700 overflow-hidden flex items-end flex-1">
                      <div
                        ref={(el) => { if (el) returnRefs.current.set(r.id, el); else returnRefs.current.delete(r.id); }}
                        className="w-full rounded-sm"
                        style={{ height: "0%", background: "linear-gradient(180deg, #a78bfa, #58b7f5)" }}
                      />
                    </div>
                  </div>
                  <div className="px-1.5 pb-1.5 text-[8px] font-mono text-ink-400 text-center">return</div>
                </div>
              ))}
            </div>
          )}

          {/* master */}
          <div className="w-[104px] shrink-0 rounded-lg border border-ink-700 bg-ink-800/70 flex flex-col overflow-hidden">
            <div className="h-[3px] bg-gradient-to-r from-teal via-amber-glow to-coral" />
            <div className="px-2 pt-1.5 text-[11px] font-bold text-ink-100">Master</div>
            <div className="flex-1 min-h-0 flex items-stretch gap-2 px-2.5 py-1.5">
              <div className="w-2.5 rounded-sm bg-ink-950 border border-ink-700 overflow-hidden flex items-end relative">
                <div ref={masterRmsRef} className="w-full rounded-sm" style={{ height: "0%", background: "linear-gradient(180deg, #ff6f61, #ffb454 45%, #3ecfb2)" }} />
                <div ref={masterPeakRef} className="absolute left-0 right-0 h-[2px] bg-ink-100" style={{ bottom: "0%" }} />
              </div>
              <div className="flex-1 flex flex-col justify-center gap-1.5 text-[9px] font-mono text-ink-400">
                <div className="text-teal">LIMITER ON</div>
                <div>-0.1 dBFS ceil</div>
                <div className="text-ink-300">44.1 kHz float</div>
              </div>
            </div>
            <div className="px-2 pb-1.5 text-[9px] font-mono text-ink-400">0.0 dB</div>
          </div>
        </div>
    </section>
  );
}

function Strip({
  t, fxOn, extended, rmsEl, peakEl, loadEl, volGesture, apply, applySilent, snapshot,
}: {
  t: Track;
  fxOn: boolean;
  extended: boolean;
  rmsEl: (el: HTMLDivElement | null) => void;
  peakEl: (el: HTMLDivElement | null) => void;
  loadEl: (el: HTMLDivElement | null) => void;
  volGesture: (t: Track, v: number) => void;
  apply: (label: string, cmds: Parameters<ReturnType<typeof useStore>["apply"]>[1]) => void;
  applySilent: (cmds: Parameters<ReturnType<typeof useStore>["applySilent"]>[0]) => void;
  snapshot: (label: string) => void;
}) {
  const panLabel = t.pan === 0 ? "C" : t.pan < 0 ? `${Math.round(-t.pan * 100)}L` : `${Math.round(t.pan * 100)}R`;

  const fxSlider = (label: string, value: number, onChange: (v: number) => void, fmt: (v: number) => string) => (
    <label className="flex items-center gap-1 text-[8px] font-mono text-ink-400" title={fmt(value)}>
      <span className="w-6">{label}</span>
      <input
        type="range" min={0} max={100} value={Math.round(value * 100)}
        onPointerDown={() => snapshot(`${t.name} ${label}`)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="flex-1 h-3"
      />
    </label>
  );

  return (
    <div
      className={`w-[96px] shrink-0 rounded-lg border flex flex-col overflow-hidden transition-colors ${t.mute ? "border-ink-700 bg-ink-900/60 opacity-70" : "border-ink-700 bg-ink-800/70"}`}
      style={{ boxShadow: t.solo ? `0 0 0 1px ${t.color}88` : undefined }}
    >
      <div className="h-[3px]" style={{ background: t.color }} />
      <div className="px-2 pt-1.5 flex items-center gap-1.5">
        <span className="text-[11px] font-bold text-ink-100 truncate flex-1" title={t.name}>{t.name}</span>
      </div>

      {/* relative DSP load — hotter strips (more sends/FX) fill further */}
      <div className="px-2 pt-1" title="Relative DSP load of this channel">
        <div className="h-[3px] rounded-full bg-ink-950/80 overflow-hidden">
          <div ref={loadEl} className="h-full rounded-full transition-[width] duration-150 ease-out" style={{ width: "0%", background: `linear-gradient(90deg, ${t.color}66, ${t.color})` }} />
        </div>
      </div>

      <div className="flex-1 min-h-0 flex items-stretch gap-2 px-2.5 py-1.5">
        {/* meter: RMS fill + peak cap (post-fader, so it reflects volume & mute/solo) */}
        <div className="w-2 rounded-sm bg-ink-950 border border-ink-700 overflow-hidden flex items-end relative">
          <div ref={rmsEl} className="w-full rounded-sm" style={{ height: "0%", background: `linear-gradient(180deg, #ff6f61, ${t.color} 45%, ${t.color}66)` }} />
          <div ref={peakEl} className="absolute left-0 right-0 h-[2px] bg-ink-100" style={{ bottom: "0%" }} />
        </div>

        <div className="flex-1 flex flex-col items-center min-h-0">
          {/* fader */}
          <div className="flex-1 min-h-0 w-full flex justify-center">
            <input
              type="range" className="fader" min={0} max={125} step={1}
              value={Math.round(t.volume * 100)}
              onPointerDown={() => volGesture(t, t.volume)}
              onChange={(e) => applySilent([{ op: "set_track_volume", trackId: t.id, value: Number(e.target.value) / 100 }])}
              aria-label={`${t.name} volume`}
            />
          </div>
          <div className="font-mono text-[9px] text-ink-300 tabular-nums mt-1">{dbLabel(t.volume)} dB</div>
        </div>
      </div>

      {/* pan */}
      {extended && (
        <div className="px-2 pb-1">
          <input
            type="range" min={-100} max={100} value={Math.round(t.pan * 100)}
            onPointerDown={() => snapshot(`${t.name} pan`)}
            onChange={(e) => applySilent([{ op: "set_track_pan", trackId: t.id, value: Number(e.target.value) / 100 }])}
            onDoubleClick={() => apply(`${t.name} pan center`, [{ op: "set_track_pan", trackId: t.id, value: 0 }])}
            className="w-full h-3"
            title={`Pan (${panLabel}) — double-click to center`}
            aria-label={`${t.name} pan`}
          />
          <div className="text-[8px] font-mono text-ink-400 text-center">{panLabel}</div>
        </div>
      )}

      {/* M/S */}
      <div className="flex gap-1 px-2 pb-1.5">
        <button
          onClick={() => apply(`${t.mute ? "Unmute" : "Mute"} ${t.name}`, [{ op: "set_track_mute", trackId: t.id, value: !t.mute }])}
          className={`flex-1 text-[10px] font-bold py-0.5 rounded border transition-colors ${t.mute ? "bg-rec/25 border-rec/60 text-rec" : "border-ink-700 text-ink-400 hover:text-ink-100"}`}
          title="Mute"
        >
          M
        </button>
        {extended && (
          <button
            onClick={() => apply(`${t.solo ? "Unsolo" : "Solo"} ${t.name}`, [{ op: "set_track_solo", trackId: t.id, value: !t.solo }])}
            className={`flex-1 text-[10px] font-bold py-0.5 rounded border transition-colors ${t.solo ? "bg-amber-glow/25 border-amber-glow/60 text-amber-glow" : "border-ink-700 text-ink-400 hover:text-ink-100"}`}
            title="Solo — hear only this track"
          >
            S
          </button>
        )}
      </div>

      {/* advanced FX */}
      {fxOn && (
        <div className="border-t border-ink-700/70 px-2 py-1.5 flex flex-col gap-1 bg-ink-900/50">
          {fxSlider("REV", t.fx.reverb, (v) => applySilent([{ op: "set_track_fx", trackId: t.id, fx: { reverb: v } as Partial<TrackFx> }]), (v) => `Reverb send ${Math.round(v * 100)}%`)}
          {fxSlider("DLY", t.fx.delay, (v) => applySilent([{ op: "set_track_fx", trackId: t.id, fx: { delay: v } as Partial<TrackFx> }]), (v) => `Delay send ${Math.round(v * 100)}%`)}
          <label className="flex items-center gap-1 text-[8px] font-mono text-ink-400" title={`Lowpass cutoff ${t.fx.cutoff >= 1000 ? (t.fx.cutoff / 1000).toFixed(1) + " kHz" : t.fx.cutoff + " Hz"}`}>
            <span className="w-6">CUT</span>
            <input
              type="range" min={0} max={100} value={cutoffToSlider(t.fx.cutoff)}
              onPointerDown={() => snapshot(`${t.name} filter`)}
              onChange={(e) => applySilent([{ op: "set_track_fx", trackId: t.id, fx: { cutoff: sliderToCutoff(Number(e.target.value)) } }])}
              className="flex-1 h-3"
            />
          </label>
          {fxSlider("DRV", t.fx.drive, (v) => applySilent([{ op: "set_track_fx", trackId: t.id, fx: { drive: v } as Partial<TrackFx> }]), (v) => `Drive ${Math.round(v * 100)}%`)}
        </div>
      )}
    </div>
  );
}
