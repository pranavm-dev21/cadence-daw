import { useSyncExternalStore } from 'react';
import { audio } from '../core/audio';
export function useRecordingBusy(): boolean {
  const recorder = audio.recorder;
  return useSyncExternalStore(callback => recorder.subscribe(callback), () => ['capturing','paused','saving'].includes(recorder.status) || recorder.canRetrySave, () => false);
}
