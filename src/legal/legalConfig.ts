/**
 * CADENCE LEGAL & COMPLIANCE CONFIGURATION
 * 
 * IMPORTANT:
 * This central configuration defines assumptions, metadata, and placeholders
 * for privacy, terms of use, licensing, and compliance policies.
 * 
 * PLACEHOLDER NOTICE:
 * Values enclosed in square brackets (e.g. "[PROJECT OWNER / LEGAL ENTITY NAME]")
 * are placeholders that MUST be reviewed and completed by the project owner
 * before declaring official legal compliance.
 * 
 * Do NOT invent or fabricate legal entities, registration numbers, certifications,
 * or compliance seals. This codebase provides a technical compliance baseline,
 * not formal legal advice.
 */

export interface LegalConfig {
  meta: {
    version: string;
    effectiveDate: string;
    lastUpdatedDate: string;
  };
  organization: {
    legalEntityName: string;
    projectName: string;
    tradeName: string;
    jurisdiction: string;
    governingState: string;
    businessAddress: string;
    supportEmail: string;
    privacyEmail: string;
    repositoryUrl: string;
    websiteUrl: string;
  };
  grievanceRedressal: {
    officerName: string;
    designation: string;
    email: string;
    physicalAddress: string;
    responseTimeNotice: string;
  };
  trackingAndCookies: {
    analyticsEnabled: boolean;
    analyticsProvider: string | null;
    telemetryEnabled: boolean;
    advertisingPixelsEnabled: boolean;
    sessionReplayEnabled: boolean;
    thirdPartyEmbedsEnabled: boolean;
    usesLocalStorage: boolean;
    usesIndexedDB: boolean;
  };
  subprocessors: Array<{
    name: string;
    purpose: string;
    country: string;
    privacyPolicyUrl: string;
    isOptional: boolean;
  }>;
  aiProcessing: {
    isLocalEngine: boolean;
    sendsAudioToCloud: boolean;
    sendsPromptsToCloud: boolean;
    modelType: string;
    dataRetentionByModel: string;
  };
  softwareDistribution: {
    licenseType: string;
    licenseUrl: string;
    desktopExecutableUrl: string;
    portableExecutableUrl: string;
    macOSDmgUrl: string;
    linuxAppImageUrl: string;
    linuxDebUrl: string;
    version: string;
    isCodeSigned: boolean;
    sha256Checksum: string;
  };
}

export const LEGAL_CONFIG: LegalConfig = {
  meta: {
    version: "1.0.0",
    effectiveDate: "September 26, 2026",
    lastUpdatedDate: "September 26, 2026",
  },
  organization: {
    legalEntityName: "[PROJECT OWNER / LEGAL ENTITY NAME]",
    projectName: "Cadence Music Workstation",
    tradeName: "CADENCE",
    jurisdiction: "India",
    governingState: "[STATE / UNION TERRITORY - e.g. Karnataka / Delhi / Maharashtra]",
    businessAddress: "[BUSINESS / OPERATIONAL POSTAL ADDRESS IF APPLICABLE]",
    supportEmail: "[SUPPORT EMAIL - e.g. support@example.com]",
    privacyEmail: "[PRIVACY EMAIL - e.g. privacy@example.com]",
    repositoryUrl: "https://github.com/pranavm-dev21/cadence-daw",
    websiteUrl: "https://cadence-daw.vercel.app",
  },
  grievanceRedressal: {
    officerName: "[GRIEVANCE OFFICER NAME]",
    designation: "Data Protection & Grievance Redressal Officer",
    email: "[GRIEVANCE EMAIL - e.g. grievance@example.com]",
    physicalAddress: "[GRIEVANCE OFFICER POSTAL ADDRESS]",
    responseTimeNotice: "In accordance with India's Digital Personal Data Protection Act, 2023 and Information Technology rules, grievances will be acknowledged within 48 hours and resolved within 30 days of receipt.",
  },
  trackingAndCookies: {
    analyticsEnabled: false,
    analyticsProvider: null,
    telemetryEnabled: false,
    advertisingPixelsEnabled: false,
    sessionReplayEnabled: false,
    thirdPartyEmbedsEnabled: false,
    usesLocalStorage: true, // Only for saving local DAW user settings and UI preferences
    usesIndexedDB: true,   // Only for local multi-track audio takes and project files on the device
  },
  subprocessors: [
    {
      name: "Vercel Inc.",
      purpose: "Edge hosting, global content delivery network (CDN), and server infrastructure for static web assets",
      country: "United States / Global Edge Network",
      privacyPolicyUrl: "https://vercel.com/legal/privacy-policy",
      isOptional: false,
    },
    {
      name: "GitHub Inc. (Microsoft)",
      purpose: "Open-source repository hosting, documentation hosting, and desktop binary release distribution",
      country: "United States",
      privacyPolicyUrl: "https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement",
      isOptional: false,
    },
    {
      name: "Supabase Inc.",
      purpose: "Optional user-initiated cloud account authentication and remote project storage backup (Disabled by default; requires active user login)",
      country: "United States",
      privacyPolicyUrl: "https://supabase.com/privacy",
      isOptional: true,
    },
  ],
  aiProcessing: {
    isLocalEngine: true,
    sendsAudioToCloud: false,
    sendsPromptsToCloud: false,
    modelType: "Client-side deterministic Web Worker heuristics and rule-based harmonic composition engines. Code executes in an isolated browser sandbox without DOM or external network access.",
    dataRetentionByModel: "Zero retention. All calculations occur transiently in local device memory.",
  },
  softwareDistribution: {
    licenseType: "MIT License",
    licenseUrl: "https://github.com/pranavm-dev21/cadence-daw/blob/master/LICENSE",
    desktopExecutableUrl: "https://github.com/pranavm-dev21/cadence-daw/releases/download/v0.1.0/Cadence_Setup_v0.1.0.exe",
    portableExecutableUrl: "https://github.com/pranavm-dev21/cadence-daw/releases/download/v0.1.0/Cadence_Portable_v0.1.0.exe",
    macOSDmgUrl: "https://github.com/pranavm-dev21/cadence-daw/releases/download/v0.1.0/Cadence_v0.1.0_universal.dmg",
    linuxAppImageUrl: "https://github.com/pranavm-dev21/cadence-daw/releases/download/v0.1.0/Cadence_v0.1.0_amd64.AppImage",
    linuxDebUrl: "https://github.com/pranavm-dev21/cadence-daw/releases/download/v0.1.0/Cadence_0.1.0_amd64.deb",
    version: "v0.1.0",
    isCodeSigned: false, // Honestly disclose until code-signing cert is provisioned
    sha256Checksum: "[VERIFY OFFICIAL SHA-256 HASH ON GITHUB RELEASE PAGE]",
  },
};
