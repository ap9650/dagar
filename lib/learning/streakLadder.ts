import type { MilestoneCode } from "./milestones";

/**
 * The streak ladder — where a streak is going, not just how long it is.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * A streak that counts up forever is a NUMBER. A streak with a next rung is a
 * GOAL. That is the whole of this file.
 *
 * Before it, `streak_3` and `streak_7` were the only two habit milestones and
 * the second was the last one a learner would ever earn — day 8 onward had
 * nothing to aim at, which is the dead end the progress screen suffered from
 * everywhere. Now every rung names the one above it, and the celebration and
 * the invitation are the same moment: *"3 days in a row. Ready for 7?"*
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * The rungs, in order.
 *
 * ── HOW THESE NUMBERS WERE CHOSEN ───────────────────────────────────────────
 * Close together early, far apart later — the habit is fragile in week one and
 * robust by month three, so the encouragement should be dense exactly where the
 * quitting happens. Duolingo uses 7 / 30 / 100 / 365; we differ twice:
 *
 *   **3** — a learner who is already behind needs a first win sooner than a
 *   voluntary adult hobbyist does. Three days is the shortest span that is
 *   recognisably a habit rather than a coincidence.
 *
 *   **180** — without it, 100 to 365 is a 265-day stretch with nothing to aim
 *   at, which is the dead end this file exists to remove, reintroduced at the
 *   top of the ladder.
 *
 * ── AND WHY IT STOPS AT 365 ─────────────────────────────────────────────────
 * A learner in Class 6 is in Class 6 for a year; after that they are promoted
 * and the question changes. Every ladder in this product tops out at the edge of
 * the learner's horizon rather than inside it — for content that is a whole
 * class, for days it is a whole year. Reaching the top should mean "you finished
 * the year", never "you are 40% of the way through it".
 *
 * There is deliberately nothing beyond it. Repeating forever — a badge every
 * hundred days — is points with extra steps, and points are the one mechanic
 * D17 refuses because a second score competes with concept mastery, which is
 * the score that means something.
 */
export const STREAK_RUNGS = [3, 7, 14, 30, 100, 180, 365] as const;

export type StreakRung = (typeof STREAK_RUNGS)[number];

/** The milestone code a rung awards. Must match the check constraint in 0025. */
export function rungCode(rung: number): MilestoneCode {
  return `streak_${rung}` as MilestoneCode;
}

/** Is this number one of the rungs? */
export function isRung(days: number): days is StreakRung {
  return (STREAK_RUNGS as readonly number[]).includes(days);
}

/**
 * The rung a milestone code refers to, or null if it is not a streak milestone.
 *
 * Parsed rather than kept in a lookup table so a rung added to `STREAK_RUNGS`
 * needs no second edit here. Anything unrecognised returns null, which callers
 * treat as "an ordinary badge" — so a future non-streak code cannot accidentally
 * be read as a number.
 */
export function rungFromCode(code: string): StreakRung | null {
  const match = /^streak_(\d+)$/.exec(code);
  if (!match) return null;
  const days = Number(match[1]);
  return isRung(days) ? days : null;
}

/**
 * The rung a learner is heading for, or null once they have passed the last one.
 *
 * Null is a real answer and callers must handle it: a learner past 365 has
 * finished the ladder, and the honest thing to show them is their streak with
 * no invitation attached — not an invented target.
 */
export function nextRung(streak: number): StreakRung | null {
  return STREAK_RUNGS.find((rung) => rung > streak) ?? null;
}

/** The rung just reached, if this exact streak lands on one. */
export function reachedRung(streak: number): StreakRung | null {
  return isRung(streak) ? streak : null;
}

export type RungProgress = {
  /** The rung being aimed at. */
  next: StreakRung;
  /** The rung just below — 0 before the first one. The bar starts here, not at 0. */
  from: number;
  /** Days still to go. Always ≥ 1. */
  remaining: number;
  /** 0–1, for the bar. */
  fraction: number;
};

/**
 * How far along the current rung a learner is.
 *
 * ── THE BAR STARTS AT THE PREVIOUS RUNG, NOT AT ZERO ────────────────────────
 * A learner on day 31 heading for 100 is 1 day into a 70-day span, not 31% of
 * the way to 100. Measuring from zero would show a bar that barely moves for
 * weeks after a milestone — the reward for reaching 30 would be watching a
 * nearly-full bar reset to a third full, which reads as losing progress.
 *
 * Returns null once the ladder is finished, which is the same "no invitation"
 * case as `nextRung`.
 */
export function rungProgress(streak: number): RungProgress | null {
  const next = nextRung(streak);
  if (next === null) return null;

  const index = STREAK_RUNGS.indexOf(next);
  const from = index === 0 ? 0 : STREAK_RUNGS[index - 1];

  const span = next - from;
  const done = Math.max(0, streak - from);

  return {
    next,
    from,
    remaining: next - streak,
    fraction: Math.min(1, done / span),
  };
}

/**
 * Is the learner one day away from a rung?
 *
 * The trigger for the evening reminder (D17b): "one more day and you reach a
 * 7-day streak" is the only nudge that carries information the learner does not
 * already have. Everything else we could send is a reproach in a helpful voice.
 */
export function oneDayFromRung(streak: number): StreakRung | null {
  const next = nextRung(streak);
  return next !== null && next - streak === 1 ? next : null;
}
