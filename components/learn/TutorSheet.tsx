"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Send, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { MarkdownBody } from "./MarkdownBody";
import { MentorCta } from "./MentorCta";

/**
 * The AI Tutor — a bottom sheet over the lesson, never a separate route.
 *
 * That is a deliberate constraint from the spec and it is about attention: a
 * learner who taps "Ask Dagar" has a specific confusion about the paragraph
 * they are reading. Navigating them away loses the paragraph, and they come
 * back having to find their place again.
 *
 * Accessibility here is load-bearing rather than decorative:
 *   - focus moves into the sheet on open and RETURNS to the trigger on close
 *   - Tab is trapped inside while it is open, so a keyboard user cannot
 *     wander into the lesson behind it
 *   - Escape closes
 *   - streamed text is announced ONCE when it finishes, not re-announced on
 *     every token, which is what a naive aria-live on the stream would do
 */

type Turn = {
  id: string | null;
  role: "user" | "assistant";
  content: string;
};

export function TutorSheet({
  lessonId,
  conceptId,
  initialMessages,
}: {
  lessonId: string;
  conceptId: string | null;
  /** Server-rendered history, so reopening a lesson shows the conversation. */
  initialMessages: Turn[];
}) {
  const t = useTranslations();

  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<"none" | "failed" | "limit" | "unavailable">("none");
  const [mentorTrigger, setMentorTrigger] = useState<string | null>(null);
  const [rated, setRated] = useState<Record<string, boolean>>({});

  const sheetRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Focus in on open, focus back to the trigger on close. Losing focus to the
  // top of the document is the classic dialog bug and it strands a keyboard
  // user mid-lesson.
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    } else {
      triggerRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, streaming]);

  const onKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key !== "Tab") return;

    // The trap. Without it, Tab walks out of the sheet and into the lesson
    // underneath, which is still on screen and still focusable.
    const focusable = sheetRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable || focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  async function send() {
    const message = draft.trim();
    if (message.length === 0 || busy) return;

    setDraft("");
    setFailure("none");
    setBusy(true);
    setTurns((prev) => [...prev, { id: null, role: "user", content: message }]);
    // Empty string, not null: the thinking indicator renders on this being
    // non-null, and it must appear the instant the learner hits send rather
    // than when the first token lands (D11).
    setStreaming("");

    try {
      const response = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lesson_id: lessonId, message }),
      });

      if (response.status === 429) {
        setFailure("limit");
        setStreaming(null);
        return;
      }
      if (response.status === 503) {
        setFailure("unavailable");
        setStreaming(null);
        return;
      }
      if (!response.ok || !response.body) {
        setFailure("failed");
        setStreaming(null);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let text = "";
      let assistantId: string | null = null;

      // NDJSON: frames are newline-delimited, and a chunk can split one in half,
      // so the trailing partial line stays in the buffer until its newline.
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.trim().length === 0) continue;
          let frame: { t: string; v?: string; id?: string | null; trigger?: string | null };
          try {
            frame = JSON.parse(line);
          } catch {
            continue;
          }

          if (frame.t === "d" && frame.v) {
            text += frame.v;
            setStreaming(text);
          } else if (frame.t === "end") {
            assistantId = frame.id ?? null;
            if (frame.trigger) setMentorTrigger(frame.trigger);
          } else if (frame.t === "err") {
            setFailure("failed");
          }
        }
      }

      // Whatever arrived is kept, even on a mid-stream failure. Blanking half an
      // explanation the learner has already read would be the worse outcome.
      if (text.length > 0) {
        setTurns((prev) => [...prev, { id: assistantId, role: "assistant", content: text }]);
      } else if (failure === "none") {
        setFailure("failed");
      }
    } catch {
      setFailure("failed");
    } finally {
      setStreaming(null);
      setBusy(false);
    }
  }

  async function rate(messageId: string, helpful: boolean) {
    setRated((prev) => ({ ...prev, [messageId]: helpful }));
    // Fire and forget. A failed thumb is not worth telling a learner about, and
    // the optimistic state above already acknowledged the tap.
    fetch("/api/tutor/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tutor_message_id: messageId, helpful }),
    }).catch(() => {});
  }

  if (!open) {
    return (
      <Button ref={triggerRef} variant="secondary" onClick={() => setOpen(true)}>
        <MessageCircle size={20} strokeWidth={1.75} aria-hidden />
        {t("lesson.askTutor")}
      </Button>
    );
  }

  return (
    <>
      {/* Scrim. Tapping it closes — the sheet is an offer, not a trap. */}
      <div
        className="fixed inset-0 z-40 bg-ink/40 motion-safe:transition-opacity"
        onClick={() => setOpen(false)}
        aria-hidden
      />

      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("tutor.title")}
        onKeyDown={onKeyDown}
        className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85dvh] w-full
                   max-w-(--container-content) flex-col
                   rounded-t-(--radius-card) border border-border bg-background
                   shadow-(--shadow-raised)"
      >
        <header className="flex items-center gap-md border-b border-border px-lg py-md">
          <h2 className="text-h3 text-ink">{t("tutor.title")}</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t("common.close")}
            className="ms-auto inline-flex size-11 items-center justify-center rounded-(--radius-control) text-body hover:bg-surface"
          >
            <X size={20} strokeWidth={1.75} aria-hidden />
          </button>
        </header>

        {/* role="log" + polite: each finished message is announced once, when it
            lands. The streaming bubble below is deliberately outside this. */}
        <div
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          className="flex-1 overflow-y-auto px-lg py-lg flex flex-col gap-md"
        >
          {turns.length === 0 && (
            <p className="text-body-sm text-muted">{t("tutor.suggestionsTitle")}</p>
          )}

          {turns.map((turn, index) => (
            <div
              key={turn.id ?? `${turn.role}-${index}`}
              className={cn(
                "flex flex-col gap-xs",
                turn.role === "user" ? "items-end" : "items-start",
              )}
            >
              {/* Who spoke, for assistive tech. Sighted users get alignment and
                  the tail shape — colour is never the only signal (rule 10). */}
              <span className="sr-only">
                {turn.role === "user" ? t("tutor.youSaid") : t("tutor.tutorSaid")}
              </span>

              <div
                className={cn(
                  "max-w-[85%] px-lg py-md text-body",
                  turn.role === "user"
                    ? "bg-primary text-white rounded-[14px] rounded-br-[4px]"
                    : "bg-primary-wash text-ink rounded-[14px] rounded-bl-[4px]",
                )}
              >
                {turn.role === "assistant" ? (
                  <MarkdownBody markdown={turn.content} />
                ) : (
                  turn.content
                )}
              </div>

              {turn.role === "assistant" && turn.id && (
                <div className="flex items-center gap-xs">
                  {([true, false] as const).map((helpful) => {
                    const chosen = rated[turn.id!] === helpful;
                    const Icon = helpful ? ThumbsUp : ThumbsDown;
                    return (
                      <button
                        key={String(helpful)}
                        type="button"
                        onClick={() => rate(turn.id!, helpful)}
                        aria-label={helpful ? t("tutor.helpful") : t("tutor.notHelpful")}
                        aria-pressed={chosen}
                        className={cn(
                          "inline-flex size-11 items-center justify-center rounded-(--radius-control)",
                          chosen ? "text-primary" : "text-muted hover:bg-surface",
                        )}
                      >
                        <Icon size={16} strokeWidth={1.75} aria-hidden />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          {streaming !== null && (
            <div className="flex flex-col items-start gap-xs">
              {/* One announcement for the whole reply, rather than one per
                  token. The bubble itself is hidden from AT until it lands in
                  the log above as a finished message. */}
              <span role="status" className="sr-only">
                {t("tutor.thinking")}
              </span>
              <div
                aria-hidden
                className="max-w-[85%] rounded-[14px] rounded-bl-[4px] bg-primary-wash px-lg py-md text-body text-ink"
              >
                {streaming.length === 0 ? (
                  <span className="flex items-center gap-xs">
                    {[0, 1, 2].map((dot) => (
                      <span
                        key={dot}
                        className="size-2 rounded-full bg-muted motion-safe:animate-pulse"
                        style={{ animationDelay: `${dot * 150}ms` }}
                      />
                    ))}
                  </span>
                ) : (
                  <MarkdownBody markdown={streaming} />
                )}
              </div>
            </div>
          )}

          {failure !== "none" && (
            // Amber, not red: the lesson still works and nothing the learner
            // did went wrong.
            <p role="status" className="text-body-sm text-notquite">
              {failure === "limit"
                ? t("tutor.limitReached")
                : failure === "unavailable"
                  ? t("tutor.unavailable")
                  : t("tutor.failed")}
            </p>
          )}

          {/* `lessonId` too: this is D6 rule 3, where the signal IS the tutor
              conversation, so the excerpt a mentor reads should be the one from
              this lesson rather than everything under the concept. */}
          {mentorTrigger && conceptId && (
            <MentorCta conceptId={conceptId} lessonId={lessonId} trigger={mentorTrigger} />
          )}

          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
          className="flex items-end gap-sm border-t border-border px-lg py-md"
        >
          <label htmlFor="tutor-input" className="sr-only">
            {t("tutor.placeholder")}
          </label>
          <input
            ref={inputRef}
            id="tutor-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t("tutor.placeholder")}
            maxLength={1000}
            autoComplete="off"
            className="min-h-12 flex-1 rounded-(--radius-control) border border-border-strong
                       bg-background px-md text-body text-ink
                       focus:border-primary focus:ring-[3px] focus:ring-primary-soft focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || draft.trim().length === 0}
            aria-label={t("tutor.send")}
            className="inline-flex size-12 shrink-0 items-center justify-center rounded-(--radius-control)
                       bg-primary text-white disabled:opacity-50"
          >
            <Send size={20} strokeWidth={1.75} aria-hidden />
          </button>
        </form>
      </div>
    </>
  );
}
