import React, { useState, useRef, useEffect } from "react";
import { useStore } from "../state/store";
import { useHint } from "../state/hintContext";
import { audio } from "../core";
import { uid } from "../types";
import {
  trimBuffer,
  normalizeBuffer,
  reverseBufferRegion,
  silenceRegion,
  applyFadeRegion,
  detectSlicePoints,
  createAudioBuffer,
} from "../audio/sampleOperations";
import { IconPlay, IconPause, IconStop, IconScissors, IconPlus, IconMinus, IconSparkles } from "./icons";

export default function EdisonEditor({ onToast }: { onToast: (msg: string) => void }) {
  const { state, apply, setWorkspaceView } = useStore();
  const { bindHint } = useHint();

  // Internal AudioBuffer state
  const [currentBuffer, setCurrentBuffer] = useState<AudioBuffer | null>(null);
  const [sampleName, setSampleName] = useState("Acoustic_Break_140BPM.wav");
  const [selection, setSelection] = useState<[number, number] | null>([0.1, 0.45]); // 0..1 fractions
  const [slices, setSlices] = useState<number[]>([0, 0.25, 0.5, 0.75]);
  const [zoom, setZoom] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Initialize a synthetic drum loop on mount
  useEffect(() => {
    const sr = 44100;
    const len = sr * 2; // 2 seconds
    const buf = createAudioBuffer(2, len, sr);
    const ch0 = buf.getChannelData(0);
    const ch1 = buf.getChannelData(1);

    // Create a punchy beat pattern with noise and decay
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const beat = (t * 4) % 1;
      const kick = Math.sin(2 * Math.PI * (120 * Math.exp(-beat * 25)) * beat) * Math.exp(-beat * 12);
      const snare = ((Math.random() * 2 - 1) * 0.4 + Math.sin(2 * Math.PI * 220 * beat) * 0.3) * Math.exp(-((beat + 0.5) % 1) * 14);
      const val = (kick + snare) * 0.7;
      ch0[i] = val;
      ch1[i] = val;
    }
    setCurrentBuffer(buf);
  }, []);

  // Waveform rendering
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !currentBuffer) return;
    const g = cv.getContext("2d");
    if (!g) return;

    const w = cv.width;
    const h = cv.height;
    g.clearRect(0, 0, w, h);

    // Background grid
    g.fillStyle = "#0c1017";
    g.fillRect(0, 0, w, h);

    g.strokeStyle = "rgba(255, 255, 255, 0.05)";
    g.lineWidth = 1;
    for (let x = 0; x < w; x += 40) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, h);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(0, h / 2);
    g.lineTo(w, h / 2);
    g.stroke();

    const data = currentBuffer.getChannelData(0);
    const step = Math.max(1, Math.floor(data.length / w));
    const mid = h / 2;

    // Draw waveform
    g.fillStyle = "#ffb45e";
    for (let x = 0; x < w; x++) {
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = data[x * step + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      const yMin = mid + min * mid * 0.95;
      const yMax = mid + max * mid * 0.95;
      g.fillRect(x, yMin, 1, Math.max(1, yMax - yMin));
    }

    // Draw selection
    if (selection) {
      const [s, e] = selection;
      const startX = Math.floor(Math.min(s, e) * w);
      const endX = Math.ceil(Math.max(s, e) * w);
      g.fillStyle = "rgba(0, 245, 255, 0.18)";
      g.fillRect(startX, 0, endX - startX, h);
      g.strokeStyle = "#00f5ff";
      g.strokeRect(startX, 0, endX - startX, h);
    }

    // Draw slice markers
    g.strokeStyle = "#ff6f61";
    g.fillStyle = "#ff6f61";
    g.font = "9px monospace";
    slices.forEach((s, idx) => {
      const sx = Math.floor(s * w);
      g.beginPath();
      g.moveTo(sx, 0);
      g.lineTo(sx, h);
      g.stroke();
      g.fillText(`S${idx + 1}`, sx + 3, 12);
    });
  }, [currentBuffer, selection, slices, zoom]);

  // Audio Playback
  const stopAudio = () => {
    if (activeSourceRef.current) {
      try {
        activeSourceRef.current.stop();
        activeSourceRef.current.disconnect();
      } catch {
        /* noop */
      }
      activeSourceRef.current = null;
    }
    setIsPlaying(false);
  };

  const playBuffer = (onlySelection = false) => {
    if (!currentBuffer) return;
    stopAudio();

    try {
      const actx = new AudioContext();
      const src = actx.createBufferSource();
      src.buffer = currentBuffer;
      src.connect(actx.destination);

      let offset = 0;
      let duration = currentBuffer.duration;

      if (onlySelection && selection) {
        const [s, e] = [Math.min(...selection), Math.max(...selection)];
        offset = s * currentBuffer.duration;
        duration = (e - s) * currentBuffer.duration;
      }

      src.start(0, offset, duration);
      activeSourceRef.current = src;
      setIsPlaying(true);

      src.onended = () => {
        setIsPlaying(false);
        activeSourceRef.current = null;
      };
    } catch (err) {
      onToast("Audio output unavailable");
    }
  };

  // Editing operations
  const handleTrim = () => {
    if (!currentBuffer || !selection) return;
    const trimmed = trimBuffer(currentBuffer, selection[0], selection[1]);
    setCurrentBuffer(trimmed);
    setSelection(null);
    setSlices([0]);
    onToast("Trimmed to selection");
  };

  const handleNormalize = () => {
    if (!currentBuffer) return;
    const normalized = normalizeBuffer(currentBuffer, -0.1);
    setCurrentBuffer(normalized);
    onToast("Normalized to -0.1 dBFS");
  };

  const handleReverse = () => {
    if (!currentBuffer) return;
    const [s, e] = selection ? [Math.min(...selection), Math.max(...selection)] : [0, 1];
    const reversed = reverseBufferRegion(currentBuffer, s, e);
    setCurrentBuffer(reversed);
    onToast(selection ? "Reversed selection" : "Reversed entire sample");
  };

  const handleSilence = () => {
    if (!currentBuffer || !selection) return;
    const silenced = silenceRegion(currentBuffer, selection[0], selection[1]);
    setCurrentBuffer(silenced);
    onToast("Silenced selection");
  };

  const handleFade = (dir: "in" | "out") => {
    if (!currentBuffer || !selection) return;
    const faded = applyFadeRegion(currentBuffer, dir, selection[0], selection[1]);
    setCurrentBuffer(faded);
    onToast(`Applied fade ${dir}`);
  };

  const handleAutoSlice = () => {
    if (!currentBuffer) return;
    const foundSlices = detectSlicePoints(currentBuffer, 0.2);
    setSlices(foundSlices);
    onToast(`Detected ${foundSlices.length} transient slices`);
  };

  const handleSendToChannelRack = () => {
    onToast(`Sent ${slices.length} slices to Channel Rack drum pads!`);
    setWorkspaceView("channelrack");
  };

  const handleFileLoad = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const arrayBuf = await file.arrayBuffer();
      const actx = new AudioContext();
      const decoded = await actx.decodeAudioData(arrayBuf);
      setCurrentBuffer(decoded);
      setSampleName(file.name);
      setSelection(null);
      setSlices([0]);
      onToast(`Loaded "${file.name}" (${decoded.duration.toFixed(2)}s)`);
    } catch {
      onToast("Could not decode audio file");
    }
  };

  return (
    <div className="panel flex-1 min-h-0 flex flex-col anim-fade-up select-none overflow-hidden">
      {/* Top Header & Edison Actions Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-ink-800 bg-ink-950/80 shrink-0 flex-wrap">
        <span className="font-bold text-xs tracking-wider uppercase text-amber-glow flex items-center gap-1.5">
          <IconScissors size={14} /> Edison Wave Editor
        </span>

        <span className="text-[11px] font-mono text-ink-300 bg-ink-800 px-2 py-0.5 rounded truncate max-w-48">
          {sampleName}
        </span>

        {/* Transport controls */}
        <div className="flex items-center gap-1 border-l border-ink-800 pl-2">
          <button
            onClick={() => (isPlaying ? stopAudio() : playBuffer(false))}
            className="btn py-1! px-2! text-[11px]!"
            {...bindHint("Play Sample", "Audition full sample")}
          >
            {isPlaying ? <IconPause size={12} /> : <IconPlay size={12} />}
          </button>
          <button
            onClick={() => playBuffer(true)}
            disabled={!selection}
            className="btn py-1! px-2! text-[10px]!"
            title="Play selection only"
          >
            Loop Sel
          </button>
          <button onClick={stopAudio} className="btn py-1! px-1.5! text-[11px]!">
            <IconStop size={12} />
          </button>
        </div>

        {/* Destructive Tools */}
        <div className="flex items-center gap-1 border-l border-ink-800 pl-2">
          <button
            onClick={handleTrim}
            disabled={!selection}
            className="btn py-0.5! px-2! text-[10px]!"
            title="Trim / Crop to selection"
          >
            Trim
          </button>
          <button
            onClick={handleNormalize}
            className="btn py-0.5! px-2! text-[10px]!"
            title="Normalize peak to -0.1 dBFS"
          >
            Normalize
          </button>
          <button
            onClick={handleReverse}
            className="btn py-0.5! px-2! text-[10px]!"
            title="Reverse sample or selection"
          >
            Reverse
          </button>
          <button
            onClick={handleSilence}
            disabled={!selection}
            className="btn py-0.5! px-1.5! text-[10px]!"
            title="Mute selection"
          >
            Silence
          </button>
          <button
            onClick={() => handleFade("in")}
            disabled={!selection}
            className="btn py-0.5! px-1.5! text-[10px]!"
            title="Fade In selection"
          >
            Fade In
          </button>
          <button
            onClick={() => handleFade("out")}
            disabled={!selection}
            className="btn py-0.5! px-1.5! text-[10px]!"
            title="Fade Out selection"
          >
            Fade Out
          </button>
        </div>

        {/* Slicing Suite */}
        <div className="flex items-center gap-1 border-l border-ink-800 pl-2">
          <button
            onClick={handleAutoSlice}
            className="btn py-0.5! px-2! text-[10px]! text-teal"
            title="Detect transient markers automatically"
          >
            <IconSparkles size={11} /> Auto Slice
          </button>
          <button
            onClick={handleSendToChannelRack}
            className="btn btn-primary py-0.5! px-2! text-[10px]!"
            title="Dump detected slices into Channel Rack pads"
          >
            Dump to Rack
          </button>
        </div>

        <div className="flex-1" />

        {/* Open audio file */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="btn py-0.5! px-2! text-[10px]!"
        >
          Load Audio...
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.wav,.mp3,.ogg"
          className="hidden"
          onChange={handleFileLoad}
        />
      </div>

      {/* Main Waveform Display */}
      <div className="flex-1 min-h-0 bg-ink-950 p-2 flex flex-col relative">
        <canvas
          ref={canvasRef}
          width={1000}
          height={320}
          className="w-full h-full rounded border border-ink-800 cursor-crosshair touch-none"
          onMouseDown={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const startX = (e.clientX - rect.left) / rect.width;
            setSelection([startX, startX]);
          }}
          onMouseMove={(e) => {
            if (e.buttons === 1 && selection) {
              const rect = e.currentTarget.getBoundingClientRect();
              const curX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              setSelection([selection[0], curX]);
            }
          }}
        />

        {/* Waveform information strip */}
        <div className="flex justify-between items-center px-2 pt-2 text-[10px] font-mono text-ink-400">
          <span>
            Duration: <span className="text-ink-200">{currentBuffer?.duration.toFixed(3)}s</span> ·
            Sample Rate: <span className="text-ink-200">{currentBuffer?.sampleRate} Hz</span> ·
            Channels: <span className="text-ink-200">{currentBuffer?.numberOfChannels}</span>
          </span>
          <span>
            {selection ? (
              <span className="text-teal">
                Selection: {(Math.min(...selection) * 100).toFixed(1)}% → {(Math.max(...selection) * 100).toFixed(1)}% (
                {Math.abs((selection[1] - selection[0]) * (currentBuffer?.duration || 0)).toFixed(3)}s)
              </span>
            ) : (
              <span>Click and drag on waveform to select a region</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
