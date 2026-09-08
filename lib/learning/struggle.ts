/**
 * Struggle detection (D6).
 *
 * Surfaces the "Talk to a mentor" CTA when any of:
 *
 *   1. 3 consecutive incorrect attempts on the same concept
 *   2. 2 attempts on the same concept where all hints were exhausted
 *   3. >= 4 AI Tutor turns on one lesson with no practice attempt started
 *
 * Rules 1 and 2 are attempt-shaped and evaluated by the practice route; rule 3
 * is turn-shaped and evaluated by the tutor route. Both live here so the three
 * D6 triggers can be read in one place rather than inferred from two callers.
 *
 * Pure: takes attempt rows, returns a trigger or null. No database, no copy.
 *
 * WHAT THIS IS NOT: a diagnosis. The CTA it drives is an offer — "want a person to
 * explain this?" — never "you are struggling", never a modal, always dismissible
 * (D6, dagar-design § Mentor request CTA). Detection being right matters far less
 * than the tone of what it triggers.
 */

import { HINT_TIERS } from "./hints";

export type StruggleTrigger =
  | "three_consecutive_incorrect"
  | "hints_exhausted_twice"
  | "tutor_turns_no_practice";

export const CONSECUTIVE_INCORRECT = 3;
export const HINTS_EXHAUSTED_ATTEMPTS = 2;
/** D6 rule 3: this many tutor turns on one lesson with nothing attempted. */
export const TUTOR_TURNS_WITHOUT_PRACTICE = 4;

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

/**
 * D6 rule 3 — four or more tutor turns on one lesson with no practice attempted.
 *
 * The signal is a learner who keeps asking and never tries. That is a specific,
 * recognisable kind of stuck: they are engaged (they are still here, still
 * asking) but something is stopping them from attempting the maths, and more
 * explanation has already failed to move them. A person can find out what in a
 * minute; the tutor has had four goes.
 *
 * `practiceAttempts` is the learner's attempts **anywhere**, not just on this
 * concept. Someone who practises elsewhere in the app is not frozen — they are
 * reading carefully before starting, which is a good habit and not a trigger.
 */
export function detectTutorStruggle({
  tutorTurns,
  practiceAttempts,
}: {
  /** Learner turns in this lesson's tutor conversation. */
  tutorTurns: number;
  practiceAttempts: number;
}): StruggleTrigger | null {
  if (practiceAttempts > 0) return null;
  if (tutorTurns < TUTOR_TURNS_WITHOUT_PRACTICE) return null;
  return "tutor_turns_no_practice";
}
