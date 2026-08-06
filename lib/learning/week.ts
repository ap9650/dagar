import { istDate } from "./dates.ts";
import { PRACTICE_QUESTIONS_FOR_GOAL } from "./dailyGoal.ts";

/**
 * The last seven days, as seven squares.
 *
 * The smallest thing on the progress screen that changes daily — and the reason
 * it earns its place: every other element there reports a STATE, so a learner
 * who worked hard on Tuesday saw identical words on Wednesday. Seven squares
 * make yesterday visible.
 *
 * ── IT MUST AGREE WITH THE STREAK ───────────────────────────────────────────
 * A square is filled on exactly the rule that moves the streak (D7): one lesson
 * completed OR five practice questions. Not "any activity" — a learner who
 * opened a lesson and stopped would see a filled square beside a flame that had
 * not moved, and two elements on one screen contradicting each other is worse
 * than either being absent.
 *
 * ── THE GRACE DAY IS NAMED, NOT FILLED ──────────────────────────────────────
 * D7 forgives one missed day per rolling week, so a learner can have an unfilled
 * square and an unbroken streak. Drawing that day as filled would be the app
 * lying about a day the learner knows they missed — that part was always right.
 *
 * But leaving it identical to an ordinary gap was the other half of the problem,
 * and it was reported: the streak card said "3 day streak · rest day used" while
 * the strip showed two squares and a hole indistinguishable from any other. Two
 * elements on one screen appearing to contradict each other, which is exactly
 * what this file's other rule exists to prevent.
 *
 * So a forgiven day is marked AS a rest day — its own state, third of three.
 * That is not a lie: `streaks.grace_used_on` records precisely which date was
 * forgiven, so the square can say the true thing rather than nothing.
 */

/** A day counts on one completed lesson OR five practice questions (D7). */
export function dayQualified(lessons: number, practiceQuestions: number): boolean {
  return lessons >= 1 || practiceQuestions >= PRACTICE_QUESTIONS_FOR_GOAL;
}

export type WeekDay = {
  /** IST calendar date, `YYYY-MM-DD`. */
  date: string;
  /** Did this day meet the goal? */
  met: boolean;
  /** Today's square is outlined rather than empty — the day is not over yet. */
  isToday: boolean;
  /**
   * A day the streak forgave (D7). Never true at the same time as `met` — a day
   * that met the goal needed no forgiving.
   */
  rested: boolean;
};

/**
 * Seven days ending today, oldest first.
 *
 * A rolling seven rather than Monday-to-Sunday: a calendar week shows a learner
 * an almost-empty strip every Monday morning, which is the worst possible
 * moment to tell someone they have done nothing. Rolling means the strip always
 * reflects the effort actually behind them.
 *
 * Takes timestamps rather than dates so the IST conversion happens in exactly
 * one place — a caller grouping by UTC date would silently move every late
 * evening's work to the wrong square.
 */
export function weekOfActivity(
  lessonCompletedAt: readonly string[],
  practiceAt: readonly string[],
  now: Date = new Date(),
  /**
   * `streaks.grace_used_on` — the one date the streak forgave, or null.
   *
   * Callers pass it only while the streak is ALIVE. The column keeps its value
   * after a streak breaks, and calling a day "rest" on a screen that is telling
   * the learner to start again would be describing a streak that no longer
   * exists.
   */
  graceUsedOn: string | null = null,
): WeekDay[] {
  const lessonsByDay = countByDay(lessonCompletedAt);
  const practiceByDay = countByDay(practiceAt);
  const today = istDate(now);

  const days: WeekDay[] = [];
  for (let back = 6; back >= 0; back--) {
    const at = new Date(now);
    at.setUTCDate(at.getUTCDate() - back);
    const date = istDate(at);
    const met = dayQualified(lessonsByDay.get(date) ?? 0, practiceByDay.get(date) ?? 0);
    days.push({
      date,
      met,
      isToday: date === today,
      // `!met` guards the impossible-but-cheap case: a day that qualified was
      // never forgiven, and two states on one square would have to pick one.
      rested: !met && date === graceUsedOn,
    });
  }
  return days;
}

function countByDay(timestamps: readonly string[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const at of timestamps) {
    const day = istDate(new Date(at));
    out.set(day, (out.get(day) ?? 0) + 1);
  }
  return out;
}

/** How many of the seven met the goal. */
export function daysMet(week: readonly WeekDay[]): number {
  return week.filter((day) => day.met).length;
}
