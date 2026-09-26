import { Clip, Track } from "../types";
import { useStore } from "./store";

/** Resolves the track + clip currently open in the editor. */
export function useEditorClip(): { track: Track; clip: Clip } | null {
  const { state } = useStore();
  const track = state.project.tracks.find((t) => t.id === state.selectedTrackId) ?? state.project.tracks[0];
  if (!track) return null;
  const clipId =
    state.editorClipId && track.clipIds.includes(state.editorClipId)
      ? state.editorClipId
      : track.sourceClipId;
  const clip = state.project.clips[clipId];
  if (!clip) return null;
  return { track, clip };
}
