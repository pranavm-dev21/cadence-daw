/* AI process sandbox.
 *
 * The copilot runs in a dedicated module Web Worker. By construction it has:
 *   - NO document / window / DOM access (module workers don't get any)
 *   - NO access to the audio engine, the store, or any UI state
 *   - NO network, filesystem or shell APIs — its only imports are pure
 *     functions (intent parser + music theory), which themselves import
 *     nothing platform-specific.
 * It receives {text, project}, returns an AiResult of validated DawCommands.
 * The renderer stays free to keep the audio path real-time even while the
 * copilot "thinks". */

import { Project } from "../types";
import { AiResult, aiRespond } from "./intent";

export interface AiRequest { text: string; project: Project; }
export interface AiResponse { result: AiResult; }

self.onmessage = (e: MessageEvent<AiRequest>) => {
  const { text, project } = e.data ?? {};
  let result: AiResult;
  try {
    result = aiRespond(typeof text === "string" ? text : "", project);
  } catch {
    result = {
      kind: "reply",
      text: "The copilot hit an unexpected error while planning — nothing was changed. Try rephrasing, or press Ctrl+Z if something looks off.",
    };
  }
  (self as unknown as Worker).postMessage({ result } satisfies AiResponse);
};
