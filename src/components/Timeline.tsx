/* Arrangement timeline — track lanes, clip blocks, loop region, markers.
 *
 * Rendering: one canvas per track row (culled to its own strip) + a ruler
 * canvas + DOM overlays for the playhead / loop band / markers / context menu.
 * Every mutation goes through the command bus (one undo entry per gesture);
 * clip *content* is shared with the piano roll, so edits in either view
 * reflect in the other instantly — they read the same clip objects.
 *
 * Playback position comes from the audio clock via audio.getCurrentStep();
 * the playhead never drives timing, it only follows it. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Note, Placement, Project, STEPS_PER_BAR, Track, uid } from "../types";
import { INSTRUMENT_META } from "../types";
import { useStore } from "../state/store";
import { audio } from "../core";
import {
  IconCopy, IconEraser, IconFlag, IconLoop, IconMinus, IconPiano, IconPlus, IconScissors,
} from "./icons";

const HEADER_W = 200;
const MARKER_H = 20;
const RULER_H = 26;
const ROW_H = 52;

const TRACK_COLORS = ["#ff6f61", "#ffb45e", "#3ecfb2", "#58b7f5", "#a78bfa", "#f5a3c9", "#9be15d", "#ffd166"];
const GROUP_TINT: Record<string, string> = { A: "rgba(255,180,94,0.055)", B: "rgba(62,207,178,0.055)", C: "rgba(167,139,250,0.055)" };
const GROUP_BADGE: Record<string, string> = { A: "#ffb45e", B: "#3ecfb2", C: "#a78bfa" };
const ACCENT = "#00f5ff";

type SnapMode = "bar" | "beat" | "grid";
const SNAP_STEPS: Record<SnapMode, number> = { bar: 16, beat: 4, grid: 1 };

type Zone = "body" | "trim-l" | "trim-r" | "fade-in" | "fade-out";

interface DragState {
  mode: "move" | "trim-l" | "trim-r" | "fade-in" | "fade-out" | "loop" | "marker";
  trackId?: string;
  placementId?: string;
  markerId?: string;
  startX: number;
  orig?: Placement;
  origBar?: number; // marker original bar
  anchorBar?: number; // loop drag anchor
  duplicate?: boolean;
  moved?: boolean;
}

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

/** Audible window of a placement in steps. */
const visSteps = (pl: Placement, clipLenBars: number): number => {
  const off = pl.offsetSteps ?? 0;
  const total = clipLenBars * STEPS_PER_BAR;
  return pl.lengthBars !== undefined ? Math.round(pl.lengthBars * STEPS_PER_BAR) : total - off;
};

