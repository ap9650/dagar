/**
 * Mastery (D5).
 *
 * The **authoritative** computation lives in Postgres — `recompute_concept_mastery`
 * in `0008_functions.sql` — because mastery must be server-side truth and must
 * update inside the same request that writes the attempt. This file is the pure
 * mirror of that formula, used for display, for the quiz bands (2.4), and for
 * tests that would otherwise need a live database.
 *
 * **The two must not drift.** If the window or the threshold changes here, change
 * it in the SQL in the same commit, and vice versa. The constants below are the
 * ones the SQL uses.
 *
 * D5:
 *   score       = correct ÷ attempted over the LAST 5 attempts on that concept
 *   mastered    = score >= 0.8 AND attempts >= 3
 *   quiz bands  = <50% needs_revision · 50–79% developing · >=80% mastered
 *
 * The 5-attempt window is deliberate and kind: a learner who starts badly and
 * improves watches their early failures fall out of the window. An all-time
 * average would pin them below the line forever, which is precisely the message
 * this product exists not to send.
 */

export const MASTERY_WINDOW = 5;
export const MASTERY_THRESHOLD = 0.8;
export const MASTERY_MIN_ATTEMPTS = 3;

export type MasteryBand = "needs_revision" | "developing" | "mastered";

export type Mastery = {
  /** 0…1, rounded to 3dp exactly as the SQL rounds it. */
  score: number;
  /** Attempts INSIDE the window, so never more than `MASTERY_WINDOW`. */
  attempts: number;
  isMastered: boolean;
  band: MasteryBand;
  /**
   * False until the learner has enough attempts for the number to mean anything.
   *
   * The UI must show "not enough practice yet" rather than 0% (spec §8). A learner
   * who has answered one question is not 0% masterful — they have barely started,
   * and 0% reads as failure.
   *
   * The threshold is `MASTERY_MIN_ATTEMPTS` (3), not the full window of 5. The spec
   * table says 5, but D5 can already declare a concept **Mastered** at 3 attempts —
   * so suppressing the score until 5 would show a learner a "Mastered" badge next to
   * "not enough practice yet". Three is the point where the number starts to mean
   * something, and it is the same number the badge uses.
   */
  hasEnoughData: boolean;
};

/** D5's quiz bands. Also used for the per-concept label on the progress screen. */
export function masteryBand(score: number): MasteryBand {
  if (score >= MASTERY_THRESHOLD) return "mastered";
  if (score >= 0.5) return "developing";
  return "needs_revision";
}

/**
 * The band for a quiz score of `correct` out of `total` (D5, slice 2.4).
 *
 * Integer arithmetic rather than `masteryBand(correct / total)` on purpose. The
 * boundaries are exact — 80% is `mastered`, 79.9% is not — and floating-point
 * division does not respect exact boundaries: some `a / b` that is 0.8 in decimal
 * lands one ulp below the nearest double to 0.8 and silently bands a learner down
 * from Mastered. `correct * 100 >= 80 * total` cannot do that.
 *
 * `total === 0` is not a real quiz and never reaches a learner — the screen shows
 * "coming soon" instead. It returns `needs_revision` rather than dividing by zero.
 */
export function quizBand(correct: number, total: number): MasteryBand {
  if (total <= 0) return "needs_revision";
  if (correct * 100 >= 80 * total) return "mastered";
  if (correct * 100 >= 50 * total) return "developing";
  return "needs_revision";
}

/**
 * Chapter mastery (D5): the share of a chapter's concepts that are Mastered.
 *
 * Counted over ALL the chapter's concepts, not just the attempted ones. A learner
 * who has mastered the only concept they have tried has not mastered the chapter,
 * and reporting 100% would be a number that flatters instead of informs — the one
 * thing a progress screen must never do.
 */
export function chapterMastery(
  conceptIds: readonly string[],
  masteredConceptIds: ReadonlySet<string>,
): { mastered: number; total: number; fraction: number } {
  const total = conceptIds.length;
  const mastered = conceptIds.filter((id) => masteredConceptIds.has(id)).length;
  return { mastered, total, fraction: total === 0 ? 0 : mastered / total };
}

/**
 * Mastery from a concept's attempt history.
 *
 * `results` is chronological, oldest first — the last `MASTERY_WINDOW` are taken.
 * Passing the whole history is fine and is the intended use; the window is applied
 * here so no caller can get it wrong.
 */
export function computeMastery(results: readonly boolean[]): Mastery {
  const window = results.slice(-MASTERY_WINDOW);
  const attempts = window.length;

  if (attempts === 0) {
    return {
      score: 0,
      attempts: 0,
      isMastered: false,
      band: "needs_revision",
      hasEnoughData: false,
    };
  }

  const correct = window.filter(Boolean).length;
  // Rounded to 3dp to match `numeric(4,3)` in the database exactly. Without this,
  // 2/3 is 0.6666666666666666 here and 0.667 there — and a "mastery changed" check
  // would fire on every read.
  const score = Math.round((correct / attempts) * 1000) / 1000;

  return {
    score,
    attempts,
    isMastered: score >= MASTERY_THRESHOLD && attempts >= MASTERY_MIN_ATTEMPTS,
    band: masteryBand(score),
    hasEnoughData: attempts >= MASTERY_MIN_ATTEMPTS,
  };
}
