import React from "react";
import { Navbar } from "./Navbar";
import { CanvasBackground } from "./CanvasBackground";
import { HeroSection } from "./HeroSection";
import { InteractiveDawShowcase } from "./InteractiveDawShowcase";
import { FeatureEditorial } from "./FeatureEditorial";
import { AiWorkflowSection } from "./AiWorkflowSection";
import { DesktopSection } from "./DesktopSection";
import { OpenSourceSection } from "./OpenSourceSection";
import { FinalCtaSection } from "./FinalCtaSection";
import { Footer } from "./Footer";

interface LandingPageProps {
  onOpenCadence: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenCadence }) => {
  return (
    <div className="relative min-h-screen bg-[#07090E] text-[#F1F5F9] font-sans overflow-x-hidden selection:bg-[#00F5FF]/30 selection:text-white">
      {/* Interactive Physics & Harmonic Waveform Canvas Background */}
      <CanvasBackground />

      {/* Floating Glass Navigation */}
      <Navbar onOpenCadence={onOpenCadence} />

      {/* Page Content */}
      <main className="relative z-10">
        {/* 1. Hero Section with Interactive DAW Preview */}
        <HeroSection onOpenCadence={onOpenCadence} />

        {/* 2. Interactive DAW Showcase (Full Studio Simulation) */}
        <InteractiveDawShowcase onOpenCadence={onOpenCadence} />

        {/* 3. Editorial Interactive Features Section (AI, Arrange, Record, Mix, Export) */}
        <FeatureEditorial />

        {/* 4. Cinematic AI Section */}
        <AiWorkflowSection onOpenCadence={onOpenCadence} />

        {/* 5. Desktop Application (.exe / Specs) */}
        <DesktopSection />

        {/* 6. Built in the Open (GitHub & Architecture) */}
        <OpenSourceSection />

        {/* 7. Final Call to Action */}
        <FinalCtaSection onOpenCadence={onOpenCadence} />
      </main>

      {/* 8. Footer */}
      <Footer onOpenCadence={onOpenCadence} />
    </div>
  );
};
