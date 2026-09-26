import React from "react";

interface FooterProps {
  onOpenCadence: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenCadence }) => {
  const repoUrl = "https://github.com/pranavm-dev21/cadence-daw";
  const downloadUrl = `${repoUrl}/releases/download/v0.1.0/Cadence_Setup_v0.1.0.exe`;
  const guideUrl = `${repoUrl}/blob/master/GUIDE.md`;

  return (
    <footer className="border-t border-[#161D2B] bg-[#06080C] py-14 px-4 sm:px-6 lg:px-8 text-xs font-mono">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <svg width="20" height="20" viewBox="0 0 32 32" aria-hidden>
              <rect width="32" height="32" rx="8" fill="#1d2330" stroke="#39415a" />
              <path d="M5 16h3l2-7 3 14 3-10 2 5 2-2h7" fill="none" stroke="#00f5ff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-sm font-bold text-white tracking-widest uppercase">CADENCE</span>
          </div>
          <span className="text-[10px] text-[#64748B] tracking-wider block">AI MUSIC WORKSPACE</span>
        </div>

        {/* Links Grid */}
        <div className="flex flex-wrap items-center gap-6 sm:gap-10 text-[#94A3B8]">
          <button
            onClick={onOpenCadence}
            className="hover:text-[#00F5FF] transition-colors cursor-pointer"
          >
            Launch Web DAW
          </button>
          <a
            href={downloadUrl}
            className="hover:text-[#00F5FF] transition-colors"
          >
            Download for Windows
          </a>
          <a
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#00F5FF] transition-colors"
          >
            GitHub
          </a>
          <a
            href={guideUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#00F5FF] transition-colors"
          >
            Documentation
          </a>
          <a
            href={`${repoUrl}/blob/master/LICENSE`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#00F5FF] transition-colors"
          >
            License (MIT)
          </a>
        </div>

        {/* Right Status */}
        <div className="text-[10px] text-[#475569]">
          <span>© {new Date().getFullYear()} CADENCE • OPEN SOURCE AUDIO INITIATIVE</span>
        </div>
      </div>
    </footer>
  );
};
