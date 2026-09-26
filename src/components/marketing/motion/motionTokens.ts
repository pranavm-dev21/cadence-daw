/**
 * LottieFiles Motion Design Skill — System Tokens
 * 
 * Principles applied:
 * - Archetype: Premium (subtle, elegant, cinematic, high precision)
 * - Three Pillars: Emotional Intent, Visual Narrative, Motion Craft
 * - Three Layers: Primary (action), Secondary (richness), Ambient (life)
 * - Disney Principles: Squash & Stretch, Anticipation, Staging, Follow Through, Slow In & Out
 */

export const MOTION_TOKENS = {
  // Motion Archetype: Premium Cinematic
  archetype: "Premium" as const,

  // Signature Easing Curves
  easing: {
    // Signature curve: Decelerates luxuriously without sudden stop
    cinematic: "cubic-bezier(0.16, 1, 0.3, 1)",
    // Fluid standard curve for interface navigation
    smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
    // Tactile overshoot (5-8%) for physical knobs, buttons, and switches
    tactilePop: "cubic-bezier(0.34, 1.35, 0.64, 1)",
    // Gentle decelerate for entrances
    entrance: "cubic-bezier(0.05, 0.7, 0.1, 1)",
    // Gentle accelerate for exits
    exit: "cubic-bezier(0.3, 0, 0.8, 0.15)",
    // Harmonic wave flow
    wave: "cubic-bezier(0.45, 0.05, 0.55, 0.95)",
    // Continuous playhead / meters
    linear: "linear",
  },

  // Duration Palette (ms)
  duration: {
    instant: 120, // Tooltip, button press, toggle, fader drag
    quick: 200,   // Hover state, chip selection, icon morph
    standard: 380, // Card entrance, tab switch, menu open
    cinematic: 650, // Hero reveal, section entry, modal bloom
    ambient: 24000, // Background glow drift, harmonic breath
  },

  // Stagger intervals adhering to the 1/3 Rule
  stagger: {
    fast: 45,      // Sequencer steps, piano keys
    standard: 75,  // Feature cards, track channels
    cinematic: 120, // Hero visual elements
  },

  // Three Motion Layers Contract
  layers: {
    primary: "Main functional action the user directs or observes",
    secondary: "Reactive telemetry, VU meter needles, knob indicator arcs, glow halos",
    ambient: "Canvas floating audio nodes, cosmic particle drift, subtle scanlines",
  },
} as const;
