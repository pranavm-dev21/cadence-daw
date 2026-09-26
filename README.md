<div align="center">

# 🎛️ CADENCE DAW

### The Open-Source AI-Native Music Workstation

[![Vercel Deployment](https://img.shields.io/badge/Live%20Demo-cadence--daw.vercel.app-00F5FF?style=for-the-badge&logo=vercel&logoColor=white)](https://cadence-daw.vercel.app)
[![Release](https://img.shields.io/badge/Release-v0.1.0-10B981?style=for-the-badge&logo=github&logoColor=white)](https://github.com/pranavm-dev21/cadence-daw/releases/tag/v0.1.0)
[![License: MIT](https://img.shields.io/badge/License-MIT-38BDF8?style=for-the-badge)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Web-6366F1?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/pranavm-dev21/cadence-daw/releases)
[![Tests](https://img.shields.io/badge/Tests-115%20Passing-00F5FF?style=for-the-badge&logo=vitest&logoColor=white)](https://github.com/pranavm-dev21/cadence-daw)

<br />

**Cadence** is a next-generation Digital Audio Workstation (DAW) engineered for speed, tactile control, and producer-grade sound design. Featuring an **FL Studio-inspired rapid-composition workflow**, Cadence combines a deterministic audio bus with an integrated **AI Music Copilot**, **10-Slot Studio Mixer**, **Edison Audio Slicing Suite**, and **Multi-Take Vocal Tracking**.

Available as a **native Windows application (`.exe`)** and a **zero-install Web DAW**.

<br />

[**🚀 Launch in Browser**](https://cadence-daw.vercel.app) • [**📥 Download for Windows (.exe)**](https://github.com/pranavm-dev21/cadence-daw/releases/download/v0.1.0/Cadence_Setup_v0.1.0.exe) • [**📖 User Manual (GUIDE.md)**](GUIDE.md) • [**📦 Release Notes**](https://github.com/pranavm-dev21/cadence-daw/releases)

---

</div>

<br />

## 📑 Table of Contents

- [✨ Key Architectural Pillars](#-key-architectural-pillars)
- [📥 Downloads & Direct Installation](#-downloads--direct-installation)
- [🎹 Studio Workspaces & Feature Suite](#-studio-workspaces--feature-suite)
  - [1. Channel Rack Pro](#1-channel-rack-pro-drum-sequencer)
  - [2. Piano Roll Pro Suite](#2-piano-roll-pro-suite)
  - [3. Edison Audio Waveform & Slicing Suite](#3-edison-audio-waveform--slicing-suite)
  - [4. 10-Slot Studio Mixer & DSP Plugins](#4-10-slot-studio-mixer--dsp-plugins)
  - [5. Sample Browser with Live Audition](#5-sample-browser-with-live-audition)
  - [6. Vocal Recording Studio](#6-vocal-recording-studio)
  - [7. AI Music Copilot & Arranger](#7-ai-music-copilot--arranger)
  - [8. Master WAV & Multitrack Stems Export](#8-master-wav--multitrack-stems-export)
- [⌨️ Pro Keyboard Shortcuts Cheat-Sheet](#️-pro-keyboard-shortcuts-cheat-sheet)
- [🛠️ Local Development & Building](#️-local-development--building)
- [🏛️ Architecture & Clean Seams](#️-architecture--clean-seams)
- [📄 License & Open-Source Commitment](#-license--open-source-commitment)

<br />

---

## ✨ Key Architectural Pillars

| Pillar | Description |
| :--- | :--- |
| **⚡ Deterministic Audio Bus** | Every note placement, automation curve, fader level, and plugin parameter edit is an atomic transaction in a pure command bus (`src/core/bus.ts`), giving you **infinite, non-destructive undo/redo** (`Ctrl+Z` / `Ctrl+Y`). |
| **🔊 Sub-5ms Real-Time Audio** | Zero-latency Web Audio API engine in modern browsers, paired with high-performance WASAPI/ASIO drivers in desktop builds. |
| **🤖 Native AI Copilot** | Describe what you want in plain English (*"Dark UK drill drum pattern at 142 BPM"*, *"Cinematic neo-soul chords in F minor"*), and Cadence synthesizes MIDI clips, chord voicings, and arrangements directly onto the timeline. |
| **🔓 100% Free & Open Source** | No monthly subscription rent, no activation keys, and no feature paywalls. Licensed under the permissive **MIT License**. |
| **🛡️ Complete Offline Privacy** | Zero telemetry, zero phone-home tracking, and zero cloud lock-in. Your recorded vocals, beats, and session files remain 100% on your machine. |

<br />

---

## 📥 Downloads & Direct Installation

Official release packages are published on the **[GitHub Releases Page](https://github.com/pranavm-dev21/cadence-daw/releases/tag/v0.1.0)**:

### 1. Windows Setup Installer (`.exe`) — Recommended
- **[Cadence_Setup_v0.1.0.exe](https://github.com/pranavm-dev21/cadence-daw/releases/download/v0.1.0/Cadence_Setup_v0.1.0.exe)** (~2.01 MB)
- Features: Standard Windows setup wizard, Desktop shortcut, Start Menu integration, and clean uninstaller.

### 2. Standalone Portable Edition (`.exe`)
- **[Cadence_Portable_v0.1.0.exe](https://github.com/pranavm-dev21/cadence-daw/releases/download/v0.1.0/Cadence_Portable_v0.1.0.exe)** (~8.75 MB)
- Features: Zero installation required. Drop it onto a USB thumb drive, double-click, and start producing immediately on any 64-bit Windows PC.

### 3. Progressive Web App (PWA) / Browser
- Visit **[cadence-daw.vercel.app](https://cadence-daw.vercel.app)** in Google Chrome, Microsoft Edge, or Brave.
- Click the install icon in the address bar to install Cadence as a standalone desktop window on macOS, Linux, ChromeOS, or Windows.

<br />

---

## 🎹 Studio Workspaces & Feature Suite

Cadence organizes music production into specialized, focused studio workspaces accessible via the top switcher or shortcut keys `F5`–`F9` (or `1`–`7`):

```
┌────────────────────────────────────────────────────────────────────────┐
│  CADENCE WORKBENCH                                                     │
├──────────────┬──────────────────────────────────────────┬──────────────┤
│ BROWSER PRO  │ WORKSPACE (Channel Rack / Piano Roll /   │ AI COPILOT   │
│              │ Edison / Mixer / Arrangement / Vocal)    │              │
│ - Packs      │                                          │ - Prompt Bar │
│ - Audition   │                                          │ - Generator  │
│ - Drag & Drop│                                          │ - Chat Log   │
├──────────────┴──────────────────────────────────────────┴──────────────┤
│ TRANSPORT BAR: [Play/Pause] [Stop] [Record] [BPM] [Metronome] [Time]   │
└────────────────────────────────────────────────────────────────────────┘
```

<br />

### 1. Channel Rack Pro (Drum Sequencer)
- **16-Step Pattern Grid**: Classic 4-beat color-coded blocks for lightning-fast drum sequencing.
- **Mixer Routing**: Route each channel independently to any of the 16 mixer tracks.
- **Per-Channel Mixing**: Individual Pan knobs, Volume sliders, and Mute/Solo status LEDs.
- **Global Swing Engine**: Add natural groove and syncopation to straight 16th-note beats.
- **Integrated Step Graph Editor**: Click any step to open granular per-step automation:
  - **Velocity**: Shape dynamic human feel.
  - **Pan**: Create wide stereo ear-candy percussion.
  - **Pitch**: Tune 808s and hi-hat rolls on the fly.

### 2. Piano Roll Pro Suite
- **Polyphonic MIDI Note Grid**: Multi-octave note painting with snap-to-grid (`1/4`, `1/8`, `1/16`, `1/32`, `Off`).
- **Chord Stamper Tool**: Instant 1-click stamp for over 15 harmonic chord templates:
  - *Major, Minor, 7th, Major 7th, Minor 7th, 9th, Sus2, Sus4, Diminished, Augmented, etc.*
- **Arpeggiator Engine**: Transform static chords into moving rhythmic arpeggios (Up, Down, Up/Down, Random) with rate division.
- **Guitar Strum Tool**: Natural note onset staggering and velocity slope simulating real plectrum strums.
- **Humanizer & Flam**: Micro-timing randomization, velocity jitter, and double-strike percussion flams.
- **Key & Scale Highlighting**: Root key snapping across Major, Natural Minor, Dorian, Phrygian, Lydian, Mixolydian, and Pentatonic scales.

### 3. Edison Audio Waveform & Slicing Suite
- **High-Resolution Waveform Display**: Smooth zoomable audio inspection with draggable selection ranges.
- **Transient Auto-Slice**: Intelligent peak-detection algorithm that automatically chops drum breaks and loops into individual hits.
- **Lossless Audio DSP Tools**:
  - **Normalize**: Peak-normalizes audio to 0 dBFS.
  - **Reverse**: Renders audio in reverse for transitional swells and FX.
  - **Trim & Silence**: Destructive sample cropping and unwanted noise deletion.
  - **Exponential Fades**: Smooth Fade-In and Fade-Out curves to eliminate clicks.
- **Dump to Channel Rack**: With one click, exported slices are mapped automatically to pads in the Channel Rack.

### 4. 10-Slot Studio Mixer & DSP Plugins
- **16 Discrete Channels + Master**: Independent channel strips with peak metering and stereo panning.
- **10 Insert FX Slots per Track**: Stack up to 10 serial DSP effects with wet/dry knobs and bypass toggles.
- **Built-in Studio DSP Plugins**:
  - **SoftClipper**: Smooth polynomial saturation curve for analog warmth, punchy drum transients, and loud masters without harsh clipping.
  - **StereoShaper**: Haas delay widener + Mid/Side stereo width balance.
  - **Vintage Chorus**: Modulated dual delay lines for lush 80s thickness.
  - **Parametric EQ & Filters**: Multi-band frequency shaping with low-cut and high-shelf.
  - **Studio Compressor & Limiter**: Transparent dynamic control with threshold, ratio, attack, release, and makeup gain.
  - **Algorithmic Reverb & Ping-Pong Delay**: Spatial depth with damping, decay time, and tempo-synced stereo echoes.
- **Master LUFS Metering**: Integrated real-time loudness metering compliant with broadcast and streaming delivery targets (-14 LUFS).

### 5. Sample Browser with Live Audition
- Tabbed asset management: **Packs**, **Project Samples**, **Plugins**, and **Favorites**.
- **Real-Time Live Audition Player**: Click any sample in the browser to audition it immediately without stopping the track.
- Drag-and-drop or 1-click loading directly into Channel Rack pads or audio tracks.

### 6. Vocal Recording Studio
- Low-latency microphone capture with real-time hardware monitoring.
- **Multi-Take Comping**: Record multiple vocal takes over the same section and comp the best phrases into a master take.
- Built-in input conditioning presets: High-Pass Filter (removes mic rumble), Vocal Presence EQ, and De-essing dynamics.

### 7. AI Music Copilot & Arranger
- Integrated AI copilot powered by clean client-side heuristics and configurable LLM reasoning.
- **Prompt-to-Music**: Type natural musical requests (*"Lofi hip hop drum groove with swung swing and vinyl chords"*), and Cadence will:
  1. Determine tempo, key, and scale.
  2. Synthesize drum patterns in the Channel Rack.
  3. Stamp chord progressions into the Piano Roll.
  4. Route channels to appropriate mixer tracks with DSP presets.
- **Arrangement Suggester**: Automatically expands loop patterns into full song structures (*Intro → Verse → Chorus → Bridge → Outro*).

### 8. Master WAV & Multitrack Stems Export
- **Lossless Master Export**: Studio-grade uncompressed **24-bit / 48 kHz** and **16-bit / 44.1 kHz** WAV rendering.
- **1-Click Multitrack Stems**: Automatically renders every track into isolated dry/wet WAV files for sending to external mixing and mastering engineers.
- **Self-Contained Bundles (`.cadenceproject`)**: Saves the full session state, automation, and recorded audio takes into a portable binary bundle.

<br />

---

## ⌨️ Pro Keyboard Shortcuts Cheat-Sheet

| Key Combination | Action |
| :--- | :--- |
| **`Space`** | Play / Pause transport |
| **`Ctrl + Z`** / **`Cmd + Z`** | Atomic Undo |
| **`Ctrl + Y`** / **`Cmd + Y`** | Atomic Redo |
| **`F5`** or **`1`** | Open **Arrangement & Timeline** |
| **`F6`** | Open **Channel Rack Pro** (Drum Machine) |
| **`F7`** or **`2`** | Open **Piano Roll Pro** |
| **`F9`** or **`3`** | Open **16-Channel Mixer** |
| **`4`** | Open **Synth Lab** |
| **`5`** | Open **GrooveBox** |
| **`6`** | Open **FX Rack** |
| **`7`** | Open **Vocal Recording Studio** |
| **`A` – `K` keys** | Play Musical Keyboard (White & Black keys) |
| **`Z` – `B` keys** | Trigger Drum Machine Pads (Kick, Snare, HiHat, etc.) |

<br />

---

## 🛠️ Local Development & Building

### Prerequisites
- **Node.js**: v20 or later (v24+ recommended)
- **Rust & Cargo**: v1.77+ (required only if compiling the desktop Tauri application)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/pranavm-dev21/cadence-daw.git
cd cadence-daw
npm install
```

### 2. Start Web Development Server
```bash
npm run dev
```
Open **[http://127.0.0.1:3000](http://127.0.0.1:3000)** in your browser.

### 3. Run Automated Test Suite & Typecheck
```bash
npm run check
```
This runs:
1. `tsc --noEmit` (strict TypeScript validation)
2. `vitest run` (19 test files, 115 unit & integration tests)
3. `vite build` (production asset bundling)

### 4. Build Native Windows Desktop Application (`.exe`)
```bash
npm run tauri:build
```
Build outputs:
- **Portable Binary**: `src-tauri/target/release/app.exe`
- **Windows Setup Installer**: `src-tauri/target/release/bundle/nsis/Cadence_0.1.0_x64-setup.exe`

<br />

---

## 🏛️ Architecture & Clean Seams

Cadence is built upon a strict **Separation of Concerns** to guarantee that the UI and audio processing never block one another:

```
cadence-daw/
├── src/
│   ├── audio/              # Pure DSP processing algorithms
│   │   ├── engine.ts       # Web Audio graph & node scheduling
│   │   ├── drumbox.ts      # Multi-sampler & transient synthesis
│   │   ├── fx.ts           # DSP plugins (SoftClipper, StereoShaper, EQ, Delay)
│   │   ├── subsynth.ts     # Polyphonic analog subtractive synthesizer
│   │   └── recorder.ts     # Microphone capture & take buffer management
│   ├── core/               # State machine & Command Bus
│   │   ├── bus.ts          # Atomic command dispatcher (Undo/Redo stack)
│   │   ├── commands.ts     # Pure transaction definitions
│   │   ├── midi.ts         # MIDI file parser & serializer
│   │   └── bundle.ts       # .cadenceproject archive packaging
│   ├── state/              # React Context & store hooks
│   ├── components/         # Studio UI Components
│   │   ├── ChannelRackPro.tsx   # FL-style 16-step sequencer & graph editor
│   │   ├── PianoRoll.tsx        # MIDI grid, chord stamper & arpeggiator
│   │   ├── Mixer.tsx            # 16-channel mixer & master LUFS meter
│   │   ├── EdisonEditor.tsx     # Waveform editor & transient slicer
│   │   ├── VocalWorkspace.tsx   # Vocal tracking & multi-take comping
│   │   ├── Timeline.tsx         # Multitrack arrangement playlist
│   │   └── marketing/           # Production landing page & physics canvas
│   └── App.tsx             # Root router (Web DAW vs Marketing View)
├── src-tauri/              # Rust desktop backend (Tauri v2)
└── server/                 # Lightweight local sync & worklet utilities
```

### Key Engineering Rules:
1. **The Audio Seam**: React components never manipulate raw Web Audio nodes directly. All interactions flow through the `audio` facade in `src/core/audio.ts`.
2. **Atomic Undo Engine**: The state store never modifies project data in-place without dispatching an atomic command to the command bus.
3. **Hardware Acceleration**: The marketing landing page utilizes pure HTML5 Canvas running spring-physics calculations in a single `requestAnimationFrame` loop, respecting `prefers-reduced-motion`.

<br />

---

## 🤝 Contributing

Contributions to Cadence are warmly welcome! Whether you are an audio DSP engineer, a React/TypeScript developer, or a music producer:

1. **Fork the Repository**: Click "Fork" on GitHub.
2. **Create a Feature Branch**: `git checkout -b feature/amazing-plugin`
3. **Commit Your Changes**: `git commit -m "feat: add tape wow & flutter DSP plugin"`
4. **Verify Tests**: Ensure `npm run check` passes with 0 errors.
5. **Open a Pull Request**: Submit your PR on GitHub for code review.

<br />

---

## 📄 License & Open-Source Commitment

Cadence DAW is licensed under the **[MIT License](LICENSE)**.

```
Copyright (c) 2026 Pranav Mishra

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction...
```

Music software should empower human expression, not charge monthly rent. Cadence is, and will always remain, **free and open-source**.

<br />

<div align="center">
  <b>Built with ❤️ for musicians and creators everywhere.</b>
  <br />
  <sub>Live Web App: <a href="https://cadence-daw.vercel.app">cadence-daw.vercel.app</a> • Repository: <a href="https://github.com/pranavm-dev21/cadence-daw">pranavm-dev21/cadence-daw</a></sub>
</div>
