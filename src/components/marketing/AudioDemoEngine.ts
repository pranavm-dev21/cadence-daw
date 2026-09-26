/**
 * Pure Web Audio synthesized demo engine for the Cadence landing page.
 * Zero external samples, zero network downloads, instant audio synthesis.
 */

class AudioDemoEngine {
  private ctx: AudioContext | null = null;
  private isRunning = false;
  private tempo = 104; // BPM
  private currentStep = 0;
  private timerId: number | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private stepCallbacks: Set<(step: number, bar: number) => void> = new Set();
  private isMuted = false;

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.35;
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 64;
      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
  }

  public subscribeStep(cb: (step: number, bar: number) => void): () => void {
    this.stepCallbacks.add(cb);
    return () => this.stepCallbacks.delete(cb);
  }

  public start() {
    if (this.isRunning) return;
    this.initContext();
    this.isRunning = true;
    this.currentStep = 0;
    const stepDurationMs = (60 / this.tempo / 4) * 1000;

    const tick = () => {
      if (!this.isRunning) return;
      this.triggerStep(this.currentStep);
      const bar = Math.floor(this.currentStep / 16);
      this.stepCallbacks.forEach((cb) => cb(this.currentStep, bar));
      this.currentStep = (this.currentStep + 1) % 64;
      this.timerId = window.setTimeout(tick, stepDurationMs);
    };

    tick();
  }

  public stop() {
    this.isRunning = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.currentStep = 0;
    this.stepCallbacks.forEach((cb) => cb(0, 0));
  }

  public toggle(): boolean {
    if (this.isRunning) {
      this.stop();
      return false;
    } else {
      this.start();
      return true;
    }
  }

  public getPlaying(): boolean {
    return this.isRunning;
  }

  public setMute(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.35, this.ctx.currentTime, 0.05);
    }
  }

  public getMeterLevel(): number {
    if (!this.analyser || !this.isRunning || this.isMuted) return 0;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
    }
    const avg = sum / data.length / 255;
    return Math.min(1, Math.max(0, avg * 1.8));
  }

  private triggerStep(step: number) {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const stepInBar = step % 16;
    const bar = Math.floor(step / 16);

    // KICK (steps 0, 8, and occasionally 14)
    if (stepInBar === 0 || stepInBar === 8 || (bar % 2 === 1 && stepInBar === 14)) {
      this.playKick(now);
    }

    // SNARE (steps 4, 12)
    if (stepInBar === 4 || stepInBar === 12) {
      this.playSnare(now);
    }

    // HI-HAT (every 2 steps + subtle 16th roll)
    if (stepInBar % 2 === 0 || (stepInBar >= 12 && step % 4 === 1)) {
      const accent = stepInBar === 2 || stepInBar === 10;
      this.playHiHat(now, accent ? 0.3 : 0.15);
    }

    // 808 BASS & CHORDS (trigger on key structural steps)
    if (stepInBar === 0 || stepInBar === 6 || stepInBar === 10) {
      const chordRoots = [55, 43.65, 65.41, 49]; // A1, F1, C2, G1 (Am, F, C, G)
      const freq = chordRoots[bar % chordRoots.length];
      this.playBass(now, freq);
    }

    // AMBIENT PAD CHORD (change every bar)
    if (stepInBar === 0) {
      const padChords = [
        [220, 261.63, 329.63, 392], // Am7
        [174.61, 220, 261.63, 329.63], // Fmaj7
        [261.63, 329.63, 392, 493.88], // Cmaj7
        [196, 246.94, 293.66, 392], // G
      ];
      this.playPad(now, padChords[bar % padChords.length]);
    }
  }

  private playKick(t: number) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(36, t + 0.12);
    gain.gain.setValueAtTime(0.9, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  private playSnare(t: number) {
    if (!this.ctx || !this.masterGain) return;
    // Noise buffer
    const bufSize = this.ctx.sampleRate * 0.15;
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(1000, t);
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.4, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noise.start(t);
    noise.stop(t + 0.15);

    // Tonal pop
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.08);
    oscGain.gain.setValueAtTime(0.3, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  private playHiHat(t: number, vol: number) {
    if (!this.ctx || !this.masterGain) return;
    const bufSize = this.ctx.sampleRate * 0.05;
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(7500, t);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(t);
    noise.stop(t + 0.05);
  }

  private playBass(t: number, freq: number) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.55, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.65);
  }

  private playPad(t: number, freqs: number[]) {
    if (!this.ctx || !this.masterGain) return;
    freqs.forEach((f) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const filter = this.ctx!.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(800, t);
      osc.type = "triangle";
      osc.frequency.setValueAtTime(f, t);
      // Gentle attack and release
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.07, t + 0.25);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 2.0);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 2.1);
    });
  }
}

export const demoAudio = new AudioDemoEngine();
