/* Piano Roll — the note editor.
 *
 * Rendered on <canvas> so clips with hundreds of notes stay at 60 fps: only
 * notes inside the scroll viewport are drawn, and a single rAF loop drives
 * the transport-synced playhead, marquee animation and drag previews.
 *
 * Interaction model (all edits commit through the command bus → one undo entry):
 *   · click empty cell        draw a note (length = "Note" selector)
 *   · drag on empty           draw a note, length follows the pointer
 *   · drag a note             move (pitch + time) — Alt duplicates, Shift multi-selects
 *   · drag a note's right edge  resize
 *   · shift-drag on empty     marquee multi-select
 *   · velocity lane below     drag vertically to paint loudness (acts on the selection)
 *   · right-click             erase
 *   · arrows nudge · Del removes · Ctrl+D duplicates · Ctrl+A selects all
 *
 * Grid snapping has a configurable resolution (1/1 … 1/16); scale-lock grays out
 * off-scale rows and constrains new notes to the project key. The playhead is
 * derived from the audio clock via audio.getCurrentStep(), never a UI timer. */

import { useCallback, useEffect, useRef, useState } from "react";
import { Note, STEPS_PER_BAR, midiName, uid } from "../types";
import { SCALES, genMelody, mulberry32 } from "../theory";
import { useStore } from "../state/store";
import { useEditorClip } from "../state/useEditorClip";
import { audio, QUANTIZE_GRIDS, quantizeAppNotes } from "../core";
import { applyStrum, applyArp, applyHumanize, applyFlam, CHORD_TEMPLATES } from "../core/proTools";
import { IconEraser, IconMinus, IconPlus, IconSparkles, IconZap } from "./icons";

const KEY_W = 64;
const ROW_H = 20;
const RULER_H = 20;
const VEL_H = 78;
const RESIZE_ZONE = 7;
const ACCENT = "#00f5ff";
const MINT = "#35e0c2";

type DragMode = "none" | "draw" | "move" | "resize" | "marquee" | "vel";

interface Drag {
  mode: DragMode;
  x0: number;
  y0: number;
  moved: boolean;
  snap: Note[]; // notes at pointer-down (deep copy)
  ids: string[]; // affected note ids
  drawId: string | null;
  selBefore: Set<string>;
}

interface ViewState {
  cellW: number;
  hi: number;
  lo: number;
  totalSteps: number;
  scrollX: number;
  scrollY: number;
  viewW: number;
  viewH: number;
  scaleLock: boolean;
  snapGrid: number;
  inScale: (midi: number) => boolean;
  rootMidi: number;
  /* fresh-per-render data consumed by the persistent rAF loop (avoids stale closures) */
  notes: Note[];
  trackColor: string;
  placementBar: number; // first timeline placement of the open clip, or -1
}

