"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatSession } from "firebase/ai";
import { RotateCcw, Send, Sparkles, X } from "lucide-react";
import { Markdown } from "./markdown";
import { askTutor, aiErrorMessage, startLessonChat, type LessonContext } from "@/lib/services/ai";
import { cn, formatClock } from "@/lib/utils";

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
  error?: boolean;
}

const SUGGESTIONS = [
  "Summarise this lesson in 5 bullet points",
  "Explain the key concept in simple terms",
  "Quiz me on this lesson",
];

/**
 * Floating AI study assistant for the lesson player. Answers are grounded in
 * the lesson notes and video transcript; each question carries the learner's
 * current video position so “this part” makes sense.
 */
export function AiAssistant({
  context,
  getVideoTime,
}: {
  context: LessonContext;
  /** Current playback position in seconds, or null when there is no video. */
  getVideoTime?: () => number | null;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const chat = useRef<ChatSession | null>(null);
  const nextId = useRef(1);
  const list = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const contextRef = useRef(context);

  useEffect(() => {
    contextRef.current = context;
  });

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Close with Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function reset() {
    chat.current = null;
    setMessages([]);
  }

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    setInput("");
    setBusy(true);

    const userId = nextId.current++;
    const replyId = nextId.current++;
    setMessages((m) => [...m, { id: userId, role: "user", text: question }, { id: replyId, role: "assistant", text: "" }]);
    const setReply = (patch: Partial<Message>) =>
      setMessages((m) => m.map((msg) => (msg.id === replyId ? { ...msg, ...patch } : msg)));

    try {
      // The conversation is created lazily so it always uses the latest lesson material.
      chat.current ??= startLessonChat(contextRef.current);
      const position = getVideoTime?.();
      const prefix = position != null && position > 0 ? `[Video position ${formatClock(position)}] ` : "";
      const answer = await askTutor(chat.current, prefix + question, (t) => setReply({ text: t }));
      if (!answer.trim()) setReply({ text: "I couldn't come up with an answer to that. Try asking in a different way.", error: true });
    } catch (error) {
      chat.current = null; // a failed turn can leave the session inconsistent
      setReply({ text: aiErrorMessage(error), error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed right-4 bottom-4 z-40 inline-flex items-center gap-2 rounded-full bg-primary py-3 pr-5 pl-4 text-sm font-semibold text-white shadow-elevated transition hover:bg-primary-hover sm:right-6 sm:bottom-6"
          aria-label="Ask the AI study assistant"
        >
          <Sparkles className="size-5" /> Ask AI
        </button>
      )}

      {open && (
        <section
          role="dialog"
          aria-label="AI study assistant"
          className="fixed inset-x-0 bottom-0 z-40 flex h-[75dvh] flex-col overflow-hidden border border-slate-200 bg-surface shadow-elevated sm:inset-x-auto sm:right-6 sm:bottom-6 sm:h-[min(38rem,calc(100dvh-6rem))] sm:w-[26rem] sm:rounded-2xl"
        >
          <header className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Sparkles className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">Study assistant</p>
              <p className="truncate text-xs text-slate-500">{context.lessonTitle}</p>
            </div>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={reset}
                disabled={busy}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                aria-label="Start a new chat"
                title="New chat"
              >
                <RotateCcw className="size-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close assistant"
            >
              <X className="size-4" />
            </button>
          </header>

          <div ref={list} className="scrollbar-thin min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col justify-center">
                <p className="text-sm font-medium text-slate-800">Ask anything about this lesson</p>
                <p className="mt-1 text-sm text-slate-500">
                  {context.lessonType === "video"
                    ? context.transcript?.trim()
                      ? "I can answer questions about the video and the lesson notes — I know where you are in the video."
                      : "I can answer from the lesson notes. This video has no transcript yet, so I can't see what's said in it."
                    : "I can explain, summarise or quiz you on this reading."}
                </p>
                <div className="mt-4 space-y-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="block w-full rounded-xl border border-slate-200 px-3 py-2 text-left text-sm text-slate-700 transition hover:border-brand-300 hover:bg-brand-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="flex justify-end">
                    <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm break-words whitespace-pre-wrap text-white">
                      {m.text}
                    </p>
                  </div>
                ) : (
                  <div key={m.id} className="flex gap-2.5">
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                      <Sparkles className="size-4" />
                    </span>
                    <div
                      className={cn(
                        "min-w-0 flex-1 rounded-2xl rounded-tl-md px-3.5 py-2.5 text-sm",
                        m.error ? "bg-red-50 text-red-800" : "bg-slate-100",
                      )}
                    >
                      {m.text ? (
                        m.error ? (
                          <p>{m.text}</p>
                        ) : (
                          <Markdown content={m.text} className="prose-sm prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-headings:my-2" />
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1 py-1" aria-label="Thinking">
                          <span className="size-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                          <span className="size-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                          <span className="size-1.5 animate-bounce rounded-full bg-slate-400" />
                        </span>
                      )}
                    </div>
                  </div>
                ),
              )
            )}
          </div>

          <form
            method="post"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="border-t border-slate-100 p-3"
          >
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
                rows={1}
                maxLength={2000}
                placeholder="Ask about this lesson…"
                aria-label="Your question"
                className="max-h-32 min-h-10 flex-1 resize-none rounded-xl border border-slate-300 bg-surface px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white transition hover:bg-primary-hover disabled:opacity-50"
                aria-label="Send question"
              >
                <Send className="size-4" />
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] text-slate-400">AI answers can be wrong — check important points with your instructor.</p>
          </form>
        </section>
      )}
    </>
  );
}
