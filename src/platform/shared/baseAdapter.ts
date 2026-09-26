import type {
  IPlatformAdapter,
  OperatingSystem,
  PathInfo,
  PlatformPaths,
  PlatformSpecs,
  AudioDriverOption,
} from "../types";

export abstract class BasePlatformAdapter implements IPlatformAdapter {
  abstract readonly os: OperatingSystem;
  abstract readonly isDesktop: boolean;
  abstract readonly modifierKey: "Ctrl" | "Cmd";
  abstract readonly modifierSymbol: "Ctrl+" | "⌘";

  readonly path: PathInfo = {
    separator: "/",

    toPosix(p: string): string {
      return p.replace(/\\/g, "/");
    },

    toWindows(p: string): string {
      return p.replace(/\//g, "\\");
    },

    normalize(p: string): string {
      if (!p) return "";
      const isWinDrive = /^[a-zA-Z]:[/\\]/.test(p);
      const drivePrefix = isWinDrive ? p.slice(0, 2) : "";
      let remaining = isWinDrive ? p.slice(2) : p;

      // Normalize slashes to forward slash for processing
      remaining = remaining.replace(/\\/g, "/");
      const isAbs = remaining.startsWith("/");

      const segments = remaining.split("/").filter(Boolean);
      const stack: string[] = [];

      for (const seg of segments) {
        if (seg === ".") continue;
        if (seg === "..") {
          if (stack.length > 0 && stack[stack.length - 1] !== "..") {
            stack.pop();
          } else if (!isAbs) {
            stack.push("..");
          }
        } else {
          stack.push(seg);
        }
      }

      let result = stack.join("/");
      if (isAbs) result = "/" + result;
      if (drivePrefix) result = drivePrefix + (result.startsWith("/") ? result : "/" + result);
      return result || (isAbs ? "/" : ".");
    },

    toPortableRelative(p: string): string {
      if (!p) return "";
      // Strip windows drive letter e.g. C:\ or c:/
      let cleaned = p.replace(/^[a-zA-Z]:[/\\]?/, "");
      // Replace backslashes with forward slashes
      cleaned = cleaned.replace(/\\/g, "/");
      // Remove any leading slashes or dots
      cleaned = cleaned.replace(/^[./\\]+/, "");
      return cleaned;
    },

    resolvePortable(relativePath: string, baseDir?: string): string {
      const cleanRel = this.toPortableRelative(relativePath);
      if (!baseDir) return cleanRel;
      return this.join(baseDir, cleanRel);
    },

    basename(p: string): string {
      if (!p) return "";
      const norm = this.toPosix(p).replace(/\/+$/, "");
      const idx = norm.lastIndexOf("/");
      return idx >= 0 ? norm.slice(idx + 1) : norm;
    },

    dirname(p: string): string {
      if (!p) return ".";
      const norm = this.toPosix(p).replace(/\/+$/, "");
      const idx = norm.lastIndexOf("/");
      if (idx === -1) return ".";
      if (idx === 0) return "/";
      return norm.slice(0, idx);
    },

    extname(p: string): string {
      const base = this.basename(p);
      const idx = base.lastIndexOf(".");
      return idx > 0 ? base.slice(idx) : "";
    },

    join(...parts: string[]): string {
      const filtered = parts.filter(Boolean);
      if (filtered.length === 0) return "";
      return this.normalize(filtered.map((pt) => this.toPosix(pt)).join("/"));
    },
  };

  formatShortcut(shortcut: string): string {
    if (this.modifierKey === "Cmd") {
      return shortcut
        .replace(/Ctrl\+/gi, "⌘")
        .replace(/Mod\+/gi, "⌘")
        .replace(/Alt\+/gi, "⌥")
        .replace(/Shift\+/gi, "⇧");
    }
    return shortcut
      .replace(/Mod\+/gi, "Ctrl+")
      .replace(/Command\+/gi, "Ctrl+");
  }

  getStandardSampleRates(): number[] {
    return [44100, 48000, 88200, 96000, 192000];
  }

  getRecommendedBufferSize(): number {
    return 256;
  }

  async requestMicrophonePermission(): Promise<boolean> {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      // Immediately stop all tracks to release hardware
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch {
      return false;
    }
  }

  async openExternalUrl(url: string): Promise<void> {
    if (typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  abstract getAudioDrivers(): AudioDriverOption[];
  abstract getDefaultAudioDriver(): string;
  abstract getDefaultPaths(): PlatformPaths;
  abstract getPlatformSpecs(): PlatformSpecs;
}
