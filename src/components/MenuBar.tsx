import React, { useState, useRef, useEffect } from "react";
import { useStore } from "../state/store";
import { useHint } from "../state/hintContext";
import { buildEmptyProject, buildDemoProject } from "../core";
import { makeTrackWithClip } from "../ai/commands";
import { InstrumentKind, INSTRUMENT_META } from "../types";
import {
  IconDrum,
  IconPiano,
  IconWave,
  IconZap,
} from "./icons";

interface ActionMenuItem {
  label: string;
  action: () => void;
  shortcut?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface SubmenuMenuItem {
  label: string;
  submenu: { label: string; action: () => void }[];
}

interface DividerMenuItem {
  divider: true;
}

type MenuItem = ActionMenuItem | SubmenuMenuItem | DividerMenuItem;

interface MenuGroup {
  id: string;
  label: string;
  items: MenuItem[];
}

interface Props {
  onOpenSettings: (tab?: string) => void;
  onOpenShortcuts: () => void;
  onToast: (msg: string) => void;
  onTriggerImport: () => void;
  onTriggerSaveFile: () => void;
  onTriggerOpenFile: () => void;
  onTriggerExportWav: () => void;
  onTriggerExportStems: () => void;
  toggleBrowser?: () => void;
  toggleCopilot?: () => void;
}

export default function MenuBar({
  onOpenSettings,
  onOpenShortcuts,
  onToast,
  onTriggerImport,
  onTriggerSaveFile,
  onTriggerOpenFile,
  onTriggerExportWav,
  onTriggerExportStems,
}: Props) {
  const { state, apply, undo, redo, setWorkspaceView, loadProject, saveNow } = useStore();
  const { bindHint } = useHint();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    window.addEventListener("mousedown", handleOutsideClick);
    return () => window.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const addTrack = (kind: InstrumentKind) => {
    const meta = INSTRUMENT_META[kind];
    const count = state.project.tracks.filter((t) => t.instrument === kind).length;
    const name = count === 0 ? meta.label : `${meta.label} ${count + 1}`;
    const { track, clip } = makeTrackWithClip(kind, name, meta.color);
    apply(`Add ${name}`, [
      { op: "add_track", track },
      { op: "create_clip", trackId: track.id, clip },
    ]);
    onToast(`Added ${name} to Channel Rack & Playlist`);
    setOpenMenu(null);
  };

  const loadTemplate = (name: string, bpm: number) => {
    const base = buildEmptyProject();
    base.name = `${name} Project`;
    base.bpm = bpm;
    loadProject(base);
    onToast(`Loaded ${name} template at ${bpm} BPM`);
    setOpenMenu(null);
  };

  const menuItems: MenuGroup[] = [
    {
      id: "file",
      label: "File",
      items: [
        { label: "New Project", shortcut: "Ctrl+N", action: () => { loadProject(buildEmptyProject()); onToast("Started new blank session"); } },
        { label: "Open Project...", shortcut: "Ctrl+O", action: onTriggerOpenFile },
        { label: "Save (Instant)", shortcut: "Ctrl+S", action: () => { const ok = saveNow(); onToast(ok ? "Saved successfully" : "Save failed"); } },
        { label: "Save Backup Bundle (.cadenceproject)", shortcut: "Ctrl+Shift+S", action: onTriggerSaveFile },
        { divider: true },
        { label: "Import Audio File...", shortcut: "Ctrl+I", action: onTriggerImport },
        { label: "Export Master WAV...", shortcut: "Ctrl+R", action: onTriggerExportWav },
        { label: "Export All Stems (Zipped)...", action: onTriggerExportStems },
        { divider: true },
        {
          label: "Templates",
          submenu: [
            { label: "Trap Beat (140 BPM)", action: () => loadTemplate("Trap", 140) },
            { label: "Synthwave / Retro (115 BPM)", action: () => loadTemplate("Synthwave", 115) },
            { label: "Lo-Fi Hip Hop (85 BPM)", action: () => loadTemplate("Lo-Fi", 85) },
            { label: "House / EDM (126 BPM)", action: () => loadTemplate("EDM", 126) },
            { label: "Demo Song (First Light)", action: () => { loadProject(buildDemoProject()); onToast("Loaded First Light demo"); } },
          ],
        },
        { divider: true },
        { label: "Project Info & Settings...", action: () => onOpenSettings("project") },
      ],
    },
    {
      id: "edit",
      label: "Edit",
      items: [
        { label: "Undo", shortcut: "Ctrl+Z", disabled: !state.canUndo, action: undo },
        { label: "Redo", shortcut: "Ctrl+Y", disabled: !state.canRedo, action: redo },
        { divider: true },
        {
          label: "Quantize Current Clip (1/16)",
          shortcut: "Ctrl+Q",
          action: () => {
            const track = state.project.tracks.find((t) => t.id === state.selectedTrackId);
            if (!track) return;
            const clipId = state.editorClipId || track.sourceClipId;
            const clip = state.project.clips[clipId];
            if (!clip || clip.notes.length === 0) return;
            const quantized = clip.notes.map((n) => ({
              ...n,
              start: Math.round(n.start),
              dur: Math.max(1, Math.round(n.dur)),
            }));
            apply("Quantize notes", [{ op: "set_clip_content", clipId, notes: quantized }]);
            onToast("Quantized notes to 1/16 grid");
          },
        },
        {
          label: "Clear Notes in Selected Clip",
          action: () => {
            const track = state.project.tracks.find((t) => t.id === state.selectedTrackId);
            if (!track) return;
            const clipId = state.editorClipId || track.sourceClipId;
            apply("Clear clip notes", [{ op: "set_clip_content", clipId, notes: [] }]);
            onToast("Cleared clip notes");
          },
        },
      ],
    },
    {
      id: "add",
      label: "Add",
      items: [
        { label: "Drum Machine (FPC)", icon: <IconDrum size={13} />, action: () => addTrack("drumkit") },
        { label: "Bass Synth (3xOSC Sub)", icon: <IconZap size={13} />, action: () => addTrack("bass") },
        { label: "Keys / Piano (FLEX)", icon: <IconPiano size={13} />, action: () => addTrack("keys") },
        { label: "Pluck Lead (DirectWave)", icon: <IconWave size={13} />, action: () => addTrack("pluck") },
        { label: "Atmospheric Pad (Harmor)", icon: <IconWave size={13} />, action: () => addTrack("pad") },
      ],
    },
    {
      id: "view",
      label: "View",
      items: [
        { label: "Playlist / Arrangement", shortcut: "F5 / 1", action: () => setWorkspaceView("arrangement") },
        { label: "Piano Roll / Channel Rack", shortcut: "F7 / 2", action: () => setWorkspaceView("pianoroll") },
        { label: "Mixer Console", shortcut: "F9 / 3", action: () => setWorkspaceView("mixer") },
        { label: "Synth Lab", shortcut: "4", action: () => setWorkspaceView("synth") },
        { label: "Groove Box", shortcut: "5", action: () => setWorkspaceView("groove") },
        { label: "FX Rack", shortcut: "6", action: () => setWorkspaceView("fx") },
        { label: "Vocal Studio", shortcut: "7", action: () => setWorkspaceView("vocal") },
        { label: "Cloud Projects", shortcut: "8", action: () => setWorkspaceView("projects") },
      ],
    },
    {
      id: "options",
      label: "Options",
      items: [
        { label: "Audio & ASIO Settings...", action: () => onOpenSettings("audio") },
        { label: "MIDI Controller Settings...", action: () => onOpenSettings("midi") },
        { label: "Themes & Appearance...", action: () => onOpenSettings("theme") },
        { label: "Project Preferences...", action: () => onOpenSettings("project") },
      ],
    },
    {
      id: "help",
      label: "Help",
      items: [
        { label: "Keyboard Shortcuts...", shortcut: "?", action: onOpenShortcuts },
        { label: "About Cadence Pro...", action: () => onOpenSettings("about") },
      ],
    },
  ];

  return (
    <div
      ref={menuBarRef}
      className="flex items-center gap-0.5 bg-ink-950/90 border-b border-ink-800 px-2 py-0.5 text-[11px] select-none z-40 relative"
    >
      {menuItems.map((menu) => {
        const hintBind = bindHint(menu.label, `Open ${menu.label} menu`);
        return (
          <div key={menu.id} className="relative">
            <button
              onClick={() => setOpenMenu(openMenu === menu.id ? null : menu.id)}
              onMouseEnter={() => {
                hintBind.onMouseEnter();
                if (openMenu) setOpenMenu(menu.id);
              }}
              onMouseLeave={hintBind.onMouseLeave}
              className={`px-2 py-1 rounded transition text-ink-300 hover:text-ink-100 hover:bg-ink-800 ${
                openMenu === menu.id ? "bg-ink-800 text-ink-100" : ""
              }`}
            >
              {menu.label}
            </button>

            {openMenu === menu.id && (
              <div className="absolute top-full left-0 mt-1 min-w-[210px] bg-ink-900 border border-ink-700/80 rounded-md shadow-2xl py-1 z-50 animate-fade-in">
                {menu.items.map((item, idx) => {
                  if ("divider" in item) {
                    return <div key={idx} className="my-1 border-t border-ink-800" />;
                  }
                  if ("submenu" in item) {
                    return (
                      <div key={idx} className="group relative px-3 py-1.5 hover:bg-ink-800/80 flex items-center justify-between text-ink-200 cursor-pointer">
                        <span>{item.label}</span>
                        <span className="text-[9px] text-ink-400">▶</span>
                        <div className="hidden group-hover:block absolute left-full top-0 ml-0.5 min-w-[190px] bg-ink-900 border border-ink-700 rounded-md shadow-2xl py-1">
                          {item.submenu?.map((sub, sidx) => (
                            <button
                              key={sidx}
                              onClick={() => { sub.action(); setOpenMenu(null); }}
                              className="w-full text-left px-3 py-1.5 hover:bg-amber-glow/20 hover:text-ink-50 text-ink-300 text-[11px]"
                            >
                              {sub.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <button
                      key={idx}
                      disabled={item.disabled}
                      onClick={() => {
                        if (!item.disabled) {
                          item.action();
                          setOpenMenu(null);
                        }
                      }}
                      className={`w-full flex items-center justify-between px-3 py-1.5 text-left text-[11px] transition ${
                        item.disabled
                          ? "opacity-35 cursor-not-allowed"
                          : "hover:bg-amber-glow/15 hover:text-ink-50 text-ink-200"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {item.icon}
                        {item.label}
                      </span>
                      {item.shortcut && (
                        <span className="text-[9.5px] font-mono text-ink-400 ml-4">{item.shortcut}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
