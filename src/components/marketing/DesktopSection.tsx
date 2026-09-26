import React from "react";
import { MagneticButton } from "./MagneticButton";

export const DesktopSection: React.FC = () => {
  const downloadInstallerUrl =
    "https://github.com/pranavm-dev21/cadence-daw/releases/download/v0.1.0/Cadence_Setup_v0.1.0.exe";
  const downloadPortableUrl =
    "https://github.com/pranavm-dev21/cadence-daw/releases/download/v0.1.0/Cadence_Portable_v0.1.0.exe";

  return (
    <section className="relative py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto" id="desktop">
      <div className="rounded-3xl bg-gradient-to-b from-[#0F1420] to-[#080B10] border border-[#1E273A] p-5 sm:p-14 overflow-hidden relative shadow-[0_30px_100px_rgba(0,0,0,0.9)]">
        {/* Subtle Ambient Radial Light */}
        <div className="absolute top-0 right-0 w-[500px] h-[300px] bg-[#00F5FF]/[0.05] blur-[100px] rounded-full pointer-events-none" />

        <div className="grid grid-cols-12 gap-8 sm:gap-10 items-center">
          {/* Left Text & Download CTAs (Cols 1-7) */}
          <div className="col-span-12 lg:col-span-7">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#38BDF8]/10 border border-[#38BDF8]/20 text-[11px] font-mono text-[#38BDF8] tracking-widest uppercase mb-4">
              NATIVE WINDOWS DESKTOP APPLICATION
            </div>

            <h2 className="text-3xl sm:text-6xl font-bold tracking-tighter text-white uppercase leading-none mb-6">
              THE FULL STUDIO.
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00F5FF] to-[#38BDF8]">
                ON YOUR MACHINE.
              </span>
            </h2>

            <p className="text-[#94A3B8] text-sm sm:text-base leading-relaxed mb-8 max-w-xl">
              While the browser offers instant cloud-free playback, the native Windows desktop app delivers uncompressed audio processing, direct hardware ASIO driver access, and total offline independence.
            </p>

            {/* Hardware Specs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8 font-mono text-xs">
              <div className="p-3 rounded-xl bg-[#090C12] border border-[#172030]">
                <span className="text-[10px] text-[#64748B] block uppercase">Platform</span>
                <span className="text-white font-bold">Windows 10 / 11</span>
                <span className="text-[9px] text-[#00F5FF] block mt-0.5">x64 Native</span>
              </div>
              <div className="p-3 rounded-xl bg-[#090C12] border border-[#172030]">
                <span className="text-[10px] text-[#64748B] block uppercase">Drivers</span>
                <span className="text-white font-bold">ASIO / WASAPI</span>
                <span className="text-[9px] text-[#10B981] block mt-0.5">Sub-5ms Latency</span>
              </div>
              <div className="p-3 rounded-xl bg-[#090C12] border border-[#172030]">
                <span className="text-[10px] text-[#64748B] block uppercase">Privacy</span>
                <span className="text-white font-bold">100% Offline</span>
                <span className="text-[9px] text-[#38BDF8] block mt-0.5">Zero Telemetry</span>
              </div>
            </div>

            {/* Direct Download Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
              <a href={downloadInstallerUrl} download="Cadence_Setup_v0.1.0.exe" className="w-full sm:w-auto">
                <MagneticButton size="lg" variant="primary" className="w-full sm:w-auto shadow-[0_0_25px_rgba(0,245,255,0.4)]">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M19 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                  </svg>
                  DOWNLOAD FOR WINDOWS (.EXE)
                </MagneticButton>
              </a>

              <a href={downloadPortableUrl} download="Cadence_Portable_v0.1.0.exe" className="w-full sm:w-auto">
                <MagneticButton size="md" variant="secondary" className="w-full sm:w-auto">
                  PORTABLE EDITION
                </MagneticButton>
              </a>
            </div>

            <span className="text-[11px] font-mono text-[#64748B] block mt-4">
              Version 0.1.0 • Standalone Executable (~8.7 MB) • SHA-256 Verified
            </span>
          </div>

          {/* Right Architecture Card (Cols 8-12) */}
          <div className="col-span-12 lg:col-span-5">
            <div className="rounded-2xl bg-[#090D14] border border-[#1C2536] p-6 shadow-2xl font-mono text-xs text-[#CBD5E1]">
              <div className="flex items-center justify-between pb-3 border-b border-[#161D2B] mb-4">
                <span className="text-[10px] text-[#00F5FF] uppercase tracking-wider">TAURI v2 + RUST ENGINE</span>
                <span className="text-[10px] text-[#34D399]">COMPILED RELEASE</span>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between py-1.5 border-b border-[#141A26]">
                  <span className="text-[#64748B]">Binary Size:</span>
                  <span className="text-white font-bold">8.7 MB (Zero Bloat)</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#141A26]">
                  <span className="text-[#64748B]">Memory Baseline:</span>
                  <span className="text-white font-bold">&lt; 90 MB RAM</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#141A26]">
                  <span className="text-[#64748B]">Audio Engine:</span>
                  <span className="text-white font-bold">24-bit 48 kHz Floating Point</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#141A26]">
                  <span className="text-[#64748B]">Stems Export:</span>
                  <span className="text-[#00F5FF] font-bold">Multi-threaded Offline Render</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-[#64748B]">Install Type:</span>
                  <span className="text-white font-bold">NSIS Setup Wizard (.exe)</span>
                </div>
              </div>

              <div className="mt-5 p-3 rounded-lg bg-[#07090E] border border-[#141A26] text-[10px] text-[#64748B] leading-relaxed">
                Note: Web browsers cannot execute .exe binaries directly. Clicking download provides the setup installer for local installation on your Windows system.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
