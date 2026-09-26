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
    <section className="relative min-h-[92vh] pt-24 sm:pt-32 pb-12 sm:pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col justify-center">
      {/* Top Ambient Glow Field */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 w-[320px] sm:w-[700px] h-[220px] sm:h-[350px] bg-[#00F5FF]/[0.05] blur-[100px] sm:blur-[140px] rounded-full pointer-events-none" />

      {/* Hero Typography & Eyebrow */}
      <div className="text-center max-w-4xl mx-auto mb-8 sm:mb-14">
        {/* Small Technical Eyebrow */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00F5FF]/10 border border-[#00F5FF]/20 text-[9px] sm:text-[11px] font-mono font-semibold tracking-[0.2em] text-[#00F5FF] uppercase mb-4 sm:mb-6 shadow-[0_0_20px_rgba(0,245,255,0.15)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00F5FF] animate-pulse" />
          OPEN SOURCE • AI MUSIC WORKSPACE
        </div>

        {/* Huge Headline */}
        <h1 className="text-4xl sm:text-7xl lg:text-8xl font-black tracking-[-0.04em] text-white uppercase leading-[0.95] sm:leading-[0.92] mb-4 sm:mb-6">
          MAKE MUSIC
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00F5FF] via-[#38BDF8] to-[#CBD5E1]">
            IN A NEW FLOW.
          </span>
        </h1>

        {/* Subheadline */}
        <p className="max-w-2xl mx-auto text-[#94A3B8] text-sm sm:text-xl font-normal leading-relaxed mb-6 sm:mb-8 px-2">
          Cadence is an AI-powered music workspace built for composing, arranging, recording, and shaping sound in one focused environment.
        </p>

        {/* Action CTAs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 sm:gap-4 mb-4 max-w-md sm:max-w-none mx-auto">
          <MagneticButton size="lg" variant="primary" onClick={onOpenCadence} className="w-full sm:w-auto">
            OPEN CADENCE
          </MagneticButton>

          <a href={downloadUrl} download="Cadence_Setup_v0.1.0.exe" className="w-full sm:w-auto">
            <MagneticButton size="lg" variant="secondary" className="w-full sm:w-auto">
              DOWNLOAD FOR WINDOWS
            </MagneticButton>
          </a>

          <a href={repoUrl} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
            <MagneticButton size="lg" variant="subtle" className="w-full sm:w-auto">
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
