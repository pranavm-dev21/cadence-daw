import { BasePlatformAdapter } from "../shared/baseAdapter";
import type {
  AudioDriverOption,
  OperatingSystem,
  PlatformPaths,
  PlatformSpecs,
} from "../types";

export class LinuxPlatformAdapter extends BasePlatformAdapter {
  readonly os: OperatingSystem = "linux";
  readonly isDesktop: boolean;
  readonly modifierKey = "Ctrl" as const;
  readonly modifierSymbol = "Ctrl+" as const;

  constructor(isDesktopEnv = false) {
    super();
    this.isDesktop = isDesktopEnv;
  }

  getAudioDrivers(): AudioDriverOption[] {
    return [
      {
        id: "pipewire",
        backend: "pipewire",
        label: "PipeWire Pro Audio (Low-Latency)",
        recommendedLatencyMs: 3.8,
        description:
          "Modern Linux multimedia routing engine with native realtime quantum scheduling (128/48000).",
        isHardwareExclusive: false,
      },
      {
        id: "jack",
        backend: "jack",
        label: "JACK Audio Connection Kit (Realtime)",
        recommendedLatencyMs: 4.1,
        description:
          "Professional Linux studio standard. Synchronous sample-accurate audio graph routing across applications.",
        isHardwareExclusive: true,
      },
      {
        id: "alsa",
        backend: "alsa",
        label: "ALSA Direct Hardware (Direct Kernel Access)",
        recommendedLatencyMs: 4.5,
        description:
          "Direct sound card driver access bypassing software mixers for maximum deterministic timing.",
        isHardwareExclusive: true,
      },
      {
        id: "pulseaudio",
        backend: "pulseaudio",
        label: "PulseAudio Sound Server",
        recommendedLatencyMs: 16.0,
        description:
          "Legacy desktop audio daemon. General desktop compatibility with higher buffer safety margins.",
        isHardwareExclusive: false,
      },
      {
        id: "webaudio",
        backend: "webaudio",
        label: "WebKitGTK Web Audio Context",
        recommendedLatencyMs: 14.0,
        description:
          "Linux WebKit engine standard audio context backed by GStreamer.",
        isHardwareExclusive: false,
      },
    ];
  }

  getDefaultAudioDriver(): string {
    return this.isDesktop ? "pipewire" : "webaudio";
  }

  override getRecommendedBufferSize(): number {
    return 128; // PipeWire quantum 128
  }

  getDefaultPaths(): PlatformPaths {
    return {
      projectsDir: "~/Music/Cadence Projects",
      samplesDir: "~/Music/Cadence Projects/Samples",
      userDataDir: "~/.config/cadence",
      recordingsDir: "~/Music/Cadence Projects/Recordings",
    };
  }

  getPlatformSpecs(): PlatformSpecs {
    return {
      name: "Linux",
      os: "linux",
      architecture: "x86_64 Native (Ubuntu, Debian, Fedora, Arch)",
      binaryFormat: "Universal AppImage & Debian Package (.deb)",
      installerName: "Cadence_v0.1.0_amd64.AppImage",
      installerExtension: ".AppImage",
      audioSubsystem: "PipeWire / ALSA / JACK Server",
      recommendedDriver: "PipeWire Pro Audio (Sub-4ms)",
      downloadUrl:
        "https://github.com/pranavm-dev21/cadence-daw/releases/download/v0.1.0/Cadence_v0.1.0_amd64.AppImage",
      portableDownloadUrl:
        "https://github.com/pranavm-dev21/cadence-daw/releases/download/v0.1.0/Cadence_0.1.0_amd64.deb",
      releaseNotesUrl:
        "https://github.com/pranavm-dev21/cadence-daw/releases/tag/v0.1.0",
      fileSizeApprox: "9.4 MB",
      sha256Placeholder:
        "8f4e2b9c71a396e95123d21b764c20f1a92e105e6b72a4413149023bc5e24b33",
    };
  }
}
