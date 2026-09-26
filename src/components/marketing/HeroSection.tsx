import React from "react";
import { MagneticButton } from "./MagneticButton";
import { HeroDawPreview } from "./HeroDawPreview";

interface HeroSectionProps {
  onOpenCadence: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onOpenCadence }) => {
  const repoUrl = "https://github.com/pranavm-dev21/cadence-daw";
  const downloadUrl = `${repoUrl}/releases/download/v0.1.0/Cadence_Setup_v0.1.0.exe`;

  return (
    <section className="relative min-h-screen pt-28 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col justify-center">
      {/* Top Ambient Glow Field */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-[#00F5FF]/[0.045] blur-[140px] rounded-full pointer-events-none" />

      {/* Hero Typography & Eyebrow */}
      <div className="text-center max-w-4xl mx-auto mb-10 sm:mb-14">
        {/* Small Technical Eyebrow */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00F5FF]/10 border border-[#00F5FF]/20 text-[10px] sm:text-[11px] font-mono font-semibold tracking-[0.2em] text-[#00F5FF] uppercase mb-6 shadow-[0_0_20px_rgba(0,245,255,0.15)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00F5FF] animate-pulse" />
          OPEN SOURCE • AI MUSIC WORKSPACE
        </div>

        {/* Huge Headline */}
        <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black tracking-[-0.05em] text-white uppercase leading-[0.92] mb-6">
          MAKE MUSIC
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00F5FF] via-[#38BDF8] to-[#CBD5E1]">
            IN A NEW FLOW.
          </span>
        </h1>

        {/* Subheadline */}
        <p className="max-w-2xl mx-auto text-[#94A3B8] text-base sm:text-xl font-normal leading-relaxed mb-8">
          Cadence is an AI-powered music workspace built for composing, arranging, recording, and shaping sound in one focused environment.
        </p>

        {/* Action CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mb-3">
          <MagneticButton size="lg" variant="primary" onClick={onOpenCadence}>
            OPEN CADENCE
          </MagneticButton>

          <a href={downloadUrl} download="Cadence_Setup_v0.1.0.exe">
            <MagneticButton size="lg" variant="secondary">
              DOWNLOAD FOR WINDOWS
            </MagneticButton>
          </a>

          <a href={repoUrl} target="_blank" rel="noopener noreferrer">
            <MagneticButton size="lg" variant="subtle">
              VIEW ON GITHUB ↗
            </MagneticButton>
          </a>
        </div>

        <span className="text-[11px] font-mono text-[#64748B] block">
          No sign-up required • Free & open-source under MIT • Native Windows .exe + Web DAW
        </span>
      </div>

      {/* Hero Visual: Interactive Cadence DAW Virtual Instrument Representation */}
      <div className="relative w-full max-w-5xl mx-auto mt-2">
        <HeroDawPreview onOpenCadence={onOpenCadence} />
      </div>
    </section>
  );
};
