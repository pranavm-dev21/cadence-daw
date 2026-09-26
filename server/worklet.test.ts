import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
interface Processor { port: { onmessage: (event: { data: string }) => void }; process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean; }
describe('audio-thread capture processor', () => {
  it('captures mono samples, omits pauses, flushes its tail and never monitors input', () => {
    const messages: { type: string; samples?: Float32Array }[] = [];
    let Capture!: new (options: object) => Processor;
    class Base { port = { onmessage: () => {}, postMessage: (data: { type: string; samples?: Float32Array }) => messages.push(data) }; }
    runInNewContext(readFileSync(new URL('../public/capture.worklet.js', import.meta.url), 'utf8'), {
      AudioWorkletProcessor: Base, Float32Array, currentTime: 0, sampleRate: 48000,
      registerProcessor: (_name: string, type: typeof Capture) => { Capture = type; },
    });
    const processor = new Capture({}); const output = new Float32Array(2).fill(1);
    processor.process([[new Float32Array([0.2,0.4]), new Float32Array([0.4,0.6])]], [[output]]);
    expect([...output]).toEqual([0,0]);
    processor.port.onmessage({ data: 'pause' }); processor.process([[new Float32Array([1,1])]], [[output]]);
    processor.port.onmessage({ data: 'resume' }); processor.process([[new Float32Array([0.1])]], [[output]]);
    processor.port.onmessage({ data: 'stop' });
    expect(messages[0].samples?.length).toBe(3); expect(messages[0].samples?.[0]).toBeCloseTo(0.3); expect(messages[0].samples?.[2]).toBeCloseTo(0.1);
    expect(messages[1].type).toBe('done'); expect(processor.process([], [[output]])).toBe(false);
  });
});
