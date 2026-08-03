"use client";

import { CheckCircle2, Lightbulb } from "lucide-react";
import { useTranslations } from "next-intl";
import { MarkdownBody } from "./MarkdownBody";

/**
 * Three ways to say "yes, that is right".
 *
 * Not decoration. The same two words twenty times in a session stop being read
 * at all — the eye learns the shape of the green box and skips it, which is the
 * same deadening that made a buzz on every correct answer worth removing.
 *
 * All three are equal in warmth on purpose. Nothing here grades HOW right an
 * answer was: a learner who worked hard for a question they found difficult
 * should not be told "Nice one" while an easier one earned "Excellent". Praise
 * that implies a ranking is a comparison, and this product does not compare
 * (design rule 12).
 *
 * Chosen by question number, never at random, so it cannot change under the
 * learner while they are reading it.
 */
const PRAISE = ["feedback.correct", "feedback.correctWell", "feedback.correctNice"] as const;

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
  hints,
  solutionMd,
  questionNumber = 1,
}: {
  isCorrect: boolean;
  /** Hints the learner has ASKED for, in tier order. Often empty. */
  hints: string[];
  /** The full worked method. Arrives once the ladder is exhausted. */
  solutionMd: string | null;
  /** Which question this is, so the praise varies without being random. */
  questionNumber?: number;
}) {
  const t = useTranslations();

  /*
    NOTHING BUZZES HERE ANY MORE.

    This used to fire `haptic("correct")` on every right answer. On a five-
    question set that is five buzzes, for the outcome the learner expects — and
    a signal spent on the expected case has nothing left for the unexpected one.
    The phone now moves only for a lesson finished or a milestone earned; a
    correct answer is answered in words, right here.

    There was never a buzz on a WRONG answer, and there is still no `wrong`
    pattern in lib/haptics.ts — a buzz there is the amber-not-red rule broken in
    a different sense: a physical reprimand for mixing up a sign.
  */

  if (isCorrect) {
    return (
      <div
        role="status"
        className="flex flex-col gap-md rounded-(--radius-card) border border-correct bg-correct-soft px-lg py-md"
      >
        <p className="flex items-center gap-sm text-label font-medium text-correct">
          <CheckCircle2 size={20} strokeWidth={1.75} aria-hidden />
          {t(PRAISE[Math.max(0, questionNumber - 1) % PRAISE.length])}
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

      {/* Each rung stays on screen as the next arrives — a learner who worked
          through three hints should be able to read them together, not watch
          the earlier ones vanish. */}
      {hints.map((hint, tier) => (
        <div key={tier} className="flex flex-col gap-xs">
          <p className="text-caption font-medium text-hint">
            {t("feedback.hintTitle")} {tier + 1}
          </p>
          <div className="text-body-sm text-ink">
            <MarkdownBody markdown={hint} />
          </div>
        </div>
      ))}

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
