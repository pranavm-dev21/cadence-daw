import React, { useState } from "react";
import { MagneticButton } from "./MagneticButton";
import { demoAudio } from "./AudioDemoEngine";
import { useInViewReveal } from "./motion/useInViewReveal";
import { MotionCard } from "./motion/MotionCard";
import { SoundwaveVisualizer } from "./motion/SoundwaveVisualizer";

interface AiWorkflowSectionProps {
  onOpenCadence: () => void;
}

export const AiWorkflowSection: React.FC<AiWorkflowSectionProps> = ({ onOpenCadence }) => {
  const [prompt, setPrompt] = useState("Create a dark cinematic ambient intro in A minor at 104 BPM");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlayingDemo, setIsPlayingDemo] = useState(false);

  const { ref: sectionRef, isRevealed: sectionRevealed } = useInViewReveal<HTMLElement>({
    threshold: 0.15,
  });

  const samplePrompts = [
    "Create a dark cinematic ambient intro in A minor at 104 BPM",
    "Generate an 808 drill rhythm with swinging hi-hats",
    "Ethereal synthwave chords with vintage chorus",
    "Lo-fi boom-bap beat with dusty vinyl warmth",
  ];

  const handleSelectPrompt = (text: string) => {
    setPrompt(text);
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
    }, 750);
  };

  const handlePlayGeneration = () => {
    const playing = demoAudio.toggle();
    setIsPlayingDemo(playing);
  };

  return (
    <section ref={sectionRef} className="relative py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto" id="ai">
      {/* Background Radial Light Field */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-[#00F5FF]/[0.035] blur-[120px] rounded-full pointer-events-none anim-halo-breathe" />

      {/* Header */}
      <div
        className={`text-center max-w-3xl mx-auto mb-14 transition-all duration-700 ease-cinematic ${
          sectionRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00F5FF]/10 border border-[#00F5FF]/20 text-[11px] font-mono text-[#00F5FF] tracking-widest uppercase mb-4 anim-badge-float">
          CO-CREATIVE INTELLIGENCE
        </div>
        <h2 className="text-4xl sm:text-6xl font-bold tracking-tighter text-white uppercase leading-none mb-5">
          NOT A CHATBOT.
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00F5FF] via-[#38BDF8] to-[#CBD5E1]">
            A MUSICAL WORKSTATION.
          </span>
        </h2>
        <p className="text-[#94A3B8] text-sm sm:text-base leading-relaxed">
          Cadence AI does not generate generic flat MP3s. It creates native, fully editable MIDI clips, synthesizer presets, and multi-track stems directly on your timeline.
        </p>
      </div>

      {/* Interactive Prompt & Workspace Console wrapped in MotionCard */}
      <MotionCard
        enableTilt={true}
        spotlightColor="rgba(0, 245, 255, 0.08)"
        className={`max-w-4xl mx-auto rounded-2xl bg-[#090C12] border border-[#1E2536] shadow-[0_25px_80px_rgba(0,0,0,0.85)] p-5 sm:p-8 overflow-hidden relative backdrop-blur-xl transition-all duration-700 ease-cinematic ${
          sectionRevealed ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-12 scale-[0.98]"
        }`}
      >
        {/* Subtle Top Sheen */}
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#00F5FF]/40 to-transparent" />

        {/* Input Bar */}
        <div className="relative mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-xl bg-[#06080C] border border-[#1A2334] focus-within:border-[#00F5FF]/60 transition-colors shadow-inner">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-[#00F5FF] font-mono text-sm pl-1 shrink-0 animate-pulse">✦</span>
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe a musical idea, chord progression, or drum groove..."
                className="w-full bg-transparent text-xs sm:text-sm text-white font-mono placeholder-[#475569] outline-none"
              />
            </div>
            <button
              onClick={() => handleSelectPrompt(prompt)}
              className="w-full sm:w-auto shrink-0 px-4 py-2 sm:py-1.5 rounded-lg bg-[#00F5FF] text-[#06080B] text-xs font-mono font-bold active:scale-[0.95] hover:shadow-[0_0_18px_rgba(0,245,255,0.7)] transition-all cursor-pointer min-h-[38px] flex items-center justify-center"
            >
              {isGenerating ? "GENERATING..." : "GENERATE"}
            </button>
          </div>
        </div>

        {/* Quick Suggestion Chips with micro-tactile feel */}
        <div className="flex flex-wrap items-center gap-2 mb-8">
          <span className="text-[10px] font-mono text-[#64748B] uppercase tracking-wider">Try:</span>
          {samplePrompts.map((p, i) => (
            <button
              key={i}
              onClick={() => handleSelectPrompt(p)}
              className="text-[11px] font-mono px-3 py-1 rounded-full bg-[#0C111A] hover:bg-[#141C2A] text-[#94A3B8] hover:text-[#00F5FF] border border-[#182030] hover:border-[#00F5FF]/30 active:scale-[0.96] transition-all cursor-pointer"
            >
              {p}
            </button>
          ))}
        </div>

        {/* Generated Timeline & Stems Visual Response */}
        <div className="rounded-xl bg-[#06080C] border border-[#161D2B] p-4 flex flex-col gap-3 relative overflow-hidden">
          {/* Shimmer sweep effect during generation */}
          {isGenerating && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#00F5FF]/10 to-transparent anim-shimmer-sweep pointer-events-none z-10" />
          )}

          {/* Status Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs font-mono border-b border-[#141A26] pb-2.5 gap-1.5">
            <div className="flex items-center gap-2 truncate">
              <span className={`w-2 h-2 rounded-full shrink-0 ${isGenerating ? "bg-[#F59E0B] animate-ping" : "bg-[#10B981]"}`} />
              <span className="text-[#CBD5E1] truncate text-[11px] sm:text-xs">
                {isGenerating ? "SYNTHESIZING TO TIMELINE..." : "ARRANGEMENT GENERATED • 4 TRACKS POPULATED"}
              </span>
            </div>
            <span className="text-[#00F5FF] shrink-0 text-[10px] sm:text-xs">KEY: A MINOR • 104 BPM</span>
          </div>

          {/* Generated Tracks Preview */}
          <div className="space-y-2">
            {[
              { name: "Sub Bass 808", color: "#FF6F61", pattern: "Roots: A1 - F1 - C2 - G1 (Glided)", type: "MIDI" },
              { name: "Pulse Drum Kit", color: "#38BDF8", pattern: "16-Step Matrix • 62% Swing • Snare Ghost Hits", type: "Step" },
              { name: "Velvet Pad Chords", color: "#A78BFA", pattern: "Am9 ➔ Fmaj7(#11) ➔ Cmaj9 ➔ Gsus4", type: "Harmonic" },
              { name: "Ambient Texture", color: "#00F5FF", pattern: "Modulated Haas Delay (StereoShaper Active)", type: "Audio" },
            ].map((trk, i) => (
              <div
                key={i}
                className="flex items-center gap-2 sm:gap-3 p-2.5 rounded-lg bg-[#090D14] border border-[#141B26] hover:border-[#00F5FF]/30 transition-colors"
              >
                <div className="w-24 sm:w-32 shrink-0 flex items-center gap-1.5 sm:gap-2 text-xs font-semibold text-white truncate">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: trk.color }} />
                  <span className="truncate">{trk.name}</span>
                </div>
                <div
                  className="flex-1 h-7 rounded border flex items-center px-2 sm:px-3 text-[10px] sm:text-[11px] font-mono truncate relative overflow-hidden"
                  style={{
                    backgroundColor: `${trk.color}10`,
                    borderColor: `${trk.color}40`,
                    color: trk.color,
                  }}
                >
                  <span className="truncate z-10">{isGenerating ? "Synthesizing note stems..." : trk.pattern}</span>
                  {i === 3 && isPlayingDemo && (
                    <div className="absolute inset-0 flex items-center justify-end pr-2 opacity-50 pointer-events-none">
                      <SoundwaveVisualizer isPlaying={true} barCount={14} height={16} primaryColor="#00F5FF" />
                    </div>
                  )}
                </div>
                <span className="text-[10px] font-mono px-1.5 sm:px-2 py-0.5 rounded bg-[#161D2B] text-[#94A3B8] shrink-0 hidden sm:inline">
                  {trk.type}
                </span>
              </div>
            ))}
          </div>

          {/* Action Row */}
          <div className="pt-3 border-t border-[#141A26] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <button
              onClick={handlePlayGeneration}
              className={`inline-flex items-center justify-center gap-2 px-3.5 py-2 sm:py-1.5 rounded-lg border text-xs font-mono text-white active:scale-[0.95] transition-all cursor-pointer min-h-[40px] sm:min-h-0 ${
                isPlayingDemo
                  ? "bg-[#00F5FF] text-[#06080B] border-[#00F5FF] shadow-[0_0_15px_rgba(0,245,255,0.6)]"
                  : "bg-[#161D2B] hover:bg-[#1E273A] border-[#232F46] hover:border-[#00F5FF]/30"
              }`}
            >
              <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                <path d="M7 4.5v15l13-7.5z" />
              </svg>
              {isPlayingDemo ? "PAUSE AUDIO" : "AUDITION SYNTHESIS"}
            </button>

            <MagneticButton size="sm" variant="primary" onClick={onOpenCadence} className="w-full sm:w-auto shadow-[0_0_15px_rgba(0,245,255,0.35)]">
              OPEN IN CADENCE WORKSPACE →
            </MagneticButton>
          </div>
        </div>
      </MotionCard>
    </section>
  );
};
