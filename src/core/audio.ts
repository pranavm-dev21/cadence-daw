/* Audio-backend seam.
 *
 * UI components and the app layer talk ONLY to the AudioBackend interface —
 * never to AudioNodes, AudioContext, or a concrete engine. Today the backend
 * is the Web Audio engine (src/audio/engine.ts); when the desktop shell
 * arrives, a TauriBackend implementing this same interface can route
 * transport/preview/meter calls over IPC to a native (Rust/CPAL) engine
 * without touching a single component. */

import { Project, TakeMeta } from "../types";
import { getEngine } from "../audio/engine";
import type { ProfilerStats } from "../audio/profiler";
import type { MeterReading, ReturnInfo } from "../audio/mixer";
import { getRecorder } from "../audio/recorder";
import type { AudioRecorder } from "../audio/recorder";
import type { WavSettings } from "../audio/engine";

/* Static return-bus identities (not audio nodes) — safe for UI to read. */
export { RETURN_DEFS } from "../audio/mixer";
export type { MeterReading, ReturnInfo } from "../audio/mixer";

export interface AudioVoice {
  stop(): void;
}

export interface AudioBackend {
  readonly kind: "webaudio" | "native";

  /* graph */
  setProject(p: Project): void;

  /* transport — the UI calls only these, never touches audio nodes */
  play(): Promise<void>;
  requestInput(): Promise<boolean>;
  importAudio(file: File, bpm: number): Promise<TakeMeta>;
  readonly recorder: AudioRecorder;
  pause(): void;
  stop(): void;
  readonly playing: boolean;
  setLoop(loop: boolean): void;
  readonly loop: boolean;
  setRecordArm(armed: boolean): void;
  isRecordArmed(): boolean;
  getCurrentStep(): number;
  setOnTransport(cb: ((playing: boolean) => void) | null): void;

  /* performance */
  previewNote(trackId: string, pitch: number, vel?: number, durSec?: number): AudioVoice;

  /* voice pool — bounded polyphony with stealing */
  setMaxPolyphony(n: number): void;
  getMaxPolyphony(): number;
  getActiveVoices(): number;
  getStolenVoices(): number;

  /* rendering */
  exportWav(p: Project, settings?: WavSettings): Promise<Blob>;

  /* mixer — channel strips, return buses, master bus, metering */
  getChannelMeter(trackId: string): MeterReading;
  getMasterMeter(): MeterReading;
  getReturnMeter(returnId: string): MeterReading;
  getReturnInfos(): ReturnInfo[];

  /* FX — relative CPU load (shared node-cost model) */
  getChannelCpuCost(trackId: string): number;
  getBusCpuCost(): number;
  getTotalCpuCost(): number;

  /* metering / diagnostics */
  getTrackLevel(trackId: string): number;
  getMasterLevel(): number;
  getSpectrum(out: Uint8Array): void;
  getLoad(): number;
  getLatencyMs(): number;
  getProfilerStats(): ProfilerStats;
}

class WebAudioBackend implements AudioBackend {
  readonly kind = "webaudio" as const;
  private get e() {
    return getEngine();
  }

  setProject(p: Project): void {
    this.e.setProject(p);
  }

  play(): Promise<void> {
    return this.e.play();
  }
  requestInput(): Promise<boolean> { return this.e.requestInput(); }
  importAudio(file: File, bpm: number): Promise<TakeMeta> { return this.e.importAudio(file, bpm); }
  get recorder(): AudioRecorder { return getRecorder(); }
  pause(): void {
    this.e.pause();
  }
  stop(): void {
    this.e.stop();
  }
  get playing(): boolean {
    return this.e.playing;
  }
  setLoop(loop: boolean): void {
    this.e.setLoop(loop);
  }
  get loop(): boolean {
    return this.e.loop;
  }
  setRecordArm(armed: boolean): void {
    this.e.setRecordArm(armed);
  }
  isRecordArmed(): boolean {
    return this.e.isRecordArmed();
  }
  getCurrentStep(): number {
    return this.e.getCurrentStep();
  }
  setOnTransport(cb: ((playing: boolean) => void) | null): void {
    this.e.onTransport = cb;
  }

  previewNote(trackId: string, pitch: number, vel = 0.85, durSec = 8): AudioVoice {
    return this.e.previewNote(trackId, pitch, vel, durSec);
  }

  setMaxPolyphony(n: number): void {
    this.e.setMaxPolyphony(n);
  }
  getMaxPolyphony(): number {
    return this.e.getMaxPolyphony();
  }
  getActiveVoices(): number {
    return this.e.getActiveVoices();
  }
  getStolenVoices(): number {
    return this.e.getStolenVoices();
  }

  exportWav(p: Project, settings?: WavSettings): Promise<Blob> {
    return this.e.exportWav(p, settings);
  }

  getChannelMeter(trackId: string): MeterReading {
    return this.e.getChannelMeter(trackId);
  }
  getMasterMeter(): MeterReading {
    return this.e.getMasterMeter();
  }
  getReturnMeter(returnId: string): MeterReading {
    return this.e.getReturnMeter(returnId);
  }
  getReturnInfos(): ReturnInfo[] {
    return this.e.getReturnInfos();
  }

  getChannelCpuCost(trackId: string): number {
    return this.e.getChannelCpuCost(trackId);
  }
  getBusCpuCost(): number {
    return this.e.getBusCpuCost();
  }
  getTotalCpuCost(): number {
    return this.e.getTotalCpuCost();
  }

  getTrackLevel(trackId: string): number {
    return this.e.getTrackLevel(trackId);
  }
  getMasterLevel(): number {
    return this.e.getMasterLevel();
  }
  getSpectrum(out: Uint8Array): void {
    this.e.getSpectrum(out);
  }
  getLoad(): number {
    return this.e.getLoad();
  }
  getLatencyMs(): number {
    return this.e.getLatencyMs();
  }
  getProfilerStats(): ProfilerStats {
    return this.e.getProfilerStats();
  }
}

/* Future:
 * class TauriBackend implements AudioBackend {
 *   readonly kind = "native" as const;
 *   // transport & preview commands → invoke("plugin:audio|play", …)
 *   // metering ← event channel from the Rust engine, throttled to ~30 Hz
 * }
 */

/** The backend every UI component talks to. */
export const audio: AudioBackend = new WebAudioBackend();
