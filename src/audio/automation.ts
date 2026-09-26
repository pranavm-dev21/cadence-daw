/* Automation model helpers — pure, shared by the real-time engine and the
 * offline renderer so both interpret a lane byte-for-byte the same way.
 *
 * Lanes store NORMALIZED values (0..1); `denormalize` maps them into each
 * parameter's real range. Interpolation is evaluated per-point with the
 * curve leaving that point:
 *   linear  — straight line
 *   smooth  — ease-in/out (smoothstep)
 *   expUp   — slow start, fast finish  (convex)
 *   expDown — fast start, slow finish  (concave) */

import { AutomationEvent, AutomationLane, AutomationParam, CurveKind } from "../types";

export interface ParamRange {
  label: string;
  min: number;
  max: number;
  /** true when the perceptual scale is logarithmic (cutoff). */
  log?: boolean;
  /** Format for UI display of a real (denormalized) value. */
  format: (v: number) => string;
}

export const PARAM_RANGES: Record<AutomationParam, ParamRange> = {
  volume: { label: "Volume", min: 0, max: 1.25, format: (v) => `${Math.round(v * 100)}%` },
  pan: { label: "Pan", min: -1, max: 1, format: (v) => (Math.abs(v) < 0.02 ? "C" : v < 0 ? `L${Math.round(-v * 100)}` : `R${Math.round(v * 100)}`) },
  reverb: { label: "Reverb send", min: 0, max: 1, format: (v) => `${Math.round(v * 100)}%` },
  delay: { label: "Delay send", min: 0, max: 1, format: (v) => `${Math.round(v * 100)}%` },
  cutoff: { label: "Filter cutoff", min: 120, max: 16000, log: true, format: (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`) },
  drive: { label: "Drive", min: 0, max: 1, format: (v) => `${Math.round(v * 100)}%` },
};

export const AUTOMATABLE_PARAMS: AutomationParam[] = ["volume", "pan", "cutoff", "drive", "reverb", "delay"];

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Normalized 0..1 → the parameter's real range (log-scaled for cutoff). */
export function denormalize(param: AutomationParam, norm: number): number {
  const r = PARAM_RANGES[param];
  const t = clamp01(norm);
  if (r.log) return r.min * Math.pow(r.max / r.min, t);
  return r.min + (r.max - r.min) * t;
}

/** Real value → normalized 0..1 (inverse of denormalize). */
export function normalize(param: AutomationParam, real: number): number {
  const r = PARAM_RANGES[param];
  if (r.log) return clamp01(Math.log(real / r.min) / Math.log(r.max / r.min));
  return clamp01((real - r.min) / (r.max - r.min));
}

/** Shape the 0..1 segment position according to the curve kind. */
export function curveShape(t: number, curve: CurveKind): number {
  const x = clamp01(t);
  switch (curve) {
    case "smooth":
      return x * x * (3 - 2 * x);
    case "expUp":
      return x * x;
    case "expDown":
      return 1 - (1 - x) * (1 - x);
    case "linear":
    default:
      return x;
  }
}

/**
 * Normalized lane value at a (fractional) step.
 *  - before the first point → first point's value
 *  - after the last point  → last point's value (held)
 *  - between points        → interpolated with the leaving point's curve
 */
export function laneValueAt(lane: AutomationLane, step: number): number {
  const pts = lane.points;
  if (pts.length === 0) return 0;
  if (step <= pts[0].step) return clamp01(pts[0].value);
  const last = pts[pts.length - 1];
  if (step >= last.step) return clamp01(last.value);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (step >= a.step && step <= b.step) {
      const span = b.step - a.step;
      const t = span <= 0 ? 0 : (step - a.step) / span;
      const shaped = curveShape(t, a.curve ?? "linear");
      return clamp01(a.value + (b.value - a.value) * shaped);
    }
  }
  return clamp01(last.value);
}

/** Real (denormalized) value at a step — what the engine applies. */
export function laneRealValueAt(lane: AutomationLane, step: number): number {
  return denormalize(lane.param, laneValueAt(lane, step));
}

/** True when a lane has any automation to speak of. */
export function laneIsActive(lane: AutomationLane): boolean {
  return lane.points.length > 0;
}

/** Lanes that apply to a track right now (have points). */
export function activeLanesForTrack(lanes: AutomationLane[], trackId: string): AutomationLane[] {
  return lanes.filter((l) => l.trackId === trackId && laneIsActive(l));
}

/* ---------------- editing helpers (used by the UI; undoable via the bus) ---------------- */

const EPS = 1 / 64; // steps closer than this are the "same" point

/** Insert or move a point, keeping the lane sorted by step. */
export function setPoint(points: AutomationEvent[], step: number, value: number, curve?: CurveKind): AutomationEvent[] {
  const out = points.filter((p) => Math.abs(p.step - step) > EPS);
  out.push({ step, value: clamp01(value), ...(curve ? { curve } : {}) });
  out.sort((a, b) => a.step - b.step);
  return out;
}

export function removePoint(points: AutomationEvent[], step: number): AutomationEvent[] {
  return points.filter((p) => Math.abs(p.step - step) > EPS);
}

/** Freehand stroke → merged points (dedupes within EPS, replaces in-range). */
export function mergeStroke(points: AutomationEvent[], stroke: AutomationEvent[]): AutomationEvent[] {
  if (stroke.length === 0) return points;
  let lo = Infinity;
  let hi = -Infinity;
  for (const s of stroke) {
    if (s.step < lo) lo = s.step;
    if (s.step > hi) hi = s.step;
  }
  const kept = points.filter((p) => p.step < lo - EPS || p.step > hi + EPS);
  return [...kept, ...stroke].sort((a, b) => a.step - b.step);
}
