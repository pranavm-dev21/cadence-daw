# CADENCE LEGAL, PRIVACY & COMPLIANCE SPECIFICATION

> **DOCUMENT STATUS:** Internal Technical Compliance Baseline  
> **LAST UPDATED:** September 26, 2026  
> **APPLICABILITY:** Web Workstation, Documentation Website, and Native Windows Desktop Builds  
> **LEGAL NOTICE:** This document and the associated code provide an engineering and architectural compliance baseline. It does **not** constitute formal legal counsel. Official certification under any specific jurisdiction (such as India's DPDP Act, EU GDPR, etc.) requires legal review by the project owner.

---

## 1. Compliance Architecture Overview

Cadence is designed around **Local-First Architecture** and **Radical Data Minimization**:
- Music compositions, audio takes, stems, and MIDI edits execute strictly client-side on the user's hardware.
- The default website and workstation bundle **zero third-party tracking scripts, zero advertising pixels, and zero session-recording tools**.
- AI co-creation relies on local deterministic in-browser Web Workers with no external network exfiltration.
- All legal configurations and organization metadata are centralized in [`src/legal/legalConfig.ts`](file:///E:/adu/panav0.111-ai-powered-daw-for-beginners-83124/panav0.111-ai-powered-daw-for-beginners-83124/src/legal/legalConfig.ts).

---

## 2. Comprehensive Compliance Checklist

### A. India Digital Personal Data Protection Act, 2023 (DPDP Act)
- [x] **Data Fiduciary Identification:** Placeholders defined for legal entity, trade name, and jurisdiction in `legalConfig.ts`.
- [ ] **Requires legal review:** Legal entity name and registered office address must be finalized by the project owner.
- [x] **Grounds for Processing:** Processing limited to strictly necessary performance of service requested by user (local storage) and cybersecurity logging (incidental edge logs).
- [x] **Notice Requirement (Section 5):** Dedicated `/privacy` route detailing categories of data, purpose, withdrawal, and grievance mechanism.
- [ ] **Requires legal review:** Format and multi-lingual requirements under upcoming DPDP Rules once notified by the Data Protection Board of India.
- [x] **Grievance Redressal Mechanism (Section 13):** Designated Grievance Officer details and statutory timelines (acknowledgment within 48 hours, resolution within 30 days) documented.
- [ ] **Requires legal review:** Formal appointment and contact details of the Grievance Redressal Officer.
- [x] **Data Principal Rights (Sections 11–14):** Right to access summary, right to correction/erasure, grievance redressal, and right to nominate explicitly supported.

---

### B. Consent & Dark Pattern Prohibition
- [x] **Clear Affirmative Action:** No pre-ticked consent checkboxes anywhere in the product.
- [x] **Unbundled Choices:** Core DAW functionality is never conditioned on agreeing to non-essential communications or telemetry.
- [x] **Consent Withdrawal:** Users can clear local storage and reset all persistent client-side data at any time via browser controls or the Data Preferences Modal.
- [x] **Dark Pattern Prohibition:**
  - No deceptive consent flows or countdown timers.
  - No fake scarcity ("Only 2 seats left").
  - No forced email subscription for downloading software or using the workstation.
  - Clean, unweighted dismiss actions.

---

### C. Children & Minors' Data Protection
- [x] **Age Policy:** Clear declaration that Cadence does not target or knowingly collect personal data from minors under 18 years.
- [x] **No Profiling or Behavioral Tracking:** Zero analytics or tracking mechanisms deployed on minors or any users.
- [x] **No Unnecessary Age Collection:** Does not collect date of birth merely for convenience.
- [ ] **Requires legal review:** Verification of verifiable parental consent mechanisms under DPDP Section 9 once relevant rules are published.

---

### D. Data Minimization & Storage Architecture
- [x] **Zero Cloud Audio Collection:** Microphone takes and imported samples are saved exclusively to local device IndexedDB (`cadence_takes`).
- [x] **No Unnecessary Profiling:** No collecting location, hardware serials, device fingerprints, or contact lists.
- [x] **Local Storage Disclosure:** Complete breakdown of IndexedDB and localStorage keys in `/privacy` and the Data Preferences Modal.
- [x] **User Deletion Procedure:** Documented manual and 1-click procedures for purging local storage.

---

### E. Security & Cryptography
- [x] **HTTPS Everywhere:** Enforced TLS with HSTS (`max-age=63072000; includeSubDomains; preload`).
- [x] **Strict Content Security Policy (CSP):** Configured in `index.html` and `vercel.json` with `default-src 'self'`, `object-src 'none'`, and `script-src 'self'`.
- [x] **Permissions Policy:** Restricts unnecessary browser sensors (`camera=(), geolocation=(), payment=()`) while allowing necessary audio input (`microphone=(self)`).
- [x] **No Secrets in Code:** Zero private API keys, tokens, or credentials committed in frontend source code.
- [x] **Sandboxed AI Web Worker:** In-browser worker runs in a separate thread without DOM access or outbound network access.
- [ ] **Requires legal review:** Periodic third-party penetration testing and vulnerability disclosure program (VDP).

---

### F. Third-Party Subprocessors & Cross-Border Data Transfers
- [x] **Subprocessor Registry:** Documented list of third parties:
  - **Vercel Inc.:** Edge hosting and static asset delivery.
  - **GitHub Inc. (Microsoft):** Code repository and release binary hosting.
  - **Supabase Inc.:** Optional, user-activated cloud database (disabled by default).
- [x] **Cross-Border Disclosure:** Explains that static assets and download redirects may touch global CDN edge nodes in compliance with cross-border data transfer regulations.
- [ ] **Requires legal review:** Review of subprocessor Data Processing Addendums (DPAs) with enterprise accounts where applicable.

---

### G. Cookies, Analytics & Telemetry
- [x] **Zero Tracking Cookies:** No third-party marketing, analytics, or advertising cookies.
- [x] **Central Tracking Switch:** Defined in `LEGAL_CONFIG.trackingAndCookies` (`analyticsEnabled: false`, `telemetryEnabled: false`).
- [x] **Storage Inspector Modal:** Live component allowing users to inspect what keys are saved in their browser and clear them immediately.

---

### H. User Content, Music Copyright & Intellectual Property
- [x] **Unambiguous Music Ownership:** Terms of Use unequivocally confirm that users retain 100% ownership and copyright of their music, stems, takes, and lyrics.
- [x] **No Overreaching IP Claims:** Cadence claims zero royalties, zero ownership, and zero commercial licenses on user-created audio.
- [x] **Limited Operational License:** Explicitly limited to local device memory processing required to synthesize and play audio.
- [x] **Classification Matrix:** Distinguishes between:
  1. Personal data (incidental connection logs, optional support emails).
  2. User-created music (solely user-owned).
  3. Uploaded audio (stored locally).
  4. Algorithmic motifs (generated locally).
  5. Cadence software (MIT open-source licensed).

---

### I. AI Co-Creation & Algorithmic Heuristics
- [x] **Local Execution:** Neural and procedural harmonic co-pilots run purely in browser memory.
- [x] **No Model Training on User Data:** Explicitly guarantees user creations are not scraped or fed into AI training corpuses.
- [x] **User Responsibility Notice:** Clear disclosure that users must verify final compositions against third-party copyright before commercial publication.

---

### J. Executable Downloads (.exe) & Software Distribution
- [x] **Transparent Executable Labeling:** Clearly identified as Windows desktop installers (`.exe`), not disguised as other file types.
- [x] **No Browser Executable Execution:** Zero attempts to execute binaries within the browser sandbox.
- [x] **Legitimate Release Source:** All download links target official GitHub Releases under HTTPS.
- [x] **Integrity & Checksums:** Version numbers, file size estimates, and SHA-256 verification instructions provided.
- [x] **No Deceptive Safety Claims:** No false claims of commercial code-signing or 100% virus guarantees until an official EV/OV certificate is integrated into the build pipeline.
- [ ] **Requires legal review:** Acquisition of a Microsoft-trusted Code Signing Certificate for the Windows installer to eliminate SmartScreen warnings.

---

### K. Open Source Licensing & Attribution
- [x] **Cadence License:** Full text of the MIT License displayed at `/licenses` and in the repository root `LICENSE`.
- [x] **Third-Party Attribution:** Documented licenses for React, Tailwind CSS, Tauri, Vite, and typography.
- [x] **Open Source Boundaries:** Delineation between open-source code, binary packages, and proprietary user-created audio.

---

### L. Incident Management & Legal Document Versioning
- [x] **Document Versioning:** Effective date, last updated date, and version identifier (`v1.0.0`) rendered on all legal documents.
- [x] **Version Control:** Legal policies maintained as source-controlled TypeScript/Markdown files in the repository.
- [ ] **Requires legal review:** Formal Data Breach Notification Protocol aligned with Indian Computer Emergency Response Team (CERT-In) reporting guidelines (within 6 hours of incident detection where applicable).

---

## 3. Action Items for Project Owner / Legal Counsel

Before launching commercial operations or marketing under a specific corporate identity:
1. **Fill in Placeholders:** Replace all `[BRACKETED]` items in [`src/legal/legalConfig.ts`](file:///E:/adu/panav0.111-ai-powered-daw-for-beginners-83124\panav0.111-ai-powered-daw-for-beginners-83124\src\legal\legalConfig.ts).
2. **Appoint Grievance Officer:** Provide legitimate contact email and physical address for statutory notices under the DPDP Act.
3. **Establish Legal Entity:** Confirm whether Cadence operates as an individual open-source project or an incorporated entity (e.g. Private Limited, LLP, Section 8 company).
4. **Code Signing Certificate:** Procure a digital signing certificate for the Windows `.exe` to establish publisher authenticity and eliminate Windows Defender / SmartScreen unverified publisher warnings.
