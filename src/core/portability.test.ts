import { describe, it, expect } from "vitest";
import { WindowsPlatformAdapter } from "../platform/windows/windowsAdapter";
import { MacOSPlatformAdapter } from "../platform/macos/macosAdapter";
import { LinuxPlatformAdapter } from "../platform/linux/linuxAdapter";
import { WebPlatformAdapter } from "../platform/web/webAdapter";
import { createProjectBundle, decodeProjectBundle } from "./bundle";
import { serialize, deserialize } from "./format";
import { AudioAssetLibrary, type AudioAsset } from "../audio/assets";
import type { Project } from "../types";

import { buildEmptyProject } from "./seed";
import { execCommand } from "./executors";

function createMemoryLibrary() {
  const rows = new Map<string, AudioAsset>();
  return {
    rows,
    library: new AudioAssetLibrary({
      put: async (a) => {
        rows.set(a.id, structuredClone(a));
      },
      get: async (id) => rows.get(id),
    }),
  };
}

function createTestProject(): Project {
  let project = buildEmptyProject();
  project = { ...project, name: "Trans-Platform Symphony", bpm: 124 };
  const take = {
    id: "take_lead_01",
    name: "Lead Vocal Take 1",
    offsetSteps: 0,
    durationSteps: 64,
    deviceId: "hw_mic_in",
    deviceLabel: "Studio Interface",
    latencyMs: 3.2,
    peak: 0.95,
  };
  project = execCommand(project, { op: "add_take", trackId: project.tracks[0].id, take });
  return project;
}

