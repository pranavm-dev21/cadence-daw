import React, { useState, useEffect, useMemo } from "react";
import { MagneticButton } from "./MagneticButton";
import { detectClientHostOs, getAllPlatformSpecs } from "../../platform";

interface NavbarProps {
  onOpenCadence: () => void;
  onNavigate?: (view: "privacy" | "terms" | "licenses") => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenCadence, onNavigate }) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const hostOs = useMemo(() => detectClientHostOs(), []);
  const allSpecs = useMemo(() => getAllPlatformSpecs(), []);
  const currentSpecs = useMemo(
    () => allSpecs.find((s) => s.os === hostOs) || allSpecs[0],
    [allSpecs, hostOs]
  );

  const repoUrl = "https://github.com/pranavm-dev21/cadence-daw";
  const downloadUrl = currentSpecs.downloadUrl;

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleMobileNavClick = (href: string) => {
    setMobileMenuOpen(false);
    const target = document.querySelector(href);
    if (target) {
      target.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-200 ${
        scrolled || mobileMenuOpen
          ? "bg-[#07090E]/95 border-b border-[#182030] backdrop-blur-md py-3"
          : "bg-transparent py-4 sm:py-5"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div
            className="flex items-center gap-2 cursor-pointer touch-manipulation"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            <svg width="24" height="24" viewBox="0 0 32 32" aria-hidden>
              <rect width="32" height="32" rx="7" fill="#131824" stroke="#253046" />
              <path
                d="M5 16h3l2-7 3 14 3-10 2 5 2-2h7"
                fill="none"
                stroke="#00F5FF"
                strokeWidth="2.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-sm sm:text-base font-bold text-white tracking-widest uppercase">CADENCE</span>
          </div>

          <div className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full bg-[#101726] border border-[#1E293B] text-[9px] font-mono text-[#00F5FF] tracking-wider uppercase">
            OPEN SOURCE • AI
          </div>
        </div>

        {/* Center Nav Links (Desktop) */}
        <nav className="hidden md:flex items-center gap-8 text-xs font-mono tracking-wider text-[#94A3B8]">
          <a href="#showcase" className="hover:text-white transition-colors">
            SHOWCASE
          </a>
          <a href="#features" className="hover:text-white transition-colors">
            WORKFLOW
          </a>
          <a href="#ai" className="hover:text-white transition-colors">
            AI ENGINE
          </a>
          <a href="#desktop" className="hover:text-white transition-colors">
            DESKTOP APP
          </a>
          <a href="#opensource" className="hover:text-white transition-colors">
            SOURCE
          </a>
        </nav>

        {/* Right Action CTAs */}
        <div className="flex items-center gap-2 sm:gap-3">
          <a
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-[#CBD5E1] hover:text-white hover:bg-[#141C2A] transition-colors"
          >
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              />
            </svg>
            GitHub
          </a>

          <a href={downloadUrl} download={currentSpecs.installerName} className="hidden lg:inline-block">
            <MagneticButton size="sm" variant="secondary">
              DOWNLOAD {currentSpecs.installerExtension.toUpperCase()}
            </MagneticButton>
          </a>

          <MagneticButton
            size="sm"
            variant="primary"
            onClick={onOpenCadence}
            className="text-[10px] sm:text-[11px] px-3 sm:px-3.5 py-1.5 sm:py-2"
          >
            OPEN CADENCE
          </MagneticButton>

          {/* Mobile Hamburger Toggle */}
          <button
            onClick={() => setMobileMenuOpen((o) => !o)}
            className="md:hidden p-2 rounded-lg bg-[#111622] border border-[#1E273A] text-[#94A3B8] hover:text-white touch-manipulation focus:outline-none"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? (
              <svg className="w-5 h-5 stroke-current" viewBox="0 0 24 24" fill="none" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5 stroke-current" viewBox="0 0 24 24" fill="none" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden px-4 pt-4 pb-6 mt-3 bg-[#07090E]/98 border-t border-b border-[#1A2234] backdrop-blur-2xl flex flex-col gap-3 font-mono text-sm">
          <button
            onClick={() => handleMobileNavClick("#showcase")}
            className="text-left py-2.5 px-3 rounded-lg text-[#CBD5E1] hover:text-[#00F5FF] hover:bg-[#0E131E] transition-colors"
          >
            SHOWCASE // STUDIO CONSOLE
          </button>
          <button
            onClick={() => handleMobileNavClick("#features")}
            className="text-left py-2.5 px-3 rounded-lg text-[#CBD5E1] hover:text-[#00F5FF] hover:bg-[#0E131E] transition-colors"
          >
            WORKFLOW // 5 DEEP DIVES
          </button>
          <button
            onClick={() => handleMobileNavClick("#ai")}
            className="text-left py-2.5 px-3 rounded-lg text-[#CBD5E1] hover:text-[#00F5FF] hover:bg-[#0E131E] transition-colors"
          >
            AI ENGINE // PROMPT TIMELINE
          </button>
          <button
            onClick={() => handleMobileNavClick("#desktop")}
            className="text-left py-2.5 px-3 rounded-lg text-[#CBD5E1] hover:text-[#00F5FF] hover:bg-[#0E131E] transition-colors"
          >
            DESKTOP APP // WIN • MAC • LINUX
          </button>
          <button
            onClick={() => handleMobileNavClick("#opensource")}
            className="text-left py-2.5 px-3 rounded-lg text-[#CBD5E1] hover:text-[#00F5FF] hover:bg-[#0E131E] transition-colors"
          >
            SOURCE // MIT GITHUB REPO
          </button>

          <div className="pt-3 border-t border-[#161D2B] flex flex-col gap-2">
            <a
              href={downloadUrl}
              download={currentSpecs.installerName}
              className="w-full"
            >
              <button className="w-full py-3 rounded-lg bg-[#111726] border border-[#232F46] text-[#E0E7FF] font-semibold text-xs text-center flex items-center justify-center gap-2 cursor-pointer active:scale-[0.97] transition-transform">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M19 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                DOWNLOAD FOR {currentSpecs.name.toUpperCase()} ({currentSpecs.installerExtension.toUpperCase()})
              </button>
            </a>

            <div className="flex items-center justify-between text-xs text-[#64748B] pt-2 px-1">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onNavigate ? onNavigate("privacy") : window.location.assign("/privacy");
                }}
                className="hover:text-[#00F5FF] cursor-pointer"
              >
                Privacy Policy
              </button>
              <span>•</span>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onNavigate ? onNavigate("terms") : window.location.assign("/terms");
                }}
                className="hover:text-[#00F5FF] cursor-pointer"
              >
                Terms of Use
              </button>
              <span>•</span>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onNavigate ? onNavigate("licenses") : window.location.assign("/licenses");
                }}
                className="hover:text-[#00F5FF] cursor-pointer"
              >
                Licenses
              </button>
            </div>

            <a
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 rounded-lg bg-transparent text-[#94A3B8] text-xs text-center flex items-center justify-center gap-2"
            >
              View GitHub Repository ↗
            </a>
          </div>
        </div>
      )}
    </header>
  );
};
