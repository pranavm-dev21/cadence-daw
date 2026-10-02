import React from "react";

type P = { size?: number; className?: string; style?: React.CSSProperties };
const S = ({ size = 15, className, style, children, viewBox = "0 0 24 24", fill = "none" }: P & { children: React.ReactNode; viewBox?: string; fill?: string }) => (
  <svg width={size} height={size} viewBox={viewBox} fill={fill} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden>
    {children}
  </svg>
);

export const IconPlay = (p: P) => <S {...p} fill="currentColor"><path d="M7 4.5v15l13-7.5z" stroke="none" /></S>;
export const IconPause = (p: P) => <S {...p} fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" stroke="none" /><rect x="14" y="4" width="4" height="16" rx="1" stroke="none" /></S>;
export const IconStop = (p: P) => <S {...p} fill="currentColor"><rect x="5.5" y="5.5" width="13" height="13" rx="2" stroke="none" /></S>;
export const IconRecord = (p: P) => <S {...p} fill="currentColor"><circle cx="12" cy="12" r="7" stroke="none" /></S>;
export const IconLoop = (p: P) => <S {...p}><path d="M17 2l4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" /></S>;
export const IconUndo = (p: P) => <S {...p}><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-15-6.7L3 13" /></S>;
export const IconRedo = (p: P) => <S {...p}><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 15-6.7L21 13" /></S>;
export const IconSave = (p: P) => <S {...p}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><path d="M17 21v-8H7v8" /><path d="M7 3v5h8" /></S>;
export const IconDownload = (p: P) => <S {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></S>;
export const IconPlus = (p: P) => <S {...p}><path d="M12 5v14M5 12h14" /></S>;
export const IconMinus = (p: P) => <S {...p}><path d="M5 12h14" /></S>;
export const IconSparkles = (p: P) => <S {...p}><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z" /><path d="M5 16l.7 1.6L7.4 18l-1.7.7L5 20.3 4.3 18.7 2.6 18l1.7-.4z" /></S>;
export const IconX = (p: P) => <S {...p}><path d="M18 6L6 18M6 6l12 12" /></S>;
export const IconChevronDown = (p: P) => <S {...p}><path d="M6 9l6 6 6-6" /></S>;
export const IconMixer = (p: P) => <S {...p}><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" /><path d="M1 14h6M9 8h6M17 16h6" /></S>;
export const IconDice = (p: P) => <S {...p}><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="8.5" cy="8.5" r="1.1" fill="currentColor" stroke="none" /><circle cx="15.5" cy="15.5" r="1.1" fill="currentColor" stroke="none" /><circle cx="15.5" cy="8.5" r="1.1" fill="currentColor" stroke="none" /><circle cx="8.5" cy="15.5" r="1.1" fill="currentColor" stroke="none" /></S>;
export const IconEraser = (p: P) => <S {...p}><path d="M20 20H8.5l-5-5a2 2 0 0 1 0-2.8l8.6-8.6a2 2 0 0 1 2.8 0l5.6 5.6a2 2 0 0 1 0 2.8L13 19.5" /><path d="M6.5 11.5l6 6" /></S>;
export const IconPiano = (p: P) => <S {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 4v10M12 4v10M16 4v10" /></S>;
export const IconWave = (p: P) => <S {...p}><path d="M2 12h2l2-5 3 10 3-14 3 12 2-6 2 3h3" /></S>;
export const IconDrum = (p: P) => <S {...p}><ellipse cx="12" cy="7" rx="8" ry="3.4" /><path d="M4 7v9c0 1.9 3.6 3.4 8 3.4s8-1.5 8-3.4V7" /><path d="M4.5 9.5L2 12M19.5 9.5L22 12" /></S>;
export const IconZap = (p: P) => <S {...p} fill="currentColor"><path d="M13 2L4 14h6l-1 8 9-12h-6z" stroke="none" /></S>;
export const IconSend = (p: P) => <S {...p}><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4z" /></S>;
export const IconCheck = (p: P) => <S {...p}><path d="M20 6L9 17l-5-5" /></S>;
export const IconTrash = (p: P) => <S {...p}><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></S>;
export const IconAlert = (p: P) => <S {...p}><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></S>;
export const IconRestore = (p: P) => <S {...p}><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /><path d="M12 7v5l3.5 2" /></S>;
export const IconBook = (p: P) => <S {...p}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></S>;
export const IconArrowRight = (p: P) => <S {...p}><path d="M5 12h14M12 5l7 7-7 7" /></S>;
export const IconChevronLeft = (p: P) => <S {...p}><path d="M15 18l-6-6 6-6" /></S>;
export const IconChevronRight = (p: P) => <S {...p}><path d="M9 18l6-6-6-6" /></S>;
/** Arrangement: a timeline with clip blocks on staggered lanes. */
export const IconArrangement = (p: P) => <S {...p}><path d="M3 5v14M3 12h18" strokeWidth="1.6" /><rect x="5" y="6.5" width="5" height="3" rx="1" fill="currentColor" stroke="none" /><rect x="12" y="6.5" width="7" height="3" rx="1" fill="currentColor" stroke="none" /><rect x="7" y="14.5" width="8" height="3" rx="1" fill="currentColor" stroke="none" /></S>;
export const IconFolderOpen = (p: P) => <S {...p}><path d="M6 14l1.5-5h13.2a1 1 0 0 1 .95 1.3L20 15" /><path d="M3 5a2 2 0 0 1 2-2h4l2 3h7a2 2 0 0 1 2 2v1" /><path d="M3 5v12a2 2 0 0 0 2 2h13l2.6-8.4A1 1 0 0 0 19.6 9H6.5a2 2 0 0 0-1.9 1.4L3 15" /></S>;
/** Synth: two oscillator waves meeting a filter knob. */
export const IconSynth = (p: P) => <S {...p}><path d="M2 9c2-4 4-4 6 0s4 4 6 0" /><path d="M2 17h5" /><circle cx="14" cy="17" r="2.4" /><path d="M14 17l1.4-1.6" /><path d="M18 13v8M21 11v10" strokeWidth="1.6" /></S>;
/** Voice/activity meter: rising bars. */
export const IconActivity = (p: P) => <S {...p}><path d="M3 20h2v-6H3zM9 20h2V8H9zM15 20h2v-9h-2zM21 20h-2V4h2z" fill="currentColor" stroke="none" /></S>;
/** Reverse playback. */
export const IconReverse = (p: P) => <S {...p} fill="currentColor"><path d="M11 5v14L3 12z" stroke="none" /><path d="M21 5v14l-8-7z" stroke="none" /></S>;
/** Slice / scissors. */
export const IconScissors = (p: P) => <S {...p}><circle cx="6" cy="6" r="2.6" /><circle cx="6" cy="18" r="2.6" /><path d="M8.2 7.6L20 19M8.2 16.4L20 5" /></S>;
export const IconCopy = (p: P) => <S {...p}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></S>;
export const IconFlag = (p: P) => <S {...p}><path d="M5 21V4" /><path d="M5 4c4-2.5 8 2.5 14 0v9c-6 2.5-10-2.5-14 0" /></S>;
/** Upload arrow into a tray. */
export const IconUpload = (p: P) => <S {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 8l5-5 5 5" /><path d="M12 3v12" /></S>;

export const BrandMark = ({ size = 26 }: P) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
    <rect width="32" height="32" rx="8" fill="#141120" stroke="#281B46" />
    <path d="M5 16h3l2-7 3 14 3-10 2 5 2-2h7" fill="none" stroke="#7C5CBF" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
