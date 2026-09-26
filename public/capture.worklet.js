/* Runs on the audio rendering thread. Output stays silent: no accidental monitoring. */
class CadenceCapture extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.chunk = new Float32Array(4096);
    this.used = 0;
    this.paused = false;
    this.stopped = false;
    this.startAt = options.processorOptions?.startAt ?? 0;
    this.port.onmessage = ({ data }) => {
      if (data === 'pause') this.paused = true;
      if (data === 'resume') this.paused = false;
      if (data === 'stop') {
        this.flush(); this.stopped = true; this.port.postMessage({ type: 'done' });
      }
    };
  }
  flush() {
    if (!this.used) return;
    const samples = this.used === this.chunk.length ? this.chunk : this.chunk.slice(0, this.used);
    this.port.postMessage({ type: 'samples', samples }, [samples.buffer]);
    this.chunk = new Float32Array(4096); this.used = 0;
  }
  process(inputs, outputs) {
    for (const output of outputs) for (const channel of output) channel.fill(0);
    if (this.stopped) return false;
    if (this.paused || !inputs[0]?.length) return true;
    const channels = inputs[0];
    const skip = Math.max(0, Math.min(channels[0].length, Math.ceil((this.startAt - currentTime) * sampleRate)));
    for (let frame = skip; frame < channels[0].length; frame++) {
      let sample = 0;
      for (const channel of channels) sample += channel[frame];
      this.chunk[this.used++] = sample / channels.length;
      if (this.used === this.chunk.length) this.flush();
    }
    return true;
  }
}
registerProcessor('cadence-capture', CadenceCapture);
