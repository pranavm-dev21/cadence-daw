import { analyzeLyrics } from "../core/lyrics";
import VocalControls from "./VocalControls";
import { useEffect, useRef, useState } from 'react';
import { audio } from '../core/audio';
import { audioAssets } from '../audio/assets';
import { useStore } from '../state/store';
import { uid, type Track } from '../types';

export default function VocalWorkspace({ onToast }: { onToast: (message: string) => void }) {
  const store = useStore();
  const latest = useRef(store); latest.current = store;
  const recorder = audio.recorder;
  const [, refresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [level, setLevel] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [wave, setWave] = useState<number[]>([]);
  const [error, setError] = useState('');
  const lyrics = store.state.project.lyrics ?? '';
  const lyricAnalysis = analyzeLyrics(lyrics);
  const importRef = useRef<HTMLInputElement>(null);
  const target = useRef<{ trackId: string; projectCreated: number } | null>(null);
  const track = store.state.project.tracks.find(t => t.id === store.state.selectedTrackId);
  const active = track?.takes.find(t => t.id === track.activeTakeId);
  const capturing = recorder.status === 'capturing';
  const paused = recorder.status === 'paused';
  const locked = capturing || paused || recorder.status === 'saving' || recorder.canRetrySave || busy;

  useEffect(() => {
    const unsubscribe = recorder.subscribe(() => refresh(n => n + 1));
    recorder.onTakeReady = ({ meta }) => {
      const current = latest.current;
      const destination = target.current;
      if (!destination || current.state.project.createdAt !== destination.projectCreated || !current.state.project.tracks.some(t => t.id === destination.trackId)) {
        onToast('Audio saved locally, but its original project is no longer open.');
        return;
      }
      current.apply('Record vocal take', [{ op: 'add_take', trackId: destination.trackId, take: meta }]);
      onToast('Take stored on this device. Save the project to keep its arrangement.');
    };
    const timer = window.setInterval(() => { setLevel(recorder.getInputLevel()); setSeconds(recorder.elapsedSeconds); }, 80);
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (recorder.status === 'capturing' || recorder.status === 'paused' || recorder.status === 'saving' || recorder.canRetrySave) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      unsubscribe(); window.clearInterval(timer);
      window.removeEventListener('beforeunload', beforeUnload);
      recorder.releaseInput();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setWave([]); setError('');
    if (active) void audioAssets.load(active.id).then(asset => {
      const peaks = Array.from({ length: 160 }, (_, column) => {
        const from = Math.floor(column * asset.pcm.length / 160);
        const to = Math.floor((column + 1) * asset.pcm.length / 160);
        let peak = 0; for (let i = from; i < to; i++) peak = Math.max(peak, Math.abs(asset.pcm[i]));
        return peak;
      });
      if (!cancelled) setWave(peaks);
    }).catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [active?.id]);

  const enable = async () => {
    setBusy(true); setError('');
    try { await audio.requestInput(); } catch { setError('Audio could not start. Check your browser and microphone settings.'); }
    finally { setBusy(false); }
  };
  const addVocal = () => {
    const id = uid('track');
    const vocal: Track = { id, name: 'Lead vocal', color: '#3ecfb2', instrument: 'keys', volume: 0.8, pan: 0, mute: false, solo: false, fx: { cutoff: 18000, drive: 0, reverb: 0.12, delay: 0 }, clipIds: [], sourceClipId: '', placements: [], recordArm: false, monitor: false, takes: [], activeTakeId: null };
    store.apply('Add vocal track', [{ op: 'add_track', track: vocal }, { op: 'create_clip', trackId: id, clip: { id: uid('clip'), name: 'Vocal lane', lengthBars: 1, notes: [] } }]); store.selectTrack(id);
  };
  const importBeat = async (file: File) => {
    setBusy(true); setError('');
    try {
      const createdAt = store.state.project.createdAt;
      const take = await audio.importAudio(file, store.state.project.bpm);
      if (latest.current.state.project.createdAt !== createdAt) throw new Error('The project changed during import. Please import again.');
      const id = uid('track');
      const imported: Track = { id, name: take.name, color: '#ffb45e', instrument: 'keys', volume: 0.8, pan: 0, mute: false, solo: false, fx: { cutoff: 18000, drive: 0, reverb: 0, delay: 0 }, clipIds: [], sourceClipId: '', placements: [], recordArm: false, monitor: false, takes: [take], activeTakeId: take.id };
      audio.stop();
      store.apply('Import beat', [{ op: 'add_track', track: imported }, { op: 'create_clip', trackId: id, clip: { id: uid('clip'), name: 'Audio lane', lengthBars: 1, notes: [] } }, { op: 'set_length', bars: Math.max(store.state.project.lengthBars, Math.ceil(take.durationSteps / 16)) }]);
      store.selectTrack(id); onToast('Audio imported with its original channels. Add a vocal track to record over it.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Audio import failed.'); }
    finally { setBusy(false); }
  };
  const record = async () => {
    if (!track) return;
    setBusy(true); setError('');
    try {
      if (!recorder.isReady && !await audio.requestInput()) return;
      target.current = { trackId: track.id, projectCreated: store.state.project.createdAt };
      audio.setLoop(false);
      await audio.play();
      recorder.startCapture(audio.getCurrentStep());
    } catch (e) { setError(e instanceof Error ? e.message : 'Recording could not start.'); }
    finally { setBusy(false); }
  };
  const stop = () => { recorder.stopRecording(); audio.stop(); };
  const pause = () => { recorder.pauseCapture(); audio.pause(); };
  const resume = async () => { try { await audio.play(); recorder.resumeCapture(); } catch (e) { setError(e instanceof Error ? e.message : 'Playback could not resume.'); } };
  const control = 'bg-ink-750 border border-ink-600 rounded-lg px-4 py-2 text-sm disabled:opacity-40 hover:border-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal';
  return <section className="flex-1 min-h-0 overflow-auto rounded-xl border border-ink-700 bg-ink-900 p-4 md:p-6" aria-label="Vocal and rap studio">
    <div className="flex flex-wrap justify-between items-start gap-3 mb-6"><div><p className="text-teal text-xs uppercase tracking-widest">Vocal / Rap Studio</p><h1 className="text-2xl font-semibold mt-1">Find your voice.</h1><p className="text-sm text-ink-400 mt-2">Record over your arrangement. Keep each take and compare your delivery.</p></div><button className={control} onClick={addVocal} disabled={locked}>+ Vocal track</button></div>
    <div className="flex flex-wrap gap-4 mb-5">
      <button className={control} disabled={locked} onClick={() => importRef.current?.click()}>Import beat / audio</button>
      <input ref={importRef} type="file" accept="audio/*,.wav,.mp3,.m4a,.flac,.ogg,.opus" className="hidden" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void importBeat(file); }} />
      <label className="text-sm">Recording track<select className="block bg-ink-800 p-2 rounded mt-1 max-w-full" value={track?.id ?? ''} disabled={locked} onChange={e => store.selectTrack(e.target.value)}>{store.state.project.tracks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      <label className="text-sm">Microphone<select aria-label="Microphone" className="block bg-ink-800 p-2 rounded mt-1 max-w-64" value={recorder.selectedDeviceId} disabled={locked} onChange={e => recorder.selectDevice(e.target.value)}><option value="">System default</option>{recorder.getDevices().map(d => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}</select></label>
      <button className={control} disabled={locked} onClick={() => void enable()}>{busy ? 'Opening microphone…' : 'Enable microphone'}</button>
      <button className={control} disabled={locked || !recorder.isReady} onClick={() => recorder.releaseInput()}>Release microphone</button>
    </div>
    <div className="p-4 bg-ink-950 rounded-lg border border-ink-700 mb-4">
      <div className="flex justify-between text-sm mb-2"><span role="status">{recorder.status === 'capturing' ? 'Recording' : paused ? 'Recording paused' : recorder.status === 'saving' ? 'Saving audio…' : recorder.isReady ? 'Microphone ready' : 'Microphone off'}</span><span className="font-mono">{seconds.toFixed(1)} s</span></div>
      <meter className="w-full" aria-label="Microphone input level" min={0} max={1} value={level} />
      <p className="text-xs text-ink-400 mt-2">{level >= 0.98 ? 'Clipping — lower your microphone gain or move farther away.' : 'Use headphones when recording over a beat. Live microphone monitoring is off.'}</p>
    </div>
    <div className="flex flex-wrap gap-2 mb-5">
      <button className={control + ' text-rec'} onClick={() => void record()} disabled={locked || !track}>● Record a take</button>
      {capturing && <button className={control} onClick={pause}>Pause take</button>}
      {paused && <button className={control} onClick={() => void resume()}>Resume take</button>}
      <button className={control} onClick={stop} disabled={!capturing && !paused}>■ Stop & save take</button>
      <button className={control} disabled={locked} onClick={() => { audio.stop(); void audio.play().catch(e => setError(e.message)); }}>▶ Play arrangement</button>
      <button className={control} onClick={() => audio.stop()}>Stop playback</button>
      {recorder.canRetrySave && <button className={control} disabled={recorder.status === 'saving'} onClick={() => void recorder.retrySave()}>Retry saving take</button>}
    </div>
    {(error || recorder.error) && <p role="alert" className="text-rec text-sm mb-4">{error || recorder.error}</p>}
    <div className="grid lg:grid-cols-2 gap-5">
      <div><h2 className="text-lg font-semibold">Your takes <span className="text-ink-400 text-sm">{track?.takes.length ?? 0}</span></h2>
        <svg viewBox="0 0 480 96" className="w-full h-24 my-3 bg-ink-950 rounded" role="img" aria-label={active ? `Waveform of ${active.name}` : 'No recorded take selected'}>{wave.map((v, i) => <line key={i} x1={i * 3} x2={i * 3} y1={48 - v * 44} y2={48 + v * 44} stroke="#3ecfb2" strokeWidth="2" />)}</svg>
        {!track?.takes.length && <p className="text-sm text-ink-400">Add a vocal track, enable your mic, and record your first take.</p>}
        <div className="flex flex-col gap-2">{track?.takes.map(take => <button key={take.id} disabled={locked} aria-pressed={take.id === active?.id} className={control + ' text-left ' + (take.id === active?.id ? 'text-teal' : '')} onClick={() => store.apply('Select vocal take', [{ op: 'set_active_take', trackId: track.id, takeId: take.id }])}>{take.id === active?.id ? '✓ ' : ''}{take.name} <span className="text-xs text-ink-400">· peak {Math.round(take.peak * 100)}%</span></button>)}</div>
        {track && <div className="flex flex-col gap-3 mt-4"><label className="text-sm">Vocal level<input aria-label="Vocal level" type="range" min="0" max="1.25" step="0.01" value={track.volume} onChange={e => store.apply('Vocal level', [{ op: 'set_track_volume', trackId: track.id, value: Number(e.target.value) }])} className="block w-full" /></label><label className="text-sm">Reverb<input aria-label="Vocal reverb" type="range" min="0" max="1" step="0.01" value={track.fx.reverb} onChange={e => store.apply('Vocal reverb', [{ op: 'set_track_fx', trackId: track.id, fx: { reverb: Number(e.target.value) } }])} className="block w-full" /></label></div>}
      </div>
      <div>{track && <VocalControls track={track} />}<label htmlFor="lyric-draft" className="text-lg font-semibold">Practice scratchpad</label><p className="text-xs text-ink-400 my-2">Saved with your project. Use a new line for each phrase.</p><textarea id="lyric-draft" value={lyrics} onChange={e => store.apply("Edit lyrics", [{ op: "set_lyrics", text: e.target.value }])} maxLength={10000} placeholder="Write a verse. Mark a breath. Try a new flow." className="w-full min-h-44 rounded-lg bg-ink-950 border border-ink-700 p-3 text-sm" /><p className="text-xs text-ink-400 mt-2">{lyricAnalysis.wordCount} words · {store.state.project.bpm} BPM</p><div className="text-xs text-ink-400 space-y-2 mt-3"><p>Rhyme ideas: {lyricAnalysis.rhymes.length ? lyricAnalysis.rhymes.join(", ") : "Try ending a line with light, time, flow, day, fire, or sound."}</p>{lyricAnalysis.repeated.length > 0 && <p>Repeated words: {lyricAnalysis.repeated.map(([word,count]) => `${word} (${count})`).join(", ")}</p>}{lyricAnalysis.lines.length > 0 && <p>Approximate English syllables per phrase: {lyricAnalysis.lines.map(line => line.syllables).join(" · ")}. This is a spelling heuristic, not a pronunciation score.</p>}</div><p className="text-xs text-ink-400 mt-4">Recordings stay in this browser. Use Save file to download a portable project backup containing every take. Keep a backup before clearing site data. Legacy JSON files contain metadata only.</p></div>
    </div>
  </section>;
}





