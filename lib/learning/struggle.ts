/**
 * Struggle detection (D6).
 *
 * Surfaces the "Talk to a mentor" CTA when any of:
 *
 *   1. 3 consecutive incorrect attempts on the same concept
 *   2. 2 attempts on the same concept where all hints were exhausted
 *   3. >= 4 AI Tutor turns on one lesson with no practice attempt started
 *
 * Rules 1 and 2 live here — they are attempt-shaped and the practice route has
 * everything they need. **Rule 3 is evaluated in the tutor slice (2.3)**, where the
 * turn count exists; it is named in the type so the mentor request records which
 * trigger fired, and so the gap is visible rather than silently missing.
 *
 * Pure: takes attempt rows, returns a trigger or null. No database, no copy.
 *
 * WHAT THIS IS NOT: a diagnosis. The CTA it drives is an offer — "want a person to
 * explain this?" — never "you are struggling", never a modal, always dismissible
 * (D6, saathi-design § Mentor request CTA). Detection being right matters far less
 * than the tone of what it triggers.
 */

import { HINT_TIERS } from "./hints";

export type StruggleTrigger =
  | "three_consecutive_incorrect"
  | "hints_exhausted_twice"
  /** D6 rule 3. Detected in the tutor slice, not here. */
  | "tutor_turns_no_practice";

export const CONSECUTIVE_INCORRECT = 3;
export const HINTS_EXHAUSTED_ATTEMPTS = 2;

/**
 * How far back rule 2 looks. Deliberately short, and matched to the mastery
 * window: without it, two hint-exhausted attempts three weeks apart would trigger
 * a mentor offer out of nowhere, about a concept the learner has since got the
 * hang of.
 */
export const STRUGGLE_WINDOW = 5;

export type AttemptRef = {
  is_correct: boolean;
  hints_used: number;
};

/**
 * Evaluate D6 rules 1 and 2 against one concept's attempts.
 *
 * `attempts` is chronological, oldest first, and is for a SINGLE concept — both
 * rules are per-concept, and mixing concepts would fire on a learner who is doing
 * fine at each of three different things.
 *
 * Rule 1 is checked first because it is the stronger signal: three wrong in a row
 * is someone stuck now, where hint exhaustion may be someone who leans on hints.
 */
export function detectStruggle(
  attempts: readonly AttemptRef[],
  maxHints: number = HINT_TIERS,
): StruggleTrigger | null {
  // Rule 1 — the last three attempts, all incorrect.
  const lastThree = attempts.slice(-CONSECUTIVE_INCORRECT);
  if (
    lastThree.length === CONSECUTIVE_INCORRECT &&
    lastThree.every((attempt) => !attempt.is_correct)
  ) {
    return "three_consecutive_incorrect";
  }

  // Rule 2 — two attempts in the recent window that used every hint available.
  //
  // Correctness is deliberately NOT part of this test. D6 says "attempts where all
  // hints were exhausted", and a learner who needs every hint to reach the answer
  // twice running is one a human could help, even though both attempts scored.
  const exhausted = attempts
    .slice(-STRUGGLE_WINDOW)
    .filter((attempt) => attempt.hints_used >= maxHints).length;

  if (maxHints > 0 && exhausted >= HINTS_EXHAUSTED_ATTEMPTS) {
    return "hints_exhausted_twice";
  }

  return null;
}
