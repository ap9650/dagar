"use client";

import { useId, useState } from "react";
import { LifeBuoy, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";

/**
 * "Want a person to explain this?" — the D6 escalation offer.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * AN INLINE CARD. NEVER A MODAL, NEVER BLOCKING, ALWAYS DISMISSIBLE.
 *
 * The trigger for this is three wrong answers in a row. A learner in that moment
 * is the last person who should have a dialog thrown across their screen — the
 * app would be interrupting them to point out that they are failing.
 *
 * The copy is an OFFER, not a diagnosis: "want a person to explain this?", never
 * "you are struggling". A learner reading over a parent's shoulder on a shared
 * phone sees this too. It is styled in the calm primary wash, not the amber of a
 * wrong answer and certainly not the red of an error: nothing has gone wrong.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Dismissal is local to the session and silent. Declining help is a normal thing
 * to do and is not recorded as an event — dismissal is data about what a learner
 * wants, not a failure to convert (spec §7).
 */
export function MentorCta({
  conceptId,
  lessonId,
  trigger,
  onDismissed,
  onSent,
}: {
  conceptId?: string;
  /** Set when the offer came from the tutor sheet, so the excerpt is scoped. */
  lessonId?: string;
  trigger: string;
  /**
   * Called when the learner declines. The PARENT owns whether the offer comes
   * back — see `PracticeSession`, which also clears it when they move on, so a
   * confirmation does not follow somebody through the rest of a session.
   */
  onDismissed?: () => void;
  /**
   * Called once a request is actually filed.
   *
   * Asking is NOT meant to remove the offer from the chapter — a learner who
   * gets stuck on a different concept tomorrow should be offered help again, and
   * `detectStruggle` will raise it. This exists for the narrower case: the
   * struggle rule is "the last three attempts were wrong", so one more wrong
   * answer straight after asking re-fires it, and the learner is offered a
   * mentor one question after requesting one. That reads as nagging and files
   * duplicates about the same concept.
   */
  onSent?: () => void;
}) {
  const t = useTranslations();
  const noteId = useId();

  /**
   * ── THE ORDER: ask first, write second ────────────────────────────────────
   * This card used to show the note field (behind an "Add a note (optional)"
   * link) NEXT TO the action, so the learner met a form and a button at the same
   * moment and had to work out that one was optional.
   *
   * Now the offer is a single button. Tapping it is the decision; the note box
   * appears after, when they have already chosen to ask and the only question
   * left is what to say. Same two pieces of information, one at a time — which
   * is the rule for every other screen in this product.
   */
  const [state, setState] = useState<
    "offered" | "composing" | "sending" | "sent" | "dismissed"
  >("offered");
  const [note, setNote] = useState("");

  if (state === "dismissed") return null;

  if (state === "sent") {
    return (
      <div
        role="status"
        className="flex flex-col gap-xs rounded-(--radius-card) border border-primary bg-primary-wash px-lg py-md"
      >
        <p className="text-label font-medium text-primary-strong">
          {t("mentor.requestedTitle")}
        </p>
        {/* Honest about the wait. There is no mentor console in the MVP (D8) and
            requests are read by a person, so promising a fast reply would be a
            promise the product cannot keep — to a learner who has just admitted
            they are stuck. */}
        <p className="text-body-sm text-body">{t("mentor.requested")}</p>
      </div>
    );
  }

  async function send() {
    setState("sending");
    try {
      const response = await fetch("/api/mentor-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concept_id: conceptId,
          lesson_id: lessonId,
          trigger,
          learner_note: note.trim() || undefined,
        }),
      });
      // Either way the learner is told it went through. A failed request here is
      // recoverable on the next trigger, and "we could not pass that on" is a
      // second disappointment stacked on the first.
      if (!response.ok) console.error("[mentor] request failed");
    } catch {
      console.error("[mentor] request threw");
    }
    setState("sent");
    onSent?.();
  }

  return (
    <div className="flex flex-col gap-md rounded-(--radius-card) border border-primary bg-primary-wash px-lg py-md">
      <div className="flex items-start gap-md">
        <LifeBuoy
          size={20}
          strokeWidth={1.75}
          aria-hidden
          className="text-primary shrink-0 mt-0.5"
        />
        <div className="flex flex-col gap-xs min-w-0">
          <p className="text-label font-medium text-primary-strong">
            {t("mentor.ctaTitle")}
          </p>
          <p className="text-body-sm text-body">{t("mentor.ctaBody")}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setState("dismissed");
            onDismissed?.();
          }}
          aria-label={t("mentor.dismiss")}
          className="ms-auto inline-flex items-center justify-center size-11 shrink-0 rounded-(--radius-control) text-body"
        >
          <X size={20} strokeWidth={1.75} aria-hidden />
        </button>
      </div>

      {state === "offered" ? (
        // One button. Nothing to read, nothing to fill in, nothing to weigh up.
        <Button variant="secondary" onClick={() => setState("composing")}>
          {t("mentor.ctaAction")}
        </Button>
      ) : (
        // They have already decided to ask. Now, and only now, what to say —
        // and it stays genuinely skippable: sending with an empty box is fine,
        // because the request already carries the concept and what they tried.
        // A textarea a stuck 12-year-old MUST fill is a reason not to ask.
        <div className="flex flex-col gap-md">
          <div className="flex flex-col gap-xs">
            <label htmlFor={noteId} className="text-caption text-body">
              {t("mentor.noteLabel")}
            </label>
            <textarea
              id={noteId}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={500}
              rows={3}
              autoFocus
              placeholder={t("mentor.notePlaceholder")}
              className="w-full rounded-(--radius-control) border border-border-strong bg-background
                         px-md py-sm text-body text-ink
                         focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary-soft"
            />
          </div>

          <Button variant="secondary" loading={state === "sending"} onClick={send}>
            {t("mentor.send")}
          </Button>
        </div>
      )}
    </div>
  );
}
