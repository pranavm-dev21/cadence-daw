import { BasePlatformAdapter } from "../shared/baseAdapter";
import type {
  AudioDriverOption,
  OperatingSystem,
  PlatformPaths,
  PlatformSpecs,
} from "../types";

export class MacOSPlatformAdapter extends BasePlatformAdapter {
  readonly os: OperatingSystem = "macos";
  readonly isDesktop: boolean;
  readonly modifierKey = "Cmd" as const;
  readonly modifierSymbol = "⌘" as const;

  constructor(isDesktopEnv = false) {
    super();
    this.isDesktop = isDesktopEnv;
  }

  getAudioDrivers(): AudioDriverOption[] {
    return [
      {
        id: "coreaudio",
        backend: "coreaudio",
        label: "Apple Core Audio (Hardware Low-Latency)",
        recommendedLatencyMs: 2.8,
        description:
          "Native macOS Hardware Abstraction Layer (HAL). Delivers jitter-free 64-sample buffer roundtrip on Apple Silicon.",
        isHardwareExclusive: false,
      },
      {
        id: "coreaudio_aggregate",
        backend: "coreaudio",
        label: "Core Audio Aggregate Device",
        recommendedLatencyMs: 4.2,
        description:
          "Combines multiple audio interfaces or virtual routing (BlackHole, Loopback) into a single virtual bus.",
        isHardwareExclusive: false,
      },
      {
        id: "webaudio",
        backend: "webaudio",
        label: "WebKit Web Audio Context",
        recommendedLatencyMs: 12.0,
        description:
          "WKWebView standard audio graph. Compatible with all macOS audio outputs without extra privileges.",
        isHardwareExclusive: false,
      },
    ];
  }

  getDefaultAudioDriver(): string {
    return this.isDesktop ? "coreaudio" : "webaudio";
  }

  override getRecommendedBufferSize(): number {
    return 64; // Apple Silicon handles 64 samples effortlessly
  }

  getDefaultPaths(): PlatformPaths {
    return {
      projectsDir: "~/Music/Cadence Projects",
      samplesDir: "~/Music/Cadence Projects/Samples",
      userDataDir: "~/Library/Application Support/Cadence",
      recordingsDir: "~/Music/Cadence Projects/Recordings",
    };
  }

  getPlatformSpecs(): PlatformSpecs {
    return {
      name: "macOS",
      os: "macos",
      architecture: "Universal Binary (Apple Silicon M1-M4 & Intel x86_64)",
      binaryFormat: "Apple Disk Image (.dmg) & Signed App Bundle",
      installerName: "Cadence_v0.1.0_universal.dmg",
      installerExtension: ".dmg",
      audioSubsystem: "Apple Core Audio HAL",
      recommendedDriver: "Core Audio (Sub-3ms)",
      downloadUrl:
        "https://github.com/pranavm-dev21/cadence-daw/releases/download/v0.1.0/Cadence_v0.1.0_universal.dmg",
      portableDownloadUrl:
        "https://github.com/pranavm-dev21/cadence-daw/releases/download/v0.1.0/Cadence_v0.1.0_macos.tar.gz",
      releaseNotesUrl:
        "https://github.com/pranavm-dev21/cadence-daw/releases/tag/v0.1.0",
      fileSizeApprox: "11.2 MB",
      sha256Placeholder:
        "4a7d1ed414474e4033ac29ccb8653d9befe85be0f937e2591702b0e222924340",
    };
  }
}
