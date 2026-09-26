import React, { useState } from "react";

export const FeatureEditorial: React.FC = () => {
  const [activeFeature, setActiveFeature] = useState<number>(0);

  const features = [
    {
      id: "ai",
      num: "01",
      tag: "INTELLIGENT WORKFLOW",
      title: "AI MUSIC",
      headline: "Use AI as part of the creative workflow.",
      description:
        "Cadence embeds neural composition engines directly into the piano roll and arrangement bus. Generate harmonic chord beds, complete drum bounce variations, and lyrical rhymes without breaking your flow.",
      visualType: "ai",
    },
    {
      id: "arrange",
      num: "02",
      tag: "COMPOSITION MATRIX",
      title: "ARRANGE",
      headline: "Shape ideas quickly on a focused timeline.",
      description:
        "Non-destructive razor slicing, magnetic time markers, and multi-track clip grouping. Seamlessly move between the 16-step Channel Rack and the full song arrangement with zero modal friction.",
      visualType: "arrange",
    },
    {
      id: "record",
      num: "03",
      tag: "LOW-LATENCY CAPTURE",
      title: "RECORD",
      headline: "Capture audio without leaving the workspace.",
      description:
        "Direct hardware monitoring with sub-5ms latency and automatic round-trip latency alignment. Stack infinite takes, loop punch-in zones, and comp the perfect vocal take in seconds.",
      visualType: "record",
    },
    {
      id: "mix",
      num: "04",
      tag: "STUDIO SIGNAL CHAIN",
      title: "MIX",
      headline: "Control levels, effects, and space with precision.",
      description:
        "10 insert slots per channel with FL Studio-style routing. Includes the analog SoftClipper saturation curve for hard-hitting drums, the Haas StereoShaper for 3D width, and master LUFS metering.",
      visualType: "mix",
    },
    {
      id: "export",
      num: "05",
      tag: "LOSSLESS DELIVERY",
      title: "EXPORT",
      headline: "Turn the finished session into something you can share.",
      description:
        "Studio-grade 24-bit / 48 kHz uncompressed WAV rendering. Automatically bounces full multitrack stems in a single automated pass, ready for mixing engineers and streaming platforms.",
      visualType: "export",
    },
  ];

  return (
    <section className="relative py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto" id="features">
      <div className="mb-14">
        <span className="text-[11px] font-mono tracking-widest text-[#00F5FF] uppercase block mb-3">
          SYSTEM ARCHITECTURE & CAPABILITIES
        </span>
        <h2 className="text-3xl sm:text-5xl font-bold tracking-tighter text-white uppercase max-w-2xl">
          DESIGNED FOR SPEED.
          <br />
          <span className="text-[#64748B]">BUILT FOR RIGOR.</span>
        </h2>
      </div>

      {/* Mobile Horizontal Pill Selector (Visible only on mobile/tablet < lg) */}
      <div className="lg:hidden flex items-center gap-2 overflow-x-auto no-scrollbar pb-3 mb-4 -mx-4 px-4">
        {features.map((feat, idx) => {
          const isActive = activeFeature === idx;
          return (
            <button
              key={feat.id}
              onClick={() => setActiveFeature(idx)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono whitespace-nowrap border transition-all cursor-pointer ${
                isActive
                  ? "bg-[#0F141F] border-[#00F5FF] text-[#00F5FF] shadow-[0_0_15px_rgba(0,245,255,0.15)]"
                  : "bg-[#090C12] border-[#182030] text-[#94A3B8] hover:border-[#222E42]"
              }`}
            >
              <span className="font-bold">{feat.num}</span>
              <span>{feat.title}</span>
            </button>
          );
        })}
      </div>

      {/* Mobile Active Feature Summary Card (Visible only on < lg) */}
      <div className="lg:hidden p-5 rounded-xl bg-[#0F141F] border border-[#00F5FF]/50 shadow-[0_10px_30px_rgba(0,245,255,0.08)] mb-6 text-left">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-mono font-bold text-[#00F5FF]">
            {features[activeFeature].num} // {features[activeFeature].tag}
          </span>
          <span className="w-2 h-2 rounded-full bg-[#00F5FF] animate-pulse" />
        </div>
        <h3 className="text-lg font-bold tracking-tight text-white mb-1.5">{features[activeFeature].title}</h3>
        <p className="text-xs text-[#94A3B8] leading-relaxed mb-3">{features[activeFeature].headline}</p>
        <p className="text-xs text-[#CBD5E1] border-t border-[#1C2538] pt-3 leading-relaxed">
          {features[activeFeature].description}
        </p>
      </div>

      {/* Main Editorial Dual-Pane Layout */}
      <div className="grid grid-cols-12 gap-8 items-start">
        {/* Desktop Left Navigation Column (Hidden on mobile, visible on lg) */}
        <div className="hidden lg:flex lg:col-span-5 flex-col gap-2">
          {features.map((feat, idx) => {
            const isActive = activeFeature === idx;
            return (
              <div
                key={feat.id}
                onClick={() => setActiveFeature(idx)}
                className={`p-5 rounded-xl border transition-all duration-200 cursor-pointer text-left ${
                  isActive
                    ? "bg-[#0F141F] border-[#00F5FF]/60 shadow-[0_10px_30px_rgba(0,245,255,0.08)]"
                    : "bg-[#090C12] hover:bg-[#0C1018] border-[#182030]"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-mono font-bold ${isActive ? "text-[#00F5FF]" : "text-[#64748B]"}`}>
                    {feat.num} // {feat.tag}
                  </span>
                  {isActive && <span className="w-2 h-2 rounded-full bg-[#00F5FF] animate-pulse" />}
                </div>

                <h3 className="text-lg font-bold tracking-tight text-white mb-1.5">{feat.title}</h3>
                <p className="text-xs text-[#94A3B8] leading-relaxed">{feat.headline}</p>

                {isActive && (
                  <p className="mt-3 text-xs text-[#CBD5E1] border-t border-[#1C2538] pt-3 leading-relaxed">
                    {feat.description}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Right Interactive Visual Treatment Pane (Cols 6-12 on desktop, static on mobile) */}
        <div className="col-span-12 lg:col-span-7 static lg:sticky lg:top-24">
          <div className="rounded-2xl bg-[#090C12] border border-[#1D2536] p-5 sm:p-8 min-h-[400px] sm:min-h-[460px] flex flex-col justify-between shadow-[0_20px_70px_rgba(0,0,0,0.8)] overflow-hidden relative">
            {/* Visual Glass Sheen */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#00F5FF]/[0.03] to-transparent pointer-events-none" />

            {/* Top Meta Header */}
            <div className="flex items-center justify-between border-b border-[#182030] pb-4 mb-6 text-xs font-mono">
              <span className="text-[#00F5FF]">{features[activeFeature].tag}</span>
              <span className="text-[#64748B]">CADENCE DSP ENGINE v0.1</span>
            </div>

            {/* Dynamic Interactive Visual Content based on active feature */}
            <div className="flex-1 flex flex-col justify-center">
              {activeFeature === 0 && (
                /* AI MUSIC VISUAL */
                <div className="flex flex-col gap-4">
                  <div className="p-4 rounded-xl bg-[#070A0F] border border-[#1E273A]">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#64748B] block mb-2">
                      Harmonic Co-Pilot Suggestion
                    </span>
                    <div className="text-sm font-semibold text-white mb-2">
                      Progression: Am9 ➔ Fmaj7(#11) ➔ Cmaj9 ➔ Gsus4
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs font-mono">
                      <span className="px-2.5 py-1 rounded bg-[#00F5FF]/10 text-[#00F5FF] border border-[#00F5FF]/30">
                        KEY: A MINOR (100% MATCH)
                      </span>
                      <span className="px-2.5 py-1 rounded bg-[#38BDF8]/10 text-[#38BDF8] border border-[#38BDF8]/30">
                        TENSION: RESOLVED
                      </span>
                      <span className="px-2.5 py-1 rounded bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/30">
                        VOICING: SPREAD STRUM
                      </span>
                    </div>
                  </div>

                  {/* Chord Stamper Piano Roll representation */}
                  <div className="h-auto sm:h-32 rounded-xl bg-[#080B10] border border-[#141A26] p-3 flex flex-col justify-between gap-2">
                    <div className="flex justify-between text-[10px] font-mono text-[#64748B]">
                      <span>CHORD STAMP ACTIVE</span>
                      <span className="hidden sm:inline">15 CHORD TEMPLATES LOADED</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {["Am9", "Fmaj7", "Cmaj9", "Gsus4"].map((c, i) => (
                        <div
                          key={i}
                          className="h-14 sm:h-16 rounded-lg bg-[#00F5FF]/10 border border-[#00F5FF]/40 flex flex-col items-center justify-center text-xs font-mono text-[#00F5FF] font-bold"
                        >
                          <span>{c}</span>
                          <span className="text-[9px] text-[#94A3B8] font-normal">Bar 0{i + 1}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeFeature === 1 && (
                /* ARRANGE VISUAL */
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between text-xs font-mono text-[#94A3B8]">
                    <span>ARRANGEMENT PLAYLIST</span>
                    <span className="text-[#00F5FF]">NON-DESTRUCTIVE RAZOR</span>
                  </div>
                  <div className="space-y-2">
                    {["Intro (4b)", "Verse 1 (8b)", "Pre-Chorus (4b)", "Chorus Drop (8b)"].map((section, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 p-3 rounded-xl bg-[#080B10] border border-[#182030]"
                      >
                        <span className="w-6 text-center text-xs font-mono text-[#64748B]">0{idx + 1}</span>
                        <div className="flex-1 h-8 rounded-lg bg-[#38BDF8]/15 border border-[#38BDF8]/40 flex items-center justify-between px-3 text-xs font-mono text-white">
                          <span>{section}</span>
                          <span className="text-[10px] text-[#38BDF8]">16-STEP MATRIX PINNED</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeFeature === 2 && (
                /* RECORD VISUAL */
                <div className="flex flex-col gap-4">
                  <div className="p-4 rounded-xl bg-[#080B10] border border-[#1E2536] flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-[#64748B]">Input Monitor</span>
                      <div className="text-sm font-bold text-white flex items-center gap-2 mt-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] animate-pulse" />
                        Microphone Input (48 kHz / 24-bit)
                      </div>
                    </div>
                    <span className="text-xs font-mono text-[#10B981] bg-[#10B981]/10 px-2 py-1 rounded border border-[#10B981]/30">
                      0.4ms COMPENSATED
                    </span>
                  </div>

                  {/* Multi-Take Stack */}
                  <div className="space-y-2">
                    {[
                      { name: "Take 01 — Hook Verse", status: "Active (Master Comp)", color: "#00F5FF" },
                      { name: "Take 02 — High Harmony", status: "Layered", color: "#38BDF8" },
                      { name: "Take 03 — Ad-lib Accent", status: "Overdub", color: "#A78BFA" },
                    ].map((tk, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg bg-[#070A0F] border border-[#161D2B] flex items-center justify-between text-xs font-mono"
                      >
                        <span className="text-white font-medium">{tk.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded" style={{ color: tk.color, backgroundColor: `${tk.color}15` }}>
                          {tk.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeFeature === 3 && (
                /* MIX VISUAL */
                <div className="flex flex-col gap-4">
                  <div className="p-4 rounded-xl bg-[#070A0F] border border-[#1E273A]">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-mono font-bold text-[#00F5FF]">SOFTCLIPPER TRANSFER CURVE</span>
                      <span className="text-[10px] font-mono text-[#34D399]">POLYNOMIAL SATURATION</span>
                    </div>
                    <div className="h-28 rounded-lg bg-[#05070B] border border-[#141A26] relative overflow-hidden flex items-center justify-center">
                      {/* Curved Saturation Transfer function SVG */}
                      <svg className="w-full h-full stroke-[#00F5FF] fill-none" viewBox="0 0 200 80">
                        <line x1="0" y1="40" x2="200" y2="40" stroke="#1A2234" strokeDasharray="4 4" />
                        <line x1="100" y1="0" x2="100" y2="80" stroke="#1A2234" strokeDasharray="4 4" />
                        <path d="M 10 75 Q 80 50 100 40 T 190 5" strokeWidth="2.5" />
                      </svg>
                    </div>
                    <div className="flex justify-between text-[10px] font-mono text-[#64748B] mt-2">
                      <span>Threshold: -0.2 dBFS</span>
                      <span>Master LUFS: -14.1 LUFS</span>
                    </div>
                  </div>
                </div>
              )}

              {activeFeature === 4 && (
                /* EXPORT VISUAL */
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between text-xs font-mono text-[#94A3B8]">
                    <span>MULTITRACK STEM BOUNCE</span>
                    <span className="text-[#34D399]">24-BIT / 48 KHZ LOSSLESS</span>
                  </div>
                  <div className="space-y-2 font-mono text-xs">
                    {[
                      { stem: "01_Drums_Master.wav", size: "38.2 MB", time: "03:14" },
                      { stem: "02_Bass_808_Sub.wav", size: "26.8 MB", time: "03:14" },
                      { stem: "03_Synths_Pluck.wav", size: "34.1 MB", time: "03:14" },
                      { stem: "04_Lead_Vocals.wav", size: "32.0 MB", time: "03:14" },
                    ].map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-lg bg-[#070A0F] border border-[#161D2B] gap-2"
                      >
                        <span className="text-white font-medium truncate">{item.stem}</span>
                        <div className="flex items-center gap-3 text-[10px] text-[#64748B] shrink-0">
                          <span>{item.time}</span>
                          <span className="text-[#00F5FF]">{item.size}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Insight Footer */}
            <div className="pt-4 border-t border-[#182030] flex items-center justify-between text-[11px] font-mono text-[#64748B]">
              <span>OPEN ARCHITECTURE • NO DRM</span>
              <span className="text-[#00F5FF]">EXTENSIBLE</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
