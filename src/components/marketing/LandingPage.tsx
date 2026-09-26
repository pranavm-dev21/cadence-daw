import React, { useEffect, useState } from "react";
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
import { useScrollPhysics, subscribeScrollPhysics } from "./useScrollPhysics";

interface LandingPageProps {
  onOpenCadence: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenCadence }) => {
  // Activate kinetic spring-momentum scroll physics engine
  useScrollPhysics(true);

  const [scrollProgress, setScrollProgress] = useState(0);

  // Enable fluid physical document scrolling on landing page
  useEffect(() => {
    document.documentElement.classList.add("landing-mode");
    document.body.classList.add("landing-mode");

    const unsubscribe = subscribeScrollPhysics((state) => {
      setScrollProgress(state.progress);
    });

    return () => {
      document.documentElement.classList.remove("landing-mode");
      document.body.classList.remove("landing-mode");
      unsubscribe();
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-[#07090E] text-[#F1F5F9] font-sans selection:bg-[#00F5FF]/30 selection:text-white">
      {/* Kinetic Scroll Progress Hairline Indicator */}
      <div
        className="fixed top-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-[#00F5FF] via-[#38BDF8] to-[#00F5FF] origin-left z-50 pointer-events-none shadow-[0_0_12px_rgba(0,245,255,0.8)]"
        style={{
          transform: `scaleX(${scrollProgress})`,
          transition: "transform 0.05s linear",
        }}
        aria-hidden="true"
      />

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
