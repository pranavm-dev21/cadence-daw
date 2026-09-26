import { VOCAL_PRESETS } from "../core/vocal";
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { StoreProvider, useStore } from './store';
import { serialize, deserialize } from '../core/format';
afterEach(cleanup);
describe('presentation modes', () => {
  it('preserves the entire project, advanced FX, takes and history across Master → Beginner → Master', () => {
    const { result } = renderHook(() => useStore(), { wrapper: StoreProvider });
    const trackId = result.current.state.project.tracks[0].id;
    act(() => {
      result.current.setMode('advanced');
      result.current.apply('Advanced vocal configuration', [
        { op: 'set_track_fx', trackId, fx: { vocal: { ...VOCAL_PRESETS["Rap vocal"], attack: 0.023, release: 0.41 }, vocalBypass: true, cutoff: 7350, reverb: 0.37, delay: 0.22, drive: 0.16 } },
        { op: 'add_take', trackId, take: { id: 'take_mode', name: 'Mode test', offsetSteps: 4, durationSteps: 20, deviceId: '', deviceLabel: 'Test', latencyMs: 12, peak: 0.7 } },
      ]);
    });
    const project = result.current.state.project;
    const before = serialize(project);
    const undoLabel = result.current.state.undoLabel;
    act(() => result.current.setMode('beginner'));
    expect(result.current.gate('advanced')).toBe(false);
    expect(result.current.state.project).toBe(project);
    act(() => result.current.setMode('advanced'));
    expect(result.current.gate('advanced')).toBe(true);
    expect(serialize(result.current.state.project)).toBe(before);
    expect(result.current.state.undoLabel).toBe(undoLabel);
    expect(localStorage.getItem('cadence.mode')).toBe('advanced');
    expect(result.current.state.project.tracks[0].fx.vocal?.attack).toBe(0.023);
    const loaded = deserialize(before);
    expect(loaded.ok && loaded.project.tracks[0].takes[0].id).toBe('take_mode');
  });
});

