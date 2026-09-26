export type OperatingSystem = "windows" | "macos" | "linux" | "web";

export type AudioBackendType =
  | "asio"
  | "wasapi"
  | "coreaudio"
  | "pipewire"
  | "alsa"
  | "pulseaudio"
  | "jack"
  | "webaudio";

export interface AudioDriverOption {
  id: string;
  backend: AudioBackendType;
  label: string;
  recommendedLatencyMs: number;
  description: string;
  isHardwareExclusive?: boolean;
}

export interface PathInfo {
  separator: "/" | "\\";
  /** Convert any path (Windows C:\ or POSIX /) to unified POSIX forward slashes */
  toPosix(p: string): string;
  /** Convert to Windows backslash format */
  toWindows(p: string): string;
  /** Normalize path removing redundant slashes, dot-segments, etc. */
  normalize(p: string): string;
  /** Strip drive letter and make relative for portable project bundles */
  toPortableRelative(p: string): string;
  /** Resolve portable relative path to active platform */
  resolvePortable(relativePath: string, baseDir?: string): string;
  basename(p: string): string;
  dirname(p: string): string;
  extname(p: string): string;
  join(...parts: string[]): string;
}

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface FileDialogOptions {
  title?: string;
  filters?: FileFilter[];
  defaultPath?: string;
  multiple?: boolean;
}

export interface PlatformPaths {
  projectsDir: string;
  samplesDir: string;
  userDataDir: string;
  recordingsDir: string;
}

export interface PlatformSpecs {
  name: string;
  os: OperatingSystem;
  architecture: string;
  binaryFormat: string;
  installerName: string;
  installerExtension: string;
  releasePackageName?: string;
  binaryExtension?: string;
  audioSubsystem: string;
  recommendedDriver: string;
  downloadUrl: string;
  portableDownloadUrl?: string;
  releaseNotesUrl: string;
  fileSizeApprox: string;
  sha256Placeholder: string;
}

export interface IPlatformAdapter {
  readonly os: OperatingSystem;
  readonly isDesktop: boolean;
  readonly modifierKey: "Ctrl" | "Cmd";
  readonly modifierSymbol: "Ctrl+" | "⌘";
  readonly path: PathInfo;

  formatShortcut(shortcut: string): string;
  getAudioDrivers(): AudioDriverOption[];
  getDefaultAudioDriver(): string;
  getRecommendedBufferSize(): number;
  getStandardSampleRates(): number[];
  getDefaultPaths(): PlatformPaths;
  requestMicrophonePermission(): Promise<boolean>;
  getPlatformSpecs(): PlatformSpecs;
  openExternalUrl(url: string): Promise<void>;
}
