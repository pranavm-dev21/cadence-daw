import type {
  IPlatformAdapter,
  OperatingSystem,
  PlatformSpecs,
} from "./types";
import { WindowsPlatformAdapter } from "./windows/windowsAdapter";
import { MacOSPlatformAdapter } from "./macos/macosAdapter";
import { LinuxPlatformAdapter } from "./linux/linuxAdapter";
import { WebPlatformAdapter } from "./web/webAdapter";

export * from "./types";
export { WindowsPlatformAdapter } from "./windows/windowsAdapter";
export { MacOSPlatformAdapter } from "./macos/macosAdapter";
export { LinuxPlatformAdapter } from "./linux/linuxAdapter";
export { WebPlatformAdapter } from "./web/webAdapter";

export function isDesktopApp(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "__TAURI_INTERNALS__" in window ||
    "__TAURI__" in window ||
    Boolean((window as unknown as { __TAURI_METADATA__?: unknown }).__TAURI_METADATA__)
  );
}

export function detectClientHostOs(): "windows" | "macos" | "linux" {
  if (typeof navigator === "undefined") return "windows";
  const ua = navigator.userAgent.toLowerCase();
  const platform = (
    (navigator as unknown as { userAgentData?: { platform?: string } }).userAgentData
      ?.platform ||
    navigator.platform ||
    ""
  ).toLowerCase();

  if (
    platform.includes("mac") ||
    ua.includes("macintosh") ||
    ua.includes("mac os x")
  ) {
    return "macos";
  }

  if (
    platform.includes("linux") ||
    ua.includes("linux") ||
    ua.includes("x11")
  ) {
    return "linux";
  }

  return "windows";
}

export function detectOperatingSystem(): OperatingSystem {
  if (!isDesktopApp()) {
    return "web";
  }
  return detectClientHostOs();
}

function createPlatformAdapter(): IPlatformAdapter {
  const isDesktop = isDesktopApp();
  const hostOs = detectClientHostOs();

  if (isDesktop) {
    switch (hostOs) {
      case "macos":
        return new MacOSPlatformAdapter(true);
      case "linux":
        return new LinuxPlatformAdapter(true);
      case "windows":
      default:
        return new WindowsPlatformAdapter(true);
    }
  }

  return new WebPlatformAdapter(hostOs);
}

/** Global platform adapter singleton */
export const platform: IPlatformAdapter = createPlatformAdapter();

export function isMac(): boolean {
  return detectClientHostOs() === "macos";
}

export function isWindows(): boolean {
  return detectClientHostOs() === "windows";
}

export function isLinux(): boolean {
  return detectClientHostOs() === "linux";
}

/** Return platform specs for all supported desktop OS targets */
export function getAllPlatformSpecs(): PlatformSpecs[] {
  const win = new WindowsPlatformAdapter(true);
  const mac = new MacOSPlatformAdapter(true);
  const lin = new LinuxPlatformAdapter(true);
  return [win.getPlatformSpecs(), mac.getPlatformSpecs(), lin.getPlatformSpecs()];
}
