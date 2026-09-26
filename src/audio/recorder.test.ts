import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioRecorder } from './recorder';
import { audioAssets } from './assets';
import type { MixerEngine } from './mixer';

function setup() {
  const node = () => ({ connect: vi.fn(), disconnect: vi.fn(), gain: { value: 0 } });
  const processor = { ...node(), onaudioprocess: null as null | ((e: AudioProcessingEvent) => void) };
  const track = { stop: vi.fn(), onended: null as null | (() => void) };
  const stream = { active: true, getTracks: () => [track], getAudioTracks: () => [track] };
  const getUserMedia = vi.fn().mockResolvedValue(stream);
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia, enumerateDevices: vi.fn().mockResolvedValue([]) } });
  const ctx = { currentTime: 0, sampleRate: 48000, destination: node(), createGain: node, createMediaStreamSource: node, createAnalyser: () => ({ ...node(), fftSize: 512 }), createScriptProcessor: () => processor } as unknown as AudioContext;
  const recorder = new AudioRecorder(); recorder.attach(ctx, {} as MixerEngine);
  const feed = (pcm: Float32Array) => processor.onaudioprocess?.({ inputBuffer: { getChannelData: () => pcm } } as unknown as AudioProcessingEvent);
  return { recorder, track, getUserMedia, feed };
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('recording lifecycle', () => {
  it('captures, pauses without collecting samples, resumes and only publishes after durable save', async () => {
    const { recorder, feed } = setup();
    const save = vi.spyOn(audioAssets, 'save').mockResolvedValue();
    recorder.onTakeReady = vi.fn();
    expect(await recorder.requestInput()).toBe(true);
    recorder.startCapture(4); feed(new Float32Array([0.2, 0.3]));
    recorder.pauseCapture(); recorder.onTransportHalt(); feed(new Float32Array([0.9]));
    expect(recorder.status).toBe('paused'); expect(save).not.toHaveBeenCalled();
    recorder.resumeCapture(); feed(new Float32Array([-0.1])); recorder.stopRecording();
    expect(recorder.status).toBe('saving'); expect(recorder.onTakeReady).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(recorder.status).toBe('ready'));
    expect(save.mock.calls[0][0].pcm).toEqual(new Float32Array([0.2, 0.3, -0.1]));
    expect(save.mock.calls[0][0].sampleRate).toBe(48000);
    expect(recorder.onTakeReady).toHaveBeenCalledOnce();
  });
  it('retains an unsaved take and retries after a quota error', async () => {
    const { recorder, feed } = setup();
    vi.spyOn(audioAssets, 'save').mockRejectedValueOnce(new Error('quota')).mockResolvedValueOnce();
    recorder.onTakeReady = vi.fn(); await recorder.requestInput(); recorder.startCapture(0); feed(new Float32Array([0.1])); recorder.stopRecording();
    await vi.waitFor(() => expect(recorder.status).toBe('error'));
    expect(recorder.canRetrySave).toBe(true); expect(recorder.onTakeReady).not.toHaveBeenCalled();
    expect(() => recorder.startCapture(0)).toThrow();
    await recorder.retrySave(); expect(recorder.status).toBe('ready'); expect(recorder.canRetrySave).toBe(false); expect(recorder.onTakeReady).toHaveBeenCalledOnce();
  });
  it('recovers from permission denial and closes tracks when input is released', async () => {
    const { recorder, track, getUserMedia } = setup();
    getUserMedia.mockRejectedValueOnce(new Error('denied'));
    expect(await recorder.requestInput()).toBe(false); expect(recorder.status).toBe('error');
    expect(recorder.error).toContain('microphone');
    expect(await recorder.requestInput()).toBe(true); recorder.releaseInput();
    expect(track.stop).toHaveBeenCalledOnce(); expect(recorder.status).toBe('idle');
  });
  it('saves an interrupted take on device disconnection', async () => {
    const { recorder, track, feed } = setup();
    vi.spyOn(audioAssets, 'save').mockResolvedValue(); recorder.onTakeReady = vi.fn();
    await recorder.requestInput(); recorder.startCapture(0); feed(new Float32Array([0.2])); track.onended?.();
    await vi.waitFor(() => expect(recorder.onTakeReady).toHaveBeenCalledOnce());
    expect(recorder.recordEnabled).toBe(false);
    expect(recorder.error).toContain('disconnected');
  });
});
