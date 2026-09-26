# Build Log

## Task Plan

### Foundation
- [x] Inspect supplied repository, package manager, source, tests and documentation (no Git metadata or prior log).
- [x] Preserve React / TypeScript / Vite and command-bus architecture.
- [~] Install dependencies and establish test/type/build baseline.
### Backend
- [ ] Authentication and account model using an established provider.
- [ ] Ownership-checked project CRUD, private audio storage and validated uploads.
- [ ] Authoritative subscription entitlement and payment integration.
### Frontend
- [x] Existing shell, arrangement, MIDI editor, mixer and project file persistence inspected.
- [~] Global Beginner / Moderate / Master labels preserving existing device preferences.
- [ ] Dedicated vocal workspace with recording, take selection, waveform and input status.
- [ ] Project dashboard, settings, premium upgrade UX and responsive/accessibility pass.
### Audio
- [~] Durable local audio assets with original sample rates and explicit missing-audio errors.
- [ ] Wire microphone recording and recorded-take playback/export into the existing engine.
- [ ] Pause/resume, disconnection recovery, metering and latency verification.
- [ ] Persistent vocal EQ/compression/de-essing/gate/effect chain and genuine presets.
- [ ] Compressed export, advanced WAV settings and codec validation.
- [ ] Rhythm/flow practice and clearly qualified timing analysis.
### Security
- [ ] Authentication/ownership/entitlement tests and storage authorization review.
- [ ] Upload validation, transport configuration, secret hygiene, rate limiting and dependency audit.
- [ ] XSS/injection review.
### Testing
- [ ] Existing suite, strict types and production build.
- [ ] Asset persistence, missing assets, recording transitions and mode preservation regression coverage.
- [ ] Browser critical flows and export decoding checks.
### Release readiness
- [ ] Setup documentation, verified commands and known limitations.
- [ ] Production configuration/migrations, release quality pass.

## Decisions

### DEC-001 — Extend the existing local DAW
**Decision:** Keep the existing React/Vite command bus; store binary recordings separately in IndexedDB, with immutable take IDs referenced by metadata. Cloud accounts and billing remain pending until securely implemented and configured.
**Reason:** Existing metadata-only saves cannot recover in-memory audio. Preventing recording loss is the highest-priority dependency. No remote transmission is needed for this repair.
**Alternatives considered:** Replacing the stack or embedding PCM in localStorage (rejected: unnecessary rewrite / quota and serialization overhead).
**Status:** final

## Progress History

## 2026-09-15 — Repository inspection
**Status:** in-progress
**Task:** Foundation and audio persistence
**What changed:** Created this continuity record. Located project inside two nested archive directories; no Git repository, environment template, backend or migrations exists. Existing microphone recorder is not exposed through the UI seam, samples are session-only, and live/export schedulers omit recorded takes. FX Rack is an isolated audition engine and its tab currently renders no content.
**Validation:** Read source and existing tests; dependency installation started.
**Decisions made:** DEC-001. Preserve legacy internal mode keys and change display labels only.
**Known issues:** README overstates implemented features and lists nonexistent Tauri commands. Full product is not production-ready.
**Next step:** Establish baseline checks, implement binary asset persistence and test failure handling, then connect recording/playback/export.
**Blockers:** Cloud authentication and payment infrastructure not configured; local work can proceed.

## 2026-09-15 — Durable vocal workflow and baseline repairs
**Status:** done (local milestone; full product remains in progress)
**Task:** Local recording / asset persistence / playback / export
**What changed:** Added IndexedDB immutable PCM storage with original sample rate, a Vocal / Rap workspace, input selection/status/meter, capture and pause/resume controls, retry after save failure, waveform/take selection, and recorded-take scheduling in live playback and WAV export. Missing assets fail export explicitly. Added Beginner/Moderate/Master display labels with legacy internal keys preserved. Restored the missing FX Rack view (still a separate audition workspace). Made sidebars responsive. Removed unused dependencies and updated test tooling. Repaired malformed recovery cleanup and a MIDI test expectation that contradicted canonical onset sorting. Corrected initial transport tempo and pre-roll position wrapping.
**Validation:** Typecheck and 76 unit/integration tests pass. Browser harness at /tests/audio-browser.html passed synthetic capture, exact IndexedDB restore, project round-trip, WAV decoding with audible vocal samples, ready-state recovery, and missing-asset rejection. npm audit reports zero vulnerabilities. Earlier production build passed; rerun after remaining changes.
**Decisions made:** No hardware microphone permission was granted during testing; use a generated MediaStream. Assets are immutable and intentionally not deleted during undo. JSON is metadata-only and the UI explicitly explains that audio remains on this device.
**Known issues:** Legacy ScriptProcessor capture needs AudioWorklet replacement and physical microphone/latency validation. Portable project audio bundles, detailed DSP, auth/private cloud storage/subscriptions, and production release checks remain unfinished. The alternative chunked renderer in render.ts is not the wired export path and must not be presented as equivalent.
**Next step:** Add persistent vocal EQ/compression parameters through the shared mixer factories, validate mode preservation and offline processing, then finish lifecycle and browser layout checks.
**Blockers:** No configured cloud auth/payment infrastructure; local implementation continues.

## 2026-09-15 — Vocal DSP, export quality, and portable backups
**Status:** in-progress
**Task:** Vocal processing, portable project files, account foundation
**What changed:** Added six real vocal EQ/compression presets, progressive controls, non-destructive bypass, shared live/offline processor, 48 kHz / 24-bit export default with Master quality selection, and export automation scheduling. Added a bounded lossless .cadenceproject container carrying metadata and all takes; imports validate fully before writing, preserve conflicting existing assets and only replace the project after successful writes. Save file now creates this portable backup; legacy JSON remains supported. Removed external Google font requests and bound development server to loopback.
**Validation:** 83 tests/typecheck/build passed before bundle tests. Browser synthetic tests passed real DSP attenuation and decoded 48 kHz / 24-bit exported vocals. 390px phone layout inspected with the vocal workspace accessible by its internal scroll region.
**Decisions made:** Portable backups are an explicit versioned binary format capped at 256 MB. Recordings remain immutable and conflicts fail closed. Supabase Auth/Postgres/private Storage and Stripe are selected for optional cloud services; use database policies for ownership and server-only subscription updates. Current local workflows remain usable without service configuration.
**Known issues:** Cloud configuration is absent and must not be represented as active. Backend/account work starts next; detailed remaining tasks remain on the Task Plan.
**Next step:** Implement ownership-enforced cloud schema, test SQL policies, add authenticated API and verified Stripe webhook handling, then connect account UI behind configuration checks.
**Blockers:** Production Supabase and Stripe credentials will be required to activate hosted services; no external infrastructure is being provisioned or recordings uploaded during development.
