import React, { useEffect } from "react";
import { LEGAL_CONFIG } from "./legalConfig";

interface TermsOfUseProps {
  onBack: () => void;
}

export const TermsOfUse: React.FC<TermsOfUseProps> = ({ onBack }) => {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

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
            <span className="text-xs font-mono text-[#B79A62] uppercase tracking-wider">USER AGREEMENT</span>
          </div>

          <div className="text-[11px] font-mono text-[#686273]">
            v{LEGAL_CONFIG.meta.version} • {LEGAL_CONFIG.meta.effectiveDate}
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        {/* Title */}
        <div className="mb-10 pb-8 border-b border-[#1E1A2B]">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#7C5CBF]/10 border border-[#7C5CBF]/20 text-[10px] font-mono text-[#9B7FD4] tracking-widest uppercase mb-4">
            FAIR CREATIVE TERMS
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white uppercase mb-4">
            TERMS OF USE
          </h1>
          <p className="text-[#9C96A8] text-sm sm:text-base leading-relaxed max-w-3xl">
            Welcome to {LEGAL_CONFIG.organization.tradeName}. These Terms of Use govern your access to the Cadence web application, documentation, and native desktop software. By using Cadence, you agree to these fair terms.
          </p>

          <div className="mt-6 p-4 rounded-xl bg-[#0D0D14] border border-[#1E1A2B] text-xs font-mono text-[#9C96A8] flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-[#686273] block text-[10px] uppercase">Effective Date:</span>
              <span className="text-white font-semibold">{LEGAL_CONFIG.meta.effectiveDate}</span>
            </div>
            <div>
              <span className="text-[#686273] block text-[10px] uppercase">Governing Jurisdiction:</span>
              <span className="text-white font-semibold">{LEGAL_CONFIG.organization.jurisdiction}</span>
            </div>
            <div>
              <span className="text-[#686273] block text-[10px] uppercase">Software License:</span>
              <span className="text-[#B79A62]">{LEGAL_CONFIG.softwareDistribution.licenseType}</span>
            </div>
          </div>
        </div>

        {/* Advisory */}
        <div className="p-4 rounded-xl bg-[#141120] border border-[#281B46] text-xs text-[#CBD5E1] mb-10 leading-relaxed">
          <strong className="text-white block mb-1 uppercase font-mono tracking-wider text-[11px]">
            Technical Baseline Notice
          </strong>
          These terms are drafted to provide a transparent, fair relationship between open-source creators and users. Placeholders indicated with square brackets are subject to customization by the project owner ({LEGAL_CONFIG.organization.legalEntityName}).
        </div>

        {/* Terms Sections */}
        <div className="space-y-10 text-sm leading-relaxed text-[#CBD5E1]">
          {/* Section 1 */}
          <section>
            <h2 className="text-lg sm:text-xl font-bold text-white mb-3 tracking-tight font-mono">
              1. OWNERSHIP OF YOUR MUSIC &amp; CREATIVE CONTENT
            </h2>
            <div className="p-4 rounded-xl bg-[#0D0D14] border border-[#7C5CBF]/40 mb-3 space-y-2">
              <strong className="text-[#B79A62] font-mono text-xs uppercase block">
                The Cadence Golden Rule: You Own What You Make
              </strong>
              <p className="text-sm text-white">
                You retain 100% of all right, title, interest, and intellectual property in and to any music, audio takes, lyrics, arrangements, project files, and sound recordings created or edited using Cadence.
              </p>
              <p className="text-xs text-[#94A3B8]">
                Cadence does <strong>NOT</strong> claim any copyright, royalty, licensing right, or ownership interest in your musical creations simply because you used our workstation to produce them.
              </p>
            </div>
            <p className="text-xs text-[#94A3B8]">
              <strong>Limited Operational License:</strong> The only license you grant to Cadence is the strictly local, technical permission for your device&rsquo;s browser or desktop application to load, decode, process, and render your audio files in computer memory while you use the software.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-lg sm:text-xl font-bold text-white mb-3 tracking-tight font-mono">
              2. ELIGIBILITY &amp; AGE REQUIREMENTS
            </h2>
            <p className="mb-2">
              You may use Cadence if you have the legal capacity to enter into an agreement in your jurisdiction.
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-1 text-xs text-[#CBD5E1]">
              <li>
                If you are under the legal age of majority in your jurisdiction (e.g. under 18 years in India), you should use Cadence with the involvement and consent of a parent or legal guardian.
              </li>
              <li>
                We do not condition standard use of Cadence on submitting age-verification documents or personal identifiers.
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-lg sm:text-xl font-bold text-white mb-3 tracking-tight font-mono">
              3. ACCEPTABLE USE &amp; PROHIBITED CONDUCT
            </h2>
            <p className="mb-3">
              We believe in creative freedom. However, you agree not to use the Cadence workstation or hosting infrastructure to:
            </p>
            <div className="space-y-2 font-mono text-xs">
              <div className="p-3 rounded-lg bg-[#090D14] border border-[#182030]">
                <span className="text-[#EF4444] font-bold block mb-0.5">Infringing Content:</span>
                <span className="text-[#94A3B8]">Distribute music or samples that violate third-party copyrights, master recording rights, trademarks, or publicity rights without appropriate licenses.</span>
              </div>
              <div className="p-3 rounded-lg bg-[#090D14] border border-[#182030]">
                <span className="text-[#EF4444] font-bold block mb-0.5">Malicious Engineering:</span>
                <span className="text-[#94A3B8]">Attempt to inject malware, disrupt our hosting infrastructure, bypass rate-limiting, or exploit vulnerabilities.</span>
              </div>
              <div className="p-3 rounded-lg bg-[#090D14] border border-[#182030]">
                <span className="text-[#EF4444] font-bold block mb-0.5">Deceptive Representation:</span>
                <span className="text-[#94A3B8]">Misrepresent Cadence or claim official endorsement, sponsorship, or certification that does not exist.</span>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-lg sm:text-xl font-bold text-white mb-3 tracking-tight font-mono">
              4. AI CO-CREATION &amp; PROCEDURAL ENGINES
            </h2>
            <p className="mb-3">
              Cadence includes procedural algorithmic composition tools that generate chords, rhythms, and synthesizer parameters.
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-1 text-xs text-[#CBD5E1]">
              <li>
                <strong>Local Execution:</strong> AI features run locally inside your browser Web Worker sandbox without transmitting prompts or recordings to external servers.
              </li>
              <li>
                <strong>User Responsibility:</strong> Because procedural algorithms generate musical motifs based on mathematical rules, you are solely responsible for verifying that your final released compositions do not inadvertently copy protected third-party musical works.
              </li>
              <li>
                <strong>No Guarantees of Commercial Uniqueness:</strong> We make no guarantee that an algorithmically generated chord progression is unique or immune from third-party copyright claims.
              </li>
            </ul>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-lg sm:text-xl font-bold text-white mb-3 tracking-tight font-mono">
              5. DESKTOP APPLICATION DOWNLOADS (WINDOWS, MACOS, LINUX)
            </h2>
            <p className="mb-3">
              The website provides direct download links to native desktop installers and executables for Windows (.exe), macOS (.dmg), and Linux (.AppImage, .deb):
            </p>
            <div className="p-4 rounded-xl bg-[#090D14] border border-[#1A2536] text-xs font-mono space-y-2">
              <p>
                <strong>Execution Context:</strong> Web browsers cannot execute desktop binaries directly. Downloads must be intentionally saved and run locally on a compatible operating system.
              </p>
              <p>
                <strong>Official Source:</strong> All official binary packages are hosted on the project&rsquo;s verified GitHub Releases page ({LEGAL_CONFIG.organization.repositoryUrl}/releases).
              </p>
              <p>
                <strong>Integrity Verification:</strong> Users are encouraged to verify published SHA-256 checksums before installation.
              </p>
              <p>
                <strong>No False Safety Guarantees:</strong> While release binaries are compiled via automated open-source GitHub workflows, we do not claim that any third-party antivirus will never generate a false positive, nor do we claim commercial code-signing certificates unless explicitly documented.
              </p>
            </div>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-lg sm:text-xl font-bold text-white mb-3 tracking-tight font-mono">
              6. OPEN SOURCE SOFTWARE &amp; THIRD-PARTY LICENSES
            </h2>
            <p className="mb-2">
              The Cadence source code is made available under the <strong>MIT License</strong>.
            </p>
            <p className="text-xs text-[#94A3B8] mb-3">
              You are free to view, fork, modify, and build upon the source code in accordance with the MIT License terms. Third-party libraries (e.g. React, Tailwind CSS, Tauri, Supabase) remain subject to their respective open-source licenses. Detailed license disclosures are accessible on our <a href="/licenses" className="text-[#B79A62] underline">Licenses Page</a>.
            </p>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="text-lg sm:text-xl font-bold text-white mb-3 tracking-tight font-mono">
              7. DISCLAIMER OF WARRANTIES (&ldquo;AS-IS&rdquo;)
            </h2>
            <div className="p-4 rounded-xl bg-[#0B0F17] border border-[#1B2538] text-xs font-mono text-[#94A3B8] leading-relaxed">
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE CADENCE SOFTWARE, WEBSITE, AND DOCUMENTATION ARE PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTY OF ANY KIND, EITHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE, INCLUDING WITHOUT LIMITATION WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, BUG-FREE, OR COMPATIBLE WITH ALL AUDIO INTERFACES OR HARDWARE CONFIGURATIONS.
            </div>
          </section>

          {/* Section 8 */}
          <section>
            <h2 className="text-lg sm:text-xl font-bold text-white mb-3 tracking-tight font-mono">
              8. LIMITATION OF LIABILITY
            </h2>
            <div className="p-4 rounded-xl bg-[#0B0F17] border border-[#1B2538] text-xs font-mono text-[#94A3B8] leading-relaxed">
              UNDER NO CIRCUMSTANCES SHALL THE PROJECT MAINTAINERS, CONTRIBUTORS, OR AFFILIATES BE LIABLE FOR ANY INDIRECT, INCIDENTAL, CONSEQUENTIAL, SPECIAL, OR EXEMPLARY DAMAGES (INCLUDING LOSS OF RECORDINGS, AUDIO DATA CORRUPTION, LOSS OF PROFITS, OR WORK STOPPAGE) ARISING OUT OF OR IN CONNECTION WITH YOUR USE OR INABILITY TO USE CADENCE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
            </div>
          </section>

          {/* Section 9 */}
          <section>
            <h2 className="text-lg sm:text-xl font-bold text-white mb-3 tracking-tight font-mono">
              9. GOVERNING LAW &amp; JURISDICTION
            </h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of <strong>{LEGAL_CONFIG.organization.jurisdiction}</strong>, without regard to conflict of law principles. Any dispute arising under or in connection with these Terms shall be subject to the exclusive jurisdiction of the competent courts located in <strong>{LEGAL_CONFIG.organization.governingState}, {LEGAL_CONFIG.organization.jurisdiction}</strong>.
            </p>
          </section>

          {/* Section 10 */}
          <section>
            <h2 className="text-lg sm:text-xl font-bold text-white mb-3 tracking-tight font-mono">
              10. CONTACT INFORMATION
            </h2>
            <p className="mb-2">For inquiries regarding these Terms of Use, please contact:</p>
            <div className="p-4 rounded-lg bg-[#090C12] border border-[#1A2336] text-xs font-mono space-y-1">
              <div><span className="text-[#64748B]">Entity:</span> <span className="text-white">{LEGAL_CONFIG.organization.legalEntityName}</span></div>
              <div><span className="text-[#64748B]">Support:</span> <span className="text-[#B79A62]">{LEGAL_CONFIG.organization.supportEmail}</span></div>
              <div><span className="text-[#64748B]">Address:</span> <span className="text-white">{LEGAL_CONFIG.organization.businessAddress}</span></div>
            </div>
          </section>
        </div>

        {/* Back Button */}
        <div className="mt-14 pt-8 border-t border-[#182030] flex items-center justify-between">
          <button
            onClick={onBack}
            className="px-5 py-2.5 rounded-xl bg-[#161D2B] hover:bg-[#1E273A] text-white text-xs font-mono font-bold transition-colors cursor-pointer"
          >
            ← Return to Workspace
          </button>

          <span className="text-xs font-mono text-[#64748B]">
            Cadence Open Source Initiative
          </span>
        </div>
      </main>
    </div>
  );
};
