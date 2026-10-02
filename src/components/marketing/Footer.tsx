import React from "react";
import { LEGAL_CONFIG } from "../../legal/legalConfig";

interface FooterProps {
  onOpenCadence: () => void;
  onNavigate?: (view: "privacy" | "terms" | "licenses") => void;
  onOpenDataModal?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenCadence, onNavigate, onOpenDataModal }) => {
  const repoUrl = LEGAL_CONFIG.organization.repositoryUrl;
  const downloadUrl = LEGAL_CONFIG.softwareDistribution.desktopExecutableUrl;
  const guideUrl = `${repoUrl}/blob/master/GUIDE.md`;
  const contactEmail = LEGAL_CONFIG.organization.supportEmail;

  return (
    <footer className="border-t border-[#1E1A2B] bg-[#08080C] py-14 px-4 sm:px-6 lg:px-8 text-xs font-mono">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <svg width="20" height="20" viewBox="0 0 32 32" aria-hidden>
              <rect width="32" height="32" rx="8" fill="#141120" stroke="#281B46" />
              <path d="M5 16h3l2-7 3 14 3-10 2 5 2-2h7" fill="none" stroke="#7C5CBF" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-sm font-bold text-white tracking-widest uppercase">CADENCE</span>
          </div>
          <span className="text-[10px] text-[#686273] tracking-wider block">AI MUSIC WORKSPACE</span>
        </div>

        {/* Links Grid */}
        <div className="flex flex-wrap items-center gap-x-6 sm:gap-x-8 gap-y-3 text-[#9C96A8]">
          <button
            onClick={onOpenCadence}
            className="hover:text-[#B79A62] transition-colors cursor-pointer py-1"
          >
            Launch Web DAW
          </button>
          <a
            href={downloadUrl}
            download="Cadence_Setup_v0.1.0.exe"
            className="hover:text-[#B79A62] transition-colors py-1"
          >
            Windows (.exe)
          </a>
          <button
            onClick={() => onNavigate ? onNavigate("privacy") : window.location.assign("/privacy")}
            className="hover:text-[#B79A62] transition-colors cursor-pointer py-1"
          >
            Privacy
          </button>
          <button
            onClick={() => onNavigate ? onNavigate("terms") : window.location.assign("/terms")}
            className="hover:text-[#B79A62] transition-colors cursor-pointer py-1"
          >
            Terms
          </button>
          {onOpenDataModal && (
            <button
              onClick={onOpenDataModal}
              className="hover:text-[#B79A62] transition-colors cursor-pointer py-1"
            >
              Cookies &amp; Storage
            </button>
          )}
          <button
            onClick={() => onNavigate ? onNavigate("licenses") : window.location.assign("/licenses")}
            className="hover:text-[#B79A62] transition-colors cursor-pointer py-1"
          >
            Licenses
          </button>
          <a
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#B79A62] transition-colors py-1"
          >
            GitHub
          </a>
          <a
            href={`mailto:${contactEmail}`}
            className="hover:text-[#B79A62] transition-colors py-1"
          >
            Contact
          </a>
          <a
            href={guideUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#B79A62] transition-colors py-1 text-[#686273]"
          >
            Docs
          </a>
        </div>

        {/* Right Status */}
        <div className="text-[10px] text-[#554F60]">
          <span>© {new Date().getFullYear()} CADENCE • OPEN SOURCE AUDIO INITIATIVE</span>
        </div>
      </div>
    </footer>
  );
};
