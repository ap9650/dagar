"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { EXIT_REASONS, type ExitReason } from "@/lib/exit";

/**
 * The last thing Dagar says to a learner who has left.
 *
 * ── WHY THIS SCREEN EXISTS ──────────────────────────────────────────────────
 * Before it, deleting an account dropped you on the language picker with no
 * message at all — indistinguishable from being signed out, which is the one
 * thing it must not look like. A learner who has just destroyed their streak
 * deserves to be told plainly that it worked.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ── THE ORDER IS THE ETHICS ─────────────────────────────────────────────────
 * The account is ALREADY deleted when this renders. The question is asked on
 * the way out, never on the way to the door:
 *
 *   - Nothing here can undo or delay the deletion. It has happened.
 *   - Answering is optional and looks optional — "No thanks" is a real button,
 *     not greyed-out small print.
 *   - The reasons blame the PRODUCT, not the learner: "It was too hard", never
 *     "I found it too hard". Someone leaving because they could not follow it
 *     should not have to describe themselves as the problem on the way out.
 *   - One tap, then it is over. No follow-up question, no "tell us more" box.
 *
 * Brilliant asks for the reason as a required step BEFORE deactivating, with an
 * asterisk. For an 11–14-year-old asking to leave, making them answer first is
 * the wrong power dynamic — and "I have a privacy concern" as a box you must
 * tick to escape is not a good look. Hence: after, and skippable.
 */
export function GoodbyeCard() {
  const t = useTranslations("goodbye");
  const [state, setState] = useState<"asking" | "thanks" | "dismissed">("asking");

  async function send(reason: ExitReason) {
    // Optimistic, and deliberately so: this is the last screen of a session
    // that no longer has an account behind it. A spinner, or an error if the
    // write fails, would be a worse goodbye than none.
    setState("thanks");
    try {
      await fetch("/api/exit-reason", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
    } catch {
      /* Their account is gone either way. Nothing here is worth an error. */
    }
  }

  return (
    <div
      role="status"
      className="flex flex-col gap-md rounded-(--radius-card) border border-primary bg-primary-wash px-lg py-lg"
    >
      <div className="flex items-start gap-md">
        <Check size={20} strokeWidth={2} aria-hidden className="text-primary shrink-0 mt-0.5" />
        <div className="flex flex-col gap-xs min-w-0">
          <p className="text-label font-medium text-primary-strong">{t("title")}</p>
          <p className="text-body-sm text-body">{t("body")}</p>
        </div>
      </div>

      {state === "asking" && (
        <>
          <p className="text-body-sm text-body">{t("ask")}</p>

          <ul className="flex flex-col gap-sm list-none m-0 p-0">
            {EXIT_REASONS.map((reason) => (
              <li key={reason}>
                <button
                  type="button"
                  onClick={() => send(reason)}
                  className="w-full min-h-12 px-lg text-start rounded-(--radius-control)
                             border border-border-strong bg-background text-body-sm text-ink
                             transition-colors duration-150 ease-out hover:bg-surface
                             active:bg-primary-soft active:scale-[0.98]
                             focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2
                             [-webkit-tap-highlight-color:transparent]"
                >
                  {t(`reasons.${reason}` as `reasons.${ExitReason}`)}
                </button>
              </li>
            ))}
          </ul>

          {/* A real button, the same size as the others. Skipping has to be as
              easy as answering, or "optional" is a word rather than a fact. */}
          <button
            type="button"
            onClick={() => setState("dismissed")}
            className="min-h-12 px-lg rounded-(--radius-control) text-body-sm text-body
                       underline underline-offset-4
                       focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
          >
            {t("skip")}
          </button>
        </>
      )}

      {state === "thanks" && <p className="text-body-sm text-body">{t("thanks")}</p>}
    </div>
  );
}
