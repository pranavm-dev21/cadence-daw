# 🎛️ Cadence DAW: The Complete User Manual & Production Guide

Welcome to **Cadence DAW** — a high-performance Digital Audio Workstation engineered with the fast, intuitive workflow of FL Studio. 

This guide walks you step-by-step through making complete records: from your first drum beat and melody composition, to audio sampling with Edison, mixing with the 10-slot FX rack, recording vocals, and exporting uncompressed master WAVs and multitrack stems.

---

## 📑 Table of Contents

1. [Installation & First Run](#1-installation--first-run)
2. [Interface & Navigation Overview](#2-interface--navigation-overview)
3. [Making Drum Beats: Channel Rack Pro](#3-making-drum-beats-channel-rack-pro)
4. [Composing Melodies & Harmonies: Piano Roll Pro](#4-composing-melodies--harmonies-piano-roll-pro)
5. [Audio Sampling & Slicing: Edison Suite](#5-audio-sampling--slicing-edison-suite)
6. [Mixing & Sound Design: Mixer Pro](#6-mixing--sound-design-mixer-pro)
7. [Arranging Full Songs: Playlist & Timeline](#7-arranging-full-songs-playlist--timeline)
8. [Vocal & Live Instrument Recording](#8-vocal--live-instrument-recording)
9. [Mastering & Exporting](#9-mastering--exporting)
10. [Pro Keyboard Shortcuts Cheat-Sheet](#10-pro-keyboard-shortcuts-cheat-sheet)

---

## 1. Installation & First Run

### Windows Desktop Installation
1. **Download the Installer**:
   - Go to [Cadence GitHub Releases](https://github.com/pranavm-dev21/cadence-daw/releases/tag/v0.1.0).
   - Download **`Cadence_Setup_v0.1.0.exe`** (or the portable `Cadence_Portable_v0.1.0.exe`).
2. **Run Setup**:
   - Launch the `.exe`. The setup wizard will install Cadence and add a desktop shortcut and Start Menu icon.
3. **Audio Configuration**:
   - Open **Options → Audio / Engine Settings** (or press the Settings icon in the top right).
   - Select your preferred output device and buffer size (**128 or 256 samples** recommended for low-latency playing; **512 samples** for large mixing sessions).
   - If using a USB MIDI Keyboard, connect it and ensure MIDI input is enabled.

---

## 2. Interface & Navigation Overview

Cadence gives you immediate access to all production areas without modal clutter:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Top Bar: Brand, Song Title, Tempo (BPM), Master Volume, Master Meter, Export    │
├─────────────────────────────────────────────────────────────────────────────────┤
│ Menu Bar: File · Edit · Add · View · Options · Help                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│ Transport: [▶ Play] [⏸ Pause] [⏹ Stop] [⏺ Record] [🔁 Loop] [120 BPM] [00:01:00]│
├───────────────┬─────────────────────────────────────────────────┬───────────────┤
│ Sample        │ Center Workspace:                               │ AI Copilot    │
│ Browser       │ [Arrangement] [Channel Rack] [Piano Roll]       │ & Assistant   │
│ (Packs,       │ [Mixer] [Edison] [Synth Lab] [Groove Box]       │ (Lyrics &     │
│ Project,      │                                                 │ Suggestions)  │
│ Plugins)      │                                                 │               │
├───────────────┴─────────────────────────────────────────────────┴───────────────┤
│ Status Bar: 💡 Live Parameter Hint · Voice Pool · CPU % · Latency ms · Clock   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Key Window Shortcuts (FL Studio Standard):
- **`F5`** ➔ **Arrangement / Playlist**
- **`F6`** ➔ **Channel Rack**
- **`F7`** ➔ **Piano Roll**
- **`F9`** ➔ **Mixer Pro**
- **`Spacebar`** ➔ Start / Pause Playback
- **`Ctrl + Space`** ➔ Stop and return to song start

---

## 3. Making Drum Beats: Channel Rack Pro

The **Channel Rack** (`F6`) is where grooves and drum patterns are programmed.

### 1. Adding Samples
- Browse sounds in the **Sample Browser** on the left (**Packs** tab).
- Click any sample to **audition** it instantly in real time.
- Click the **`+`** icon next to a sample to load it directly into the Channel Rack as a new instrument track.

### 2. Programming the 16-Step Grid
- Steps are color-grouped in 4-beat sections (like FL Studio's 4-step blocks).
- **Left-Click** on a step button to activate/deactivate a hit.
- Hit **`Spacebar`** to listen to your loop.

### 3. Channel Controls (Pan, Vol, Mute, Solo)
- **Mute / Solo LED**: Click the green LED circle on the left of any channel to mute it. Hold `Ctrl` or `Alt` + click to solo.
- **Pan Knob**: Drag up/down or rotate to pan sound Left or Right.
- **Volume Knob**: Set channel level gain.
- **Mixer Track Number (`TRK`)**: Set which Mixer channel strip (1 to 10) processes this sound.

### 4. Global Swing
- Locate the **Swing** knob in the Channel Rack toolbar.
- Increase from `0%` to `50%–70%` to give your drums a bouncy, human groove (essential for Hip-Hop, House, Trap, and R&B).

### 5. Graph Editor (Velocity, Pan, Pitch)
- Click the **Graph Editor** toggle button on the Channel Rack toolbar.
- Select **Velocity (`VEL`)**, **Panning (`PAN`)**, or **Pitch (`PIT`)**.
- Click or drag the bars beneath each step to customize the hit intensity, create rolling hi-hat volume slopes, or pan percussion hits across the stereo field.

---

## 4. Composing Melodies & Harmonies: Piano Roll Pro

The **Piano Roll** (`F7`) allows note-level composition with melodic instruments (keys, bass, pluck, synths).

### 1. Drawing Notes
- **Draw**: Left-click on any grid cell to create a note.
- **Resize**: Drag the right edge of any note to lengthen or shorten it.
- **Move**: Click and drag notes up/down for pitch, or left/right for timing.
- **Erase**: Right-click on a note to delete it.

### 2. Scale Snapping & Scale Highlighting
- In the Piano Roll toolbar, choose your Root Key (e.g., `A`, `C`, `F#`) and Scale (`Minor`, `Major`, `Pentatonic`, `Dorian`).
- The piano roll automatically highlights the notes belonging to your selected scale, ensuring you never play an off-key note!

### 3. Pro Composition Tools:
- **🎹 Chord Stamper**:
  - Click **Chord Stamp** in the toolbar.
  - Choose from 15+ templates: *Major Triad, Minor Triad, Dominant 7th, Major 7th, Minor 7th, 9th, Sus2, Sus4, Diminished, Augmented*.
  - Click anywhere on the piano roll to stamp the full multi-note chord instantly.
- **🎸 Guitar Strum**:
  - Select your chord notes and click **Strum**.
  - Applies micro-delays between lower and higher strings, transforming static block chords into realistic, expressive acoustic or electric guitar strums.
- **✨ Arpeggiator**:
  - Highlight notes and click **Arp**.
  - Select pattern (`Up`, `Down`, `Up/Down`, or `Random`) and rate (`1/8` or `1/16`) to turn static chords into cascading arpeggio melodies.
- **🎲 Humanizer**:
  - Select notes and click **Humanize**.
  - Adds subtle random micro-timing offsets and organic velocity variations so your sequence feels played by a live musician.
- **⚡ Flam**:
  - Turn single snare or percussion notes into rapid double-tap "flams" and trap roll articulations.

---

## 5. Audio Sampling & Slicing: Edison Suite

The **Edison Audio Suite** (`Workspace Switcher → Edison`) is a destructive audio editing and waveform surgery tool.

### 1. Loading Audio
- Drag and drop any `.wav` or `.mp3` audio file into Edison, or click **Load Sample**.
- You can also load any recorded vocal take into Edison directly.

### 2. Waveform Navigation & Selection
- **Zoom**: Use the mouse scroll wheel over the waveform or click the **Zoom In / Out** buttons.
- **Select Region**: Left-click and drag across the waveform to select an audio region.
- **Play Selection**: Press `Spacebar` to loop the highlighted section.

### 3. Audio Processing Tools
- **Normalize (0 dB)**: Boosts the selected region so its highest peak hits exactly `0.0 dBFS` without clipping.
- **Reverse**: Flips the selected audio backwards (great for reverse cymbal swells and vocal risers).
- **Trim**: Crops the audio file to keep only your highlighted selection, discarding unwanted silence.
- **Silence**: Mutes the selected region completely.
- **Fade In / Fade Out**: Creates exponential volume fades to remove clicks and create smooth transitions.

### 4. Transient Auto-Slice & Dump to Channel Rack
- Click **Auto Slice**: Edison analyzes transient energy peaks and automatically places slice markers on kick, snare, and percussion hits.
- Click **Dump to Rack**: Edison chops the sample at every slice point and creates playable instrument pads in the **Channel Rack** so you can play your chopped loop on pads or keys immediately!

---

## 6. Mixing & Sound Design: Mixer Pro

The **Mixer** (`F9`) provides channel balancing, signal routing, and effect processing.

### 1. Channel Strips
- Each channel strip includes:
  - **Volume Fader**: -∞ dB to +6 dB.
  - **Pan Pot**: Balance stereo placement Left / Center / Right.
  - **Mute (`M`) / Solo (`S`)**: Isolate or silence channels.
  - **VU Peak Meter**: Real-time signal amplitude meter.

### 2. The 10-Slot FX Inspector
- Click on any mixer channel to focus it. The **FX Rack Inspector** appears on the right with **10 modular effect slots**.
- Click any slot to choose an effect from the dropdown:
  - **SoftClipper**: Essential FL Studio plugin! Uses an analog polynomial saturation transfer curve. Place it on the Master or Drum Bus to crush kicks and 808s without digital clipping.
  - **StereoShaper**: Widens synth leads, guitars, and background pads using Haas psychoacoustic delays and Mid/Side image widening.
  - **Vintage Chorus**: Lush dual-delay modulation for 80s synthwave pads and guitars.
  - **Parametric EQ**: Clean cuts and boosts across low, mid, and high frequencies.
  - **Compressor**: Glues drum mixes together and controls dynamic peaks.
  - **Studio Reverb & Ping-Pong Delay**: Algorithmic spatial immersion.
- **Bypass Toggle**: Click the green LED to bypass any effect slot.
- **Wet / Dry Slider**: Adjust the effect blend from 0% (dry) to 100% (wet).

### 3. Master Loudness & LUFS Metering
- The Master channel includes an integrated **LUFS Loudness Meter**.
- Target **-14 LUFS** for Spotify, Apple Music, and YouTube streaming releases.

---

## 7. Arranging Full Songs: Playlist & Timeline

The **Arrangement Playlist** (`F5`) is where you structure patterns, vocal takes, and audio clips into a complete song.

### 1. Placing Clips
- Select a pattern or audio clip from the clip list.
- Click on the timeline grid to place clip blocks.
- Drag clips horizontally to adjust bar position.

### 2. Arrangement Tools (Top Toolbar):
- **Draw Tool (`P`)**: Paint clips onto tracks.
- **Slice / Razor Tool (`C`)**: Click any clip to cut it cleanly into two separate pieces.
- **Select Tool (`E`)**: Box-select multiple clips to move or duplicate them together.
- **Duplicate (`Ctrl + B` or `Ctrl + D`)**: Duplicate selected clips to the next bar.

### 3. Song Section Markers
- Click **Add Marker** (or right-click the ruler) to create arrangement markers:
  - `Intro`, `Verse 1`, `Pre-Chorus`, `Chorus`, `Verse 2`, `Bridge`, `Outro`.
- Click on a marker to jump playback directly to that song section.

### 4. Loop Regions & Punch-In
- Drag along the timeline ruler to define a loop region.
- Toggle the **Loop (`L`)** button in the transport bar to cycle that section continuously while writing or practicing lyrics.

---

## 8. Vocal & Live Instrument Recording

Cadence features a dedicated low-latency recording studio (`Workspace Switcher → Vocal / Rap`).

1. **Connect & Select Microphone**:
   - Plug in your USB microphone or audio interface.
   - Choose your input device from the input selector.
2. **Monitoring & Latency**:
   - Toggle **Monitor** to hear your voice through headphones.
   - Cadence features automatic **Round-Trip Latency Compensation** so your recorded vocals automatically lock onto the beat grid with zero timing delay.
3. **Recording Takes**:
   - Arm the track (**Record Arm**).
   - Press **`R`** or click the Record button, then hit **`Spacebar`**.
   - Perform your verse or chorus.
   - Hit **`Spacebar`** to stop. Each recording is saved as a discrete **Take**.
4. **Take Comping**:
   - View all takes in the Take List.
   - Audition different takes and select the best parts to create the perfect master comp.

---

## 9. Mastering & Exporting

When your song is finished, Cadence offers studio-grade rendering options:

### 1. Master 24-bit WAV Export
- Go to **File → Export WAV** (or click the **Export** button in the top bar).
- Renders an uncompressed, studio-mastered **24-bit / 48 kHz stereo WAV** file, ready for distribution to streaming platforms.

### 2. Multitrack Stems Export
- Go to **File → Export Stems**.
- Cadence renders **every track to its own separate WAV file** in one pass (Drums.wav, Bass.wav, Chords.wav, Vocals.wav, FX.wav).
- Perfect for sending your project to mixing/mastering engineers or remix collaborators!

### 3. Saving Project Bundles (`.cadenceproject`)
- Go to **File → Save Project File**.
- Generates a `.cadenceproject` archive containing your entire project structure, all patterns, mixer routing, and embedded audio takes.
- Back up or move your project to another computer with **zero missing sample errors**.

---

## 10. Pro Keyboard Shortcuts Cheat-Sheet

| Key / Shortcut | Action |
| :--- | :--- |
| **`Spacebar`** | Play / Pause |
| **`Ctrl + Space`** | Stop and return to start |
| **`F5`** | Open Arrangement / Playlist |
| **`F6`** | Open Channel Rack |
| **`F7`** | Open Piano Roll |
| **`F9`** | Open Mixer Pro |
| **`R`** | Toggle Record Arm |
| **`L`** | Toggle Loop Region playback |
| **`Ctrl + Z`** | Undo last action |
| **`Ctrl + Y`** / **`Ctrl + Shift + Z`** | Redo last action |
| **`Ctrl + S`** | Save project snapshot |
| **`Ctrl + B`** | Duplicate selected clip to next bar |
| **`Ctrl + A`** | Select all notes / clips |
| **`Delete`** / **`Backspace`** | Delete selected notes / clips |
| **`A` to `K` Keys** | Play interactive musical keyboard |
| **`Z` to `B` Keys** | Trigger drum pads (Kick, Snare, Hi-hat, Perc) |

---

*Happy producing with Cadence DAW!*
