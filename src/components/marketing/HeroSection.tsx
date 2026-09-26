import React, { useMemo } from "react";
import { MagneticButton } from "./MagneticButton";
import { HeroDawPreview } from "./HeroDawPreview";
import { useInViewReveal } from "./motion/useInViewReveal";
import { SoundwaveVisualizer } from "./motion/SoundwaveVisualizer";
import { detectClientHostOs, getAllPlatformSpecs } from "../../platform";

interface HeroSectionProps {
  onOpenCadence: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onOpenCadence }) => {
  const repoUrl = "https://github.com/pranavm-dev21/cadence-daw";

  const hostOs = useMemo(() => detectClientHostOs(), []);
  const allSpecs = useMemo(() => getAllPlatformSpecs(), []);
  const currentSpecs = useMemo(
    () => allSpecs.find((s) => s.os === hostOs) || allSpecs[0],
    [allSpecs, hostOs]
  );
  const downloadUrl = currentSpecs.downloadUrl;

  // Staggered reveal for hero typography and preview
  const { ref: heroTextRef, isRevealed: heroTextRevealed, getStaggerStyle } = useInViewReveal<HTMLDivElement>({
    threshold: 0.1,
    staggerInterval: 80,
  });

  const { ref: dawPreviewRef, isRevealed: dawPreviewRevealed } = useInViewReveal<HTMLDivElement>({
    threshold: 0.1,
    baseDelay: 240,
  });

  return (
    <section className="relative min-h-[92vh] pt-24 sm:pt-32 pb-12 sm:pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col justify-center">
      {/* Ambient Radial Glow Layer (Pillar 3: Ambient Motion) */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 w-[320px] sm:w-[700px] h-[220px] sm:h-[350px] bg-[#00F5FF]/[0.05] blur-[100px] sm:blur-[140px] rounded-full pointer-events-none anim-halo-breathe" />

      {/* Hero Typography & Eyebrow */}
      <div ref={heroTextRef} className="text-center max-w-4xl mx-auto mb-8 sm:mb-14">
        {/* Technical Eyebrow Badge with mini Soundwave */}
        <div
          style={getStaggerStyle(0)}
          className={`inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#00F5FF]/10 border border-[#00F5FF]/20 text-[9px] sm:text-[11px] font-mono font-semibold tracking-[0.2em] text-[#00F5FF] uppercase mb-4 sm:mb-6 shadow-[0_0_20px_rgba(0,245,255,0.15)] anim-badge-float transition-all duration-600 ${
            heroTextRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#00F5FF] animate-pulse" />
          <span>OPEN SOURCE • AI MUSIC WORKSPACE</span>
          <div className="hidden sm:inline-block ml-1 opacity-75">
            <SoundwaveVisualizer isPlaying={true} barCount={10} height={12} primaryColor="#00F5FF" />
          </div>
        </div>

        {/* Headline */}
        <h1
          style={getStaggerStyle(1)}
          className={`text-4xl sm:text-7xl lg:text-8xl font-black tracking-[-0.04em] text-white uppercase leading-[0.95] sm:leading-[0.92] mb-4 sm:mb-6 transition-all duration-700 ease-cinematic ${
            heroTextRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          MAKE MUSIC
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00F5FF] via-[#38BDF8] to-[#CBD5E1]">
            IN A NEW FLOW.
          </span>
        </h1>

        {/* Subheadline */}
        <p
          style={getStaggerStyle(2)}
          className={`max-w-2xl mx-auto text-[#94A3B8] text-sm sm:text-xl font-normal leading-relaxed mb-6 sm:mb-8 px-2 transition-all duration-700 ease-cinematic ${
            heroTextRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          Cadence is an AI-powered music workspace built for composing, arranging, recording, and shaping sound in one focused environment.
        </p>

        {/* Action CTAs */}
        <div
          style={getStaggerStyle(3)}
          className={`flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 sm:gap-4 mb-4 max-w-md sm:max-w-none mx-auto transition-all duration-700 ease-cinematic ${
            heroTextRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <MagneticButton size="lg" variant="primary" onClick={onOpenCadence} className="w-full sm:w-auto shadow-[0_0_25px_rgba(0,245,255,0.35)]">
            OPEN CADENCE
          </MagneticButton>

          <a href={downloadUrl} download={currentSpecs.installerName} className="w-full sm:w-auto">
            <MagneticButton size="lg" variant="secondary" className="w-full sm:w-auto">
              DOWNLOAD FOR {currentSpecs.name.toUpperCase()} ({currentSpecs.installerExtension.toUpperCase()})
            </MagneticButton>
          </a>

          <a href={repoUrl} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
            <MagneticButton size="lg" variant="subtle" className="w-full sm:w-auto">
              VIEW ON GITHUB ↗
            </MagneticButton>
          </a>
        </div>

        <span
          style={getStaggerStyle(4)}
          className={`text-[11px] font-mono text-[#64748B] block transition-all duration-700 ${
            heroTextRevealed ? "opacity-100" : "opacity-0"
          }`}
        >
          No sign-up required • Free & open-source under MIT • Native {currentSpecs.name} + Web DAW
        </span>
      </div>

      {/* Hero Visual: Interactive Cadence DAW Virtual Instrument Representation */}
      <div
        ref={dawPreviewRef}
        className={`relative w-full max-w-5xl mx-auto mt-2 transition-all duration-800 ease-cinematic ${
          dawPreviewRevealed ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-10 scale-[0.98]"
        }`}
      >
        <HeroDawPreview onOpenCadence={onOpenCadence} />
      </div>
    </section>
  );
};
