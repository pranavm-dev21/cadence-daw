import { useEffect, useRef, useState } from "react";
import { DawCommand } from "../types";
import { useStore } from "../state/store";
import { AiResult, PlanItem, aiRespond } from "../ai/intent";
import type { AiResponse } from "../ai/aiWorker";
import { IconArrowRight, IconCheck, IconChevronRight, IconSend, IconSparkles, IconX } from "./icons";

interface PlanPayload { title: string; summary: string; items: PlanItem[]; status: "pending" | "approved" | "rejected"; }
interface Msg { id: number; role: "user" | "ai"; text?: string; plan?: PlanPayload; }

let msgId = 0;
const WELCOME: Record<string, string> = {
  beginner:
    "Hey! I'm your music copilot — I write MIDI: beats, melodies, chords, basslines, arrangements. Everything I do can be undone with Ctrl+Z.\n\nFastest first win: press play, listen to \"First Light\", then tap a chip below.",
  producer:
    "Copilot online. I generate and edit musical content — parts, energy, structure, tempo, key — always as reviewable commands. Mixing stays yours.\n\nTry \"more energy\" once you've looped something you like.",
  advanced:
    "Copilot online — music-content scope only. All mutations flow through the validated command queue: approve plans, inspect items, revert batches atomically.\n\nSuggestion: run \"arrange my song\", then A/B with a single undo.",
};

const CHIPS: Record<string, string[]> = {
  beginner: ["Make me a beat", "Add a melody", "Add a bassline", "Arrange my song"],
  producer: ["More energy", "Add chords", "Set tempo to 120", "Add a pad"],
  advanced: ["Make it chill", "Transpose the lead up 3", "Change key to C minor", "Arrange my song"],
};

