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
  onNavigate?: (view: "privacy" | "terms" | "licenses") => void;
  onOpenDataModal?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onOpenCadence,
  onNavigate,
  onOpenDataModal,
}) => {
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
    <div className="relative min-h-screen bg-[#08080C] text-[#EDE9F6] font-sans selection:bg-[#7C5CBF]/30 selection:text-white overflow-x-hidden w-full">
      {/* Kinetic Scroll Progress Hairline Indicator */}
      <div
        className="fixed top-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-[#7C5CBF] via-[#B79A62] to-[#7C5CBF] origin-left z-50 pointer-events-none shadow-[0_0_12px_rgba(183,154,98,0.4)]"
        style={{
          transform: `scaleX(${scrollProgress})`,
          transition: "transform 0.05s linear",
        }}
        aria-hidden="true"
      />

      {/* Interactive Physics & Harmonic Waveform Canvas Background */}
      <CanvasBackground />

      {/* Floating Glass Navigation */}
      <Navbar onOpenCadence={onOpenCadence} onNavigate={onNavigate} />

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

      {/* 8. Footer with Legal and Compliance Links */}
      <Footer
        onOpenCadence={onOpenCadence}
        onNavigate={onNavigate}
        onOpenDataModal={onOpenDataModal}
      />
    </div>
  );
};
