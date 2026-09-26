/* Compatibility shim — the executors and factories moved to the core layer
 * (src/core/executors.ts) as part of the command-bus architecture. This file
 * keeps older import paths resolving; new code should import from "../core". */

export {
  execCommand,
  execCommands,
  makeClip,
  makeTrack,
  makeTrackWithClip,
  noteOf,
  clipWith,
  STEPS_PER_BAR,
} from "../core/executors";
