import React from "react";
import { MagneticButton } from "./MagneticButton";

export const OpenSourceSection: React.FC = () => {
  const repoUrl = "https://github.com/pranav520214/cadence-music-workspace";

  const pillars = [
    {
      title: "No Subscription Lock-In",
      desc: "Music software shouldn't require monthly rent. Cadence is 100% free and open source under the MIT License.",
      icon: "🔓",
    },
    {
      title: "Deterministic Audio Bus",
      desc: "Every parameter change, note placement, and FX automation is an atomic, undoable command in the core bus.",
      icon: "⚡",
    },
    {
      title: "Zero Telemetry & Tracking",
      desc: "Your recordings, audio takes, and session stems never leave your device. Complete local privacy by default.",
      icon: "🛡️",
    },
  ];

  return (
    <section className="relative py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto" id="opensource">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-14 gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#10B981]/10 border border-[#10B981]/20 text-[11px] font-mono text-[#10B981] tracking-widest uppercase mb-4">
            TRANSPARENT ENGINEERING • MIT LICENSE
          </div>
          <h2 className="text-4xl sm:text-6xl font-bold tracking-tighter text-white uppercase leading-none">
            BUILT IN THE OPEN.
          </h2>
        </div>

        <a href={repoUrl} target="_blank" rel="noopener noreferrer">
          <MagneticButton size="md" variant="secondary" className="border-[#38BDF8]/40 text-[#38BDF8]">
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            VIEW SOURCE ON GITHUB
          </MagneticButton>
        </a>
      </div>

      {/* Grid of Open Source Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {pillars.map((p, idx) => (
          <div
            key={idx}
            className="p-6 rounded-2xl bg-[#090C12] border border-[#1A2234] hover:border-[#00F5FF]/40 transition-colors"
          >
            <span className="text-2xl block mb-3">{p.icon}</span>
            <h3 className="text-lg font-bold text-white mb-2 tracking-tight">{p.title}</h3>
            <p className="text-xs text-[#94A3B8] leading-relaxed font-normal">{p.desc}</p>
          </div>
        ))}
      </div>

      {/* Tech Stack Bar */}
      <div className="p-6 rounded-2xl bg-[#0B0F17] border border-[#161D2B] flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
        <span className="text-[#64748B] uppercase tracking-wider">CORE TECHNOLOGIES:</span>
        <div className="flex flex-wrap items-center gap-3">
          <span className="px-3 py-1 rounded bg-[#070A0F] border border-[#1A2336] text-[#38BDF8]">
            TypeScript 5.7
          </span>
          <span className="px-3 py-1 rounded bg-[#070A0F] border border-[#1A2336] text-[#FF6F61]">
            Rust 1.97
          </span>
          <span className="px-3 py-1 rounded bg-[#070A0F] border border-[#1A2336] text-[#00F5FF]">
            Tauri v2
          </span>
          <span className="px-3 py-1 rounded bg-[#070A0F] border border-[#1A2336] text-[#A78BFA]">
            Web Audio DSP
          </span>
          <span className="px-3 py-1 rounded bg-[#070A0F] border border-[#1A2336] text-[#10B981]">
            Tailwind CSS
          </span>
        </div>
      </div>
    </section>
  );
};
