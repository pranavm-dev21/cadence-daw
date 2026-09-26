import type { VocalSettings } from '../core/vocal';
/** Native audio-thread EQ and compression, shared by playback and offline mix. */
export class VocalProcessor {
  readonly input: BiquadFilterNode;
  readonly presence: BiquadFilterNode;
  readonly compressor: DynamicsCompressorNode;
  readonly output: GainNode;
  constructor(ctx: BaseAudioContext, settings: VocalSettings) {
    this.input = ctx.createBiquadFilter(); this.input.type = 'highpass'; this.input.Q.value = 0.707;
    this.presence = ctx.createBiquadFilter(); this.presence.type = 'peaking'; this.presence.frequency.value = 3200; this.presence.Q.value = 0.8;
    this.compressor = ctx.createDynamicsCompressor(); this.compressor.knee.value = 12;
    this.output = ctx.createGain();
    this.input.connect(this.presence); this.presence.connect(this.compressor); this.compressor.connect(this.output);
    this.configure(settings);
  }
  configure(s: VocalSettings): void {
    this.input.frequency.value = s.highPass; this.presence.gain.value = s.presence;
    this.compressor.threshold.value = s.threshold; this.compressor.ratio.value = s.ratio;
    this.compressor.attack.value = s.attack; this.compressor.release.value = s.release; this.output.gain.value = s.makeup;
  }
  dispose(): void { this.input.disconnect(); this.presence.disconnect(); this.compressor.disconnect(); this.output.disconnect(); }
}
