import { describe, expect, it } from 'vitest';
import { VOCAL_PRESETS, validVocalSettings, sanitizeVocalSettings } from './vocal';
import { buildEmptyProject } from './seed';
import { execCommand } from './executors';
import { serialize, deserialize } from './format';
import { validateCommand } from './commands';
describe('vocal processing state', () => {
  it('uses real distinct bounded parameter presets', () => {
    expect(Object.values(VOCAL_PRESETS).every(validVocalSettings)).toBe(true);
    expect(VOCAL_PRESETS['Warm vocal'].presence).toBeLessThan(VOCAL_PRESETS['Bright vocal'].presence);
    expect(VOCAL_PRESETS['Rap vocal'].ratio).toBeGreaterThan(VOCAL_PRESETS['Soft vocal'].ratio);
  });
  it('preserves compressor controls during ordinary mix edits, bypass, and project reload', () => {
    let p = buildEmptyProject(); const trackId = p.tracks[0].id;
    const vocal = { ...VOCAL_PRESETS['Rap vocal'], attack: 0.017 };
    p = execCommand(p, { op: 'set_track_fx', trackId, fx: { vocal } });
    p = execCommand(p, { op: 'set_track_fx', trackId, fx: { reverb: 0.42, vocalBypass: true } });
    const parsed = deserialize(serialize(p));
    expect(parsed.ok && parsed.project.tracks[0].fx.vocal).toEqual(vocal);
    expect(parsed.ok && parsed.project.tracks[0].fx.vocalBypass).toBe(true);
  });
  it('rejects non-finite or out-of-range processing at the command boundary', () => {
    const vocal = { ...VOCAL_PRESETS['Clean vocal'], attack: Infinity };
    expect(sanitizeVocalSettings(vocal)).toBeUndefined();
    expect(validateCommand({ op: 'set_track_fx', trackId: 'track', fx: { vocal } })).not.toBeNull();
  });
});
