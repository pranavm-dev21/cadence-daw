import { BasePlatformAdapter } from "../shared/baseAdapter";
import type {
  AudioDriverOption,
  OperatingSystem,
  PlatformPaths,
  PlatformSpecs,
} from "../types";

export class WindowsPlatformAdapter extends BasePlatformAdapter {
  readonly os: OperatingSystem = "windows";
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
        id: "tauri_asio",
        backend: "asio",
        label: "Native ASIO Driver (Ultra-Low Latency)",
        recommendedLatencyMs: 3.5,
        description:
          "Direct hardware driver bypass for Steinberg ASIO interfaces. Recommended for zero-jitter vocal and MIDI tracking.",
        isHardwareExclusive: true,
      },
      {
        id: "wasapi",
        backend: "wasapi",
        label: "Windows WASAPI (Exclusive Mode)",
        recommendedLatencyMs: 6.8,
        description:
          "Direct kernel streaming without mixing latency. Bypasses Windows Audio Engine mixer.",
        isHardwareExclusive: true,
      },
      {
        id: "wasapi_shared",
        backend: "wasapi",
        label: "Windows WASAPI (Shared Mode)",
        recommendedLatencyMs: 12.0,
        description:
          "Standard Windows audio driver. Allows simultaneous audio from browser and other desktop apps.",
        isHardwareExclusive: false,
      },
      {
        id: "webaudio",
        backend: "webaudio",
        label: "Web Audio Context (WebView2 Fallback)",
        recommendedLatencyMs: 15.0,
        description:
          "Standard browser audio engine. Universal compatibility across all audio hardware.",
        isHardwareExclusive: false,
      },
    ];
  }

  getDefaultAudioDriver(): string {
    return this.isDesktop ? "tauri_asio" : "webaudio";
  }

  override getRecommendedBufferSize(): number {
    return 128; // ASIO standard
  }

  getDefaultPaths(): PlatformPaths {
    return {
      projectsDir: "C:\\Users\\User\\Documents\\Cadence Projects",
      samplesDir: "C:\\Users\\User\\Documents\\Cadence Projects\\Samples",
      userDataDir: "C:\\Users\\User\\AppData\\Roaming\\Cadence",
      recordingsDir: "C:\\Users\\User\\Documents\\Cadence Projects\\Recordings",
    };
  }

  getPlatformSpecs(): PlatformSpecs {
    return {
      name: "Windows",
      os: "windows",
      architecture: "x64 Native (64-bit Intel & AMD)",
      binaryFormat: "NSIS Installer & Standalone Executable",
      installerName: "Cadence_Setup_v0.1.0.exe",
      installerExtension: ".exe",
      audioSubsystem: "ASIO v2.0 & WASAPI Exclusive",
      recommendedDriver: "Native ASIO (Sub-5ms)",
      downloadUrl:
        "https://github.com/pranavm-dev21/cadence-daw/releases/download/v0.1.0/Cadence_Setup_v0.1.0.exe",
      portableDownloadUrl:
        "https://github.com/pranavm-dev21/cadence-daw/releases/download/v0.1.0/Cadence_Portable_v0.1.0.exe",
      releaseNotesUrl:
        "https://github.com/pranavm-dev21/cadence-daw/releases/tag/v0.1.0",
      fileSizeApprox: "8.7 MB",
      sha256Placeholder:
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    };
  }
}
