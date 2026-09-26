import React, { useState } from "react";
import { MagneticButton } from "./MagneticButton";
import {
  detectClientHostOs,
  getAllPlatformSpecs,
} from "../../platform";
import { useInViewReveal } from "./motion/useInViewReveal";
import { MotionCard } from "./motion/MotionCard";

export const DesktopSection: React.FC = () => {
  const detectedOs = detectClientHostOs();
  const [selectedOs, setSelectedOs] = useState<"windows" | "macos" | "linux">(
    detectedOs
  );

  const { ref: sectionRef, isRevealed: sectionRevealed } = useInViewReveal<HTMLElement>({
    threshold: 0.12,
  });

  const allSpecs = getAllPlatformSpecs();
  const currentSpecs =
    allSpecs.find((s) => s.os === selectedOs) || allSpecs[0];

  const getSystemRequirements = (os: "windows" | "macos" | "linux") => {
    switch (os) {
      case "macos":
        return "macOS 11.0 Big Sur or later (Native Apple Silicon M1-M4 & Intel Core)";
      case "linux":
        return "glibc 2.31+, WebKit2GTK 4.1, PipeWire / PulseAudio / ALSA";
      case "windows":
      default:
        return "Windows 10 (1903+) or Windows 11 (64-bit Intel / AMD)";
    }
  };

  const getInstallTip = (os: "windows" | "macos" | "linux") => {
    switch (os) {
      case "macos":
        return "Mount the .dmg disk image and drag Cadence to your Applications folder. Microphone permission is prompted on first vocal tracking.";
      case "linux":
        return "Make the AppImage executable with 'chmod +x Cadence*.AppImage' and launch directly, or install via 'sudo dpkg -i Cadence*.deb'.";
      case "windows":
      default:
        return "Run the NSIS setup wizard to install into AppData, or launch the Portable Edition with zero registry changes.";
    }
  };

  return (
    <section
      ref={sectionRef}
      className="relative py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
      id="desktop"
    >
      <div
        className={`rounded-3xl bg-gradient-to-b from-[#0F1420] to-[#080B10] border border-[#1E273A] p-5 sm:p-14 overflow-hidden relative shadow-[0_30px_100px_rgba(0,0,0,0.9)] transition-all duration-700 ease-cinematic ${
          sectionRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
        }`}
      >
        {/* Ambient Radial Lighting */}
        <div className="absolute top-0 right-0 w-[500px] h-[300px] bg-[#00F5FF]/[0.05] blur-[100px] rounded-full pointer-events-none anim-halo-breathe" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[250px] bg-[#38BDF8]/[0.03] blur-[90px] rounded-full pointer-events-none" />

        {/* Platform Selection Segmented Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 border-b border-[#1E273A] pb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#38BDF8]/10 border border-[#38BDF8]/20 text-[11px] font-mono text-[#38BDF8] tracking-widest uppercase mb-2 anim-badge-float">
              CROSS-PLATFORM DESKTOP WORKSTATION
            </div>
            <p className="text-xs text-[#94A3B8]">
              One codebase. One unified creative experience. Zero Electron bloat.
            </p>
          </div>

          <div className="inline-flex p-1 rounded-xl bg-[#090D14] border border-[#1C2536] self-start sm:self-auto">
            {(["windows", "macos", "linux"] as const).map((osKey) => {
              const isSelected = selectedOs === osKey;
              return (
                <button
                  key={osKey}
                  onClick={() => setSelectedOs(osKey)}
                  className={`px-3 sm:px-4 py-2 rounded-lg text-xs font-mono transition-all flex items-center gap-2 cursor-pointer active:scale-[0.96] ${
                    isSelected
                      ? "bg-[#162032] text-[#00F5FF] shadow-inner font-semibold border border-[#00F5FF]/20"
                      : "text-[#94A3B8] hover:text-white"
                  }`}
                >
                  {osKey === "windows" && (
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                      <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-13.051-1.801" />
                    </svg>
                  )}
                  {osKey === "macos" && (
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.61-.75 1.04-1.8 1.01-2.85-.9.04-2 .61-2.65 1.36-.58.67-.99 1.74-.93 2.78.99.08 2.05-.53 2.57-1.29z" />
                    </svg>
                  )}
                  {osKey === "linux" && (
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                      <path d="M12.002 2c-2.49 0-4.5 2.01-4.5 4.5 0 .86.25 1.67.68 2.35C6.44 9.87 5 11.78 5 14c0 3.87 3.13 7 7.002 7 3.86 0 6.998-3.13 6.998-7 0-2.22-1.44-4.13-3.18-5.15.43-.68.68-1.49.68-2.35 0-2.49-2.01-4.5-4.5-4.5zm0 1.5c1.66 0 3 1.34 3 3 0 .74-.28 1.42-.74 1.95l-.39.45.54.26c1.39.68 2.59 2.16 2.59 4.84 0 2.76-2.24 5-5 5s-5-2.24-5-5c0-2.68 1.2-4.16 2.59-4.84l.54-.26-.39-.45c-.46-.53-.74-1.21-.74-1.95 0-1.66 1.34-3 3-3z" />
                    </svg>
                  )}
                  <span className="capitalize">{osKey === "macos" ? "macOS" : osKey}</span>
                  {detectedOs === osKey && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00F5FF] animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-12 gap-8 sm:gap-10 items-center">
          {/* Left Text & Download CTAs (Cols 1-7) */}
          <div className="col-span-12 lg:col-span-7">
            {detectedOs === selectedOs && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#10B981]/10 border border-[#10B981]/30 text-[10px] font-mono text-[#10B981] mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                Auto-detected for your system ({currentSpecs.name})
              </div>
            )}

            <h2 className="text-3xl sm:text-6xl font-bold tracking-tighter text-white uppercase leading-none mb-6">
              THE FULL STUDIO.
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00F5FF] to-[#38BDF8]">
                ON YOUR MACHINE.
              </span>
            </h2>

            <p className="text-[#94A3B8] text-sm sm:text-base leading-relaxed mb-8 max-w-xl">
              While the browser offers instant cloud-free playback, the native{" "}
              {currentSpecs.name} desktop app delivers uncompressed 24-bit 48kHz
              audio processing, direct {currentSpecs.audioSubsystem} hardware
              access, and total offline independence.
            </p>

            {/* Hardware Specs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8 font-mono text-xs">
              <div className="p-3 rounded-xl bg-[#090C12] border border-[#172030] hover:border-[#00F5FF]/30 transition-colors">
                <span className="text-[10px] text-[#64748B] block uppercase">
                  Platform
                </span>
                <span className="text-white font-bold">{currentSpecs.name}</span>
                <span className="text-[9px] text-[#00F5FF] block mt-0.5 truncate">
                  {currentSpecs.architecture}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#090C12] border border-[#172030] hover:border-[#38BDF8]/30 transition-colors">
                <span className="text-[10px] text-[#64748B] block uppercase">
                  Drivers
                </span>
                <span className="text-white font-bold truncate block">
                  {currentSpecs.audioSubsystem}
                </span>
                <span className="text-[9px] text-[#10B981] block mt-0.5">
                  {currentSpecs.recommendedDriver}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#090C12] border border-[#172030] hover:border-[#38BDF8]/30 transition-colors">
                <span className="text-[10px] text-[#64748B] block uppercase">
                  Privacy
                </span>
                <span className="text-white font-bold">100% Offline</span>
                <span className="text-[9px] text-[#38BDF8] block mt-0.5">
                  Zero Telemetry
                </span>
              </div>
            </div>

            {/* Direct Download Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
              <a
                href={currentSpecs.downloadUrl}
                download={currentSpecs.installerName}
                className="w-full sm:w-auto"
              >
                <MagneticButton
                  size="lg"
                  variant="primary"
                  className="w-full sm:w-auto shadow-[0_0_25px_rgba(0,245,255,0.4)]"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M19 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                  </svg>
                  DOWNLOAD FOR {currentSpecs.name.toUpperCase()} (
                  {currentSpecs.installerExtension.toUpperCase()})
                </MagneticButton>
              </a>

              {currentSpecs.portableDownloadUrl && (
                <a
                  href={currentSpecs.portableDownloadUrl}
                  className="w-full sm:w-auto"
                >
                  <MagneticButton
                    size="md"
                    variant="secondary"
                    className="w-full sm:w-auto"
                  >
                    {selectedOs === "windows"
                      ? "PORTABLE EDITION (.EXE)"
                      : selectedOs === "linux"
                      ? "DEBIAN PACKAGE (.DEB)"
                      : "MACOS ARCHIVE"}
                  </MagneticButton>
                </a>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-4 text-[11px] font-mono text-[#64748B]">
              <span>Version 0.1.0</span>
              <span>•</span>
              <span>Standalone Executable (~{currentSpecs.fileSizeApprox})</span>
              <span>•</span>
              <a
                href={currentSpecs.releaseNotesUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[#00F5FF] hover:underline"
              >
                Verify SHA-256 Checksum on GitHub
              </a>
            </div>
          </div>

          {/* Right Architecture Card wrapped in MotionCard */}
          <div className="col-span-12 lg:col-span-5">
            <MotionCard
              enableTilt={true}
              spotlightColor="rgba(56, 189, 248, 0.12)"
              className="rounded-2xl bg-[#090D14] border border-[#1C2536] p-6 shadow-2xl font-mono text-xs text-[#CBD5E1]"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#161D2B] mb-4">
                <span className="text-[10px] text-[#00F5FF] uppercase tracking-wider">
                  TAURI v2 + RUST ENGINE
                </span>
                <span className="text-[10px] text-[#34D399]">
                  COMPILED RELEASE
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between py-1.5 border-b border-[#141A26]">
                  <span className="text-[#64748B]">Target OS:</span>
                  <span className="text-white font-bold">
                    {currentSpecs.name}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#141A26]">
                  <span className="text-[#64748B]">Binary Size:</span>
                  <span className="text-white font-bold">
                    {currentSpecs.fileSizeApprox} (Zero Bloat)
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#141A26]">
                  <span className="text-[#64748B]">Memory Baseline:</span>
                  <span className="text-white font-bold">&lt; 90 MB RAM</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#141A26]">
                  <span className="text-[#64748B]">Audio Engine:</span>
                  <span className="text-white font-bold">
                    24-bit 48 kHz Floating Point
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#141A26]">
                  <span className="text-[#64748B]">Packaging:</span>
                  <span className="text-[#00F5FF] font-bold">
                    {currentSpecs.binaryFormat}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-[#64748B]">Requirement:</span>
                  <span className="text-white text-right max-w-[200px] truncate">
                    {getSystemRequirements(selectedOs)}
                  </span>
                </div>
              </div>

              <div className="mt-5 p-3 rounded-lg bg-[#07090E] border border-[#141A26] text-[10px] text-[#64748B] leading-relaxed">
                <span className="text-[#00F5FF] font-bold block mb-1">
                  Installation Guide ({currentSpecs.name}):
                </span>
                {getInstallTip(selectedOs)}
              </div>
            </MotionCard>
          </div>
        </div>
      </div>
    </section>
  );
};
