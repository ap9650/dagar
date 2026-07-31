import { daysBetween, istDate } from "./dates";

/**
 * Streaks (D7).
 *
 * The **authoritative** computation lives in Postgres — `extend_streak` in
 * `0008_functions.sql` — because a streak is server-side truth and must move
 * inside the same request that records the activity. This file is the pure
 * mirror of that function, plus the display logic both learner screens need.
 *
 * **The two must not drift.** If the grace window or the gap rules change here,
 * change the SQL in the same commit, and vice versa. The point of the mirror is
 * that D7's edge cases — the grace day, the rolling 7, the 11pm/1am IST boundary
 * — can be tested exhaustively without a database, which is the difference
 * between "the streak logic is probably right" and knowing.
 *
 * D7:
 *   a day counts on >= 1 lesson completed OR >= 5 practice questions
 *   the day boundary is Asia/Kolkata, stored as a date, never a timestamp
 *   ONE grace day per rolling 7 — a single missed day does not reset
 */

/** One grace day per rolling **7 days**. */
export const GRACE_WINDOW_DAYS = 7;

export type Streak = {
  current: number;
  longest: number;
  /** IST date string, `YYYY-MM-DD`. Null before the learner's first active day. */
  lastActiveDate: string | null;
  /** The forgiven day, if a grace day has been spent. */
  graceUsedOn: string | null;
};

export const NO_STREAK: Streak = {
  current: 0,
  longest: 0,
  lastActiveDate: null,
  graceUsedOn: null,
};

/**
 * The streak after a qualifying day. A pure mirror of `extend_streak`.
 *
 * `date` is an IST date string and is the SERVER's idea of today. A client clock
 * cannot manufacture a streak here, because no caller passes a client-supplied
 * date — see the route handlers, which all use `istDate()`.
 *
 * Idempotent: calling twice for the same date returns the same streak, so a
 * second lesson on the same day does not extend it again.
 */
export function nextStreak(streak: Streak | null, date: string): Streak {
  if (!streak || streak.lastActiveDate === null) {
    return { current: 1, longest: Math.max(1, streak?.longest ?? 0), lastActiveDate: date, graceUsedOn: streak?.graceUsedOn ?? null };
  }

  // Already counted today.
  if (streak.lastActiveDate === date) return streak;

  const gap = daysBetween(streak.lastActiveDate, date);

  // Backdated call. Never rewind a streak — a late-arriving write from a phone
  // that was offline must not undo days the learner has since earned.
  if (gap < 0) return streak;

  let current: number;
  let graceUsedOn = streak.graceUsedOn;

  if (gap === 1) {
    current = streak.current + 1;
  } else if (gap === 2) {
    // Exactly one day missed. Spend the grace day if it is available.
    const graceAvailable =
      streak.graceUsedOn === null ||
      daysBetween(streak.graceUsedOn, date) >= GRACE_WINDOW_DAYS;

    if (graceAvailable) {
      current = streak.current + 1;
      graceUsedOn = shiftDate(date, -1); // the day that was forgiven
    } else {
      current = 1;
    }
  } else {
    current = 1; // two or more days missed
  }

  return {
    current,
    longest: Math.max(streak.longest, current),
    lastActiveDate: date,
    graceUsedOn,
  };
}

/** `date` shifted by n days, still as an IST date string. */
function shiftDate(date: string, days: number): string {
  const at = new Date(`${date}T00:00:00+05:30`);
  at.setUTCDate(at.getUTCDate() + days);
  return istDate(at);
}

export type StreakStatus = {
  /** What to SHOW. Zero once the stored streak has gone stale. */
  days: number;
  alive: boolean;
  /** A grace day is currently protecting the streak — a lighter flame, not a gap. */
  graceActive: boolean;
  longest: number;
};

/**
 * What the header and the progress screen display.
 *
 * ── WHY THE STORED NUMBER IS NOT ENOUGH ─────────────────────────────────────
 * `streaks.current` only changes when the learner is active. A learner who had a
 * 5-day streak and then disappeared for a fortnight still has `current = 5` in
 * the row, because nothing has run to knock it down — the recompute happens on
 * write, and there have been no writes.
 *
 * Rendering that stored 5 would tell them they have a streak they lost. So the
 * display asks how long ago the last active day was: today or yesterday means
 * the streak is live; two days ago means grace is still holding it; beyond that
 * it is over and the screen says "Start again today".
 * ────────────────────────────────────────────────────────────────────────────
 */
export function streakStatus(
  streak: Streak | null,
  today: string = istDate(),
): StreakStatus {
  if (!streak || streak.lastActiveDate === null) {
    return { days: 0, alive: false, graceActive: false, longest: streak?.longest ?? 0 };
  }

  const gap = daysBetween(streak.lastActiveDate, today);

  // A gap of 2 is the day the grace covers: the learner missed yesterday, and if
  // they return today the streak continues. Showing it as broken in the meantime
  // would be wrong AND discouraging on the one day encouragement matters most.
  const graceAvailable =
    streak.graceUsedOn === null ||
    daysBetween(streak.graceUsedOn, today) >= GRACE_WINDOW_DAYS;

  const alive = gap <= 1 || (gap === 2 && graceAvailable);

  return {
    days: alive ? streak.current : 0,
    alive,
    // The flame goes lighter when a grace day is what is holding the streak up —
    // either one was spent recently, or one is covering the gap right now.
    graceActive:
      alive &&
      (gap === 2 ||
        (streak.graceUsedOn !== null &&
          daysBetween(streak.graceUsedOn, today) < GRACE_WINDOW_DAYS)),
    longest: streak.longest,
  };
}

/** The database row shape, mapped to this module's type. */
export function fromRow(
  row: {
    current: number;
    longest: number;
    last_active_date: string | null;
    grace_used_on: string | null;
  } | null,
): Streak | null {
  if (!row) return null;
  return {
    current: row.current,
    longest: row.longest,
    lastActiveDate: row.last_active_date,
    graceUsedOn: row.grace_used_on,
  };
}
