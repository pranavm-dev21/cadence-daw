/** Persisted vocal parameters; independent of presentation mode. */
export interface VocalSettings {
  highPass: number; presence: number; threshold: number; ratio: number;
  attack: number; release: number; makeup: number;
}
export const VOCAL_BOUNDS: Record<keyof VocalSettings, readonly [number, number]> = {
  highPass: [20, 400], presence: [-12, 12], threshold: [-60, 0], ratio: [1, 12],
  attack: [0.001, 0.1], release: [0.03, 1], makeup: [0.25, 4],
};
export const VOCAL_DEFAULT: VocalSettings = { highPass: 80, presence: 2, threshold: -20, ratio: 3, attack: 0.01, release: 0.18, makeup: 1.2 };
export const VOCAL_PRESETS: Record<string, VocalSettings> = {
  'Clean vocal': VOCAL_DEFAULT,
  'Warm vocal': { ...VOCAL_DEFAULT, highPass: 65, presence: -2, ratio: 2 },
  'Bright vocal': { ...VOCAL_DEFAULT, highPass: 100, presence: 4 },
  'Spoken voice': { ...VOCAL_DEFAULT, highPass: 90, threshold: -24, ratio: 4, presence: 1 },
  'Rap vocal': { ...VOCAL_DEFAULT, highPass: 85, threshold: -22, ratio: 4, attack: 0.006, release: 0.12, presence: 3 },
  'Soft vocal': { ...VOCAL_DEFAULT, highPass: 60, ratio: 2, attack: 0.02, release: 0.25, presence: 1 },
};
export function validVocalSettings(raw: unknown): raw is VocalSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const value = raw as Record<string, unknown>;
  return Object.entries(VOCAL_BOUNDS).every(([key, [lo, hi]]) => typeof value[key] === 'number' && Number.isFinite(value[key]) && (value[key] as number) >= lo && (value[key] as number) <= hi);
}
export function sanitizeVocalSettings(raw: unknown): VocalSettings | undefined {
  if (!validVocalSettings(raw)) return undefined;
  return Object.fromEntries(Object.keys(VOCAL_BOUNDS).map(key => [key, raw[key as keyof VocalSettings]])) as unknown as VocalSettings;
}
