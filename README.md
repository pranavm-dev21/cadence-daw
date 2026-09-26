# Cadence DAW

A high-performance Digital Audio Workstation (DAW) featuring an FL Studio-style workflow, available as a standalone native Windows desktop application (`.exe`) and web application. Built with React, TypeScript, Tailwind CSS, Web Audio DSP, and Tauri v2 (Rust).

---

## 📥 Direct Downloads (Windows)

Download the latest release directly from GitHub Releases:

- **[Windows Setup Installer (`.exe`)](https://github.com/pranavm-dev21/cadence-daw/releases/download/v0.1.0/Cadence_Setup_v0.1.0.exe)**  
  *Direct installation wizard with desktop shortcut, Start Menu entry, and uninstaller.*
- **[Portable Binary (`.exe`)](https://github.com/pranavm-dev21/cadence-daw/releases/download/v0.1.0/Cadence_Portable_v0.1.0.exe)**  
  *Single standalone executable — double-click to launch immediately without installing.*

Visit the **[GitHub Releases Page](https://github.com/pranavm-dev21/cadence-daw/releases)** for changelogs and release assets.

📖 **New to Cadence?** Read the **[Complete User Manual & Production Guide](GUIDE.md)** for step-by-step tutorials on beatmaking, piano roll chord stamping, Edison audio slicing, 10-slot mixer sound design, and vocal recording.

---

## 🎹 Studio Feature Suite

### 1. Channel Rack Pro
- **16-Step Drum Sequencer**: 4-beat grouped color matrix with instant toggle buttons.
- **Mixer & Output Controls**: Per-channel Pan, Volume, Mute/Solo LEDs, and target Mixer Track assignment.
- **Global Swing**: Natural groove with adjustable swing percentage.
- **Integrated Graph Editor**: Fine-tune per-step **Velocity**, **Panning**, and **Pitch**.

### 2. Piano Roll Pro Suite
- **Interactive Multi-Octave Note Grid**: Full MIDI composition with snap-to-grid, velocity editing, and length adjustment.
- **Chord Stamper**: 1-click generation of 15+ chord templates (Major, Minor, 7th, Maj7, m7, 9th, Sus2, Sus4, Dim, Aug, etc.).
- **Arpeggiator Engine**: Up, Down, Up/Down, and Random arpeggiator with rate controls.
- **Guitar Strum Tool**: Natural note onset staggering for realistic acoustic/electric guitar strums.
- **Humanizer & Flam**: Micro-timing and velocity humanization, plus rapid double-strike flam articulations.
- **Scale Highlighting**: Root key and scale snapping (Natural Minor, Major, Pentatonic, Dorian, Phrygian, etc.).

### 3. Edison Audio Waveform & Slicing Suite
- **Waveform Display**: High-resolution zoomable waveform with drag selection.
- **Transient Auto-Slice**: Automatically detects drum hits and transients for instant sample chopping.
- **Audio DSP Operations**:
  - **Normalize**: Peak-normalizes selected audio region to 0 dB.
  - **Reverse**: Flips audio backwards in place.
  - **Trim & Silence**: Destructive cropping and silence insertion.
  - **Fades**: Exponential Fade In and Fade Out.
- **Dump to Channel Rack**: Instantly sends sliced hits to individual Channel Rack pads.

### 4. 10-Slot Studio Mixer & FX Rack
- **10 FX Insert Slots per Channel**: Chain effects with individual enable/bypass LEDs and wet/dry mix knobs.
- **Integrated DSP Plugins**:
  - **SoftClipper**: Polynomial saturation transfer curve for punchy drum transients and analog mastering warmth.
  - **StereoShaper**: Haas delay widener + Mid/Side stereo image width control.
  - **Vintage Chorus**: Modulated dual delay lines for lush modulation.
  - **Parametric EQ & Filters**: Multi-band frequency shaping.
  - **Compressor & Limiter**: Dynamic range control with makeup gain.
  - **Studio Reverb & Ping-Pong Delay**: Algorithmic spatial simulation.
- **Master LUFS Metering**: Integrated loudness metering compliant with broadcast and streaming targets (-14 LUFS).

### 5. Sample Browser with Live Audition
- Multi-tab browser: **Packs**, **Project**, **Plugins**, and **Favorites**.
- **Real-Time Audition Player**: Click any sample to preview it instantly before loading.
- Instant search filter and 1-click addition to track or Channel Rack.

### 6. Vocal Recording Studio
- Low-latency microphone capture with real-time monitoring.
- Multi-take recording with comping and automatic round-trip latency compensation.
- High-pass filtering, presence EQ, and vocal dynamics presets.

### 7. Multitrack Stems & Master Export
- **Master WAV Export**: Studio-grade 24-bit / 48 kHz uncompressed WAV export.
- **Multitrack Stems Export**: Automatically renders every track to separate WAV stems in a single pass for external mixing/mastering engineers.
- **Project Bundles (`.cadenceproject`)**: Lossless self-contained project archives containing all track metadata and referenced PCM audio takes.

---

## 🛠️ Development & Building

### Prerequisites
- [Node.js 24+](https://nodejs.org/) and npm
- [Rust 1.77+](https://rustup.rs/) (for desktop `.exe` builds)

### Run in Browser (Dev Mode)
```sh
npm install
npm run dev
```
Open [http://127.0.0.1:3000](http://127.0.0.1:3000) in Chrome, Edge, or any modern Web Audio browser.

### Run Automated Tests & Typecheck
```sh
npm run check
```
Runs full TypeScript verification, all 20 test suites (122 unit/integration tests), and the Vite production build.

### Build Desktop Windows Executable & Installer
```sh
npm run tauri:build
```
Builds:
- `src-tauri/target/release/app.exe` (Standalone portable executable)
- `src-tauri/target/release/bundle/nsis/Cadence_0.1.0_x64-setup.exe` (NSIS Windows Setup Installer)

---

## 🏛️ Architecture & Ponytail Ruleset

Cadence adheres strictly to the **Ponytail "lazy senior developer" engineering ladder**:
- **Seam Isolation**: All UI components communicate exclusively with the audio engine via the `AudioBackend` contract (`src/core/audio.ts`).
- **Command Bus**: All project mutations pass through the pure, atomic, undoable command bus (`src/core/commands.ts` & `src/core/bus.ts`).
- **Deterministic DSP**: Signal processing algorithms in `src/audio/` are pure, predictable, and unit-tested offline.
- **Zero-Bloat Dependencies**: Built on clean Web Audio nodes and lightweight Tauri v2 desktop wrappers.

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
