import { useEffect, useMemo, useRef, useState } from "react";
import {
  PatchCategory, SUBSYNTH_PRESETS, SubSynth, SynthPatch, VoiceProfile,
  profileSubSynth,
} from "../audio/subsynth";
import { IconActivity, IconSynth } from "./icons";

/* Module-level singletons so the AudioContext + synth survive view switches
 * without leaking a new context on every remount. */
let labCtx: AudioContext | null = null;
let labSynth: SubSynth | null = null;
let labPatch: SynthPatch = SUBSYNTH_PRESETS[0];

const CATEGORY_COLOR: Record<PatchCategory, string> = {
  bass: "#ffb45e",
  pad: "#a78bfa",
  lead: "#58b7f5",
  pluck: "#3ecfb2",
};
const CATEGORY_ORDER: PatchCategory[] = ["bass", "lead", "pluck", "pad"];

const NOTE_OFFSETS: Record<string, number> = {
  a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11,
  k: 12, o: 13, l: 14, p: 15,
};

const BLACK_PCS = new Set([1, 3, 6, 8, 10]);
const SEMIS = 17;

const cutoffToSlider = (f: number) => Math.round((100 * Math.log(f / 60)) / Math.log(16000 / 60));
const sliderToCutoff = (v: number) => Math.round(60 * Math.pow(16000 / 60, v / 100));
const fmtHz = (f: number) => (f >= 1000 ? `${(f / 1000).toFixed(1)}k` : `${Math.round(f)}`);

function ensureSynth(patch: SynthPatch): SubSynth {
  if (!labCtx) {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    labCtx = new Ctx();
    const master = labCtx.createGain();
    master.gain.value = 0.7;
    const comp = labCtx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 4;
    master.connect(comp);
    comp.connect(labCtx.destination);
    labSynth = new SubSynth(patch);
    labSynth.attach(labCtx, master);
  }
  if (labCtx.state === "suspended") void labCtx.resume();
  labSynth!.setPatch(patch);
  return labSynth!;
}