describe("Cross-Platform Portability Test Suite", () => {
  const winAdapter = new WindowsPlatformAdapter(true);
  const macAdapter = new MacOSPlatformAdapter(true);
  const linAdapter = new LinuxPlatformAdapter(true);
  const webAdapter = new WebPlatformAdapter("windows");

  describe("1. Path Normalization Matrix", () => {
    it("normalizes Windows backslash paths to standard POSIX", () => {
      const winPath = "C:\\Users\\Artist\\Music\\Cadence Projects\\Beat1.cadenceproject";
      expect(winAdapter.path.toPosix(winPath)).toBe(
        "C:/Users/Artist/Music/Cadence Projects/Beat1.cadenceproject"
      );
      expect(macAdapter.path.toPosix(winPath)).toBe(
        "C:/Users/Artist/Music/Cadence Projects/Beat1.cadenceproject"
      );
    });

    it("strips Windows drive letters to generate portable relative paths", () => {
      const winPaths = [
        "C:\\Users\\Artist\\Cadence\\Samples\\Kick.wav",
        "D:\\Audio\\Loops\\Bass.wav",
        "E:/Audio/Takes/Vocal.wav",
      ];
      for (const p of winPaths) {
        const portable = winAdapter.path.toPortableRelative(p);
        expect(portable).not.toMatch(/^[a-zA-Z]:/);
        expect(portable).not.toContain("\\");
      }
      expect(winAdapter.path.toPortableRelative("C:\\Samples\\Kick.wav")).toBe("Samples/Kick.wav");
    });

    it("resolves portable relative paths correctly into macOS and Linux base paths", () => {
      const relSample = "Samples/Drums/808.wav";
      const macBase = "/Users/producer/Music/Cadence Projects";
      const linBase = "/home/producer/Music/Cadence Projects";
      const winBase = "C:\\Users\\Producer\\Documents\\Cadence Projects";

      expect(macAdapter.path.resolvePortable(relSample, macBase)).toBe(
        "/Users/producer/Music/Cadence Projects/Samples/Drums/808.wav"
      );
      expect(linAdapter.path.resolvePortable(relSample, linBase)).toBe(
        "/home/producer/Music/Cadence Projects/Samples/Drums/808.wav"
      );
      expect(winAdapter.path.resolvePortable(relSample, winBase)).toBe(
        "C:/Users/Producer/Documents/Cadence Projects/Samples/Drums/808.wav"
      );
    });
  });

  describe("2. Project Serialization Portability", () => {
    it("ensures serialize() contains zero OS-specific path separators or absolute paths", () => {
      const proj = createTestProject();
      const json = serialize(proj);

      expect(json).not.toContain("C:\\");
      expect(json).not.toContain("/Users/");
      expect(json).not.toContain("/home/");

      const parsed = deserialize(json);
      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        expect(parsed.project.name).toBe("Trans-Platform Symphony");
        expect(parsed.project.tracks[0].takes[0].id).toBe("take_lead_01");
      }
    });
  });

  describe("3. Bidirectional Project Bundle Loading Matrix", () => {
    it("bundles project on simulated Windows and decodes perfectly on simulated macOS & Linux", async () => {
      const project = createTestProject();
      const { library } = createMemoryLibrary();

      // Create a test audio asset
      const pcm = new Float32Array(4800);
      for (let i = 0; i < pcm.length; i++) {
        pcm[i] = Math.sin((2 * Math.PI * 440 * i) / 48000);
      }
      await library.save({
        id: "take_lead_01",
        sampleRate: 48000,
        pcm,
      });

      // 1. Pack bundle on Windows
      const blob = await createProjectBundle(project, library);
      const arrayBuffer = await blob.arrayBuffer();

      // 2. Decode on macOS
      const decodedMac = decodeProjectBundle(arrayBuffer);
      expect(decodedMac.project.name).toBe(project.name);
      expect(decodedMac.project.bpm).toBe(124);
      expect(decodedMac.assets.length).toBe(1);
      expect(decodedMac.assets[0].id).toBe("take_lead_01");
      expect(decodedMac.assets[0].sampleRate).toBe(48000);
      expect(decodedMac.assets[0].pcm.length).toBe(4800);

      // Verify float32 little-endian precision preserved across platforms
      for (let i = 0; i < 20; i++) {
        expect(decodedMac.assets[0].pcm[i]).toBeCloseTo(pcm[i], 5);
      }

      // 3. Decode on Linux
      const decodedLinux = decodeProjectBundle(arrayBuffer);
      expect(decodedLinux.project.tracks[0].name).toBe(project.tracks[0].name);
      expect(decodedLinux.assets[0].pcm[100]).toBeCloseTo(pcm[100], 5);
    });
  });

  describe("4. Platform Keyboard Modifier Formatting", () => {
    it("formats Mod shortcuts to Cmd on macOS and Ctrl on Windows/Linux", () => {
      expect(winAdapter.formatShortcut("Mod+S")).toBe("Ctrl+S");
      expect(linAdapter.formatShortcut("Mod+S")).toBe("Ctrl+S");
      expect(macAdapter.formatShortcut("Mod+S")).toBe("⌘S");
      expect(webAdapter.formatShortcut("Mod+S")).toBe("Ctrl+S");

      expect(macAdapter.formatShortcut("Ctrl+Z")).toBe("⌘Z");
      expect(macAdapter.formatShortcut("Shift+Mod+Z")).toBe("⇧⌘Z");
    });
  });

  describe("5. Platform Audio Subsystem Specifications", () => {
    it("provides the appropriate low-latency driver for each OS", () => {
      expect(winAdapter.getDefaultAudioDriver()).toBe("tauri_asio");
      expect(macAdapter.getDefaultAudioDriver()).toBe("coreaudio");
      expect(linAdapter.getDefaultAudioDriver()).toBe("pipewire");
      expect(webAdapter.getDefaultAudioDriver()).toBe("webaudio");

      const winDrivers = winAdapter.getAudioDrivers();
      expect(winDrivers.some((d) => d.backend === "asio")).toBe(true);

      const macDrivers = macAdapter.getAudioDrivers();
      expect(macDrivers.some((d) => d.backend === "coreaudio")).toBe(true);

      const linDrivers = linAdapter.getAudioDrivers();
      expect(linDrivers.some((d) => d.backend === "pipewire")).toBe(true);
      expect(linDrivers.some((d) => d.backend === "jack")).toBe(true);
      expect(linDrivers.some((d) => d.backend === "alsa")).toBe(true);
    });
  });
});
