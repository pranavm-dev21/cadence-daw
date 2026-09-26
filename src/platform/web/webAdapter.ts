import { BasePlatformAdapter } from "../shared/baseAdapter";
import type {
  AudioDriverOption,
  OperatingSystem,
  PlatformPaths,
  PlatformSpecs,
} from "../types";

export class WebPlatformAdapter extends BasePlatformAdapter {
  readonly os: OperatingSystem = "web";
  readonly isDesktop = false;
  readonly modifierKey: "Ctrl" | "Cmd";
  readonly modifierSymbol: "Ctrl+" | "⌘";
  private detectedClientOs: "windows" | "macos" | "linux";

  constructor(clientOs: "windows" | "macos" | "linux" = "windows") {
    super();
    this.detectedClientOs = clientOs;
    this.modifierKey = clientOs === "macos" ? "Cmd" : "Ctrl";
    this.modifierSymbol = clientOs === "macos" ? "⌘" : "Ctrl+";
  }

  getAudioDrivers(): AudioDriverOption[] {
    return [
      {
        id: "webaudio",
        backend: "webaudio",
        label: "Browser Web Audio Engine",
        recommendedLatencyMs: 15.0,
        description:
          "Zero-install browser audio running directly in your web browser. Upgrade to native desktop app for sub-5ms low latency.",
        isHardwareExclusive: false,
      },
    ];
  }

  getDefaultAudioDriver(): string {
    return "webaudio";
  }

  getDefaultPaths(): PlatformPaths {
    return {
      projectsDir: "IndexedDB://CadenceProjects",
      samplesDir: "IndexedDB://CadenceSamples",
      userDataDir: "LocalStorage://CadenceSettings",
      recordingsDir: "IndexedDB://CadenceRecordings",
    };
  }

  getPlatformSpecs(): PlatformSpecs {
    // When running in web, guide to the detected host platform's download
    if (this.detectedClientOs === "macos") {
      return {
        name: "macOS",
        os: "macos",
        architecture: "Universal Binary (Apple Silicon M1-M4 & Intel)",
        binaryFormat: "Apple Disk Image (.dmg)",
        installerName: "Cadence_v0.1.0_universal.dmg",
        installerExtension: ".dmg",
        audioSubsystem: "Apple Core Audio Engine",
        recommendedDriver: "Core Audio HAL (Sub-3ms)",
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
    if (this.detectedClientOs === "linux") {
      return {
        name: "Linux",
        os: "linux",
        architecture: "x86_64 Native (AppImage / deb)",
        binaryFormat: "Universal AppImage & Debian Package",
        installerName: "Cadence_v0.1.0_amd64.AppImage",
        installerExtension: ".AppImage",
        audioSubsystem: "PipeWire / ALSA / JACK",
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
