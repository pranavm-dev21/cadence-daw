# Cadence

A browser music workspace built with React, TypeScript, Vite and Web Audio. The local vocal workflow is implemented; the full production roadmap remains in progress. See [log.md](log.md) for verified milestones and remaining work.

## Run locally

Use Node.js 24 and npm. From this directory:

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. Microphone access requires localhost or HTTPS and browser permission. Local recording needs no cloud credentials.

```sh
npm run check
npm audit
```

`check` runs browser/server type checks, automated tests and a production build. `npm run preview` previews `dist`; it does not start the API.

## Available workflows

- Beginner, Moderate and Master expose progressively detailed controls while retaining the same project and undo history.
- Vocal / Rap supports input selection, metering, recording, pause/resume, take selection, waveform display and save retry after storage failure.
- AudioWorklet captures mono vocals, with a compatibility fallback. Monitoring starts off. Capture stops at ten minutes; practical project duration is limited to 64 bars.
- Import supported browser-decodable audio up to 64 MB and the current 64-bar timeline. Stereo channels are preserved. Browser decoding may resample the source.
- Six vocal presets configure real high-pass filtering, presence EQ and compression. Bypass and parameter changes preserve source audio. The shared mixer applies processing to playback and WAV export.
- WAV export defaults to stereo 48 kHz / 24-bit; Master exposes 44.1/48 kHz and 16/24-bit choices.
- Save file downloads a lossless `.cadenceproject` containing metadata and all referenced takes, including inactive takes. Version 2 preserves stereo and reads older version 1 mono bundles. Local bundles are capped at 256 MB.
- Lyrics persist with the project. Rhyme suggestions use a small local dictionary; syllable estimates are approximate English heuristics.
- Existing MIDI arrangement, piano roll, mixer and synth workflows remain available. The FX Rack is a separate audition workspace, not the saved vocal processing chain.

## Saving and privacy

Project metadata is stored locally; PCM audio is stored in IndexedDB. Browser storage can be cleared or evicted: download portable project backups for important work. Legacy JSON files contain metadata only and require their audio assets on the same device. Missing audio prevents export instead of silently producing an incomplete song.

Local projects remain on the device after cloud sign-out. Use a private browser profile on shared computers. Cloud upload happens only through the Projects controls after accounts are configured. No real microphone audio or user projects were uploaded during development checks.

## Optional accounts and Premium

[DEPLOYMENT.md](DEPLOYMENT.md) describes the Supabase/Stripe setup. Copy `.env.example` to `.env`, configure services, and run `npm run server` in a second terminal. The development server forwards `/api` to the local API.

The implementation includes verified bearer authentication, owner-filtered projects, private storage, revision conflict protection, server-enforced Premium history and signature-checked subscription events. Hosted services have not been provisioned or tested end to end. Blank configuration leaves cloud features explicitly unavailable and local editing usable.

## Verification

Automated coverage includes recording transitions, storage transactions, bundle corruption/collisions, stereo compatibility, mode preservation, WAV encoding, DSP settings, API authorization, subscription events and database row policies. Database tests use real embedded PostgreSQL with test representations of Supabase-owned schemas.

With the development server running, `/tests/audio-browser.html` exercises synthetic audio capture, persistent recovery, audible WAV decoding, DSP, missing-asset rejection and stereo import. It does not request a physical microphone or play the generated tone through speakers. `/tests/layout.html` supports phone/tablet inspection. Deploy only `dist`, not the source/test directory.

## Remaining work

This is not yet a production release. Remaining items include non-destructive audio trimming, compressed exports, de-essing/noise gate and detailed chain editing, fuller rhythm/flow practice, physical microphone latency calibration, broader browser/accessibility coverage, password recovery, hosted auth/billing validation, cloud storage quotas and orphan cleanup, operational monitoring and release review. The alternate chunk renderer is not the wired export engine and has not been validated for recorded takes.
