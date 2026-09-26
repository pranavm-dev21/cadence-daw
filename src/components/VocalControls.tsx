import { useStore } from '../state/store';
import { VOCAL_BOUNDS, VOCAL_DEFAULT, VOCAL_PRESETS, type VocalSettings } from '../core/vocal';
import type { Track } from '../types';

export default function VocalControls({ track }: { track: Track }) {
  const { apply, gate } = useStore();
  const values = track.fx.vocal ?? VOCAL_DEFAULT;
  const set = (patch: Partial<VocalSettings>) => apply('Adjust vocal processing', [{ op: 'set_track_fx', trackId: track.id, fx: { vocal: { ...values, ...patch } } }]);
  const controls: { key: keyof VocalSettings; label: string; step: number }[] = [
    { key: 'presence', label: gate('producer') ? 'Presence at 3.2 kHz (dB)' : 'Vocal brightness', step: 0.5 },
    { key: 'ratio', label: gate('producer') ? 'Compression ratio' : 'Vocal smoothness', step: 0.1 },
    ...(gate('producer') ? [{ key: 'highPass' as const, label: 'Low-cut frequency (Hz)', step: 5 }, { key: 'threshold' as const, label: 'Compressor threshold (dB)', step: 1 }] : []),
    ...(gate('advanced') ? [{ key: 'attack' as const, label: 'Attack (seconds)', step: 0.001 }, { key: 'release' as const, label: 'Release (seconds)', step: 0.01 }, { key: 'makeup' as const, label: 'Makeup gain', step: 0.05 }] : []),
  ];
  return <fieldset className="mt-5 border border-ink-700 rounded-lg p-3"><legend className="px-2 text-sm font-semibold">Vocal processing</legend>
    <label className="text-sm">Preset<select className="block bg-ink-800 rounded p-2 mt-1 w-full" aria-label="Vocal preset" value="" onChange={e => { const vocal = VOCAL_PRESETS[e.target.value]; if (vocal) apply('Apply vocal preset', [{ op: 'set_track_fx', trackId: track.id, fx: { vocal: { ...vocal }, vocalBypass: false } }]); }}><option value="" disabled>{track.fx.vocal ? 'Custom / choose preset' : 'Choose a vocal sound'}</option>{Object.keys(VOCAL_PRESETS).map(name => <option key={name}>{name}</option>)}</select></label>
    <label className="flex items-center gap-2 text-sm my-3"><input type="checkbox" checked={!!track.fx.vocalBypass} onChange={e => apply('Bypass vocal processing', [{ op: 'set_track_fx', trackId: track.id, fx: { vocalBypass: e.target.checked } }])} />Bypass vocal processing</label>
    <div className="grid sm:grid-cols-2 gap-3">{controls.map(({ key, label, step }) => <label key={key} className="text-xs">{label} <output className="text-teal">{values[key]}</output><input aria-label={label} type="range" min={VOCAL_BOUNDS[key][0]} max={VOCAL_BOUNDS[key][1]} step={step} value={values[key]} disabled={!!track.fx.vocalBypass} onChange={e => set({ [key]: Number(e.target.value) })} className="w-full block mt-2" /></label>)}</div>
    <p className="text-xs text-ink-400 mt-3">Low-cut → presence EQ → compression → tone and effects. Original recordings stay unchanged.</p>
  </fieldset>;
}
