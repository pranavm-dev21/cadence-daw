/* Sample-accurate note scheduling — the single code path shared by live
 * playback (engine.ts) and offline rendering (render.ts). Keeping both on the
 * exact same walk is what makes the realtime↔offline parity guarantee hold:
 * a note's onset instant, velocity (incl. clip fades) and duration are computed
 * identically in both worlds. Allocation-free in the hot loop. */

import { Note, Placement, Project, Track } from "../types";
import { isAudible, soloActive } from "./mixer";

/**
 * Walk every note that sounds on `absStep` and hand it to `emit`.
 * The loop itself allocates nothing; `emit` is the only callback.
 *
 * Placement trim model: `offsetSteps` skips the head of the clip (the block's
 * bar position is where content step `offsetSteps` begins) and `lengthBars`
 * caps the audible tail. `rel` is the step index *within the audible window*
 * (0 at the block's left edge) — used for fade envelopes.
 */
export function stepNotes(
  p: Project,
  absStep: number,
  emit: (t: Track, n: Note, rel: number, pl: Placement) => void,
): void {
  const total = p.lengthBars * 16;
  const s = ((absStep % total) + total) % total;
  // Solo/mute semantics live in the mixer (single source of truth).
  const anySolo = soloActive(p.tracks);
  for (const t of p.tracks) {
    if (!isAudible(t, anySolo)) continue;
    for (const pl of t.placements) {
      const clip = p.clips[pl.clipId];
      if (!clip) continue;
      const off = pl.offsetSteps ?? 0;
      const clipSteps = clip.lengthBars * 16;
      const vis = pl.lengthBars !== undefined ? Math.round(pl.lengthBars * 16) : clipSteps - off;
      // fractional bars (beat-level splits) → fractional step position
      const relF = s - pl.bar * 16;
      if (relF < 0 || relF >= vis) continue;
      const rel = Math.floor(relF);
      // Match any note whose (possibly fractional, post-quantize) start lands in
      // this step; the caller places it at its exact sub-step clock time.
      for (const n of clip.notes) {
        if (Math.floor(n.start) - off === rel && n.start < off + vis) emit(t, n, rel, pl);
      }
    }
  }
}

/** Fade envelope value (0..1) for a note onset at `rel` inside the audible window. */
export function placementFade(pl: Placement, rel: number, visSteps: number): number {
  let f = 1;
  if (pl.fadeIn && pl.fadeIn > 0) f *= Math.min(1, rel / pl.fadeIn);
  if (pl.fadeOut && pl.fadeOut > 0) f *= Math.min(1, (visSteps - rel) / pl.fadeOut);
  return f < 0 ? 0 : f > 1 ? 1 : f;
}

/** 16th-note duration in seconds at a given tempo. */
export const stepDurFor = (bpm: number): number => 60 / Math.max(1, bpm) / 4;
