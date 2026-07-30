"use client";

import { CheckCircle2, Lightbulb } from "lucide-react";
import { useTranslations } from "next-intl";
import { MarkdownBody } from "./MarkdownBody";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WRONG ANSWERS ARE AMBER. RED IS FOR SYSTEM ERRORS ONLY.
 *
 * Not a style preference, and the one rule in the design system marked
 * non-negotiable. A learner who is already behind must never see the colour of
 * danger because they mixed up a sign. Amber says *not yet*; red says *you
 * failed*. The only red in this product is a failed network request.
 *
 * And a wrong answer NEVER appears alone. Every not-quite state on this panel
 * carries the next step with it — a hint, or the worked solution. A bare mark
 * with nothing to do next is where a struggling learner closes the app.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Correctness is carried by an ICON and by TEXT as well as by colour (design
 * rule 10), and the whole panel is `role="status"` so a screen reader announces
 * the result instead of leaving it as something only sighted users receive.
 */
export function FeedbackPanel({
  isCorrect,
  hint,
  solutionMd,
}: {
  isCorrect: boolean;
  /** Tier 1. Present only after a wrong answer. */
  hint: string | null;
  /** The full worked method. Arrives once the learner has re-engaged. */
  solutionMd: string | null;
}) {
  const t = useTranslations();

  if (isCorrect) {
    return (
      <div
        role="status"
        className="flex flex-col gap-md rounded-(--radius-card) border border-correct bg-correct-soft px-lg py-md"
      >
        <p className="flex items-center gap-sm text-label font-medium text-correct">
          <CheckCircle2 size={20} strokeWidth={1.75} aria-hidden />
          {t("feedback.correct")}
        </p>

        {/* One line of WHY, not just a tick. A learner who guessed right and is
            told only "Correct!" has learned nothing from the question. */}
        {solutionMd && (
          <div className="text-body-sm text-ink">
            <MarkdownBody markdown={solutionMd} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      role="status"
      className="flex flex-col gap-md rounded-(--radius-card) border border-notquite bg-notquite-soft px-lg py-md"
    >
      <p className="flex items-center gap-sm text-label font-medium text-notquite">
        <Lightbulb size={20} strokeWidth={1.75} aria-hidden />
        {t("feedback.notQuite")}
      </p>

      {hint && !solutionMd && (
        <div className="text-body-sm text-ink">
          <MarkdownBody markdown={hint} />
        </div>
      )}

      {solutionMd && (
        <div className="flex flex-col gap-sm">
          <p className="text-caption font-medium text-notquite">
            {t("feedback.solutionTitle")}
          </p>
          <div className="text-body-sm text-ink">
            <MarkdownBody markdown={solutionMd} />
          </div>
        </div>
      )}
    </div>
  );
}