const SNAP_GRIDS: { steps: number; label: string }[] = [
  { steps: 16, label: "1/1" },
  { steps: 8, label: "1/2" },
  { steps: 4, label: "1/4" },
  { steps: 2, label: "1/8" },
  { steps: 1, label: "1/16" },
];
const NOTE_LENGTHS: [number, string][] = [[1, "1/16"], [2, "1/8"], [4, "1/4"], [8, "1/2"]];
const KEYCAPS: Record<number, string> = { 0: "A", 1: "W", 2: "S", 3: "E", 4: "D", 5: "F", 6: "T", 7: "G", 8: "Y", 9: "H", 10: "U", 11: "J", 12: "K", 13: "O", 14: "L", 15: "P" };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export default function PianoRoll() {
  const { state, apply, gate } = useStore();
  const ec = useEditorClip();
  const extended = gate("producer");

  const [zoom, setZoom] = useState(22);
  const [noteLen, setNoteLen] = useState(2);
  const [snapGrid, setSnapGrid] = useState(1);
  const [scaleLock, setScaleLock] = useState(true);
  const [follow, setFollow] = useState(true);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [qGrid, setQGrid] = useState(1);
  const [qStrength, setQStrength] = useState(100);
  const [qSwing, setQSwing] = useState(0);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const velScrollerRef = useRef<HTMLDivElement>(null);
  const keyColRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const velCanvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const dragRef = useRef<Drag>({ mode: "none", x0: 0, y0: 0, moved: false, snap: [], ids: [], drawId: null, selBefore: new Set() });
  const previewRef = useRef<Note[] | null>(null);
  const selRef = useRef<Set<string>>(selection);
  const hoverRef = useRef<string | null>(null);
  const cursorRef = useRef<number>(-1); // clip-relative step, -1 = off
  const dirtyRef = useRef(true);
  const viewRef = useRef<ViewState | null>(null);
  const followRef = useRef(follow);
  selRef.current = selection;
  followRef.current = follow;

  const markDirty = useCallback(() => { dirtyRef.current = true; }, []);

  /* ---------------- geometry & scales ---------------- */

  const hasClip = !!ec && ec.track.instrument !== "drumkit";
  const track = ec?.track;
  const clip = ec?.clip;
  const p = state.project;

  const totalSteps = clip ? clip.lengthBars * STEPS_PER_BAR : 16;
  const hi = p.rootMidi + 27;
  const lo = track ? (track.instrument === "bass" ? p.rootMidi - 15 : p.rootMidi - 2) : p.rootMidi - 2;
  const rowCount = hi - lo + 1;

  const inScale = useCallback(
    (midi: number) => SCALES[p.scale].includes(((midi - p.rootMidi) % 12 + 12) % 12),
    [p.scale, p.rootMidi],
  );
  const snapPitch = useCallback(
    (midi: number) => {
      if (!scaleLock || inScale(midi)) return midi;
      for (let d = 1; d <= 3; d++) {
        if (inScale(midi + d)) return midi + d;
        if (inScale(midi - d)) return midi - d;
      }
      return midi;
    },
    [scaleLock, inScale],
  );

  /* keep view params + fresh data readable from the persistent rAF loop. Assigning
   * during render means the loop (created once) always sees current notes, color
   * and placement — no stale-closure repaints. */
  viewRef.current = hasClip
    ? {
        cellW: zoom,
        hi,
        lo,
        totalSteps,
        scrollX: scrollerRef.current?.scrollLeft ?? 0,
        scrollY: scrollerRef.current?.scrollTop ?? 0,
        viewW: scrollerRef.current?.clientWidth ?? 0,
        viewH: scrollerRef.current?.clientHeight ?? 0,
        scaleLock,
        snapGrid,
        inScale,
        rootMidi: p.rootMidi,
        notes: clip?.notes ?? [],
        trackColor: track?.color ?? "#58b7f5",
        placementBar: track?.placements.find((pl) => pl.clipId === clip?.id)?.bar ?? -1,
      }
    : null;

  /* ---------------- commit helper ---------------- */

  const setNotes = useCallback(
    (notes: Note[], label: string, extra?: { lengthBars?: number; name?: string }) => {
      if (!clip) return;
      apply(label, [{ op: "set_clip_content", clipId: clip.id, notes, ...extra }]);
    },
    [apply, clip],
  );

  const doQuantize = () => {
    if (!clip || clip.notes.length === 0) return;
    const gridLabel = QUANTIZE_GRIDS.find((g) => g.steps === qGrid)?.label ?? `${qGrid}`;
    setNotes(quantizeAppNotes(clip.notes, { grid: qGrid, strength: qStrength / 100, swing: qSwing / 100 }), `Quantize to ${gridLabel} @ ${qStrength}%${qSwing ? ` · swing ${qSwing}%` : ""}`);
    markDirty();
  };

  const suggest = () => {
    if (!clip || !track) return;
    const rng = mulberry32((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
    setNotes(genMelody(rng, p.rootMidi, p.scale, clip.lengthBars, 1), "Copilot: sketch melody");
    setSelection(new Set());
    markDirty();
  };

  const getTargetNotes = () => {
    if (!clip) return [];
    if (selection.size > 0) return clip.notes.filter((n) => selection.has(n.id));
    return [...clip.notes];
  };

  const doStrum = () => {
    if (!clip || clip.notes.length === 0) return;
    const target = getTargetNotes();
    const targetIds = new Set(target.map((n) => n.id));
    const strummed = applyStrum(target, 0.25, "up");
    const otherNotes = clip.notes.filter((n) => !targetIds.has(n.id));
    setNotes([...otherNotes, ...strummed], "Strum notes");
    markDirty();
  };

  const doArp = () => {
    if (!clip || clip.notes.length === 0) return;
    const target = getTargetNotes();
    const targetIds = new Set(target.map((n) => n.id));
    const arped = applyArp(target, "up", snapGrid, 1);
    const otherNotes = clip.notes.filter((n) => !targetIds.has(n.id));
    setNotes([...otherNotes, ...arped], "Arpeggiate notes");
    markDirty();
  };

  const doHumanize = () => {
    if (!clip || clip.notes.length === 0) return;
    const target = getTargetNotes();
    const targetIds = new Set(target.map((n) => n.id));
    const humanized = applyHumanize(target, 0.08, 0.12);
    const otherNotes = clip.notes.filter((n) => !targetIds.has(n.id));
    setNotes([...otherNotes, ...humanized], "Humanize velocity & timing");
    markDirty();
  };

  const doFlam = () => {
    if (!clip || clip.notes.length === 0) return;
    const target = getTargetNotes();
    const targetIds = new Set(target.map((n) => n.id));
    const flammed = applyFlam(target, 0.25, 0.6);
    const otherNotes = clip.notes.filter((n) => !targetIds.has(n.id));
    setNotes([...otherNotes, ...flammed], "Add flam grace notes");
    markDirty();
  };

  const stampChord = (templateName: string) => {
    if (!clip) return;
    const t = CHORD_TEMPLATES.find((x) => x.name === templateName) || CHORD_TEMPLATES[0];
    const root = p.rootMidi + 12; // C4 default or root
    const step = Math.floor(audio.getCurrentStep()) % (clip.lengthBars * 16);
    const newNotes: Note[] = t.intervals.map((semitone) => ({
      id: uid("n"),
      pitch: root + semitone,
      start: step,
      dur: 4,
      vel: 0.85,
    }));
    setNotes([...clip.notes, ...newNotes], `Stamp ${t.name}`);
    markDirty();
  };

  /* ---------------- canvas sizing + render loop ---------------- */

  useEffect(() => {
    if (!hasClip) return;
    const cv = canvasRef.current;
    const vv = velCanvasRef.current;
    if (!cv || !vv) return;
    const dpr = window.devicePixelRatio || 1;
    const w = totalSteps * zoom;
    const h = RULER_H + rowCount * ROW_H;
    cv.style.width = `${w}px`;
    cv.style.height = `${h}px`;
    cv.width = Math.ceil(w * dpr);
    cv.height = Math.ceil(h * dpr);
    vv.style.width = `${w}px`;
    vv.style.height = `${VEL_H}px`;
    vv.width = Math.ceil(w * dpr);
    vv.height = Math.ceil(VEL_H * dpr);
    markDirty();
  }, [hasClip, totalSteps, zoom, rowCount, markDirty]);

  /* transport-synced playhead: read the audio clock, map to clip position.
   * Reads viewRef each frame so it tracks the current clip/placement without
   * re-subscribing. */
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const v = viewRef.current;
      if (v) {
        let c = -1;
        if (v.placementBar >= 0) {
          const rel = audio.getCurrentStep() - v.placementBar * STEPS_PER_BAR;
          if (rel >= 0 && rel < v.totalSteps) c = rel;
        }
        if (c !== cursorRef.current) {
          cursorRef.current = c;
          dirtyRef.current = true;
          if (followRef.current && c >= 0 && scrollerRef.current) {
            const x = c * v.cellW;
            const { scrollLeft, clientWidth } = scrollerRef.current;
            if (x < scrollLeft + clientWidth * 0.12 || x > scrollLeft + clientWidth * 0.85) {
              scrollerRef.current.scrollLeft = Math.max(0, x - clientWidth * 0.3);
            }
          }
        }
      }
      if (audio.playing) dirtyRef.current = true; // marquee dash + glow stay alive
      if (dirtyRef.current) {
        dirtyRef.current = false;
        draw();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasClip]);

  /* reset the playhead when the open clip changes */
  useEffect(() => {
    cursorRef.current = -1;
    markDirty();
  }, [clip?.id, markDirty]);

  /* ---------------- drawing ---------------- */

  const draw = () => {
    const v = viewRef.current;
    const cv = canvasRef.current;
    const vv = velCanvasRef.current;
    if (!v || !cv || !vv) return;
    const dpr = window.devicePixelRatio || 1;
    const ctx = cv.getContext("2d");
    const vctx = vv.getContext("2d");
    if (!ctx || !vctx) return;

    const { cellW, hi: hiP, lo: loP, totalSteps: steps } = v;
    const W = steps * cellW;
    const H = RULER_H + (hiP - loP + 1) * ROW_H;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    vctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    /* ---- note canvas ---- */
    ctx.clearRect(0, 0, W, H);

    // ruler
    ctx.fillStyle = "rgba(9,11,14,0.92)";
    ctx.fillRect(0, 0, W, RULER_H);
    ctx.font = "9px 'IBM Plex Mono', monospace";
    for (let bar = 0; bar * 16 < steps; bar++) {
      const x = bar * 16 * cellW;
      ctx.fillStyle = "rgba(0,245,255,0.75)";
      ctx.fillText(`${bar + 1}`, x + 4, 13);
      ctx.fillStyle = "rgba(148,163,184,0.28)";
      ctx.fillRect(x, 0, 1, RULER_H);
      for (let b = 1; b < 4; b++) {
        ctx.fillStyle = "rgba(148,163,184,0.12)";
        ctx.fillRect(x + b * 4 * cellW, RULER_H - 6, 1, 6);
      }
    }

    // rows: scale shading, root tint, zebra per bar
    for (let midi = hiP; midi >= loP; midi--) {
      const y = RULER_H + (hiP - midi) * ROW_H;
      const on = v.inScale(midi);
      if (v.scaleLock && !on) {
        ctx.fillStyle = "rgba(4,6,9,0.5)"; // gray out off-scale rows
        ctx.fillRect(0, y, W, ROW_H);
      } else if (((midi - v.rootMidi) % 12 + 12) % 12 === 0) {
        ctx.fillStyle = "rgba(0,245,255,0.05)";
        ctx.fillRect(0, y, W, ROW_H);
      }
      ctx.fillStyle = "rgba(148,163,184,0.055)";
      ctx.fillRect(0, y + ROW_H - 1, W, 1);
    }
    // vertical grid: beats + bars
    for (let s = 0; s <= steps; s++) {
      const x = s * cellW;
      if (s % 16 === 0) ctx.fillStyle = "rgba(148,163,184,0.22)";
      else if (s % 4 === 0) ctx.fillStyle = "rgba(148,163,184,0.10)";
      else if (cellW >= 16) ctx.fillStyle = "rgba(148,163,184,0.045)";
      else continue;
      ctx.fillRect(x, RULER_H, 1, H - RULER_H);
    }

    // notes (culled to the visible viewport)
    const notes = previewRef.current ?? v.notes;
    const sel = selRef.current;
    const xMin = v.scrollX - cellW * 2;
    const xMax = v.scrollX + v.viewW + cellW * 2;
    const t = performance.now();
    for (const n of notes) {
      const x = n.start * cellW;
      const w = Math.max(5, n.dur * cellW - 2);
      if (x + w < xMin || x > xMax) continue;
      const y = RULER_H + (hiP - n.pitch) * ROW_H + 2;
      if (y < RULER_H - ROW_H || y > H) continue;
      const h = ROW_H - 4;
      const selected = sel.has(n.id);
      const hovered = hoverRef.current === n.id && !selected;
      const offScale = v.scaleLock && !v.inScale(n.pitch);
      const alpha = 0.35 + n.vel * 0.65;

      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 3);
      if (offScale) {
        ctx.fillStyle = `rgba(120,128,145,${alpha * 0.4})`;
        ctx.fill();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = "rgba(255,111,97,0.55)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);
        continue;
      }
      ctx.fillStyle = selected ? hexA(ACCENT, alpha) : hexA(v.trackColor, alpha);
      if (selected) {
        ctx.shadowColor = ACCENT;
        ctx.shadowBlur = 9;
      }
      ctx.fill();
      ctx.shadowBlur = 0;
      // velocity sheen
      ctx.fillStyle = `rgba(255,255,255,${0.10 + n.vel * 0.22})`;
      ctx.fillRect(x, y, w, 2);
      ctx.strokeStyle = selected ? "rgba(255,255,255,0.85)" : hovered ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)";
      ctx.lineWidth = selected ? 1.4 : 1;
      ctx.stroke();
      if (hovered) {
        ctx.fillStyle = "rgba(255,255,255,0.14)";
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 3);
        ctx.fill();
      }
    }

    // marquee
    const d = dragRef.current;
    if (d.mode === "marquee" && d.moved) {
      const mx = Math.min(d.x0, lastPointer.x);
      const my = Math.min(d.y0, lastPointer.y);
      const mw = Math.abs(lastPointer.x - d.x0);
      const mh = Math.abs(lastPointer.y - d.y0);
      ctx.fillStyle = "rgba(0,245,255,0.07)";
      ctx.fillRect(mx, my, mw, mh);
      ctx.setLineDash([5, 4]);
      ctx.lineDashOffset = -t / 40;
      ctx.strokeStyle = "rgba(0,245,255,0.8)";
      ctx.lineWidth = 1;
      ctx.strokeRect(mx, my, mw, mh);
      ctx.setLineDash([]);
    }

    // playhead
    const c = cursorRef.current;
    if (c >= 0) {
      const x = c * cellW;
      const grad = ctx.createLinearGradient(x - 8, 0, x + 8, 0);
      grad.addColorStop(0, "rgba(0,245,255,0)");
      grad.addColorStop(0.5, "rgba(0,245,255,0.16)");
      grad.addColorStop(1, "rgba(0,245,255,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(x - 8, 0, 16, H);
      ctx.fillStyle = ACCENT;
      ctx.fillRect(x - 1, 0, 2, H);
      ctx.beginPath();
      ctx.moveTo(x - 5, 0);
      ctx.lineTo(x + 5, 0);
      ctx.lineTo(x, 8);
      ctx.closePath();
      ctx.fill();
    }

    /* ---- velocity lane ---- */
    vctx.clearRect(0, 0, W, VEL_H);
    vctx.fillStyle = "rgba(9,11,14,0.7)";
    vctx.fillRect(0, 0, W, VEL_H);
    for (let s = 0; s <= steps; s += 4) {
      vctx.fillStyle = s % 16 === 0 ? "rgba(148,163,184,0.2)" : "rgba(148,163,184,0.08)";
      vctx.fillRect(s * cellW, 0, 1, VEL_H);
    }
    vctx.fillStyle = "rgba(148,163,184,0.12)";
    vctx.fillRect(0, VEL_H - 12, W, 1);
    for (const n of notes) {
      const x = n.start * cellW;
      const w = Math.max(4, n.dur * cellW - 2);
      if (x + w < xMin || x > xMax) continue;
      const bh = Math.max(3, n.vel * (VEL_H - 20));
      const selected = sel.has(n.id);
      const y = VEL_H - 12 - bh;
      vctx.fillStyle = selected ? hexA(ACCENT, 0.55 + n.vel * 0.45) : hexA(v.trackColor, 0.3 + n.vel * 0.6);
      vctx.beginPath();
      vctx.roundRect(x, y, w, bh, 2);
      vctx.fill();
      vctx.fillStyle = selected ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.45)";
      vctx.fillRect(x, y, w, 2);
    }
  };

  /* ---------------- pointer interaction ---------------- */

  const lastPointer = useRef({ x: 0, y: 0 }).current;

  const toContent = (e: React.PointerEvent | React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const stepOf = (x: number) => x / (viewRef.current?.cellW ?? 22);
  const pitchOf = (y: number) => {
    const v = viewRef.current!;
    return v.hi - Math.floor((y - RULER_H) / ROW_H);
  };
  const snapStep = (s: number, grid: number, on: boolean) => (on ? Math.round(s / grid) * grid : Math.round(s * 4) / 4);

  const hitNote = (x: number, y: number, notes: Note[]): { n: Note; edge: boolean } | null => {
    const v = viewRef.current!;
    const pitch = pitchOf(y);
    for (let i = notes.length - 1; i >= 0; i--) {
      const n = notes[i];
      if (n.pitch !== pitch) continue;
      const x0 = n.start * v.cellW;
      const x1 = (n.start + n.dur) * v.cellW;
      if (x >= x0 && x < x1) return { n, edge: x > x1 - RESIZE_ZONE };
    }
    return null;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!clip || !track) return;
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    wrapperRef.current?.focus();
    const { x, y } = toContent(e);
    const v = viewRef.current!;
    lastPointer.x = x;
    lastPointer.y = y;
    const d = dragRef.current;
    d.snap = clip.notes.map((n) => ({ ...n }));
    d.x0 = x;
    d.y0 = y;
    d.moved = false;
    d.selBefore = new Set(selRef.current);
    d.drawId = null;
    d.ids = [];

    if (e.button === 2) {
      const hit = hitNote(x, y, clip.notes);
      if (hit) {
        setNotes(clip.notes.filter((n) => n.id !== hit.n.id), "Erase note");
        markDirty();
      }
      d.mode = "none";
      return;
    }

    const hit = hitNote(x, y, clip.notes);

    if (hit) {
      if (hit.edge) {
        d.mode = "resize";
        d.ids = selRef.current.has(hit.n.id) ? [...selRef.current] : [hit.n.id];
        if (!selRef.current.has(hit.n.id)) setSelection(new Set([hit.n.id]));
      } else if (e.shiftKey) {
        d.mode = "move";
        const next = new Set(selRef.current);
        if (next.has(hit.n.id)) next.delete(hit.n.id);
        else next.add(hit.n.id);
        setSelection(next);
        d.ids = [...next];
      } else if (e.altKey) {
        // duplicate + drag the copies
        d.mode = "move";
        const copies = d.snap
          .filter((n) => (selRef.current.size ? selRef.current.has(n.id) : n.id === hit.n.id))
          .map((n) => ({ ...n, id: uid("n") }));
        previewRef.current = [...d.snap, ...copies];
        d.ids = copies.map((n) => n.id);
        d.snap = previewRef.current.map((n) => ({ ...n }));
        setSelection(new Set(d.ids));
      } else {
        d.mode = "move";
        if (!selRef.current.has(hit.n.id)) setSelection(new Set([hit.n.id]));
        d.ids = selRef.current.has(hit.n.id) ? [...selRef.current] : [hit.n.id];
      }
    } else if (e.shiftKey) {
      d.mode = "marquee";
    } else {
      // draw a note; horizontal drag sizes it
      const start = clamp(snapStep(stepOf(x), Math.max(1, snapGrid), !e.altKey), 0, v.totalSteps - 1);
      const pitch = clamp(snapPitch(pitchOf(y)), 0, 127);
      const note: Note = { id: uid("n"), pitch, start, dur: Math.max(1, noteLen), vel: e.ctrlKey || e.metaKey ? 1 : 0.85 };
      d.mode = "draw";
      d.drawId = note.id;
      d.ids = [note.id];
      previewRef.current = [...clip.notes, note];
      d.snap = previewRef.current.map((n) => ({ ...n })); // include the new note in the drag snapshot
      markDirty();
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!clip) return;
    const d = dragRef.current;
    // velocity-lane drags measure against the velocity canvas, note drags against the grid
    const src = d.mode === "vel" ? velCanvasRef.current! : canvasRef.current!;
    const rect = src.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    lastPointer.x = x;
    lastPointer.y = y;
    const v = viewRef.current!;

    if (d.mode === "none") {
      // hover feedback + cursor shaping (only repaint when the hovered note changes)
      const hit = hitNote(x, y, previewRef.current ?? clip.notes);
      const hid = hit?.n.id ?? null;
      const cv = canvasRef.current!;
      cv.style.cursor = hit ? (hit.edge ? "ew-resize" : "grab") : "crosshair";
      if (hoverRef.current !== hid) {
        hoverRef.current = hid;
        markDirty();
      }
      return;
    }

    if (Math.hypot(x - d.x0, y - d.y0) > 3) d.moved = true;
    const gridOn = !e.altKey;

    if (d.mode === "draw" && d.drawId) {
      const n0 = d.snap.find((n) => n.id === d.drawId)!;
      const g = Math.max(1, snapGrid);
      const dur = clamp(Math.max(g, Math.round((stepOf(x) - n0.start) / g) * g), 1, v.totalSteps - n0.start);
      previewRef.current = d.snap.map((n) => (n.id === d.drawId ? { ...n, dur } : n));
    } else if (d.mode === "move") {
      const dStep = gridOn ? Math.round(stepOf(x - d.x0) / snapGrid) * snapGrid : Math.round(stepOf(x - d.x0) * 4) / 4;
      const dPitch = Math.round((d.y0 - y) / ROW_H);
      previewRef.current = d.snap.map((n) =>
        d.ids.includes(n.id)
          ? { ...n, start: clamp(n.start + dStep, 0, v.totalSteps - 0.25), pitch: clamp(n.pitch + dPitch, 0, 127) }
          : n,
      );
    } else if (d.mode === "resize") {
      previewRef.current = d.snap.map((n) =>
        d.ids.includes(n.id)
          ? { ...n, dur: clamp(Math.max(1, Math.round(n.start + n.dur + stepOf(x - d.x0))), 1, v.totalSteps - n.start) }
          : n,
      );
    } else if (d.mode === "marquee") {
      const s0 = stepOf(Math.min(d.x0, x));
      const s1 = stepOf(Math.max(d.x0, x));
      const p0 = pitchOf(Math.max(d.y0, y));
      const p1 = pitchOf(Math.min(d.y0, y));
      const next = new Set(d.selBefore);
      for (const n of clip.notes) {
        if (n.start + n.dur >= s0 && n.start <= s1 && n.pitch >= p0 && n.pitch <= p1) next.add(n.id);
      }
      setSelection(next);
    } else if (d.mode === "vel") {
      const vel = clamp(1 - y / (VEL_H - 12), 0.05, 1);
      previewRef.current = d.snap.map((n) => (d.ids.includes(n.id) ? { ...n, vel } : n));
    }
    markDirty();
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!clip || !track) return;
    const d = dragRef.current;
    const preview = previewRef.current;
    previewRef.current = null;
    hoverRef.current = null;

    if (d.mode === "draw" && d.drawId && preview) {
      const note = preview.find((n) => n.id === d.drawId)!;
      setNotes(preview, "Draw note");
      audio.previewNote(track.id, note.pitch, 0.8, 0.35);
    } else if ((d.mode === "move" || d.mode === "resize") && preview) {
      if (d.moved) {
        const verb = d.mode === "resize" ? "Resize notes" : d.snap.length > clip.notes.length ? "Duplicate notes" : `Move ${d.ids.length > 1 ? `${d.ids.length} notes` : "note"}`;
        setNotes(preview, verb);
      }
    } else if (d.mode === "vel" && preview && d.moved) {
      setNotes(preview, `Edit velocity (${d.ids.length} note${d.ids.length > 1 ? "s" : ""})`);
    }
    d.mode = "none";
    d.ids = [];
    markDirty();
    void e;
  };

  const onVelPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!clip) return;
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    const rect = velCanvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const step = stepOf(x);
    const under = clip.notes.filter((n) => step >= n.start && step < n.start + n.dur);
    const d = dragRef.current;
    d.mode = "vel";
    d.x0 = x;
    d.y0 = y;
    d.moved = true;
    d.snap = clip.notes.map((n) => ({ ...n }));
    const useSel = selRef.current.size > 0 && under.some((n) => selRef.current.has(n.id));
    d.ids = useSel ? [...selRef.current] : under.map((n) => n.id);
    const vel = clamp(1 - y / (VEL_H - 12), 0.05, 1);
    previewRef.current = d.snap.map((n) => (d.ids.includes(n.id) ? { ...n, vel } : n));
    markDirty();
  };

  /* ---------------- keyboard: group editing ---------------- */

  const onKey = (e: React.KeyboardEvent) => {
    if (!clip) return;
    const sel = selRef.current;
    const notes = clip.notes;
    const has = notes.some((n) => sel.has(n.id));
    const mod = e.ctrlKey || e.metaKey;

    if (e.key === "Escape") {
      setSelection(new Set());
      markDirty();
      return;
    }
    if (mod && e.key.toLowerCase() === "a") {
      e.preventDefault();
      setSelection(new Set(notes.map((n) => n.id)));
      markDirty();
      return;
    }
    if (mod && e.key.toLowerCase() === "d") {
      e.preventDefault();
      if (!has) return;
      const copies = notes.filter((n) => sel.has(n.id)).map((n) => ({ ...n, id: uid("n"), start: clamp(n.start + 16, 0, totalSteps - 1) }));
      setNotes([...notes, ...copies], `Duplicate ${copies.length} note${copies.length > 1 ? "s" : ""}`);
      setSelection(new Set(copies.map((n) => n.id)));
      markDirty();
      return;
    }
    if ((e.key === "Delete" || e.key === "Backspace") && has) {
      e.preventDefault();
      setNotes(notes.filter((n) => !sel.has(n.id)), `Delete ${sel.size} note${sel.size > 1 ? "s" : ""}`);
      setSelection(new Set());
      markDirty();
      return;
    }
    if (e.key.startsWith("Arrow") && has) {
      e.preventDefault();
      const v = viewRef.current!;
      let dStep = 0;
      let dPitch = 0;
      if (e.key === "ArrowLeft") dStep = -(e.shiftKey ? 4 : snapGrid);
      if (e.key === "ArrowRight") dStep = e.shiftKey ? 4 : snapGrid;
      if (e.key === "ArrowUp") dPitch = e.shiftKey ? 12 : 1;
      if (e.key === "ArrowDown") dPitch = e.shiftKey ? -12 : -1;
      setNotes(
        notes.map((n) =>
          sel.has(n.id)
            ? { ...n, start: clamp(n.start + dStep, 0, v.totalSteps - 0.25), pitch: clamp(n.pitch + dPitch, 0, 127) }
            : n,
        ),
        "Nudge notes",
      );
      markDirty();
    }
  };

  /* ---------------- scroll sync + wheel zoom ---------------- */

  const onScroll = () => {
    const s = scrollerRef.current;
    if (!s) return;
    if (keyColRef.current) keyColRef.current.style.transform = `translateY(${-s.scrollTop}px)`;
    if (velScrollerRef.current) velScrollerRef.current.scrollLeft = s.scrollLeft;
    markDirty();
  };

  useEffect(() => {
    const s = scrollerRef.current;
    if (!s) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setZoom((z) => clamp(Math.round(z + (e.deltaY < 0 ? 3 : -3)), 10, 48));
      }
    };
    s.addEventListener("wheel", onWheel, { passive: false });
    return () => s.removeEventListener("wheel", onWheel);
  }, [hasClip]);

  /* ---------------- render ---------------- */

  if (!hasClip || !track || !clip) return null;
  const rows: number[] = [];
  for (let m = hi; m >= lo; m--) rows.push(m);
  const snapLabel = SNAP_GRIDS.find((g) => g.steps === snapGrid)?.label ?? "";

  const chip = (on: boolean) =>
    `px-2 py-0.5 rounded-md font-mono text-[11px] border transition-all duration-150 ${
      on ? "border-amber-glow/60 text-amber-glow bg-amber-glow/10 shadow-[0_0_10px_rgba(0,245,255,0.15)]" : "border-ink-700 text-ink-400 hover:text-ink-100 hover:border-ink-600"
    }`;

  return (
    <div className="panel flex-1 min-h-0 flex flex-col anim-fade-up" style={{ animationDelay: "120ms" }}>
      {/* toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-ink-700/70 shrink-0 flex-wrap">
        <span className="panel-title">Piano Roll</span>
        <span className="w-2 h-2 rounded-[3px]" style={{ background: track.color, boxShadow: `0 0 8px ${track.color}88` }} />
        <input
          key={clip.name}
          defaultValue={clip.name}
          onBlur={(e) => e.target.value.trim() && e.target.value !== clip.name && setNotes(clip.notes, "Rename clip", { name: e.target.value.trim() })}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="bg-ink-800 border border-ink-700 rounded-md px-2 py-1 text-[12px] font-semibold w-28 focus:outline-none focus:border-amber-glow/60"
          aria-label="Clip name"
        />

        {/* zoom */}
        <div className="flex items-center gap-1">
          <button className="w-6 h-6 flex items-center justify-center rounded border border-ink-700 text-ink-400 hover:text-ink-100 hover:border-ink-600 transition-colors" onClick={() => setZoom((z) => clamp(z - 3, 10, 48))} title="Zoom out (Ctrl+wheel)"><IconMinus size={11} /></button>
          <button className="w-6 h-6 flex items-center justify-center rounded border border-ink-700 text-ink-400 hover:text-ink-100 hover:border-ink-600 transition-colors" onClick={() => setZoom((z) => clamp(z + 3, 10, 48))} title="Zoom in (Ctrl+wheel)"><IconPlus size={11} /></button>
        </div>

        {/* draw length */}
        <div className="flex items-center gap-1 text-[11px] text-ink-400">
          Note
          {NOTE_LENGTHS.map(([v, label]) => (
            <button key={v} onClick={() => setNoteLen(v)} className={chip(noteLen === v)}>{label}</button>
          ))}
        </div>

        {extended && (
          <>
            {/* snap resolution */}
            <div className="flex items-center gap-1 text-[11px] text-ink-400" title="Grid snap resolution — Alt bypasses snapping while dragging">
              Snap
              {SNAP_GRIDS.map((g) => (
                <button key={g.steps} onClick={() => setSnapGrid(g.steps)} className={chip(snapGrid === g.steps)}>{g.label}</button>
              ))}
            </div>

            {/* scale lock */}
            <button
              onClick={() => setScaleLock((s) => !s)}
              title="Scale lock — off-scale rows are grayed out and new notes snap into key"
              className={chip(scaleLock)}
            >
              Scale lock {scaleLock ? "on" : "off"}
            </button>

            {/* quantize */}
            <div className="flex items-center gap-1.5 text-[11px] text-ink-400" title="Quantize note positions">
              <IconZap size={12} className="text-amber-glow" />
              <select value={qGrid} onChange={(e) => setQGrid(Number(e.target.value))} className="bg-ink-800 border border-ink-700 rounded px-1 py-0.5 font-mono text-[11px] text-ink-200 focus:outline-none focus:border-amber-glow/60" aria-label="Quantize grid">
                {QUANTIZE_GRIDS.map((g) => <option key={g.steps} value={g.steps}>{g.label}</option>)}
              </select>
              <label className="flex items-center gap-1 font-mono text-[10px]">str
                <input type="range" min={10} max={100} step={5} value={qStrength} onChange={(e) => setQStrength(Number(e.target.value))} className="w-14 h-3" />
              </label>
              <label className="flex items-center gap-1 font-mono text-[10px]">swg
                <input type="range" min={0} max={100} step={5} value={qSwing} onChange={(e) => setQSwing(Number(e.target.value))} className="w-14 h-3" />
              </label>
              <button className="btn py-0.5! px-2! text-[11px]!" onClick={doQuantize} title="Apply quantize (undoable)">Apply</button>
            </div>

            {/* FL Pro Editing Suite */}
            <div className="flex items-center gap-1 border-l border-ink-700/80 pl-2">
              <select
                onChange={(e) => { if (e.target.value) stampChord(e.target.value); e.target.value = ""; }}
                className="bg-ink-800 border border-ink-700 rounded px-1.5 py-0.5 text-[10px] font-semibold text-amber-glow focus:outline-none"
                title="Stamp chord at playhead"
                defaultValue=""
              >
                <option value="" disabled>+ Chord...</option>
                {CHORD_TEMPLATES.map((t) => (
                  <option key={t.name} value={t.name}>{t.name}</option>
                ))}
              </select>

              <button
                className="btn py-0.5! px-1.5! text-[10px]!"
                onClick={doStrum}
                title="Strum chords — staggers note onsets"
              >
                Strum
              </button>
              <button
                className="btn py-0.5! px-1.5! text-[10px]!"
                onClick={doArp}
                title="Arpeggiate selected notes"
              >
                Arp
              </button>
              <button
                className="btn py-0.5! px-1.5! text-[10px]!"
                onClick={doHumanize}
                title="Humanize micro-timing and velocity"
              >
                Humanize
              </button>
              <button
                className="btn py-0.5! px-1.5! text-[10px]!"
                onClick={doFlam}
                title="Add flam / grace notes"
              >
                Flam
              </button>
            </div>
          </>
        )}

        <button onClick={() => setFollow((f) => !f)} className={chip(follow)} title="Keep the playhead in view while playing">Follow {follow ? "on" : "off"}</button>

        <div className="flex-1" />
        {selection.size > 0 && (
          <span className="text-[10px] font-mono text-amber-glow bg-amber-glow/10 border border-amber-glow/40 rounded-full px-2 py-0.5">
            {selection.size} selected · Del ⌫ · Ctrl+D dup · arrows nudge
          </span>
        )}
        <span className="text-[10px] text-ink-400 hidden 2xl:block">drag = draw/move/resize · shift-drag = select · alt-drag = duplicate · right-click = erase</span>
        <button className="btn py-1! px-2! text-[11px]!" onClick={suggest} title="Let the copilot sketch a melody in key"><IconSparkles size={13} /> Suggest</button>
        <button className="btn btn-ghost btn-danger py-1! px-2! text-[11px]!" onClick={() => { setNotes([], "Clear notes"); setSelection(new Set()); }}><IconEraser size={13} /> Clear</button>
      </div>

      {/* body: key column + note grid + velocity lane */}
      <div
        ref={wrapperRef}
        tabIndex={0}
        onKeyDown={onKey}
        onContextMenu={(e) => e.preventDefault()}
        className="flex-1 min-h-0 flex flex-col focus:outline-none"
      >
        <div className="flex-1 min-h-0 flex">
          {/* piano keys */}
          <div className="shrink-0 w-[64px] overflow-hidden border-r border-ink-700/70 bg-ink-850 relative">
            <div ref={keyColRef} className="absolute top-0 left-0 right-0 will-change-transform">
              {rows.map((midi) => {
                const black = [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);
                const on = inScale(midi);
                const isRoot = ((midi - p.rootMidi) % 12 + 12) % 12 === 0;
                const cap = KEYCAPS[midi - (p.rootMidi + 12)];
                return (
                  <button
                    key={midi}
                    onMouseDown={() => audio.previewNote(track.id, midi, 0.85, 0.6)}
                    className={`w-full flex items-center justify-between px-1.5 border-b border-ink-800 text-[9px] font-mono transition-colors active:bg-amber-glow/25 ${
                      black ? "bg-ink-900 text-ink-400" : "bg-ink-800 text-ink-300"
                    } ${scaleLock && !on ? "opacity-40" : ""}`}
                    style={{ height: ROW_H, boxShadow: isRoot ? `inset 3px 0 0 ${ACCENT}` : undefined }}
                    title={`${midiName(midi)}${scaleLock && !on ? " — outside key" : ""}`}
                  >
                    <span className={isRoot ? "text-amber-glow font-bold" : ""}>{midiName(midi)}</span>
                    {cap && <span className="text-[8px] text-ink-500 border border-ink-700 rounded px-0.5">{cap}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* note grid */}
          <div ref={scrollerRef} onScroll={onScroll} className="flex-1 min-w-0 overflow-auto bg-ink-900/60">
            <canvas
              ref={canvasRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={() => { hoverRef.current = null; markDirty(); }}
              className="block touch-none"
            />
          </div>
        </div>

        {/* velocity lane */}
        <div className="shrink-0 flex border-t border-ink-700/70">
          <div className="shrink-0 w-[64px] bg-ink-850 border-r border-ink-700/70 flex flex-col items-center justify-center gap-0.5" title="Velocity lane — drag bars vertically to set loudness">
            <span className="text-[8px] font-bold tracking-[0.18em] text-ink-400 uppercase">Vel</span>
            <span className="text-[8px] font-mono text-ink-500">drag ↕</span>
          </div>
          <div ref={velScrollerRef} className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden bg-ink-900/60">
            <canvas
              ref={velCanvasRef}
              onPointerDown={onVelPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              className="block touch-none"
              style={{ cursor: "ns-resize" }}
            />
          </div>
        </div>
      </div>

      {/* status strip */}
      <div className="px-3 py-1.5 border-t border-ink-700/70 text-[10px] font-mono text-ink-400 flex gap-4 shrink-0">
        <span>{clip.notes.length} notes</span>
        <span>{clip.lengthBars} bar{clip.lengthBars > 1 ? "s" : ""}</span>
        <span className="text-teal/90">snap {snapLabel}</span>
        <span className={scaleLock ? "text-amber-glow" : ""}>key {midiName(p.rootMidi)} {p.scale}{scaleLock ? " · locked" : ""}</span>
      </div>
    </div>
  );
}

/* ---------------- small helpers ---------------- */

function hexA(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${clamp(a, 0, 1)})`;
}
