import { INSTRUMENT_META, InstrumentKind } from "../types";
import { useStore } from "../state/store";
import { buildDemoProject, buildEmptyProject } from "../core";
import { makeTrackWithClip } from "../ai/commands";
import { IconBook, IconDrum, IconPiano, IconWave, IconZap } from "./icons";

const KIND_ICONS: Record<InstrumentKind, (p: { size?: number }) => React.ReactNode> = {
  drumkit: IconDrum,
  bass: IconZap,
  keys: IconPiano,
  pluck: IconWave,
  pad: IconWave,
};

export default function Browser({ onToast }: { onToast: (m: string) => void }) {
  const { state, apply, selectTrack, loadProject } = useStore();
  const p = state.project;

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
    onToast(`${name} added — click a timeline cell to place its clip`);
  };

  return (
    <aside className="w-[212px] shrink-0 hidden lg:flex flex-col gap-2 min-h-0 anim-fade-up" style={{ animationDelay: "60ms" }}>
      {/* instruments */}
      <div className="panel p-2.5 shrink-0">
        <div className="panel-title mb-2">Instruments</div>
        <div className="flex flex-col gap-1">
          {(Object.keys(INSTRUMENT_META) as InstrumentKind[]).map((kind) => {
            const meta = INSTRUMENT_META[kind];
            const Ico = KIND_ICONS[kind];
            return (
              <button
                key={kind}
                onClick={() => addInstrument(kind)}
                className="group flex items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 text-left transition-all duration-150 hover:border-ink-600 hover:bg-ink-800 active:scale-[0.98]"
                title={`Add a ${meta.label} track`}
              >
                <span className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-transform duration-150 group-hover:scale-110" style={{ background: `${meta.color}22`, color: meta.color, border: `1px solid ${meta.color}44` }}>
                  <Ico size={14} />
                </span>
                <span className="leading-tight">
                  <span className="block text-[12px] font-semibold text-ink-100">{meta.label}</span>
                  <span className="block text-[9.5px] text-ink-400">{meta.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* tracks */}
      <div className="panel p-2.5 flex-1 min-h-0 flex flex-col">
        <div className="panel-title mb-2">Tracks</div>
        <div className="flex-1 overflow-y-auto flex flex-col gap-1">
          {p.tracks.map((t) => {
            const selected = t.id === state.selectedTrackId;
            const notes = t.clipIds.reduce((acc, id) => acc + (p.clips[id]?.notes.length ?? 0), 0);
            return (
              <button
                key={t.id}
                onClick={() => selectTrack(t.id)}
                className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-all duration-130 border ${selected ? "bg-ink-800 border-ink-600" : "border-transparent hover:bg-ink-800/60"}`}
              >
                <span className="w-2.5 h-2.5 rounded-[4px] shrink-0" style={{ background: t.color, boxShadow: selected ? `0 0 8px ${t.color}99` : undefined }} />
                <span className="flex-1 min-w-0">
                  <span className={`block text-[12px] font-semibold truncate ${selected ? "text-ink-100" : "text-ink-300"}`}>{t.name}</span>
                  <span className="block text-[9.5px] text-ink-400 font-mono">{notes} notes · {t.placements.length} on timeline{t.mute ? " · muted" : ""}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* sessions */}
        <div className="pt-2 mt-2 border-t border-ink-700/70">
          <div className="panel-title mb-1.5">Sessions</div>
          <div className="flex flex-col gap-1">
            <button className="btn justify-start! text-[11px]!" onClick={() => { loadProject(buildDemoProject()); onToast("Loaded the demo song \"First Light\""); }}>
              <IconWave size={12} /> Demo song — First Light
            </button>
            <button className="btn justify-start! text-[11px]!" onClick={() => { loadProject(buildEmptyProject()); onToast("Blank session — ask the copilot for a beat"); }}>
              <IconBook size={12} /> Blank session
            </button>
          </div>
        </div>
      </div>

      {/* beginner guide */}
      {state.mode === "beginner" && (
        <div className="panel p-2.5 shrink-0 border-amber-glow/25">
          <div className="flex items-center gap-1.5 mb-1.5">
            <IconBook size={12} className="text-amber-glow" />
            <span className="panel-title text-amber-glow/90!">3-step start</span>
          </div>
          <ol className="text-[11px] text-ink-300 leading-relaxed list-none flex flex-col gap-1">
            <li><span className="text-amber-glow font-mono font-semibold">1.</span> Press <span className="font-semibold text-ink-100">play</span> — a song is already loaded.</li>
            <li><span className="text-amber-glow font-mono font-semibold">2.</span> Click a <span className="font-semibold text-ink-100">colored block</span> above, then edit its notes below.</li>
            <li><span className="text-amber-glow font-mono font-semibold">3.</span> Ask the copilot to <span className="font-semibold text-ink-100">“arrange my song”</span>.</li>
          </ol>
        </div>
      )}
    </aside>
  );
}