export default function Timeline() {
  const { state, apply, applySilent, snapshot, selectTrack, setEditorClip, setWorkspaceView, gate } = useStore();
  const p = state.project;
  const producer = gate("producer");

  const [barW, setBarW] = useState(64);
  const [snap, setSnap] = useState<SnapMode>("bar");
  const [follow, setFollow] = useState(false);
  const [selected, setSelected] = useState<{ trackId: string; placementId: string } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; trackId: string; placementId: string } | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; x: number; y: number; value: string } | null>(null);
  const [hoverZone, setHoverZone] = useState<Zone | "ruler" | null>(null);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const rowCanvas = useRef(new Map<string, HTMLCanvasElement>());
  const rulerRef = useRef<HTMLCanvasElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const dirtyRef = useRef(true);
  const loopPreviewRef = useRef<{ startBar: number; endBar: number } | null>(null);
  const movePreviewRef = useRef<{ trackId: string; placementId: string; bar: number } | null>(null);

  const totalSteps = p.lengthBars * STEPS_PER_BAR;
  const W = p.lengthBars * barW;
  const snapSteps = SNAP_STEPS[snap];

  /* keep fresh values readable inside the rAF loop */
  const viewRef = useRef({ p, barW, selected, hoverZone, producer });
  viewRef.current = { p, barW, selected, hoverZone, producer };

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
  }, []);

  /* ---------------- helpers ---------------- */

  const snapBar = useCallback(
    (bar: number): number => Math.max(0, Math.round((bar * STEPS_PER_BAR) / snapSteps) * snapSteps) / STEPS_PER_BAR,
    [snapSteps],
  );

  const findPlacement = useCallback(
    (trackId: string, placementId: string): { track: Track; pl: Placement } | null => {
      const track = p.tracks.find((t) => t.id === trackId);
      const pl = track?.placements.find((x) => x.id === placementId);
      return track && pl ? { track, pl } : null;
    },
    [p],
  );

  /* ---------------- commands ---------------- */

  const updatePlacement = (trackId: string, placementId: string, patch: Record<string, number>, label: string) => {
    apply(label, [{ op: "update_placement", trackId, placementId, patch }]);
    markDirty();
  };

  const splitAtPlayhead = (trackId?: string, placementId?: string) => {
    const tid = trackId ?? selected?.trackId;
    const pid = placementId ?? selected?.placementId;
    if (!tid || !pid) return;
    const hit = findPlacement(tid, pid);
    if (!hit) return;
    const clip = p.clips[hit.pl.clipId];
    if (!clip) return;
    const off = hit.pl.offsetSteps ?? 0;
    const vis = visSteps(hit.pl, clip.lengthBars);
    // split point as a content step, snapped
    const raw = audio.getCurrentStep() - hit.pl.bar * STEPS_PER_BAR + off;
    const k = Math.round(raw / snapSteps) * snapSteps;
    if (k <= off || k >= off + vis) return;
    apply("Split clip at playhead", [{ op: "split_placement", trackId: tid, placementId: pid, atStep: k }]);
    markDirty();
  };

  const duplicatePlacement = (trackId: string, placementId: string, deltaBars: number) => {
    apply("Duplicate clip", [{ op: "duplicate_placement", trackId, placementId, deltaBars }]);
    markDirty();
  };

  const removePlacement = (trackId: string, placementId: string) => {
    apply("Remove clip", [{ op: "remove_placement", trackId, placementId }]);
    setSelected(null);
    markDirty();
  };

  /* ---------------- hit testing ---------------- */

  const hitTest = (track: Track, x: number): { pl: Placement; zone: Zone } | null => {
    const clipLen = (id: string) => p.clips[id]?.lengthBars ?? 1;
    for (const pl of [...track.placements].sort((a, b) => b.bar - a.bar)) {
      const x0 = pl.bar * barW;
      const x1 = x0 + (visSteps(pl, clipLen(pl.clipId)) / STEPS_PER_BAR) * barW;
      if (x < x0 || x > x1) continue;
      if (x - x0 < 7) return { pl, zone: "trim-l" };
      if (x1 - x < 7) return { pl, zone: "trim-r" };
      if (x - x0 < 16) return { pl, zone: "fade-in" };
      if (x1 - x < 16) return { pl, zone: "fade-out" };
      return { pl, zone: "body" };
    }
    return null;
  };

  /* ---------------- pointer interactions ---------------- */

  const onRowPointerDown = (track: Track, e: React.PointerEvent<HTMLCanvasElement>) => {
    if (menu) setMenu(null);
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const hit = hitTest(track, x);
    (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);

    if (!hit) {
      // paint the track's source clip onto the snapped empty bar
      const bar = snapBar(x / barW);
      if (Math.floor(bar) < p.lengthBars) {
        apply(`Place ${p.clips[track.sourceClipId]?.name ?? "clip"}`, [
          { op: "place_clip", trackId: track.id, clipId: track.sourceClipId, bar },
        ]);
        markDirty();
      }
      return;
    }

    setSelected({ trackId: track.id, placementId: hit.pl.id });
    dragRef.current = {
      mode: hit.zone === "body" ? "move" : (hit.zone as DragState["mode"]),
      trackId: track.id,
      placementId: hit.pl.id,
      startX: x,
      orig: { ...hit.pl },
      duplicate: e.altKey && hit.zone === "body",
      moved: false,
    };
  };

  const onRowPointerMove = (track: Track, e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const d = dragRef.current;
    if (!d || d.trackId !== track.id) {
      const hit = hitTest(track, x);
      setHoverZone(hit ? hit.zone : null);
      return;
    }
    d.moved = true;
    const dx = x - d.startX;
    const dSteps = Math.round((dx / barW) * STEPS_PER_BAR / snapSteps) * snapSteps;

    if (d.mode === "move" && d.orig) {
      const newBar = snapBar(d.orig.bar + dSteps / STEPS_PER_BAR);
      movePreviewRef.current = { trackId: track.id, placementId: d.placementId!, bar: newBar };
      markDirty();
    } else if ((d.mode === "trim-l" || d.mode === "trim-r") && d.orig) {
      const clip = p.clips[d.orig.clipId];
      if (!clip) return;
      const off = d.orig.offsetSteps ?? 0;
      const vis = visSteps(d.orig, clip.lengthBars);
      if (d.mode === "trim-l") {
        const newOff = Math.min(Math.max(0, off + dSteps), off + vis - 1);
        updatePlacement(track.id, d.placementId!, { offsetSteps: newOff }, "Trim clip start");
      } else {
        const newVis = Math.max(1, vis - dSteps);
        updatePlacement(track.id, d.placementId!, { lengthBars: newVis / STEPS_PER_BAR }, "Trim clip end");
      }
      d.startX = x;
    } else if ((d.mode === "fade-in" || d.mode === "fade-out") && d.orig) {
      const clip = p.clips[d.orig.clipId];
      if (!clip) return;
      const vis = visSteps(d.orig, clip.lengthBars);
      const half = Math.max(1, Math.floor(vis / 2));
      const steps = Math.min(half, Math.max(0, Math.round((Math.abs(dx) / barW) * STEPS_PER_BAR)));
      if (d.mode === "fade-in") updatePlacement(track.id, d.placementId!, { fadeIn: steps }, "Fade in");
      else updatePlacement(track.id, d.placementId!, { fadeOut: steps }, "Fade out");
    }
  };

  const onRowPointerUp = (track: Track) => {
    const d = dragRef.current;
    dragRef.current = null;
    const preview = movePreviewRef.current;
    movePreviewRef.current = null;
    if (!d || d.mode !== "move" || !d.orig || !preview) {
      markDirty();
      return;
    }
    const clip = p.clips[d.orig.clipId];
    if (!clip) return;
    const lenSteps = visSteps(d.orig, clip.lengthBars);
    const cmds: Parameters<typeof apply>[1] = [];
    const label = d.duplicate ? "Duplicate clip" : "Move clip";

    if (d.duplicate) {
      cmds.push({ op: "duplicate_placement", trackId: track.id, placementId: d.placementId!, deltaBars: preview.bar - d.orig.bar });
    } else {
      cmds.push({ op: "update_placement", trackId: track.id, placementId: d.placementId!, patch: { bar: preview.bar } });
      // Auto-crossfade: if the drop overlaps a neighbour on the same track, give the
      // earlier clip a fade-out and the later clip a fade-in across the overlap.
      const aStart = preview.bar * STEPS_PER_BAR;
      const aEnd = aStart + lenSteps;
      for (const other of track.placements) {
        if (other.id === d.placementId) continue;
        const oStart = other.bar * STEPS_PER_BAR;
        const oEnd = oStart + visSteps(other, p.clips[other.clipId]?.lengthBars ?? 1);
        const ov = Math.round(Math.min(aEnd, oEnd) - Math.max(aStart, oStart));
        if (ov > 0) {
          const first = aStart <= oStart ? { id: d.placementId!, vis: lenSteps } : { id: other.id, vis: oEnd - oStart };
          const second = aStart <= oStart ? { id: other.id, vis: oEnd - oStart } : { id: d.placementId!, vis: lenSteps };
          cmds.push({ op: "update_placement", trackId: track.id, placementId: first.id, patch: { fadeOut: Math.min(ov, Math.max(1, Math.floor(first.vis / 2))) } });
          cmds.push({ op: "update_placement", trackId: track.id, placementId: second.id, patch: { fadeIn: Math.min(ov, Math.max(1, Math.floor(second.vis / 2))) } });
          break;
        }
      }
    }
    apply(label, cmds);
    markDirty();
  };

  const onRowDoubleClick = (track: Track, e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const hit = hitTest(track, e.clientX - rect.left);
    if (!hit) return;
    // open the clip in the piano roll / step sequencer (shared content → instant sync)
    selectTrack(track.id);
    setEditorClip(hit.pl.clipId);
    setWorkspaceView("pianoroll");
  };

  const onRowContextMenu = (track: Track, e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const hit = hitTest(track, e.clientX - rect.left);
    if (!hit) return;
    setSelected({ trackId: track.id, placementId: hit.pl.id });
    setMenu({ x: e.clientX, y: e.clientY, trackId: track.id, placementId: hit.pl.id });
  };

  /* ---------------- ruler: loop region ---------------- */

  const onRulerPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const bar = snapBar((e.clientX - rect.left) / barW);
    (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
    dragRef.current = { mode: "loop", startX: e.clientX - rect.left, anchorBar: bar };
    loopPreviewRef.current = { startBar: bar, endBar: bar };
    markDirty();
  };
  const onRulerPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current;
    if (!d || d.mode !== "loop") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const bar = snapBar((e.clientX - rect.left) / barW);
    const a = d.anchorBar ?? 0;
    loopPreviewRef.current = { startBar: Math.min(a, bar), endBar: Math.max(a, bar) };
    markDirty();
  };
  const onRulerPointerUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    const lp = loopPreviewRef.current;
    loopPreviewRef.current = null;
    if (d?.mode === "loop" && lp && lp.endBar - lp.startBar >= 0.25) {
      apply("Set loop region", [{ op: "set_loop_region", region: { startBar: lp.startBar, endBar: lp.endBar } }]);
    }
    markDirty();
  };
  const clearLoop = () => {
    apply("Clear loop region", [{ op: "set_loop_region", region: null }]);
    markDirty();
  };

  /* ---------------- markers ---------------- */

  const commitMarkers = (markers: Project["markers"], label: string) => {
    apply(label, [{ op: "set_markers", markers }]);
    markDirty();
  };
  const addMarker = (bar: number) => {
    commitMarkers([...p.markers, { id: uid("mk"), bar, label: `Section ${p.markers.length + 1}` }], "Add marker");
  };
  const moveMarker = (id: string, bar: number) => {
    commitMarkers(p.markers.map((m) => (m.id === id ? { ...m, bar } : m)), "Move marker");
  };
  const removeMarker = (id: string) => {
    commitMarkers(p.markers.filter((m) => m.id !== id), "Remove marker");
  };

  /* ---------------- zoom & scroll ---------------- */

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = scrollerRef.current;
    if (!el) return;
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18;
      const anchorContent = el.scrollLeft + e.nativeEvent.offsetX;
      const anchorBar = anchorContent / barW;
      const next = Math.min(160, Math.max(28, Math.round(barW * factor)));
      setBarW(next);
      requestAnimationFrame(() => {
        el.scrollLeft = anchorBar * next - e.nativeEvent.offsetX;
      });
    } else {
      el.scrollLeft += e.deltaY + e.deltaX;
    }
  };

  /* ---------------- render loop ---------------- */

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const v = viewRef.current;
      // playhead follows the audio clock
      if (playheadRef.current) {
        const step = audio.getCurrentStep();
        const x = HEADER_W + (step / STEPS_PER_BAR) * v.barW;
        playheadRef.current.style.transform = `translateX(${x}px)`;
        if (follow && audio.playing && scrollerRef.current) {
          const el = scrollerRef.current;
          const visRight = el.scrollLeft + el.clientWidth;
          if (x > visRight - 48 || x < el.scrollLeft + HEADER_W) el.scrollLeft = Math.max(0, x - el.clientWidth * 0.45);
        }
      }
      if (audio.playing) dirtyRef.current = true; // keep crossfade shimmer + loop pulse alive
      if (dirtyRef.current) {
        dirtyRef.current = false;
        drawRuler();
        for (const t of v.p.tracks) drawRow(t);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [follow]);

  /* redraw whenever the project / zoom / selection changes */
  useEffect(() => {
    markDirty();
  }, [p, barW, selected, hoverZone, producer, markDirty]);

  /* resize canvases when geometry changes */
  useEffect(() => {
    const dpr = window.devicePixelRatio || 1;
    const rc = rulerRef.current;
    if (rc) {
      rc.style.width = `${W}px`;
      rc.style.height = `${RULER_H}px`;
      rc.width = Math.ceil(W * dpr);
      rc.height = Math.ceil(RULER_H * dpr);
    }
    for (const cv of rowCanvas.current.values()) {
      cv.style.width = `${W}px`;
      cv.style.height = `${ROW_H}px`;
      cv.width = Math.ceil(W * dpr);
      cv.height = Math.ceil(ROW_H * dpr);
    }
    markDirty();
  }, [W, p.tracks.length, markDirty]);

  /* ---------------- drawing ---------------- */

  const drawRuler = () => {
    const rc = rulerRef.current;
    const v = viewRef.current;
    if (!rc) return;
    const ctx = rc.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { barW: bw } = v;
    const width = v.p.lengthBars * bw;
    ctx.clearRect(0, 0, width, RULER_H);

    // bar ticks + numbers
    ctx.font = "9px 'IBM Plex Mono', monospace";
    for (let bar = 0; bar < v.p.lengthBars; bar++) {
      const x = bar * bw;
      ctx.fillStyle = "rgba(0,245,255,0.8)";
      ctx.fillText(`${bar + 1}`, x + 5, 12);
      ctx.fillStyle = "rgba(148,163,184,0.35)";
      ctx.fillRect(x, RULER_H - 10, 1, 10);
      for (let b = 1; b < 4; b++) {
        ctx.fillStyle = "rgba(148,163,184,0.12)";
        ctx.fillRect(x + b * (bw / 4), RULER_H - 5, 1, 5);
      }
    }

    // loop region (committed or preview)
    const lr = loopPreviewRef.current ?? v.p.loopRegion;
    if (lr) {
      const x0 = lr.startBar * bw;
      const x1 = lr.endBar * bw;
      ctx.fillStyle = "rgba(0,245,255,0.12)";
      ctx.fillRect(x0, 0, x1 - x0, RULER_H);
      ctx.strokeStyle = "rgba(0,245,255,0.8)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x0 + 0.5, 1, x1 - x0 - 1, RULER_H - 2);
    }
  };

  const drawRow = (track: Track) => {
    const cv = rowCanvas.current.get(track.id);
    const v = viewRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { barW: bw } = v;
    const width = v.p.lengthBars * bw;
    ctx.clearRect(0, 0, width, ROW_H);

    // row backdrop: group tint + zebra bars
    if (track.groupId && GROUP_TINT[track.groupId]) {
      ctx.fillStyle = GROUP_TINT[track.groupId];
      ctx.fillRect(0, 0, width, ROW_H);
    }
    for (let bar = 0; bar < v.p.lengthBars; bar++) {
      if (bar % 2 === 1) {
        ctx.fillStyle = "rgba(148,163,184,0.03)";
        ctx.fillRect(bar * bw, 0, bw, ROW_H);
      }
      ctx.fillStyle = "rgba(148,163,184,0.14)";
      ctx.fillRect(bar * bw, 0, 1, ROW_H);
    }
    // beat lines
    if (bw >= 40) {
      ctx.fillStyle = "rgba(148,163,184,0.05)";
      for (let bar = 0; bar < v.p.lengthBars; bar++) {
        for (let b = 1; b < 4; b++) ctx.fillRect(bar * bw + b * (bw / 4), 0, 1, ROW_H);
      }
    }
    if (track.mute) {
      ctx.fillStyle = "rgba(9,11,14,0.45)";
      ctx.fillRect(0, 0, width, ROW_H);
    }

    const isSelTrack = v.selected?.trackId === track.id;

    for (const pl of track.placements) {
      const clip = v.p.clips[pl.clipId];
      if (!clip) continue;
      const vis = visSteps(pl, clip.lengthBars);
      let bar = pl.bar;
      const preview = movePreviewRef.current;
      if (preview && preview.placementId === pl.id) bar = preview.bar;
      const x0 = bar * bw;
      const w = (vis / STEPS_PER_BAR) * bw;
      const x1 = x0 + w;
      const y0 = 6;
      const h = ROW_H - 12;
      const isSel = isSelTrack && v.selected?.placementId === pl.id;

      // crossfade hatch where this clip overlaps a neighbour
      for (const other of track.placements) {
        if (other.id === pl.id) continue;
        const oVis = visSteps(other, v.p.clips[other.clipId]?.lengthBars ?? 1);
        const oStart = other.bar * STEPS_PER_BAR;
        const oEnd = oStart + oVis;
        const s = Math.max(pl.bar * STEPS_PER_BAR, oStart);
        const e = Math.min(pl.bar * STEPS_PER_BAR + vis, oEnd);
        if (e > s) {
          const cx0 = (s / STEPS_PER_BAR) * bw;
          const cx1 = (e / STEPS_PER_BAR) * bw;
          ctx.save();
          ctx.beginPath();
          ctx.rect(cx0, y0, cx1 - cx0, h);
          ctx.clip();
          ctx.strokeStyle = "rgba(255,255,255,0.35)";
          ctx.lineWidth = 1;
          for (let xx = cx0 - h; xx < cx1; xx += 6) {
            ctx.beginPath();
            ctx.moveTo(xx, y0 + h);
            ctx.lineTo(xx + h, y0);
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      // block body
      const alpha = track.mute ? 0.35 : 0.92;
      const grad = ctx.createLinearGradient(0, y0, 0, y0 + h);
      grad.addColorStop(0, rgba(track.color, alpha));
      grad.addColorStop(1, rgba(track.color, alpha * 0.55));
      ctx.fillStyle = grad;
      roundRect(ctx, x0, y0, w, h, 4);
      ctx.fill();
      ctx.strokeStyle = isSel ? ACCENT : rgba("#ffffff", 0.18);
      ctx.lineWidth = isSel ? 1.5 : 1;
      roundRect(ctx, x0 + 0.5, y0 + 0.5, w - 1, h - 1, 4);
      ctx.stroke();

      // note-density strip (shared clip content → live sync with the piano roll)
      const off = pl.offsetSteps ?? 0;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0 + 2, y0 + h - 12, w - 4, 9);
      ctx.clip();
      ctx.fillStyle = "rgba(9,11,14,0.35)";
      ctx.fillRect(x0 + 2, y0 + h - 12, w - 4, 9);
      for (const n of clip.notes) {
        const rel = Math.floor(n.start) - off;
        if (rel < 0 || rel >= vis) continue;
        const nx = x0 + (rel / vis) * (w - 4) + 2;
        ctx.fillStyle = `rgba(255,255,255,${0.25 + n.vel * 0.5})`;
        ctx.fillRect(nx, y0 + h - 11, Math.max(1, (n.dur / vis) * (w - 4)), 2 + n.vel * 5);
      }
      ctx.restore();

      // clip name
      ctx.fillStyle = "rgba(9,11,14,0.75)";
      ctx.font = "600 9px 'Space Grotesk', sans-serif";
      ctx.fillText(clip.name, x0 + 5, y0 + 11, Math.max(0, w - 10));

      // fade wedges
      if (pl.fadeIn && pl.fadeIn > 0) {
        const fw = Math.min(w, (pl.fadeIn / vis) * w);
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x0 + fw, y0);
        ctx.lineTo(x0, y0 + h);
        ctx.closePath();
        ctx.fill();
      }
      if (pl.fadeOut && pl.fadeOut > 0) {
        const fw = Math.min(w, (pl.fadeOut / vis) * w);
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.beginPath();
        ctx.moveTo(x1, y0);
        ctx.lineTo(x1 - fw, y0);
        ctx.lineTo(x1, y0 + h);
        ctx.closePath();
        ctx.fill();
      }
    }
  };

  /* ---------------- render ---------------- */

  const loop = p.loopRegion;
  const contentH = MARKER_H + RULER_H + p.tracks.length * ROW_H;

  return (
    <div className="panel flex flex-col flex-1 min-h-0 anim-fade-up overflow-hidden" style={{ animationDelay: "80ms" }}>
      {/* toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-ink-700/70 flex-wrap">
        <span className="panel-title">Arrangement</span>
        <span className="text-[10px] font-mono text-ink-400">{p.lengthBars} bars · {p.timeSignature.numerator}/{p.timeSignature.denominator}</span>
        <div className="w-px h-4 bg-ink-700" />

        {/* snap resolution */}
        <div className="flex items-center gap-1 text-[10px] text-ink-400">
          snap
          {(["bar", "beat", "grid"] as SnapMode[]).map((s) => (
            <button
              key={s}
              onClick={() => setSnap(s)}
              className={`px-1.5 py-0.5 rounded font-mono border transition-colors ${snap === s ? "border-amber-glow/60 text-amber-glow bg-amber-glow/10" : "border-ink-700 text-ink-400 hover:text-ink-100"}`}
              title={`Snap to ${s === "bar" ? "bars" : s === "beat" ? "beats (1/4)" : "1/16 grid"}`}
            >
              {s === "bar" ? "bar" : s === "beat" ? "1/4" : "1/16"}
            </button>
          ))}
        </div>

        <button className="btn btn-ghost px-2! py-0.5! text-[10px]!" onClick={() => splitAtPlayhead()} disabled={!selected} title="Split the selected clip at the playhead">
          <IconScissors size={12} /> split
        </button>

        <div className="flex-1" />

        {/* loop region */}
        {loop ? (
          <button onClick={clearLoop} className="chip py-0.5! text-teal! border-teal/50! bg-teal/10!" title="Click to clear the loop region">
            <IconLoop size={11} /> loop {loop.startBar + 1}–{loop.endBar}
          </button>
        ) : (
          <span className="text-[9px] text-ink-500 hidden lg:block" title="Drag across the ruler to set a loop region">drag ruler → loop</span>
        )}

        <button
          onClick={() => setFollow((f) => !f)}
          className={`chip py-0.5! ${follow ? "text-amber-glow! border-amber-glow/50! bg-amber-glow/10!" : ""}`}
          title="Keep the playhead in view while playing"
        >
          follow
        </button>

        <div className="w-px h-4 bg-ink-700" />
        <button className="btn btn-ghost px-1.5! py-0.5!" title="Zoom out (Ctrl+scroll)" onClick={() => setBarW((w) => Math.max(28, w - 12))}><IconMinus size={13} /></button>
        <span className="font-mono text-[9px] text-ink-400 w-7 text-center tabular-nums">{barW}</span>
        <button className="btn btn-ghost px-1.5! py-0.5!" title="Zoom in (Ctrl+scroll)" onClick={() => setBarW((w) => Math.min(160, w + 12))}><IconPlus size={13} /></button>
        <div className="w-px h-4 bg-ink-700" />
        <button className="btn btn-ghost px-2! py-0.5! text-[10px]!" onClick={() => apply("Extend timeline", [{ op: "set_length", bars: p.lengthBars + 4 }])}>+4 bars</button>
        <button className="btn btn-ghost px-2! py-0.5! text-[10px]!" disabled={p.lengthBars <= 4} onClick={() => apply("Shorten timeline", [{ op: "set_length", bars: p.lengthBars - 4 }])}>−4</button>
      </div>

      {/* canvas region */}
      <div ref={scrollerRef} onWheel={onWheel} className="flex-1 min-h-0 overflow-auto relative" onClick={() => menu && setMenu(null)}>
        <div className="relative" style={{ width: HEADER_W + W, height: contentH }}>
          {/* sticky header row: corner + markers + ruler */}
          <div className="sticky top-0 z-30 flex" style={{ width: HEADER_W + W }}>
            <div className="sticky left-0 z-40 shrink-0 border-b border-r border-ink-700 bg-ink-850" style={{ width: HEADER_W, height: MARKER_H + RULER_H }}>
              <div className="px-3 pt-1 text-[8px] font-mono text-ink-500 uppercase tracking-wider">tracks · {p.tracks.length}</div>
              <div className="px-3 text-[9px] text-ink-400">double-click a clip → editor</div>
            </div>
            <div className="relative border-b border-ink-700" style={{ width: W, height: MARKER_H + RULER_H }}>
              {/* marker strip */}
              <div
                className="absolute top-0 left-0 right-0 cursor-copy"
                style={{ height: MARKER_H }}
                title="Click to add a marker · drag to move · right-click to remove · double-click to rename"
                onClick={(e) => {
                  const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                  addMarker(snapBar((e.clientX - rect.left) / barW));
                }}
              >
                {p.markers.map((m) => (
                  <div
                    key={m.id}
                    className="absolute top-0 flex items-center gap-1 px-1 h-full cursor-grab active:cursor-grabbing group"
                    style={{ left: m.bar * barW, background: "linear-gradient(180deg, rgba(255,180,94,0.16), rgba(255,180,94,0.05))", borderLeft: "1.5px solid #ffb45e" }}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                      dragRef.current = { mode: "marker", markerId: m.id, startX: e.clientX, origBar: m.bar };
                    }}
                    onPointerMove={(e) => {
                      const d = dragRef.current;
                      if (d?.mode === "marker" && d.markerId === m.id) {
                        const dBars = Math.round(((e.clientX - d.startX) / barW) * STEPS_PER_BAR / snapSteps) * snapSteps / STEPS_PER_BAR;
                        const nb = Math.max(0, Math.min(p.lengthBars, (d.origBar ?? 0) + dBars));
                        if (nb !== m.bar) moveMarker(m.id, nb);
                      }
                    }}
                    onPointerUp={() => { dragRef.current = null; }}
                    onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); removeMarker(m.id); }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setRenaming({ id: m.id, x: e.clientX, y: e.clientY, value: m.label });
                    }}
                  >
                    <IconFlag size={9} className="text-amber-glow shrink-0" />
                    <span className="text-[8px] font-semibold text-amber-glow whitespace-nowrap max-w-[80px] truncate group-hover:text-ink-100 transition-colors">{m.label}</span>
                  </div>
                ))}
              </div>
              <canvas
                ref={rulerRef}
                className="absolute left-0 cursor-ew-resize"
                style={{ top: MARKER_H }}
                onPointerDown={onRulerPointerDown}
                onPointerMove={onRulerPointerMove}
                onPointerUp={onRulerPointerUp}
                onDoubleClick={clearLoop}
              />
            </div>
          </div>

          {/* track rows */}
          {p.tracks.map((t, i) => {
            const top = MARKER_H + RULER_H + i * ROW_H;
            return (
              <div key={t.id} className="absolute left-0 flex" style={{ top, width: HEADER_W + W, height: ROW_H }}>
                <TrackHeader t={t} selected={state.selectedTrackId === t.id} onSelect={() => selectTrack(t.id)} onRename={(name) => apply(`Rename ${t.name}`, [{ op: "rename_track", trackId: t.id, name }])} onColor={(color) => apply(`Recolor ${t.name}`, [{ op: "set_track_color", trackId: t.id, color }])} onGroup={(groupId) => apply(`Group ${t.name}`, [{ op: "set_track_group", trackId: t.id, groupId }])} noteCount={t.placements.reduce((acc, pl) => acc + (p.clips[pl.clipId]?.notes.length ?? 0), 0)} />
                <canvas
                  ref={(el) => { if (el) rowCanvas.current.set(t.id, el); else rowCanvas.current.delete(t.id); }}
                  className={hoverZone === "trim-l" || hoverZone === "trim-r" ? "cursor-ew-resize" : hoverZone === "fade-in" || hoverZone === "fade-out" ? "cursor-w-resize" : "cursor-pointer"}
                  onPointerDown={(e) => onRowPointerDown(t, e)}
                  onPointerMove={(e) => onRowPointerMove(t, e)}
                  onPointerUp={() => onRowPointerUp(t)}
                  onDoubleClick={(e) => onRowDoubleClick(t, e)}
                  onContextMenu={(e) => onRowContextMenu(t, e)}
                />
              </div>
            );
          })}

          {/* loop band overlay across rows */}
          {loop && (
            <div
              className="absolute pointer-events-none z-10 border-x border-teal/40"
              style={{
                left: HEADER_W + loop.startBar * barW,
                width: (loop.endBar - loop.startBar) * barW,
                top: MARKER_H + RULER_H,
                height: p.tracks.length * ROW_H,
                background: "repeating-linear-gradient(45deg, rgba(62,207,178,0.05) 0 8px, transparent 8px 16px)",
              }}
            />
          )}

          {/* playhead */}
          <div ref={playheadRef} className="absolute top-0 z-20 pointer-events-none" style={{ left: 0, height: contentH }}>
            <div className="w-px h-full bg-amber-glow shadow-[0_0_8px_rgba(0,245,255,0.9)]" style={{ marginLeft: HEADER_W - 0.5 }} />
            <div className="absolute w-2 h-2 rotate-45 bg-amber-glow shadow-[0_0_10px_rgba(0,245,255,1)]" style={{ left: HEADER_W - 4, top: MARKER_H + RULER_H - 5 }} />
          </div>
        </div>
      </div>

      {/* context menu */}
      {menu && (
        <div className="fixed z-50 w-44 rounded-lg border border-ink-600 bg-ink-850 shadow-2xl overflow-hidden anim-fade-up" style={{ left: menu.x, top: menu.y }}>
          {[
            { label: "Open in editor", icon: <IconPiano size={12} />, act: () => { const hit = findPlacement(menu.trackId, menu.placementId); if (hit) { selectTrack(menu.trackId); setEditorClip(hit.pl.clipId); setWorkspaceView("pianoroll"); } } },
            { label: "Split at playhead", icon: <IconScissors size={12} />, act: () => splitAtPlayhead(menu.trackId, menu.placementId) },
            { label: "Duplicate +1 bar", icon: <IconCopy size={12} />, act: () => duplicatePlacement(menu.trackId, menu.placementId, 1) },
            { label: "Remove", icon: <IconEraser size={12} />, act: () => removePlacement(menu.trackId, menu.placementId), danger: true },
          ].map((it) => (
            <button key={it.label} onClick={() => { it.act(); setMenu(null); }} className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] text-left transition-colors ${it.danger ? "text-rec hover:bg-rec/10" : "text-ink-200 hover:bg-ink-750"}`}>
              {it.icon} {it.label}
            </button>
          ))}
        </div>
      )}

      {/* marker rename popover */}
      {renaming && (
        <div className="fixed z-50" style={{ left: renaming.x, top: renaming.y }}>
          <input
            autoFocus
            defaultValue={renaming.value}
            onFocus={(e) => e.target.select()}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v) commitMarkers(p.markers.map((m) => (m.id === renaming.id ? { ...m, label: v.slice(0, 24) } : m)), "Rename marker");
              setRenaming(null);
            }}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setRenaming(null); }}
            className="bg-ink-800 border border-amber-glow/60 rounded-md px-2 py-1 text-[11px] w-32 focus:outline-none"
          />
        </div>
      )}

      {/* hint strip */}
      <div className="px-3 py-1 border-t border-ink-700/70 text-[9px] font-mono text-ink-500 flex gap-3 shrink-0">
        <span>drag = move</span>
        <span className="hidden md:inline">alt-drag = duplicate</span>
        <span className="hidden md:inline">edges = trim</span>
        <span className="hidden lg:inline">inner edges = fade</span>
        <span className="hidden lg:inline">overlap = crossfade</span>
        <span className="hidden xl:inline">right-click = more</span>
      </div>
    </div>
  );
}

/* ---------------- track header (DOM, sticky-left) ---------------- */

function TrackHeader({
  t, selected, noteCount, onSelect, onRename, onColor, onGroup,
}: {
  t: Track;
  selected: boolean;
  noteCount: number;
  onSelect: () => void;
  onRename: (name: string) => void;
  onColor: (color: string) => void;
  onGroup: (groupId: string | null) => void;
}) {
  const meta = INSTRUMENT_META[t.instrument];
  const kindLabel = t.instrument === "drumkit" ? "MIDI" : "INSTR";
  const nextColor = () => {
    const i = TRACK_COLORS.indexOf(t.color);
    onColor(TRACK_COLORS[(i + 1) % TRACK_COLORS.length]);
  };
  const nextGroup = () => {
    const order: (string | null)[] = [null, "A", "B", "C"];
    const i = order.indexOf(t.groupId ?? null);
    onGroup(order[(i + 1) % order.length]);
  };
  return (
    <div
      className={`sticky left-0 z-20 shrink-0 border-b border-r border-ink-700 flex flex-col justify-center gap-0.5 px-2.5 cursor-pointer transition-colors ${selected ? "bg-ink-750" : "bg-ink-850 hover:bg-ink-800"}`}
      style={{ width: HEADER_W, height: ROW_H, boxShadow: `inset 3px 0 0 ${t.color}`, background: t.groupId && GROUP_TINT[t.groupId] ? undefined : undefined }}
      onClick={onSelect}
      title={`${meta.label} · ${noteCount} notes`}
    >
      <div className="flex items-center gap-1.5">
        <button onClick={(e) => { e.stopPropagation(); nextColor(); }} className="w-3 h-3 rounded-full shrink-0 hover:scale-125 transition-transform" style={{ background: t.color, boxShadow: `0 0 6px ${t.color}88` }} title="Cycle track color" />
        <span className={`text-[12px] font-bold truncate flex-1 ${t.mute ? "text-ink-500 line-through" : "text-ink-100"}`}>{t.name}</span>
        {t.groupId && (
          <button onClick={(e) => { e.stopPropagation(); nextGroup(); }} className="text-[8px] font-bold w-4 h-4 rounded flex items-center justify-center shrink-0" style={{ color: GROUP_BADGE[t.groupId], border: `1px solid ${GROUP_BADGE[t.groupId]}66`, background: `${GROUP_BADGE[t.groupId]}1a` }} title="Cycle group (A/B/C/none)">
            {t.groupId}
          </button>
        )}
        {!t.groupId && (
          <button onClick={(e) => { e.stopPropagation(); nextGroup(); }} className="text-[8px] font-bold w-4 h-4 rounded flex items-center justify-center text-ink-600 border border-ink-700 hover:text-ink-300 shrink-0" title="Assign to a group">
            +
          </button>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[7px] font-mono px-1 py-px rounded bg-ink-750 text-ink-400 border border-ink-700">{kindLabel}</span>
        <span className="text-[8px] font-mono text-ink-500 truncate">{meta.label.toLowerCase()}</span>
        <span className="ml-auto text-[8px] font-mono text-ink-500">{noteCount}♩</span>
      </div>
      <input
        key={t.name}
        defaultValue={t.name}
        onClick={(e) => e.stopPropagation()}
        onBlur={(e) => e.target.value.trim() && e.target.value !== t.name && onRename(e.target.value.trim())}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="hidden"
        aria-label="Rename track"
      />
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
