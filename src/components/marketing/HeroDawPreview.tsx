import React, { useState, useEffect } from "react";
import { demoAudio } from "./AudioDemoEngine";
import { subscribeScrollPhysics } from "./useScrollPhysics";

interface HeroDawPreviewProps {
  onOpenCadence: () => void;
}

export const HeroDawPreview: React.FC<HeroDawPreviewProps> = ({ onOpenCadence }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [meterLevel, setMeterLevel] = useState(0.42);
  const [activeTab, setActiveTab] = useState<"timeline" | "mixer" | "rack">("timeline");
  const [hoverParam, setHoverParam] = useState<string>("READY • HOVER CONTROLS FOR TELEMETRY");
  const [scrollTilt, setScrollTilt] = useState(0);

  useEffect(() => {
    return subscribeScrollPhysics((state) => {
      const tilt = Math.max(-2.5, Math.min(2.5, state.velocity * 0.22));
      setScrollTilt(tilt);
    });
  }, []);

  useEffect(() => {
    const unsub = demoAudio.subscribeStep((step) => {
      setCurrentStep(step);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    let animId: number;
    const updateMeter = () => {
      if (isPlaying) {
        const live = demoAudio.getMeterLevel();
        setMeterLevel((prev) => prev * 0.75 + (live || Math.random() * 0.6 + 0.25) * 0.25);
      } else {
        setMeterLevel((prev) => Math.max(0.04, prev * 0.9));
      }
      animId = requestAnimationFrame(updateMeter);
    };
    animId = requestAnimationFrame(updateMeter);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying]);

  const handleTogglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const playing = demoAudio.toggle();
    setIsPlaying(playing);
    setHoverParam(playing ? "TRANSPORT: PLAYING (104 BPM • 4/4 • A MINOR)" : "TRANSPORT: PAUSED");
  };

  const playheadPercent = (currentStep / 64) * 100;

  return (
    <div
      onClick={onOpenCadence}
      style={{
        transform: `perspective(1200px) rotateX(${scrollTilt}deg)`,
        transition: "transform 0.12s cubic-bezier(0.2, 0, 0.2, 1)",
      }}
      className="group relative w-full rounded-2xl bg-[#090C12]/95 border border-[#1E2536] hover:border-[#00F5FF]/40 shadow-[0_25px_80px_rgba(0,0,0,0.85)] hover:shadow-[0_0_60px_rgba(0,245,255,0.14)] transition-all duration-300 overflow-hidden cursor-pointer backdrop-blur-xl"
      title="Click to launch Cadence Workstation"
    >
      {/* Top Glass Refraction Sheen */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#00F5FF]/50 to-transparent" />

      {/* Top Transport & Status Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#0B0F17] border-b border-[#1A2233] text-[11px] font-mono">
        <div className="flex items-center gap-3">
          {/* Traffic light LEDs */}
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]/80 border border-[#F87171]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]/80 border border-[#FBBF24]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]/80 border border-[#34D399]" />
          </div>

          <div className="h-4 w-[1px] bg-[#1E2536]" />

          {/* Transport Button */}
          <button
            onClick={handleTogglePlay}
            onMouseEnter={() => setHoverParam("TRANSPORT: TOGGLE SONG PLAYBACK [SPACE]")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-semibold tracking-wider transition-all duration-150 ${
              isPlaying
                ? "bg-[#00F5FF] text-[#06080B] shadow-[0_0_15px_rgba(0,245,255,0.6)]"
                : "bg-[#161D2B] text-[#E2E8F0] hover:bg-[#1E273A] border border-[#232F46]"
            }`}
          >
            {isPlaying ? (
              <>
                <span className="w-2 h-2 bg-[#06080B] rounded-[1px] animate-pulse" />
                PAUSE
              </>
            ) : (
              <>
                <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                  <path d="M7 4.5v15l13-7.5z" />
                </svg>
                PLAY DEMO
              </>
            )}
          </button>

          {/* BPM & Clock */}
          <span className="text-[#94A3B8] hidden sm:inline-block">
            104 <span className="text-[#475569]">BPM</span>
          </span>
          <span className="text-[#38BDF8] hidden md:inline-block font-mono">
            {String(Math.floor(currentStep / 16) + 1).padStart(2, "0")}:
            {String(Math.floor((currentStep % 16) / 4) + 1).padStart(2, "0")}:
            {String((currentStep % 4) + 1).padStart(2, "0")}
          </span>
        </div>

        {/* Center Workspace Switcher Preview */}
        <div className="hidden lg:flex items-center gap-1 p-0.5 rounded-md bg-[#070A0F] border border-[#161D2B]">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveTab("timeline");
            }}
            className={`px-2.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
              activeTab === "timeline" ? "bg-[#1E273A] text-[#00F5FF]" : "text-[#64748B] hover:text-[#CBD5E1]"
            }`}
          >
            Timeline
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveTab("rack");
            }}
            className={`px-2.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
              activeTab === "rack" ? "bg-[#1E273A] text-[#00F5FF]" : "text-[#64748B] hover:text-[#CBD5E1]"
            }`}
          >
            Channel Rack
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveTab("mixer");
            }}
            className={`px-2.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
              activeTab === "mixer" ? "bg-[#1E273A] text-[#00F5FF]" : "text-[#64748B] hover:text-[#CBD5E1]"
            }`}
          >
            Mixer
          </button>
        </div>

        {/* Master Meter & Open Button */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5" title="Master Output Meter">
            <span className="text-[9px] uppercase tracking-wider text-[#64748B]">MSTR</span>
            <div className="w-16 sm:w-20 h-2 rounded bg-[#070A0F] border border-[#1E273A] overflow-hidden flex">
              <div
                className="h-full bg-gradient-to-r from-[#10B981] via-[#00F5FF] to-[#EF4444] transition-all duration-75"
                style={{ width: `${Math.round(meterLevel * 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-[#00F5FF] hidden sm:inline">-14 LUFS</span>
          </div>

          <span className="text-[10px] text-[#00F5FF] group-hover:translate-x-0.5 transition-transform flex items-center gap-1 font-semibold">
            LAUNCH DAW →
          </span>
        </div>
      </div>

      {/* Main Workstation Timeline Canvas */}
      <div className="relative p-3 sm:p-5 grid grid-cols-12 gap-3 min-h-[310px] sm:min-h-[380px]">
        {/* Timeline Tracks (Cols 1-9 on desktop) */}
        <div className="col-span-12 lg:col-span-9 flex flex-col gap-2 relative">
          {/* Timeline Bar Ruler */}
          <div className="h-6 rounded bg-[#0D121B] border border-[#161D2B] flex items-center justify-between px-3 text-[10px] font-mono text-[#64748B] select-none">
            <span>BAR 01</span>
            <span>BAR 02</span>
            <span>BAR 03</span>
            <span>BAR 04</span>
          </div>

          {/* Laser Playhead Line */}
          <div
            className="absolute top-0 bottom-0 w-[2px] bg-[#00F5FF] shadow-[0_0_12px_#00F5FF] z-20 pointer-events-none transition-all duration-75"
            style={{ left: `${playheadPercent}%` }}
          >
            <div className="w-2.5 h-2.5 -ml-1 bg-[#00F5FF] rounded-[2px] shadow-[0_0_8px_#00F5FF]" />
          </div>

          {/* Track 1: Kick & 808 */}
          <div
            onMouseEnter={() => setHoverParam("TRACK 1: 808 SUB • PAN C • VOL 92% • ROUTED TO MIXER TRK 1")}
            className="flex items-center gap-2 p-2 rounded-lg bg-[#0C1018] border border-[#182030] hover:border-[#FF6F61]/40 transition-colors"
          >
            <div className="w-20 sm:w-24 shrink-0 flex items-center justify-between text-[11px] font-semibold text-[#CBD5E1]">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#FF6F61]" />
                808 Sub
              </span>
              <span className="text-[9px] font-mono text-[#64748B]">TRK 1</span>
            </div>
            <div className="flex-1 h-12 rounded bg-[#080B10] border border-[#141A26] relative overflow-hidden flex items-center p-1.5 gap-1.5">
              {/* Waveform Blocks */}
              <div className="w-1/4 h-full rounded bg-[#FF6F61]/15 border border-[#FF6F61]/40 flex items-center justify-center text-[10px] font-mono text-[#FF6F61]">
                [ 808 Hit A ]
              </div>
              <div className="w-1/4 h-full rounded bg-[#FF6F61]/15 border border-[#FF6F61]/40 flex items-center justify-center text-[10px] font-mono text-[#FF6F61]">
                [ 808 Slide ]
              </div>
              <div className="w-1/4 h-full rounded bg-[#FF6F61]/15 border border-[#FF6F61]/40 flex items-center justify-center text-[10px] font-mono text-[#FF6F61]">
                [ 808 Hit B ]
              </div>
              <div className="w-1/4 h-full rounded bg-[#FF6F61]/15 border border-[#FF6F61]/40 flex items-center justify-center text-[10px] font-mono text-[#FF6F61]">
                [ Sub Drop ]
              </div>
            </div>
          </div>

          {/* Track 2: Drum Kit */}
          <div
            onMouseEnter={() => setHoverParam("TRACK 2: PULSE DRUM KIT • STEP SEQUENCER • 62% SWING")}
            className="flex items-center gap-2 p-2 rounded-lg bg-[#0C1018] border border-[#182030] hover:border-[#38BDF8]/40 transition-colors"
          >
            <div className="w-20 sm:w-24 shrink-0 flex items-center justify-between text-[11px] font-semibold text-[#CBD5E1]">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#38BDF8]" />
                Drums
              </span>
              <span className="text-[9px] font-mono text-[#64748B]">TRK 2</span>
            </div>
            <div className="flex-1 h-12 rounded bg-[#080B10] border border-[#141A26] relative overflow-hidden flex items-center p-1 gap-1">
              {/* 16-step mini grid visual */}
              {Array.from({ length: 16 }).map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 h-7 rounded-[3px] border transition-colors ${
                    i % 4 === 0
                      ? "bg-[#38BDF8]/30 border-[#38BDF8]/60 shadow-[0_0_8px_rgba(56,189,248,0.3)]"
                      : i % 2 === 0
                      ? "bg-[#182234] border-[#24314A]"
                      : "bg-[#0E131E] border-[#161D2B]"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Track 3: Neon Pluck / Keys */}
          <div
            onMouseEnter={() => setHoverParam("TRACK 3: NEON KEYS • CHORD STAMPER: AM7 - FMAJ7 - CMAJ7")}
            className="flex items-center gap-2 p-2 rounded-lg bg-[#0C1018] border border-[#182030] hover:border-[#A78BFA]/40 transition-colors"
          >
            <div className="w-20 sm:w-24 shrink-0 flex items-center justify-between text-[11px] font-semibold text-[#CBD5E1]">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#A78BFA]" />
                Keys
              </span>
              <span className="text-[9px] font-mono text-[#64748B]">TRK 3</span>
            </div>
            <div className="flex-1 h-12 rounded bg-[#080B10] border border-[#141A26] relative overflow-hidden p-1.5 flex items-center gap-2">
              <div className="w-1/2 h-full rounded bg-[#A78BFA]/15 border border-[#A78BFA]/40 flex flex-col justify-center px-2 text-[10px] font-mono text-[#A78BFA]">
                <span>Am7 ➔ Fmaj7 (Strummed)</span>
                <span className="text-[8px] text-[#A78BFA]/60">15-voice polyphony</span>
              </div>
              <div className="w-1/2 h-full rounded bg-[#A78BFA]/15 border border-[#A78BFA]/40 flex flex-col justify-center px-2 text-[10px] font-mono text-[#A78BFA]">
                <span>Cmaj7 ➔ Gsus4 (Arp 1/16)</span>
                <span className="text-[8px] text-[#A78BFA]/60">Humanized + Flam</span>
              </div>
            </div>
          </div>

          {/* Track 4: Vocal Stem */}
          <div
            onMouseEnter={() => setHoverParam("TRACK 4: VOCAL TAKE 01 • EDISON SLICE • 0.4MS LATENCY COMPENSATED")}
            className="flex items-center gap-2 p-2 rounded-lg bg-[#0C1018] border border-[#182030] hover:border-[#00F5FF]/40 transition-colors"
          >
            <div className="w-20 sm:w-24 shrink-0 flex items-center justify-between text-[11px] font-semibold text-[#CBD5E1]">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#00F5FF]" />
                Lead Vox
              </span>
              <span className="text-[9px] font-mono text-[#64748B]">TRK 4</span>
            </div>
            <div className="flex-1 h-12 rounded bg-[#080B10] border border-[#141A26] relative overflow-hidden flex items-center px-3">
              {/* Simulated Audio Waveform SVG */}
              <svg className="w-full h-8 stroke-[#00F5FF] fill-[#00F5FF]/10" viewBox="0 0 400 40" preserveAspectRatio="none">
                <path d="M0,20 Q20,5 40,20 T80,20 Q100,2 120,20 T160,20 Q180,8 200,20 T240,20 Q260,1 280,20 T320,20 Q340,6 360,20 T400,20 L400,40 L0,40 Z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Right Strip: Channel Inspector & FX Preview (Cols 10-12 on desktop) */}
        <div className="hidden lg:flex col-span-3 flex-col gap-2 rounded-xl bg-[#0B0F17] border border-[#1A2234] p-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#161D2B]">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#94A3B8]">Channel Strip</span>
            <span className="text-[9px] font-mono text-[#10B981] bg-[#10B981]/10 px-1.5 py-0.5 rounded">ACTIVE</span>
          </div>

          {/* Quick Knobs Grid */}
          <div className="grid grid-cols-2 gap-2 text-center text-[10px] font-mono">
            <div
              onMouseEnter={() => setHoverParam("SOFTCLIPPER: SATURATION 65% • ZERO DIGITAL DISTORTION")}
              className="p-2 rounded bg-[#0D121B] border border-[#182030]"
            >
              <div className="w-7 h-7 mx-auto rounded-full border-2 border-[#00F5FF] flex items-center justify-center text-[9px] text-[#00F5FF] font-bold">
                65
              </div>
              <span className="text-[#64748B] block mt-1">SoftClip</span>
            </div>
            <div
              onMouseEnter={() => setHoverParam("STEREOSHAPER: HAAS WIDTH 140% • 3D PANORAMA")}
              className="p-2 rounded bg-[#0D121B] border border-[#182030]"
            >
              <div className="w-7 h-7 mx-auto rounded-full border-2 border-[#38BDF8] flex items-center justify-center text-[9px] text-[#38BDF8] font-bold">
                140
              </div>
              <span className="text-[#64748B] block mt-1">Width</span>
            </div>
          </div>

          {/* 10-Slot FX Rack Preview */}
          <div className="flex-1 flex flex-col gap-1 pt-1">
            <span className="text-[9px] font-mono uppercase tracking-wider text-[#64748B]">Insert FX Slots</span>
            {["1. SoftClipper Pro", "2. StereoShaper (Haas)", "3. Vintage Chorus", "4. Parametric EQ", "5. PingPong Delay"].map(
              (fx, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-2 py-1 rounded bg-[#070A0F] border border-[#141A26] text-[10px] font-mono text-[#CBD5E1]"
                >
                  <span className="truncate">{fx}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00F5FF]" />
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Bottom Reactive Hint Bar */}
      <div className="px-4 py-2 bg-[#070A0F] border-t border-[#161D2B] flex items-center justify-between text-[11px] font-mono text-[#64748B]">
        <div className="flex items-center gap-2 truncate">
          <span className="text-[#00F5FF]">💡 HINT:</span>
          <span className="text-[#94A3B8] truncate">{hoverParam}</span>
        </div>
        <div className="hidden sm:flex items-center gap-3 shrink-0 text-[10px] text-[#475569]">
          <span>WEBAUDIO DSP</span>
          <span>•</span>
          <span>DETERMINISTIC BUS</span>
          <span>•</span>
          <span>ZERO LATENCY</span>
        </div>
      </div>
    </div>
  );
};