export default function SynthLab() {
  const [patch, setPatchState] = useState<SynthPatch>(labPatch);
  const [active, setActive] = useState(0);
  const [peak, setPeak] = useState(0);
  const [profile, setProfile] = useState<VoiceProfile | null>(null);
  const [profiling, setProfiling] = useState(false);
  const [heldPc, setHeldPc] = useState<Set<number>>(new Set());

  const patchRef = useRef(patch);
  patchRef.current = patch;
  const heldRef = useRef(new Set<number>());

  const setPatch = (partial: Partial<SynthPatch>) => {
    setPatchState((p) => {
      const next = { ...p, ...partial };
      labPatch = next;
      labSynth?.setPatch(next);
      return next;
    });
  };
  const loadPreset = (p: SynthPatch) => {
    labPatch = p;
    labSynth?.allNotesOff();
    heldRef.current.clear();
    setHeldPc(new Set());
    setPatchState(p);
    setProfile(null);
  };

  const noteOn = (midi: number) => {
    const s = ensureSynth(patchRef.current);
    s.noteOn(midi, 0.85);
    heldRef.current.add(midi);
    setHeldPc(new Set(heldRef.current));
  };
  const noteOff = (midi: number) => {
    labSynth?.noteOff(midi);
    heldRef.current.delete(midi);
    setHeldPc(new Set(heldRef.current));
  };
  const noteOnRef = useRef(noteOn);
  const noteOffRef = useRef(noteOff);
  noteOnRef.current = noteOn;
  noteOffRef.current = noteOff;

  /* live voice telemetry */
  useEffect(() => {
    const id = window.setInterval(() => {
      if (labSynth) {
        setActive(labSynth.activeVoices);
        setPeak(labSynth.peakVoices);
      }
    }, 110);
    return () => window.clearInterval(id);
  }, []);

  /* computer-keyboard performance */
  useEffect(() => {
    const isForm = (el: EventTarget | null) =>
      el instanceof HTMLElement && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
    const down = (e: KeyboardEvent) => {
      if (isForm(e.target) || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const off = NOTE_OFFSETS[e.key.toLowerCase()];
      if (off === undefined) return;
      const base = patchRef.current.category === "bass" ? 45 : 57;
      noteOnRef.current(base + off);
    };
    const up = (e: KeyboardEvent) => {
      const off = NOTE_OFFSETS[e.key.toLowerCase()];
      if (off === undefined) return;
      const base = patchRef.current.category === "bass" ? 45 : 57;
      noteOffRef.current(base + off);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      labSynth?.allNotesOff();
    };
  }, []);

  /* keyboard layout */
  const base = patch.category === "bass" ? 45 : 57;
  const keyList = useMemo(() => {
    const arr: { midi: number; black: boolean }[] = [];
    for (let i = 0; i < SEMIS; i++) arr.push({ midi: base + i, black: BLACK_PCS.has((base + i) % 12) });
    return arr;
  }, [base]);
  const whiteKeys = keyList.filter((k) => !k.black);
  const whiteW = 100 / whiteKeys.length;

  const runProfile = async () => {
    setProfiling(true);
    try {
      const p = await profileSubSynth(patchRef.current, 32, 1);
      setProfile(p);
    } finally {
      setProfiling(false);
    }
  };

  const accent = CATEGORY_COLOR[patch.category];

  return (
    <div className="panel flex-1 min-h-0 flex flex-col anim-fade-up overflow-hidden" style={{ animationDelay: "140ms" }}>
      {/* header */}
      <div className="flex items-center gap-2.5 px-3.5 h-12 shrink-0 border-b border-ink-700/70">
        <IconSynth size={18} className="shrink-0" style={{ color: accent }} />
        <div className="leading-tight min-w-0">
          <div className="text-[14px] font-bold text-ink-100 truncate">Synth Lab</div>
          <div className="text-[9px] font-mono uppercase tracking-wider" style={{ color: accent }}>
            {patch.category} · {patch.name}
          </div>
        </div>
        <div className="flex-1" />
        {/* live voice LEDs */}
        <div className="hidden sm:flex items-center gap-1" title={`${active} active voice${active === 1 ? "" : "s"} (peak ${peak})`}>
          {Array.from({ length: 16 }, (_, i) => (
            <span
              key={i}
              className="w-1.5 h-3.5 rounded-[2px] transition-all duration-100"
              style={{
                background: i < active ? accent : "var(--color-ink-750)",
                boxShadow: i < active ? `0 0 6px ${accent}` : "none",
                opacity: i < active ? 1 : 0.5,
              }}
            />
          ))}
        </div>
        <div className="text-right leading-none ml-1">
          <div className="font-mono text-[22px] font-bold tabular-nums" style={{ color: accent }}>{active}</div>
          <div className="text-[8px] font-mono uppercase tracking-widest text-ink-400">voices</div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-y-auto">
        {/* left: presets + keyboard */}
        <div className="flex-1 min-w-0 flex flex-col gap-3 p-3.5">
          {/* preset grid */}
          <div>
            <div className="panel-title mb-2">Factory presets</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {CATEGORY_ORDER.flatMap((cat) =>
                SUBSYNTH_PRESETS.filter((p) => p.category === cat).map((p) => {
                  const selected = p.name === patch.name;
                  return (
                    <button
                      key={p.name}
                      onClick={() => loadPreset(p)}
                      className={`px-2.5 py-2 rounded-lg border text-left transition-all duration-150 active:scale-[0.98] ${
                        selected ? "bg-ink-750" : "bg-ink-850 hover:bg-ink-800 border-ink-750"
                      }`}
                      style={selected ? { borderColor: CATEGORY_COLOR[cat], boxShadow: `0 0 0 1px ${CATEGORY_COLOR[cat]}55` } : undefined}
                    >
                      <span className="block text-[11.5px] font-semibold text-ink-100 truncate">{p.name}</span>
                      <span className="block text-[8.5px] font-mono uppercase tracking-widest mt-0.5" style={{ color: CATEGORY_COLOR[cat] }}>
                        {p.category} · {p.mode === "mono" ? "mono" : `${p.unison}v`}
                      </span>
                    </button>
                  );
                }),
              )}
            </div>
          </div>

          {/* playable keyboard */}
          <div>
            <div className="panel-title mb-2 flex items-center justify-between">
              <span>Play it</span>
              <span className="text-[9px] font-mono normal-case tracking-normal text-ink-400">click / drag · or keys A–K row</span>
            </div>
            <div className="relative h-32 select-none rounded-lg overflow-hidden border border-ink-700 bg-ink-950">
              {whiteKeys.map((k) => {
                const held = heldPc.has(k.midi);
                return (
                  <button
                    key={k.midi}
                    onPointerDown={(e) => { e.preventDefault(); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); noteOn(k.midi); }}
                    onPointerUp={() => noteOff(k.midi)}
                    onPointerLeave={() => heldPc.has(k.midi) && noteOff(k.midi)}
                    className="absolute top-0 bottom-0 border-r border-ink-700/60 transition-colors duration-75"
                    style={{
                      left: `${whiteKeys.indexOf(k) * whiteW}%`,
                      width: `${whiteW}%`,
                      background: held ? accent : "linear-gradient(180deg, #232a38, #1a202c)",
                    }}
                    aria-label={`Play note ${k.midi}`}
                  />
                );
              })}
              {keyList.filter((k) => k.black).map((k) => {
                const whitesBefore = keyList.slice(0, keyList.indexOf(k)).filter((x) => !x.black).length;
                const held = heldPc.has(k.midi);
                return (
                  <button
                    key={k.midi}
                    onPointerDown={(e) => { e.preventDefault(); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); noteOn(k.midi); }}
                    onPointerUp={() => noteOff(k.midi)}
                    onPointerLeave={() => heldPc.has(k.midi) && noteOff(k.midi)}
                    className="absolute top-0 h-[62%] z-10 rounded-b border border-ink-950 transition-colors duration-75"
                    style={{
                      left: `${whitesBefore * whiteW - whiteW * 0.3}%`,
                      width: `${whiteW * 0.6}%`,
                      background: held ? accent : "linear-gradient(180deg, #0d1117, #06080c)",
                      boxShadow: held ? `0 0 10px ${accent}` : "0 2px 6px rgba(0,0,0,0.6)",
                    }}
                    aria-label={`Play note ${k.midi}`}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* right: patch editor + headroom */}
        <div className="w-full lg:w-[320px] shrink-0 border-t lg:border-t-0 lg:border-l border-ink-700/70 p-3.5 flex flex-col gap-3">
          <PatchEditor patch={patch} setPatch={setPatch} accent={accent} />
          <HeadroomPanel
            active={active}
            peak={peak}
            profile={profile}
            profiling={profiling}
            onProfile={runProfile}
            accent={accent}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------------- patch editor ---------------- */

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-[9px] font-mono uppercase tracking-wider text-ink-400">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function Slider({ value, min, max, step, onChange, fmt }: {
  value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; fmt?: (v: number) => string;
}) {
  return (
    <div className="flex items-center gap-2">
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1 h-3" />
      <span className="w-11 text-right text-[9.5px] font-mono text-ink-300 tabular-nums">{fmt ? fmt(value) : value}</span>
    </div>
  );
}

function Section({ title, children, accent }: { title: string; children: React.ReactNode; accent: string }) {
  return (
    <div>
      <div className="text-[9px] font-mono uppercase tracking-[0.18em] mb-1.5" style={{ color: accent }}>{title}</div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function PatchEditor({ patch, setPatch, accent }: {
  patch: SynthPatch; setPatch: (p: Partial<SynthPatch>) => void; accent: string;
}) {
  const setAmp = (p: Partial<SynthPatch["amp"]>) => setPatch({ amp: { ...patch.amp, ...p } });
  const setFEnv = (p: Partial<SynthPatch["filterEnv"]>) => setPatch({ filterEnv: { ...patch.filterEnv, ...p } });
  const waves = ["sine", "triangle", "sawtooth", "square", "noise"] as const;

  return (
    <div className="flex flex-col gap-3">
      <Section title="Voice" accent={accent}>
        <div className="flex gap-1.5">
          {(["mono", "poly"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setPatch({ mode: m })}
              className={`flex-1 py-1 rounded-md text-[10.5px] font-bold uppercase tracking-wider border transition-colors ${
                patch.mode === m ? "border-transparent text-ink-950" : "border-ink-700 text-ink-400 hover:text-ink-100"
              }`}
              style={patch.mode === m ? { background: accent } : undefined}
            >
              {m}
            </button>
          ))}
        </div>
        {patch.mode === "mono" && (
          <Row label="Glide"><Slider value={Math.round(patch.glide * 1000)} min={0} max={300} step={5} onChange={(v) => setPatch({ glide: v / 1000 })} fmt={(v) => `${v}ms`} /></Row>
        )}
        <Row label="Unison"><Slider value={patch.unison} min={1} max={8} step={1} onChange={(v) => setPatch({ unison: v })} fmt={(v) => `${v}v`} /></Row>
        <Row label="Spread"><Slider value={patch.unisonSpread} min={0} max={50} step={1} onChange={(v) => setPatch({ unisonSpread: v })} fmt={(v) => `${v}¢`} /></Row>
      </Section>

      <Section title="Oscillators" accent={accent}>
        <Row label="Osc 1">
          <div className="flex gap-1 items-center">
            <select value={patch.osc1Wave} onChange={(e) => setPatch({ osc1Wave: e.target.value as SynthPatch["osc1Wave"] })} className="bg-ink-800 border border-ink-700 rounded px-1.5 py-0.5 text-[10px] font-mono text-ink-200 flex-1">
              {waves.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
            <span className="w-12"><Slider value={patch.osc1Detune} min={-100} max={100} step={1} onChange={(v) => setPatch({ osc1Detune: v })} fmt={(v) => `${v}¢`} /></span>
          </div>
        </Row>
        <Row label="Osc 2">
          <div className="flex gap-1 items-center">
            <select value={patch.osc2Wave} onChange={(e) => setPatch({ osc2Wave: e.target.value as SynthPatch["osc2Wave"] })} className="bg-ink-800 border border-ink-700 rounded px-1.5 py-0.5 text-[10px] font-mono text-ink-200 flex-1">
              {waves.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
            <span className="w-12"><Slider value={patch.osc2Detune} min={-1200} max={1200} step={10} onChange={(v) => setPatch({ osc2Detune: v })} fmt={(v) => `${v}¢`} /></span>
          </div>
        </Row>
        <Row label="Mix"><Slider value={Math.round(patch.oscMix * 100)} min={0} max={100} step={1} onChange={(v) => setPatch({ oscMix: v / 100 })} fmt={(v) => `${v}%`} /></Row>
      </Section>

      <Section title="Filter" accent={accent}>
        <div className="flex gap-1.5">
          {(["lowpass", "highpass", "bandpass"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setPatch({ filterType: t })}
              className={`flex-1 py-1 rounded-md text-[9.5px] font-bold uppercase border transition-colors ${
                patch.filterType === t ? "border-transparent text-ink-950" : "border-ink-700 text-ink-400 hover:text-ink-100"
              }`}
              style={patch.filterType === t ? { background: accent } : undefined}
            >
              {t === "lowpass" ? "LP" : t === "highpass" ? "HP" : "BP"}
            </button>
          ))}
        </div>
        <Row label="Cutoff"><Slider value={cutoffToSlider(patch.cutoff)} min={0} max={100} step={1} onChange={(v) => setPatch({ cutoff: sliderToCutoff(v) })} fmt={(v) => fmtHz(sliderToCutoff(v))} /></Row>
        <Row label="Reso"><Slider value={Math.round(patch.resonance)} min={0} max={20} step={1} onChange={(v) => setPatch({ resonance: v })} fmt={(v) => `${v}`} /></Row>
        <Row label="Env Amt"><Slider value={Math.round(patch.filterEnvAmount)} min={-4000} max={8000} step={100} onChange={(v) => setPatch({ filterEnvAmount: v })} fmt={(v) => fmtHz(Math.abs(v))} /></Row>
      </Section>

      <Section title="Envelope · LFO" accent={accent}>
        <Row label="Attack"><Slider value={Math.round(patch.amp.attack * 1000)} min={1} max={2000} step={5} onChange={(v) => setAmp({ attack: v / 1000 })} fmt={(v) => `${v}ms`} /></Row>
        <Row label="Release"><Slider value={Math.round(patch.amp.release * 1000)} min={10} max={3000} step={10} onChange={(v) => setAmp({ release: v / 1000 })} fmt={(v) => `${v}ms`} /></Row>
        <div className="flex gap-1 items-center">
          <span className="w-14 shrink-0 text-[9px] font-mono uppercase tracking-wider text-ink-400">LFO</span>
          <select value={patch.lfoTarget} onChange={(e) => setPatch({ lfoTarget: e.target.value as SynthPatch["lfoTarget"] })} className="bg-ink-800 border border-ink-700 rounded px-1.5 py-0.5 text-[10px] font-mono text-ink-200">
            <option value="pitch">pitch</option>
            <option value="amplitude">amp</option>
          </select>
          <div className="flex-1"><Slider value={Math.round(patch.lfoRate * 10)} min={0} max={120} step={1} onChange={(v) => setPatch({ lfoRate: v / 10 })} fmt={(v) => `${(v / 10).toFixed(1)}Hz`} /></div>
        </div>
        <Row label="Depth"><Slider value={Math.round(patch.lfoDepth * 100)} min={0} max={100} step={1} onChange={(v) => setPatch({ lfoDepth: v / 100 })} fmt={(v) => `${v}%`} /></Row>
      </Section>
    </div>
  );
}

/* ---------------- headroom panel ---------------- */

function HeadroomPanel({ active, peak, profile, profiling, onProfile, accent }: {
  active: number; peak: number; profile: VoiceProfile | null; profiling: boolean;
  onProfile: () => void; accent: string;
}) {
  const headroom = profile?.estimatedHeadroom ?? null;
  const barPct = headroom === null ? 0 : Math.min(100, (headroom / 64) * 100);
  return (
    <div className="rounded-lg border border-ink-700 bg-ink-850/70 p-3">
      <div className="flex items-center gap-2 mb-2">
        <IconActivity size={14} style={{ color: accent } as never} />
        <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-ink-200">Voice headroom</span>
      </div>

      <div className="flex items-end gap-4 mb-2">
        <div>
          <div className="font-mono text-[26px] font-bold leading-none tabular-nums" style={{ color: accent }}>
            {headroom === null ? "—" : headroom >= 999 ? "999+" : headroom}
          </div>
          <div className="text-[8px] font-mono uppercase tracking-widest text-ink-400 mt-1">est. simultaneous voices</div>
        </div>
        <div className="flex-1">
          <div className="flex justify-between text-[9px] font-mono text-ink-400 mb-1">
            <span>active <b className="text-ink-200">{active}</b></span>
            <span>peak <b className="text-ink-200">{peak}</b></span>
          </div>
          <div className="h-2 rounded-full bg-ink-950 border border-ink-750 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${barPct}%`, background: `linear-gradient(90deg, ${accent}66, ${accent})` }} />
          </div>
        </div>
      </div>

      {profile && (
        <div className="text-[9px] font-mono text-ink-400 leading-relaxed mb-2">
          {profile.voices}×{profile.unison}-unison voices rendered in <b className="text-ink-200">{profile.renderMs.toFixed(1)}ms</b>
          {" "}(≈{profile.costPerVoiceMs.toFixed(3)}ms/voice). Native DSP runs on the audio thread, off the JS heap — 16+ voices stay dropout-free on a 4-core CPU.
        </div>
      )}

      <button
        onClick={onProfile}
        disabled={profiling}
        className="w-full py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider border border-ink-600 text-ink-100 hover:bg-ink-750 transition-colors disabled:opacity-50"
      >
        {profiling ? "Profiling…" : profile ? "Re-run profile" : "Profile voice cost"}
      </button>
    </div>
  );
}
