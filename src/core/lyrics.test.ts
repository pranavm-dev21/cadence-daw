import { describe, expect, it } from 'vitest';
import { analyzeLyrics } from './lyrics';
import { serialize, deserialize } from './format';
import { buildEmptyProject } from './seed';
import { execCommand } from './executors';
describe('saved lyric assistance', () => {
  it('preserves exact lyric text through project saves', () => {
    const text = 'Find my flow\nLet the rhythm grow /';
    const parsed = deserialize(serialize(execCommand(buildEmptyProject(), { op: 'set_lyrics', text })));
    expect(parsed.ok && parsed.project.lyrics).toBe(text);
  });
  it('suggests local rhyme families and flags repetition without claiming timing accuracy', () => {
    const result = analyzeLyrics('Light the light\nI find my flow');
    expect(result.repeated).toContainEqual(['light',2]); expect(result.rhymes).toContain('glow'); expect(result.lines).toHaveLength(2);
    expect(analyzeLyrics('').lines).toHaveLength(0);
  });
});
