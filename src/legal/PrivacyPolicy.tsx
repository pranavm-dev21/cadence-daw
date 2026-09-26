import React, { useEffect } from "react";
import { LEGAL_CONFIG } from "./legalConfig";

interface PrivacyPolicyProps {
  onBack: () => void;
  onOpenDataModal?: () => void;
}

export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onBack, onOpenDataModal }) => {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <div className="min-h-screen bg-[#07090E] text-[#E2E8F0] font-sans selection:bg-[#00F5FF]/30 selection:text-white pb-24">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#07090E]/90 backdrop-blur-xl border-b border-[#1A2234] px-4 sm:px-8 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-xs font-mono text-[#94A3B8] hover:text-[#00F5FF] transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              BACK TO CADENCE
            </button>
            <span className="text-[#334155]">•</span>
            <span className="text-xs font-mono text-[#00F5FF] uppercase tracking-wider">LEGAL DOCUMENTATION</span>
          </div>

          <div className="text-[11px] font-mono text-[#64748B]">
            v{LEGAL_CONFIG.meta.version} • {LEGAL_CONFIG.meta.effectiveDate}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        {/* Document Header */}
        <div className="mb-10 pb-8 border-b border-[#182030]">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00F5FF]/10 border border-[#00F5FF]/20 text-[10px] font-mono text-[#00F5FF] tracking-widest uppercase mb-4">
            TRANSPARENCY & DATA PROTECTION NOTICE
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white uppercase mb-4">
            PRIVACY POLICY
          </h1>
          <p className="text-[#94A3B8] text-sm sm:text-base leading-relaxed max-w-3xl">
            This Privacy Policy describes how personal data and project telemetry are handled by {LEGAL_CONFIG.organization.tradeName} (&ldquo;Cadence&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;). We treat user privacy, data minimization, and consent as core engineering commitments.
          </p>

          <div className="mt-6 p-4 rounded-xl bg-[#0B0F17] border border-[#1A2536] text-xs font-mono text-[#94A3B8] flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-[#64748B] block text-[10px] uppercase">Effective Date:</span>
              <span className="text-white font-semibold">{LEGAL_CONFIG.meta.effectiveDate}</span>
            </div>
            <div>
              <span className="text-[#64748B] block text-[10px] uppercase">Last Updated:</span>
              <span className="text-white font-semibold">{LEGAL_CONFIG.meta.lastUpdatedDate}</span>
            </div>
            <div>
              <span className="text-[#64748B] block text-[10px] uppercase">Compliance Framework:</span>
              <span className="text-[#00F5FF]">Aligned with India DPDP Act, 2023 Principles</span>
            </div>
          </div>
        </div>

        {/* Advisory Callout */}
        <div className="p-4 rounded-xl bg-[#131926] border border-[#223048] text-xs text-[#CBD5E1] mb-10 leading-relaxed">
          <strong className="text-white block mb-1 uppercase font-mono tracking-wider text-[11px]">
            Notice Regarding Legal Status &amp; Configuration
          </strong>
          This document is a technical compliance baseline designed to clearly explain Cadence&rsquo;s actual architecture. It is not formal legal advice. Placeholders marked in brackets must be finalized by the project owner ({LEGAL_CONFIG.organization.legalEntityName}) in review with legal counsel. We do not make unsubstantiated claims of official regulatory certifications.
        </div>

        {/* Policy Sections */}
        <div className="space-y-10 text-sm leading-relaxed text-[#CBD5E1]">
          {/* Section 1 */}
          <section>
            <h2 className="text-lg sm:text-xl font-bold text-white mb-3 tracking-tight font-mono">
              1. ARCHITECTURAL COMMITMENT: LOCAL-FIRST BY DESIGN
            </h2>
            <p className="mb-3">
              Cadence is fundamentally engineered as a <strong>local-first music production environment</strong>. When you compose songs, record audio, tweak synthesizers, slice clips, or program drum sequences in Cadence, the processing occurs directly inside your device&rsquo;s local runtime memory.
            </p>
            <div className="p-4 rounded-lg bg-[#090D14] border border-[#161F2E] space-y-2 font-mono text-xs">
              <div className="flex items-start gap-2">
                <span className="text-[#10B981] font-bold">✓</span>
                <span><strong>No Mandatory Accounts:</strong> You do not need to create an account, log in, or provide an email to use the Cadence workstation.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#10B981] font-bold">✓</span>
                <span><strong>No Remote Audio Capture:</strong> Your microphone recordings, audio takes, and project stems are never streamed to remote servers.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#10B981] font-bold">✓</span>
                <span><strong>Zero Third-Party Trackers:</strong> No advertising pixels, third-party analytics SDKs, or session-recording tools are integrated into this site.</span>
              </div>
            </div>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-lg sm:text-xl font-bold text-white mb-3 tracking-tight font-mono">
              2. WHAT DATA IS PROCESSED &amp; PURPOSE OF PROCESSING
            </h2>
            <p className="mb-4">
              In accordance with data minimization principles under India&rsquo;s Digital Personal Data Protection Act, 2023 (DPDP Act) and international privacy laws, we process only the strictly necessary data:
            </p>

            <div className="space-y-3 font-mono text-xs">
              <div className="p-3.5 rounded-lg bg-[#090D14] border border-[#182234]">
                <span className="text-[#00F5FF] font-bold block mb-1">A. Local Browser Storage (Essential)</span>
                <p className="text-[#94A3B8] mb-1">
                  <strong>Data:</strong> Saved DAW projects, MIDI tracks, automation curves, audio take buffers, and editor view preferences.
                </p>
                <p className="text-[#94A3B8] mb-1">
                  <strong>Storage Mechanism:</strong> Browser IndexedDB (`cadence_takes`) and localStorage (`cadence_session`, `cadence_settings`).
                </p>
                <p className="text-[#64748B]">
                  <strong>Purpose &amp; Basis:</strong> Performance of service requested by you. This data resides exclusively on your local computer or smartphone.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-[#090D14] border border-[#182234]">
                <span className="text-[#38BDF8] font-bold block mb-1">B. Infrastructure &amp; Network Security Logs (Incidental)</span>
                <p className="text-[#94A3B8] mb-1">
                  <strong>Data:</strong> Standard HTTP request metadata (IP address, browser user-agent, requested URL, timestamp) logged transiently by our edge hosting network (Vercel).
                </p>
                <p className="text-[#64748B]">
                  <strong>Purpose &amp; Basis:</strong> Legitimate interest in cybersecurity, defending against DDoS attacks, and ensuring reliable routing. These server logs are not correlated with individual music projects.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-[#090D14] border border-[#182234]">
                <span className="text-[#A78BFA] font-bold block mb-1">C. Optional User Correspondence</span>
                <p className="text-[#94A3B8] mb-1">
                  <strong>Data:</strong> Your email address and message contents if you voluntarily contact us for bug reports, support, or privacy requests.
                </p>
                <p className="text-[#64748B]">
                  <strong>Purpose &amp; Basis:</strong> Explicit consent given by initiating communication, used solely to address your query.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-lg sm:text-xl font-bold text-white mb-3 tracking-tight font-mono">
              3. HOW CONSENT IS OBTAINED &amp; WITHDRAWN
            </h2>
            <ul className="list-disc list-inside space-y-2 pl-1">
              <li>
                <strong>Clear Affirmative Action:</strong> We do not utilize pre-ticked checkboxes or deceptive UI patterns. Using optional features (such as voluntary cloud accounts) requires an affirmative sign-up.
              </li>
              <li>
                <strong>Right to Withdraw Consent:</strong> You may cease local storage at any time by clearing your browser site data or using our integrated data deletion tool.
              </li>
              <li>
                <strong>No Conditional Service:</strong> Full access to the core music workstation and audio synthesis features is never conditioned on consenting to non-essential tracking or marketing.
              </li>
            </ul>
            {onOpenDataModal && (
              <div className="mt-4">
                <button
                  onClick={onOpenDataModal}
                  className="px-4 py-2 rounded-lg bg-[#161D2B] hover:bg-[#1E273A] border border-[#232F46] text-xs font-mono text-[#00F5FF] transition-colors cursor-pointer"
                >
                  ⚙ Inspect / Clear Local Device Storage →
                </button>
              </div>
            )}
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-lg sm:text-xl font-bold text-white mb-3 tracking-tight font-mono">
              4. ARTIFICIAL INTELLIGENCE &amp; CO-CREATIVE PROCESSING
            </h2>
            <p className="mb-3">
              Cadence includes neural and algorithmic co-composition tools (such as chord stamping, rhythm generation, and melodic harmonization).
            </p>
            <div className="p-4 rounded-lg bg-[#0B0F17] border border-[#182030] text-xs font-mono space-y-2">
              <p>
                <strong>Execution Environment:</strong> {LEGAL_CONFIG.aiProcessing.modelType}
              </p>
              <p>
                <strong>No Cloud Exfiltration:</strong> {LEGAL_CONFIG.aiProcessing.sendsAudioToCloud ? "Audio is sent to cloud." : "Zero audio, prompt text, or MIDI is uploaded to any external AI vendor or cloud API by default."}
              </p>
              <p>
                <strong>No Model Training:</strong> Your compositions and inputs are never used to train machine learning models.
              </p>
            </div>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-lg sm:text-xl font-bold text-white mb-3 tracking-tight font-mono">
              5. DATA RETENTION &amp; DELETION
            </h2>
            <p className="mb-3">
              Because Cadence does not store your music projects on central servers, <strong>you retain complete physical custody of your data</strong>:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-1 mb-4">
              <li>
                <strong>Local Projects &amp; Takes:</strong> Persisted in your device&rsquo;s IndexedDB until you delete them, clear your browser data, or reset the workspace.
              </li>
              <li>
                <strong>Server Logs:</strong> Edge server access logs at our hosting provider (Vercel) are automatically rotated and deleted in accordance with industry security standards (typically within 30 to 90 days).
              </li>
              <li>
                <strong>Support Inquiries:</strong> Retained only as long as necessary to resolve the inquiry or comply with legal obligations.
              </li>
            </ul>
            <div className="p-4 rounded-lg bg-[#090D14] border border-[#161F2E] font-mono text-xs">
              <span className="text-[#00F5FF] font-bold block mb-1">How to completely delete your local data:</span>
              <p className="text-[#94A3B8]">
                In your browser, navigate to Developer Tools / Settings ➔ Storage / Clear Site Data ➔ Clear IndexedDB &amp; LocalStorage for this domain.
              </p>
            </div>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-lg sm:text-xl font-bold text-white mb-3 tracking-tight font-mono">
              6. SUBPROCESSORS &amp; INTERNATIONAL TRANSFERS
            </h2>
            <p className="mb-3">
              We rely on trusted technical service providers solely for hosting, release delivery, and optional database features:
            </p>
            <div className="space-y-2.5 font-mono text-xs">
              {LEGAL_CONFIG.subprocessors.map((sub, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-[#090C12] border border-[#161D2B] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-white font-bold block">{sub.name}</span>
                    <span className="text-[#94A3B8]">{sub.purpose}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[#64748B] block text-[10px]">{sub.country}</span>
                    <a href={sub.privacyPolicyUrl} target="_blank" rel="noopener noreferrer" className="text-[#00F5FF] text-[10px] hover:underline">
                      Privacy Policy ↗
                    </a>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-[#94A3B8] mt-3">
              <strong>Cross-Border Transfer Notice:</strong> When accessing our website or downloading releases from GitHub, incidental network requests may be processed across global edge routing locations, in compliance with applicable cross-border data transfer regulations.
            </p>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="text-lg sm:text-xl font-bold text-white mb-3 tracking-tight font-mono">
              7. USER RIGHTS UNDER APPLICABLE LAW
            </h2>
            <p className="mb-3">
              Under India&rsquo;s Digital Personal Data Protection Act, 2023 (DPDP Act) and international data protection regulations, you possess the following rights regarding personal data processed by a Data Fiduciary:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
              <div className="p-3 rounded-lg bg-[#090D14] border border-[#182030]">
                <strong className="text-white block mb-1">Right to Access Summary:</strong>
                <span className="text-[#94A3B8]">Request confirmation of whether personal data is being processed and an accessible summary.</span>
              </div>
              <div className="p-3 rounded-lg bg-[#090D14] border border-[#182030]">
                <strong className="text-white block mb-1">Right to Correction &amp; Erasure:</strong>
                <span className="text-[#94A3B8]">Request correction of inaccurate data or deletion of personal data no longer necessary for its purpose.</span>
              </div>
              <div className="p-3 rounded-lg bg-[#090D14] border border-[#182030]">
                <strong className="text-white block mb-1">Right of Grievance Redressal:</strong>
                <span className="text-[#94A3B8]">Avail of readily available redressal mechanisms through our designated Grievance Officer.</span>
              </div>
              <div className="p-3 rounded-lg bg-[#090D14] border border-[#182030]">
                <strong className="text-white block mb-1">Right to Nominate:</strong>
                <span className="text-[#94A3B8]">Nominate an individual to exercise rights on your behalf in the event of death or incapacity.</span>
              </div>
            </div>
          </section>

          {/* Section 8 */}
          <section>
            <h2 className="text-lg sm:text-xl font-bold text-white mb-3 tracking-tight font-mono">
              8. PROTECTION OF CHILDREN &amp; MINORS
            </h2>
            <p className="mb-2">
              Cadence is an audio creation tool suitable for learners and creative enthusiasts of all ages. However:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-1 mb-3">
              <li>We do not knowingly solicit or collect personal identification data from children under 18 years of age.</li>
              <li>We do not employ targeted advertising, behavioral profiling, or tracking mechanisms directed at minors.</li>
              <li>If you are a parent or guardian and believe personal data has been submitted without required parental consent, please contact our Grievance Officer immediately.</li>
            </ul>
          </section>

          {/* Section 9 */}
          <section>
            <h2 className="text-lg sm:text-xl font-bold text-white mb-3 tracking-tight font-mono">
              9. COOKIES &amp; TRACKING TECHNOLOGIES
            </h2>
            <p className="mb-3">
              <strong>We do NOT use tracking cookies.</strong>
            </p>
            <div className="p-4 rounded-lg bg-[#0B0F17] border border-[#182030] text-xs font-mono">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#1E2536] text-[#64748B]">
                    <th className="pb-2">Technology</th>
                    <th className="pb-2">Type</th>
                    <th className="pb-2">Purpose</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#141A26] text-[#CBD5E1]">
                  <tr>
                    <td className="py-2 text-[#00F5FF]">IndexedDB</td>
                    <td className="py-2">Essential</td>
                    <td className="py-2">Local multi-track audio project storage on your device</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-[#00F5FF]">localStorage</td>
                    <td className="py-2">Essential</td>
                    <td className="py-2">Remembers UI mode, mixer volume state, and editor zoom</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-[#EF4444]">Third-party Cookies</td>
                    <td className="py-2">Disabled</td>
                    <td className="py-2">None used</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 10 */}
          <section>
            <h2 className="text-lg sm:text-xl font-bold text-white mb-3 tracking-tight font-mono">
              10. DATA SECURITY SAFEGUARDS
            </h2>
            <p className="mb-2">We implement robust technical measures to safeguard your interactions:</p>
            <ul className="list-disc list-inside space-y-1.5 pl-1">
              <li>Enforced HTTPS transport with HTTP Strict Transport Security (HSTS).</li>
              <li>Strict Content Security Policy (CSP) blocking unauthorized external scripts and inline evaluations.</li>
              <li>Local sandboxing of AI Web Workers without DOM access or outbound network capabilities.</li>
              <li>Continuous dependency auditing and zero API keys embedded in client-side bundles.</li>
            </ul>
          </section>

          {/* Section 11 */}
          <section>
            <h2 className="text-lg sm:text-xl font-bold text-white mb-3 tracking-tight font-mono">
              11. CONTACT &amp; GRIEVANCE REDRESSAL MECHANISM
            </h2>
            <p className="mb-4">
              For privacy inquiries, rights requests, or grievances under India&rsquo;s Digital Personal Data Protection Act, 2023 or the Information Technology Act, 2000, please reach out to our designated officer:
            </p>
            <div className="p-5 rounded-xl bg-[#090C12] border border-[#1E273A] font-mono text-xs space-y-2">
              <div className="flex justify-between py-1 border-b border-[#141A26]">
                <span className="text-[#64748B]">Data Fiduciary / Entity:</span>
                <span className="text-white font-bold">{LEGAL_CONFIG.organization.legalEntityName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#141A26]">
                <span className="text-[#64748B]">Grievance Officer:</span>
                <span className="text-white">{LEGAL_CONFIG.grievanceRedressal.officerName} ({LEGAL_CONFIG.grievanceRedressal.designation})</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#141A26]">
                <span className="text-[#64748B]">Privacy Email:</span>
                <span className="text-[#00F5FF]">{LEGAL_CONFIG.organization.privacyEmail}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#141A26]">
                <span className="text-[#64748B]">Postal Address:</span>
                <span className="text-white">{LEGAL_CONFIG.grievanceRedressal.physicalAddress}</span>
              </div>
              <div className="pt-2 text-[11px] text-[#94A3B8]">
                {LEGAL_CONFIG.grievanceRedressal.responseTimeNotice}
              </div>
            </div>
          </section>

          {/* Section 12 */}
          <section>
            <h2 className="text-lg sm:text-xl font-bold text-white mb-3 tracking-tight font-mono">
              12. CHANGES TO THIS PRIVACY POLICY
            </h2>
            <p>
              We may update this Privacy Policy to reflect architectural improvements or legal developments. When changes occur, the &ldquo;Last Updated&rdquo; date at the top of this document will be revised. Material updates will be communicated visibly via the website or repository release notes.
            </p>
          </section>
        </div>

        {/* Footer Back Action */}
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
