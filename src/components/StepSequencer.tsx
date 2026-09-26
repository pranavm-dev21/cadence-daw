import { DRUM_LANES, Note, STEPS_PER_BAR, uid } from "../types";
import { genDrums, mulberry32 } from "../theory";
import { useStore } from "../state/store";
import { useEditorClip } from "../state/useEditorClip";
import { audio } from "../core";
import { IconDice, IconEraser } from "./icons";

const LANE_COLORS = ["#ff6f61", "#ffb45e", "#00f5ff", "#35e0c2", "#a78bfa"];
const LANE_KEYS = ["Z", "X", "C", "V", "B"];
const CELL_W = 25;
const LABEL_W = 132;

export default function StepSequencer() {
  const { state, apply } = useStore();
  const ec = useEditorClip();
  if (!ec || ec.track.instrument !== "drumkit") return null;
  const { track, clip } = ec;
  const steps = clip.lengthBars * STEPS_PER_BAR;

  const setNotes = (notes: Note[], label: string, extra?: { lengthBars?: number; name?: string }) =>
    apply(label, [{ op: "set_clip_content", clipId: clip.id, notes, ...extra }]);

  const cellNote = (lane: number, s: number) => clip.notes.find((n) => n.pitch === lane && n.start === s);

  const cycleCell = (lane: number, s: number) => {
    const existing = cellNote(lane, s);
    if (!existing) {
      setNotes([...clip.notes, { id: uid("n"), pitch: lane, start: s, dur: 1, vel: 0.85 }], "Add drum hit");
    } else if (existing.vel < 1) {
      setNotes(clip.notes.map((n) => (n.id === existing.id ? { ...n, vel: 1 } : n)), "Accent drum hit");
    } else {
      setNotes(clip.notes.filter((n) => n.id !== existing.id), "Remove drum hit");
    }
  };

  const variation = () => {
    const rng = mulberry32((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
    const energy = Math.floor(rng() * 3);
    setNotes(genDrums(rng, energy, clip.lengthBars), `Generate drum variation (energy ${energy + 1}/3)`);
  };

  return (
    <div className="panel flex-1 min-h-0 flex flex-col anim-fade-up" style={{ animationDelay: "120ms" }}>
      {/* toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-ink-700/70 shrink-0 flex-wrap">
        <span className="panel-title">Step Sequencer</span>
        <span className="w-2 h-2 rounded-[3px]" style={{ background: track.color }} />
        <input
          key={clip.name}
          defaultValue={clip.name}
          onBlur={(e) => e.target.value.trim() && e.target.value !== clip.name && apply("Rename clip", [{ op: "set_clip_content", clipId: clip.id, notes: clip.notes, name: e.target.value.trim() }])}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="bg-ink-800 border border-ink-700 rounded-md px-2 py-1 text-[12px] font-semibold w-28 focus:outline-none focus:border-amber-glow/60"
          aria-label="Clip name"
        />
        <div className="flex items-center gap-1 text-[11px] text-ink-400">
          Length
          {[1, 2, 4].map((b) => (
            <button
              key={b}
              onClick={() => setNotes(clip.notes.filter((n) => n.start < b * STEPS_PER_BAR), `Clip length ${b} bar${b > 1 ? "s" : ""}`, { lengthBars: b })}
              className={`px-2 py-0.5 rounded-md font-mono border transition-colors ${clip.lengthBars === b ? "border-amber-glow/60 text-amber-glow bg-amber-glow/10" : "border-ink-700 text-ink-400 hover:text-ink-100"}`}
            >
              {b}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <span className="text-[10px] text-ink-400 hidden xl:block">click = hit · click again = accent · right-click = erase · keys Z X C V B play pads</span>
        <button className="btn py-1! px-2! text-[11px]!" onClick={variation} title="Generate a fresh groove (undoable)">
          <IconDice size={13} /> Variation
        </button>
        <button className="btn btn-ghost btn-danger py-1! px-2! text-[11px]!" onClick={() => setNotes([], "Clear pattern")} title="Clear all hits">
          <IconEraser size={13} /> Clear
        </button>
      </div>

      {/* grid */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="min-w-max py-2">
          {/* bar ruler */}
          <div className="flex" style={{ paddingLeft: LABEL_W }}>
            {Array.from({ length: clip.lengthBars * 4 }, (_, i) => (
              <div key={i} className={`font-mono text-[9px] px-1 pb-1 ${i % 4 === 0 ? "text-amber-glow/80" : "text-ink-400/50"}`} style={{ width: CELL_W * 4 }}>
                {i % 4 === 0 ? `bar ${Math.floor(i / 4) + 1}` : ""}
              </div>
            ))}
          </div>

          {DRUM_LANES.map((laneName, lane) => (
            <div key={laneName} className="flex items-stretch group/lane">
              {/* lane label / pad */}
              <button
                onMouseDown={() => audio.previewNote(track.id, lane, 0.95, 0.5)}
                className="shrink-0 sticky left-0 z-10 bg-ink-850 group-hover/lane:bg-ink-800 border-r border-ink-700 flex items-center gap-2 px-3 transition-all duration-100 active:bg-ink-750"
                style={{ width: LABEL_W, boxShadow: `inset 3px 0 0 ${LANE_COLORS[lane]}` }}
                title={`Play ${laneName} (key ${LANE_KEYS[lane]})`}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: LANE_COLORS[lane], boxShadow: `0 0 8px ${LANE_COLORS[lane]}66` }} />
                <span className="text-[12px] font-semibold text-ink-200 flex-1 text-left">{laneName}</span>
                <span className="key-cap relative bottom-0 right-0">{LANE_KEYS[lane]}</span>
              </button>

              {/* steps */}
              <div className="flex py-[3px]">
                {Array.from({ length: steps }, (_, s) => {
                  const n = cellNote(lane, s);
                  const beatStart = s % 4 === 0;
                  const barStart = s % 16 === 0;
                  const altBar = Math.floor(s / 16) % 2 === 1;
                  return (
                    <div
                      key={s}
                      onClick={() => cycleCell(lane, s)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        if (n) setNotes(clip.notes.filter((x) => x.id !== n.id), "Remove drum hit");
                      }}
                      title={n ? (n.vel >= 1 ? "Accented hit — click to erase" : "Hit — click to accent") : "Click to add a hit"}
                      className="cursor-pointer transition-all duration-100 hover:scale-y-110"
                      style={{
                        width: CELL_W - 2,
                        height: 30,
                        margin: "0 1px",
                        borderRadius: 4,
                        borderLeft: barStart ? "2px solid var(--color-ink-600)" : beatStart ? "2px solid var(--color-ink-750)" : "2px solid transparent",
                        background: n
                          ? n.vel >= 1
                            ? `linear-gradient(180deg, #fff3, ${LANE_COLORS[lane]})`
                            : `${LANE_COLORS[lane]}b8`
                          : altBar
                            ? "rgba(18,22,29,0.9)"
                            : "rgba(28,34,48,0.75)",
                        boxShadow: n ? (n.vel >= 1 ? `0 0 12px ${LANE_COLORS[lane]}aa, inset 0 1px 0 #fff5` : `inset 0 1px 0 #fff3`) : "inset 0 1px 3px rgba(0,0,0,0.5)",
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ))}

          {clip.notes.length === 0 && (
            <div className="text-center text-[11px] text-ink-400 py-3">
              Empty pattern — click cells to build a beat, or hit <span className="text-amber-glow font-semibold">Variation</span>, or ask the copilot “make a beat”.
            </div>
          )}
        </div>
      </div>

      {/* status strip */}
      <div className="px-3 py-1.5 border-t border-ink-700/70 text-[10px] font-mono text-ink-400 flex gap-4 shrink-0">
        <span>{clip.notes.length} hits</span>
        <span>{clip.lengthBars} bar{clip.lengthBars > 1 ? "s" : ""}</span>
        <span className="text-teal/80">{state.project.bpm} BPM grid</span>
      </div>
    </div>
  );
}
