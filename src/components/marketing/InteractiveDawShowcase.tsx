import React, { useState, useEffect } from "react";
import { demoAudio } from "./AudioDemoEngine";
import { MagneticButton } from "./MagneticButton";

interface InteractiveDawShowcaseProps {
  onOpenCadence: () => void;
}

export const InteractiveDawShowcase: React.FC<InteractiveDawShowcaseProps> = ({ onOpenCadence }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [zoomLevel, setZoomLevel] = useState<"1x" | "2x" | "4x">("1x");
  const [activeChannel, setActiveChannel] = useState(0);
  const [mutedChannels, setMutedChannels] = useState<Record<number, boolean>>({});
  const [soloChannels, setSoloChannels] = useState<Record<number, boolean>>({});
  const [faders, setFaders] = useState([85, 92, 78, 88, 90]);
  const [panValues, setPanValues] = useState([0, -15, 20, -5, 10]);
  const [hint, setHint] = useState<string>("CLICK PLAY TO HEAR REAL-TIME WEB AUDIO SYNTHESIS");

  useEffect(() => {
    const unsub = demoAudio.subscribeStep((step) => {
      setCurrentStep(step);
    });
    return () => unsub();
  }, []);

  const handleTogglePlay = () => {
    const playing = demoAudio.toggle();
    setIsPlaying(playing);
    setHint(playing ? "STUDIO RUNNING: 104 BPM • WEB AUDIO DSP ACTIVE" : "PLAYBACK PAUSED");
  };

  const toggleMute = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setMutedChannels((prev) => {
      const next = { ...prev, [idx]: !prev[idx] };
      setHint(`CHANNEL ${idx + 1}: ${next[idx] ? "MUTED" : "UNMUTED"}`);
      return next;
    });
  };

  const toggleSolo = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSoloChannels((prev) => {
      const next = { ...prev, [idx]: !prev[idx] };
      setHint(`CHANNEL ${idx + 1}: ${next[idx] ? "SOLO ACTIVE" : "SOLO OFF"}`);
      return next;
    });
  };

  const handleFaderChange = (idx: number, val: number) => {
    setFaders((prev) => {
      const copy = [...prev];
      copy[idx] = val;
      return copy;
    });
    setHint(`CHANNEL ${idx + 1} VOLUME: ${val}% (-${Math.round((100 - val) * 0.2)} dB)`);
  };

  const channels = [
    { name: "Pulse Kick 808", color: "#FF6F61", type: "Drum / Bass", plugin: "SoftClipper", icon: "🥁" },
    { name: "Snare & Rimshot", color: "#38BDF8", type: "Transient", plugin: "Parametric EQ", icon: "💥" },
    { name: "Crisp Hats (1/16)", color: "#00F5FF", type: "Cymbal", plugin: "StereoShaper", icon: "✨" },
    { name: "Neon Pluck Synth", color: "#A78BFA", type: "Poly Synth", plugin: "Vintage Chorus", icon: "🎹" },
    { name: "Lead Vocal Comp", color: "#34D399", type: "Audio Take", plugin: "De-Esser & Comp", icon: "🎤" },
  ];

  const playheadPercent = (currentStep / 64) * 100;

  return (
    <section className="relative py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto" id="showcase">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00F5FF]/10 border border-[#00F5FF]/20 text-[11px] font-mono text-[#00F5FF] tracking-widest uppercase mb-4">
            LIVE INTERACTIVE PREVIEW
          </div>
          <h2 className="text-4xl sm:text-6xl font-bold tracking-tighter text-white uppercase leading-none">
            YOUR STUDIO.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00F5FF] via-[#38BDF8] to-[#CBD5E1]">
              IN THE FLOW.
            </span>
          </h2>
        </div>

        <p className="max-w-md text-[#94A3B8] text-sm sm:text-base leading-relaxed font-normal">
          Experience the tactile response of an instrument designed for immediate creative capture. Try playing the demo, adjusting faders, and tweaking channel parameters below.
        </p>
      </div>

      {/* The Master Studio Console Frame */}
      <div className="relative rounded-2xl bg-[#090C12] border border-[#1D2536] shadow-[0_30px_100px_rgba(0,0,0,0.95)] overflow-hidden">
        {/* Console Top Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-4 py-3 bg-[#0B0F17] border-b border-[#1A2233]">
          <div className="flex flex-wrap items-center justify-between sm:justify-start gap-2 sm:gap-3">
            <button
              onClick={handleTogglePlay}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-lg text-xs font-semibold font-mono tracking-wider transition-all duration-150 min-h-[40px] cursor-pointer ${
                isPlaying
                  ? "bg-[#00F5FF] text-[#06080B] shadow-[0_0_20px_rgba(0,245,255,0.7)]"
                  : "bg-[#161D2B] hover:bg-[#1E273A] text-white border border-[#232F46]"
              }`}
            >
              {isPlaying ? (
                <>
                  <span className="w-2.5 h-2.5 bg-[#06080B] rounded-[2px]" />
                  PAUSE DEMO
                </>
              ) : (
                <>
                  <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                    <path d="M7 4.5v15l13-7.5z" />
                  </svg>
                  PLAY REAL AUDIO
                </>
              )}
            </button>

            <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#070A0F] border border-[#161D2B] text-xs font-mono text-[#94A3B8]">
              <span className="text-[#64748B]">BPM:</span>
              <span className="text-[#00F5FF] font-bold">104.0</span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#070A0F] border border-[#161D2B] text-xs font-mono text-[#94A3B8]">
              <span className="text-[#64748B]">SWING:</span>
              <span className="text-[#F59E0B] font-bold">62%</span>
            </div>

            {/* Timeline Zoom Controls */}
            <div className="hidden md:flex items-center gap-1 p-1 rounded-lg bg-[#070A0F] border border-[#161D2B] text-xs font-mono">
              {(["1x", "2x", "4x"] as const).map((z) => (
                <button
                  key={z}
                  onClick={() => {
                    setZoomLevel(z);
                    setHint(`TIMELINE ZOOM LEVEL: ${z}`);
                  }}
                  className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                    zoomLevel === z ? "bg-[#1E273A] text-[#00F5FF] font-bold" : "text-[#64748B] hover:text-[#CBD5E1]"
                  }`}
                >
                  {z}
                </button>
              ))}
            </div>
          </div>

          {/* Action CTA */}
          <MagneticButton
            size="sm"
            variant="primary"
            onClick={onOpenCadence}
            className="w-full sm:w-auto shadow-[0_0_15px_rgba(0,245,255,0.4)]"
          >
            LAUNCH FULL WORKSPACE
          </MagneticButton>
        </div>

        {/* Studio Work Area */}
        <div className="grid grid-cols-12 min-h-[460px]">
          {/* Left: Interactive Multi-Track Arrangement View (Cols 1-8) */}
          <div className="col-span-12 lg:col-span-8 p-4 sm:p-6 border-b lg:border-b-0 lg:border-r border-[#1A2233] flex flex-col gap-3 relative">
            {/* Timeline Bar Ruler */}
            <div className="h-7 rounded-lg bg-[#0C1018] border border-[#161D2B] flex items-center justify-between px-4 text-xs font-mono text-[#64748B] select-none">
              <span>BAR 01 // INTRO</span>
              <span>BAR 02 // BEAT ENTRY</span>
              <span>BAR 03 // VERSE HOOK</span>
              <span>BAR 04 // DROP</span>
            </div>

            {/* Playhead Laser Line */}
            <div
              className="absolute top-4 bottom-4 w-[2px] bg-[#00F5FF] shadow-[0_0_15px_#00F5FF] z-20 pointer-events-none transition-all duration-75"
              style={{ left: `${Math.max(2, Math.min(97, playheadPercent))}%` }}
            >
              <div className="w-3 h-3 -ml-1 bg-[#00F5FF] rounded-[2px] shadow-[0_0_10px_#00F5FF]" />
            </div>

            {/* Track Rows */}
            {channels.map((ch, idx) => {
              const isMuted = !!mutedChannels[idx];
              const isSolo = !!soloChannels[idx];
              const isSelected = activeChannel === idx;

              return (
                <div
                  key={idx}
                  onClick={() => {
                    setActiveChannel(idx);
                    setHint(`FOCUSED TRACK: ${ch.name} • ${ch.plugin}`);
                  }}
                  className={`flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 rounded-xl border transition-all duration-150 cursor-pointer ${
                    isSelected
                      ? "bg-[#101522] border-[#00F5FF]/50 shadow-[0_0_20px_rgba(0,245,255,0.06)]"
                      : "bg-[#0B0F17] hover:bg-[#0E131E] border-[#182030]"
                  }`}
                >
                  {/* Track Header Controls */}
                  <div className="w-full sm:w-44 shrink-0 flex items-center justify-between">
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-sm shrink-0">{ch.icon}</span>
                      <div className="truncate">
                        <span className="text-xs font-semibold text-white block truncate">{ch.name}</span>
                        <span className="text-[10px] font-mono text-[#64748B] block truncate">{ch.type}</span>
                      </div>
                    </div>

                    {/* Mute and Solo Buttons */}
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <button
                        onClick={(e) => toggleMute(idx, e)}
                        className={`w-7 h-7 sm:w-6 sm:h-6 rounded flex items-center justify-center text-[10px] font-bold font-mono transition-colors cursor-pointer ${
                          isMuted ? "bg-[#EF4444] text-white" : "bg-[#161D2B] text-[#64748B] hover:text-white"
                        }`}
                        title="Mute Track"
                      >
                        M
                      </button>
                      <button
                        onClick={(e) => toggleSolo(idx, e)}
                        className={`w-7 h-7 sm:w-6 sm:h-6 rounded flex items-center justify-center text-[10px] font-bold font-mono transition-colors cursor-pointer ${
                          isSolo ? "bg-[#F59E0B] text-[#06080B]" : "bg-[#161D2B] text-[#64748B] hover:text-white"
                        }`}
                        title="Solo Track"
                      >
                        S
                      </button>
                    </div>
                  </div>

                  {/* Track Waveform & Pattern Clip Blocks */}
                  <div className="w-full flex-1 h-12 rounded-lg bg-[#070A0F] border border-[#141A26] relative overflow-hidden flex items-center p-1.5 gap-2">
                    {/* Simulated Clip Block 1 */}
                    <div
                      className="flex-1 h-full rounded border flex items-center px-2 text-[10px] font-mono transition-opacity"
                      style={{
                        backgroundColor: `${ch.color}15`,
                        borderColor: `${ch.color}50`,
                        color: ch.color,
                        opacity: isMuted ? 0.35 : 1,
                      }}
                    >
                      <span className="truncate">CLIP 01 [Loop]</span>
                    </div>

                    {/* Simulated Clip Block 2 */}
                    <div
                      className="flex-1 h-full rounded border flex items-center px-2 text-[10px] font-mono transition-opacity"
                      style={{
                        backgroundColor: `${ch.color}15`,
                        borderColor: `${ch.color}50`,
                        color: ch.color,
                        opacity: isMuted ? 0.35 : 1,
                      }}
                    >
                      <span className="truncate">CLIP 02 [Variation]</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: Focused Channel Strip & Interactive Mixer Inspector (Cols 9-12) */}
          <div className="col-span-12 lg:col-span-4 p-4 sm:p-6 bg-[#0B0F17] flex flex-col justify-between gap-6">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#1A2234]">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#00F5FF]">CHANNEL STRIP</span>
                  <h3 className="text-base font-bold text-white tracking-tight">{channels[activeChannel].name}</h3>
                </div>
                <span className="text-xs font-mono text-[#38BDF8] bg-[#38BDF8]/10 px-2 py-0.5 rounded-md border border-[#38BDF8]/20">
                  TRK {activeChannel + 1}
                </span>
              </div>

              {/* Pan & Volume Sliders */}
              <div className="mt-6 flex flex-col gap-4">
                <div>
                  <div className="flex justify-between text-xs font-mono mb-1.5">
                    <span className="text-[#94A3B8]">PANORAMA</span>
                    <span className="text-[#00F5FF]">
                      {panValues[activeChannel] === 0
                        ? "CENTER"
                        : panValues[activeChannel] > 0
                        ? `R${panValues[activeChannel]}`
                        : `L${-panValues[activeChannel]}`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-50"
                    max="50"
                    value={panValues[activeChannel]}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setPanValues((prev) => {
                        const copy = [...prev];
                        copy[activeChannel] = val;
                        return copy;
                      });
                      setHint(`PANORAMA: ${val === 0 ? "CENTER" : val > 0 ? "RIGHT" : "LEFT"} (${val}%)`);
                    }}
                    className="w-full accent-[#00F5FF] cursor-pointer py-1.5"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono mb-1.5">
                    <span className="text-[#94A3B8]">LEVEL GAIN</span>
                    <span className="text-[#00F5FF]">{faders[activeChannel]}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={faders[activeChannel]}
                    onChange={(e) => handleFaderChange(activeChannel, parseInt(e.target.value, 10))}
                    className="w-full accent-[#00F5FF] cursor-pointer py-1.5"
                  />
                </div>
              </div>

              {/* 10-Slot FX Inspector Showcase */}
              <div className="mt-6">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#64748B] block mb-2">
                  ACTIVE FX CHAIN (SLOTS 1-10)
                </span>
                <div className="space-y-1.5 font-mono text-xs">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-[#070A0F] border border-[#161D2B] text-white">
                    <span className="flex items-center gap-2 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00F5FF] shrink-0" />
                      <span className="truncate">{channels[activeChannel].plugin}</span>
                    </span>
                    <span className="text-[10px] text-[#34D399] shrink-0">ACTIVE</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-[#070A0F] border border-[#161D2B] text-[#64748B]">
                    <span>2. SoftClipper Studio</span>
                    <span className="text-[10px] text-[#00F5FF]">45%</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-[#070A0F] border border-[#161D2B] text-[#64748B]">
                    <span>3. Master Limiter</span>
                    <span className="text-[10px] text-[#00F5FF]">0.0 dB</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Launch App Prompt */}
            <div className="p-3 rounded-xl bg-[#0F141F] border border-[#1E2638] text-xs text-[#94A3B8]">
              <span className="font-semibold text-white block mb-1">Full Desktop Experience</span>
              Runs offline with direct ASIO audio drivers, VST compatibility, and multitrack stems rendering.
            </div>
          </div>
        </div>

        {/* Live Hint Telemetry Bar */}
        <div className="px-4 py-2.5 bg-[#06080C] border-t border-[#161D2B] flex items-center justify-between text-xs font-mono gap-2">
          <div className="flex items-center gap-2 truncate flex-1 min-w-0">
            <span className="text-[#00F5FF] font-bold shrink-0">💡 TELEMETRY:</span>
            <span className="text-[#CBD5E1] truncate">{hint}</span>
          </div>
          <span className="text-[10px] text-[#475569] hidden md:inline shrink-0">
            ZERO LATENCY • 24-BIT 48KHZ READY
          </span>
        </div>
      </div>
    </section>
  );
};
