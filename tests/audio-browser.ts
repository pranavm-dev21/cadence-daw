import { audio } from '../src/core/audio';
import { AudioAssetLibrary, IndexedDbAssets, audioAssets } from '../src/audio/assets';
import { buildEmptyProject } from '../src/core/seed';
import { execCommand } from '../src/core/executors';
import { serialize, deserialize } from '../src/core/format';
import { importAudioFile } from '../src/audio/import';
import { encodeWavExt } from '../src/audio/render';
const output = document.querySelector('#results')!;
document.querySelector('#run')!.addEventListener('click', async () => {
  output.textContent = 'Running…';
  const messages: string[] = [];
  const assert = (value: unknown, label: string) => { if (!value) throw new Error(label); messages.push('PASS ' + label); output.textContent = messages.join('\n'); };
  const context = new AudioContext({ sampleRate: 48000 });
  const original = navigator.mediaDevices.getUserMedia;
  let oscillator: OscillatorNode | undefined;
  try {
    await context.resume();
    const destination = context.createMediaStreamDestination();
    oscillator = context.createOscillator(); oscillator.frequency.value = 440;
    const gain = context.createGain(); gain.gain.value = 0.2;
    oscillator.connect(gain); gain.connect(destination); oscillator.start();
    navigator.mediaDevices.getUserMedia = async () => destination.stream;
    let project = buildEmptyProject();
    project = { ...project, lengthBars: 1, bpm: 120, tracks: project.tracks.map(t => ({ ...t, placements: [] })) };
    audio.setProject(project);
    assert(await audio.requestInput(), 'Synthetic microphone initialized');
    assert(audio.recorder.capturePath === 'audio-worklet', 'Browser uses audio-thread capture');
    const takePromise = new Promise<import('../src/audio/recorder').CapturedTake>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Recording save timed out')), 10000);
      audio.recorder.onTakeReady = take => { clearTimeout(timeout); resolve(take); };
    });
    audio.recorder.startCapture(0);
    assert(audio.recorder.status === 'capturing', 'Recorder enters capturing state');
    await new Promise(resolve => setTimeout(resolve, 450));
    audio.recorder.onTransportHalt();
    const take = await takePromise;
    assert(take.pcm.some(value => Math.abs(value) > 0.01), 'Captured PCM contains the synthetic tone');
    const reopened = await new AudioAssetLibrary(new IndexedDbAssets()).load(take.meta.id);
    assert(reopened.pcm.length === take.pcm.length && reopened.pcm[100] === take.pcm[100], 'Fresh asset library restores exact stored PCM');
    project = execCommand(project, { op: 'add_take', trackId: project.tracks[0].id, take: take.meta });
    const loaded = deserialize(serialize(project));
    assert(loaded.ok, 'Project metadata round-trips');
    if (!loaded.ok) throw new Error(loaded.error);
    const wav = await audio.exportWav(loaded.project);
    const wavBytes = await wav.arrayBuffer();
    const header = new DataView(wavBytes);
    assert(header.getUint32(24, true) === 48000 && header.getUint16(34, true) === 24, 'Export header is 48 kHz / 24-bit PCM');
    const decoded = await context.decodeAudioData(wavBytes);
    assert(decoded.sampleRate === context.sampleRate && decoded.numberOfChannels === 2, 'Browser decodes exported stereo WAV');
    assert(decoded.getChannelData(0).some(value => Math.abs(value) > 0.001), 'Export includes recorded vocal audio');
    const processed = execCommand(project, { op: 'set_track_fx', trackId: project.tracks[0].id, fx: { vocal: { highPass: 400, presence: -12, threshold: -50, ratio: 12, attack: 0.001, release: 0.1, makeup: 0.25 } } });
    const processedWav = await audio.exportWav(processed);
    const processedAudio = await context.decodeAudioData(await processedWav.arrayBuffer());
    const energy = (buffer: AudioBuffer) => buffer.getChannelData(0).reduce((sum, value) => sum + value * value, 0);
    assert(energy(processedAudio) < energy(decoded) * 0.5, 'Vocal EQ and compression measurably change exported audio');
    assert(audio.recorder.status === 'ready', 'Recorder returns to ready after durable save');
    const missing = { ...take.meta, id: 'missing_asset_test' };
    const broken = execCommand(project, { op: 'add_take', trackId: project.tracks[0].id, take: missing });
    let rejected = false;
    try { await audio.exportWav(broken); } catch { rejected = true; }
    assert(rejected, 'Export fails explicitly when a referenced take is missing');
    const stereo = context.createBuffer(2, 4800, 48000);
    stereo.getChannelData(0).fill(0.25); stereo.getChannelData(1).fill(-0.125);
    const stereoFile = new File([encodeWavExt(stereo, 24)], 'stereo-check.wav', { type: 'audio/wav' });
    const imported = await importAudioFile(stereoFile, context, 120);
    const stereoAsset = await new AudioAssetLibrary(new IndexedDbAssets()).load(imported.id);
    assert(stereoAsset.channelCount === 2 && Math.abs(stereoAsset.pcm[200] - 0.25) < 0.001 && Math.abs(stereoAsset.pcm[201] + 0.125) < 0.001, 'Stereo import preserves distinct left and right samples');
    output.textContent += '\nALL CHECKS PASSED';
  } catch (error) { output.textContent += '\nFAIL ' + (error instanceof Error ? error.message : String(error)); }
  finally {
    audio.recorder.releaseInput(); audio.stop();
    navigator.mediaDevices.getUserMedia = original;
    oscillator?.stop(); await context.close();
  }
});