export default function AIPanel() {
  const { state, apply, setAiPanel } = useStore();
  const [messages, setMessages] = useState<Msg[]>(() => [{ id: msgId++, role: "ai", text: WELCOME[state.mode] }]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const workerFailed = useRef(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  /* Spawn the AI sandbox once — a module worker with no DOM/network access. */
  useEffect(() => {
    try {
      workerRef.current = new Worker(new URL("../ai/aiWorker.ts", import.meta.url), { type: "module" });
    } catch {
      workerFailed.current = true; // sandboxed spawn blocked → inline fallback
    }
    return () => { workerRef.current?.terminate(); workerRef.current = null; };
  }, []);

  useEffect(() => () => { if (timerRef.current) window.clearTimeout(timerRef.current); }, []);

  const push = (m: Omit<Msg, "id">) => setMessages((prev) => [...prev, { ...m, id: msgId++ }]);

  const handleResult = (res: AiResult) => {
    if (res.kind === "reply") {
      push({ role: "ai", text: res.text });
    } else if (res.kind === "run") {
      apply("Copilot: " + res.text.split(".")[0], res.commands);
      push({ role: "ai", text: res.text });
    } else {
      push({ role: "ai", plan: { title: res.title, summary: res.summary, items: res.items, status: "pending" } });
    }
  };

  const submit = (raw: string) => {
    const text = raw.trim();
    if (!text || thinking) return;
    push({ role: "user", text });
    setInput("");
    setThinking(true);

    const startedAt = performance.now();
    const finish = (res: AiResult) => {
      // keep a small, human "thinking" beat even though planning is instant
      const wait = Math.max(0, 430 + Math.random() * 260 - (performance.now() - startedAt));
      timerRef.current = window.setTimeout(() => { handleResult(res); setThinking(false); }, wait);
    };

    if (workerRef.current && !workerFailed.current) {
      let settled = false;
      const onMsg = (e: MessageEvent<AiResponse>) => {
        if (settled) return;
        settled = true;
        workerRef.current?.removeEventListener("message", onMsg);
        finish(e.data.result);
      };
      workerRef.current.addEventListener("message", onMsg);
      workerRef.current.postMessage({ text, project: state.project });
      // failsafe: if the sandbox ever goes silent, answer inline instead of hanging
      window.setTimeout(() => {
        if (settled) return;
        settled = true;
        workerRef.current?.removeEventListener("message", onMsg);
        workerFailed.current = true;
        finish(aiRespond(text, state.project));
      }, 1600);
    } else {
      finish(aiRespond(text, state.project));
    }
  };

  const approve = (msg: Msg) => {
    if (!msg.plan) return;
    const cmds: DawCommand[] = msg.plan.items.map((i) => i.command);
    apply(`Copilot: ${msg.plan.title}`, cmds);
    setMessages((prev) => prev.map((m) => (m.id === msg.id && m.plan ? { ...m, plan: { ...m.plan, status: "approved" } } : m)));
    push({ role: "ai", text: `Done — ${msg.plan.items.length} operation${msg.plan.items.length > 1 ? "s" : ""} applied as one undoable batch. Press play, and Ctrl+Z if you want it back.` });
  };

  const reject = (msg: Msg) => {
    setMessages((prev) => prev.map((m) => (m.id === msg.id && m.plan ? { ...m, plan: { ...m.plan, status: "rejected" } } : m)));
    push({ role: "ai", text: "No problem — nothing was changed. Tell me what to adjust instead." });
  };

  /* Collapsed state — a slim rail so the work area gets the full width. */
  if (!state.aiPanelOpen) {
    return (
      <aside className="w-[46px] shrink-0 panel hidden xl:flex flex-col items-center pt-3 pb-4 anim-fade-up" style={{ animationDelay: "200ms" }}>
        <button
          onClick={() => setAiPanel(true)}
          title="Open copilot"
          aria-label="Open copilot"
          className="w-9 h-9 rounded-lg flex items-center justify-center bg-amber-glow/12 border border-amber-glow/30 text-amber-glow hover:bg-amber-glow/22 hover:scale-105 active:scale-95 transition-all duration-150 shadow-[0_0_16px_rgba(0,245,255,0.18)]"
        >
          <IconSparkles size={16} />
        </button>
        <span className="mt-3 text-[9px] font-semibold tracking-[0.22em] uppercase text-ink-400" style={{ writingMode: "vertical-rl" }}>
          Copilot
        </span>
        <div className="mt-auto flex flex-col items-center gap-1.5" title={thinking ? "Copilot is thinking…" : "Copilot ready"}>
          <span className={`w-1.5 h-1.5 rounded-full ${thinking ? "bg-amber-glow animate-pulse" : "bg-teal"} shadow-[0_0_8px_rgba(62,207,178,0.7)]`} />
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-[324px] shrink-0 panel hidden xl:flex flex-col anim-fade-up overflow-hidden" style={{ animationDelay: "200ms" }}>
      {/* header */}
      <div className="flex items-center gap-2 px-3 h-11 border-b border-ink-700/70 shrink-0">
        <span className={`w-2 h-2 rounded-full ${thinking ? "bg-amber-glow animate-pulse" : "bg-teal"} shadow-[0_0_8px_rgba(62,207,178,0.7)]`} />
        <span className="text-[13px] font-bold text-ink-100">Copilot</span>
        <span className="text-[9px] font-mono text-ink-400 tracking-wider uppercase" title="Runs in an isolated Web Worker — no DOM, no network, no file access">midi copilot · sandboxed worker · undoable</span>
        <div className="flex-1" />
        <IconSparkles size={14} className="text-amber-glow" />
        <button
          onClick={() => setAiPanel(false)}
          title="Collapse copilot panel"
          aria-label="Collapse copilot panel"
          className="w-6 h-6 rounded-md flex items-center justify-center text-ink-400 hover:text-ink-100 hover:bg-ink-750 transition-colors duration-150"
        >
          <IconChevronRight size={14} />
        </button>
      </div>

      {/* messages */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-3">
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="self-end max-w-[88%] bg-amber-glow/15 border border-amber-glow/30 text-ink-100 text-[12.5px] leading-relaxed rounded-xl rounded-br-sm px-3 py-2 anim-pop">
              {m.text}
            </div>
          ) : m.plan ? (
            <div key={m.id} className={`self-start w-full rounded-xl border overflow-hidden anim-pop ${m.plan.status === "rejected" ? "border-ink-700 opacity-55" : "border-teal/35 bg-teal/[0.04]"}`}>
              <div className="px-3 pt-2.5 pb-1.5 flex items-start gap-2">
                <IconSparkles size={14} className="text-amber-glow shrink-0 mt-0.5" />
                <div>
                  <div className="text-[13px] font-bold text-ink-100">{m.plan.title}</div>
                  <div className="text-[11px] text-ink-300 leading-snug mt-0.5">{m.plan.summary}</div>
                </div>
              </div>
              <ul className="mx-3 mb-2 rounded-lg bg-ink-950/60 border border-ink-700 divide-y divide-ink-750/60">
                {m.plan.items.map((it, i) => (
                  <li key={i} className="flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-ink-200">
                    <span className="font-mono text-[9px] text-teal/80 w-4 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                    <span className="leading-snug">{it.label}</span>
                  </li>
                ))}
              </ul>
              {m.plan.status === "pending" ? (
                <div className="flex gap-1.5 px-3 pb-2.5">
                  <button className="btn btn-primary py-1! px-2.5! text-[11px]! flex-1 justify-center" onClick={() => approve(m)}>
                    <IconCheck size={12} /> Apply {m.plan.items.length} change{m.plan.items.length > 1 ? "s" : ""}
                  </button>
                  <button className="btn py-1! px-2.5! text-[11px]!" onClick={() => reject(m)}>
                    <IconX size={12} /> Reject
                  </button>
                </div>
              ) : (
                <div className={`px-3 pb-2.5 text-[10.5px] font-mono flex items-center gap-1.5 ${m.plan.status === "approved" ? "text-teal" : "text-ink-400"}`}>
                  {m.plan.status === "approved" ? <IconCheck size={11} /> : <IconX size={11} />}
                  {m.plan.status === "approved" ? "applied · one undo reverts the whole batch" : "rejected · project untouched"}
                </div>
              )}
            </div>
          ) : (
            <div key={m.id} className="self-start max-w-[94%] bg-ink-800 border border-ink-700 text-ink-200 text-[12.5px] leading-relaxed rounded-xl rounded-bl-sm px-3 py-2 anim-pop whitespace-pre-line">
              {m.text}
            </div>
          ),
        )}
        {thinking && (
          <div className="self-start bg-ink-800 border border-ink-700 rounded-xl rounded-bl-sm px-3.5 py-2.5 flex items-center gap-1.5 anim-pop">
            {[0, 1, 2].map((i) => (
              <span key={i} className="w-1.5 h-1.5 rounded-full bg-amber-glow" style={{ animation: `dot-blink 0.9s ease-in-out ${i * 0.18}s infinite` }} />
            ))}
            <span className="text-[10px] font-mono text-ink-400 ml-1">analyzing project…</span>
          </div>
        )}
      </div>

      {/* chips */}
      <div className="px-3 pb-2 flex flex-wrap gap-1.5 shrink-0">
        {CHIPS[state.mode].map((c) => (
          <button key={c} className="chip" onClick={() => submit(c)} disabled={thinking}>
            <IconArrowRight size={10} /> {c}
          </button>
        ))}
      </div>

      {/* input */}
      <form
        className="flex items-center gap-2 px-3 py-2.5 border-t border-ink-700/70 shrink-0"
        onSubmit={(e) => { e.preventDefault(); submit(input); }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='Try "add a melody" or "arrange my song"'
          className="flex-1 bg-ink-950 border border-ink-700 rounded-lg px-3 py-2 text-[12.5px] text-ink-100 placeholder:text-ink-400/70 focus:outline-none focus:border-amber-glow/60 focus:ring-2 focus:ring-amber-glow/15 transition"
          aria-label="Ask the copilot"
        />
        <button type="submit" className="btn btn-primary px-3! py-2!" disabled={!input.trim() || thinking} title="Send to copilot">
          <IconSend size={14} />
        </button>
      </form>
    </aside>
  );
}

