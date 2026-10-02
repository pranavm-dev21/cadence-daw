import React, { useEffect } from "react";
import { LEGAL_CONFIG } from "./legalConfig";

interface LicensesProps {
  onBack: () => void;
}

export const Licenses: React.FC<LicensesProps> = ({ onBack }) => {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const thirdPartyLicenses = [
    {
      name: "React & React-DOM",
      license: "MIT License",
      copyright: "Meta Platforms, Inc. and affiliates",
      purpose: "Declarative user interface framework for the workstation",
    },
    {
      name: "Tailwind CSS",
      license: "MIT License",
      copyright: "Tailwind Labs, Inc.",
      purpose: "Utility-first CSS styling engine",
    },
    {
      name: "Tauri Framework",
      license: "MIT OR Apache-2.0",
      copyright: "The Tauri Programme within The Commons Conservancy",
      purpose: "Lightweight native desktop shell and window orchestration",
    },
    {
      name: "Vite",
      license: "MIT License",
      copyright: "Evan You and Vite contributors",
      purpose: "Frontend build tooling and module bundling",
    },
    {
      name: "@supabase/supabase-js",
      license: "MIT License",
      copyright: "Supabase, Inc.",
      purpose: "Optional user-activated cloud database client",
    },
    {
      name: "Space Grotesk & IBM Plex Mono",
      license: "SIL Open Font License (OFL 1.1)",
      copyright: "Florian Karsten / IBM Corp.",
      purpose: "Open typographic system for studio displays",
    },
  ];

  return (
    <div className="min-h-screen bg-[#08080C] text-[#EDE9F6] font-sans selection:bg-[#7C5CBF]/30 selection:text-white pb-24">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-[#08080C]/90 backdrop-blur-xl border-b border-[#1E1A2B] px-4 sm:px-8 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-xs font-mono text-[#9C96A8] hover:text-[#B79A62] transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              BACK TO CADENCE
            </button>
            <span className="text-[#332D42]">•</span>
            <span className="text-xs font-mono text-[#B79A62] uppercase tracking-wider">OPEN SOURCE LICENSES</span>
          </div>

          <div className="text-[11px] font-mono text-[#686273]">
            MIT License • Open Ecosystem
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        <div className="mb-10 pb-8 border-b border-[#1E1A2B]">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#10B981]/10 border border-[#10B981]/20 text-[10px] font-mono text-[#10B981] tracking-widest uppercase mb-4">
            TRANSPARENCY & ATTRIBUTION
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white uppercase mb-4">
            SOFTWARE LICENSES
          </h1>
          <p className="text-[#9C96A8] text-sm sm:text-base leading-relaxed max-w-3xl">
            Cadence is built on a foundation of open standards and permissive open-source collaboration. This page details the primary license for Cadence and provides attribution for our foundational open-source components.
          </p>
        </div>

        {/* Clear Scope Distinction */}
        <section className="mb-12">
          <h2 className="text-base sm:text-lg font-bold text-white mb-4 tracking-tight font-mono uppercase">
            Scope &amp; Classification
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
            <div className="p-4 rounded-xl bg-[#0D0D14] border border-[#1E1A2B]">
              <span className="text-[#9B7FD4] font-bold block mb-1">Cadence Source Code</span>
              <p className="text-[#9C96A8]">
                All original source code authored for the Cadence workstation is released under the permissive MIT License.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-[#0D0D14] border border-[#1E1A2B]">
              <span className="text-[#10B981] font-bold block mb-1">Your Music &amp; Audio</span>
              <p className="text-[#9C96A8]">
                User-created songs, recorded vocal takes, stems, and MIDI compositions remain 100% your proprietary copyright.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-[#0D0D14] border border-[#1E1A2B]">
              <span className="text-[#B79A62] font-bold block mb-1">Desktop Binary Builds</span>
              <p className="text-[#9C96A8]">
                Compiled executables bundle the open-source Rust Tauri engine and WebAudio DSP pipeline for Windows, macOS, and Linux.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-[#0D0D14] border border-[#1E1A2B]">
              <span className="text-[#8B6FB0] font-bold block mb-1">Third-Party Libraries</span>
              <p className="text-[#9C96A8]">
                Dependencies are governed by their respective individual open-source licenses as attributed below.
              </p>
            </div>
          </div>
        </section>

        {/* Main Cadence MIT License */}
        <section className="mb-12">
          <h2 className="text-base sm:text-lg font-bold text-white mb-4 tracking-tight font-mono uppercase">
            Cadence Primary License (MIT)
          </h2>
          <div className="p-6 rounded-xl bg-[#0D0D14] border border-[#1E1A2B] font-mono text-xs text-[#CBD5E1] space-y-4">
            <p className="font-bold text-white">
              Copyright (c) {new Date().getFullYear()} {LEGAL_CONFIG.organization.legalEntityName} and Cadence Contributors
            </p>
            <p className="leading-relaxed">
              Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the &ldquo;Software&rdquo;), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
            </p>
            <p className="leading-relaxed">
              The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
            </p>
            <p className="leading-relaxed text-[#9C96A8]">
              THE SOFTWARE IS PROVIDED &ldquo;AS IS&rdquo;, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
            </p>
          </div>
        </section>

        {/* Third-Party Attribution */}
        <section className="mb-12">
          <h2 className="text-base sm:text-lg font-bold text-white mb-4 tracking-tight font-mono uppercase">
            Third-Party Open-Source Attribution
          </h2>
          <div className="space-y-3 font-mono text-xs">
            {thirdPartyLicenses.map((item, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-[#0D0D14] border border-[#1E1A2B] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-white font-bold block text-sm">{item.name}</span>
                  <span className="text-[#9C96A8]">{item.purpose}</span>
                  <span className="text-[#686273] block text-[10px] mt-0.5">Copyright: {item.copyright}</span>
                </div>
                <div className="shrink-0 sm:text-right">
                  <span className="px-2.5 py-1 rounded bg-[#7C5CBF]/10 text-[#9B7FD4] border border-[#7C5CBF]/20 text-[10px] font-bold">
                    {item.license}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Back Link */}
        <div className="pt-8 border-t border-[#1E1A2B] flex items-center justify-between">
          <button
            onClick={onBack}
            className="px-5 py-2.5 rounded-xl bg-[#141120] hover:bg-[#1E1A2B] text-white text-xs font-mono font-bold transition-colors cursor-pointer"
          >
            ← Return to Workspace
          </button>
          <a
            href={LEGAL_CONFIG.organization.repositoryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono text-[#B79A62] hover:underline"
          >
            View Repository on GitHub ↗
          </a>
        </div>
      </main>
    </div>
  );
};
