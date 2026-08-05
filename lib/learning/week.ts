import { istDate } from "./dates";
import { PRACTICE_QUESTIONS_FOR_GOAL } from "./dailyGoal";

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
 * ── AND IT DOES NOT SHOW THE GRACE DAY ──────────────────────────────────────
 * D7 forgives one missed day per rolling week, so a learner can have an unfilled
 * square and an unbroken streak. That is not a contradiction, it is the grace
 * day working — and the streak card says so in words. Drawing a missed day as
 * filled would be the app lying about a day the learner knows they missed.
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
): WeekDay[] {
  const lessonsByDay = countByDay(lessonCompletedAt);
  const practiceByDay = countByDay(practiceAt);
  const today = istDate(now);

  const days: WeekDay[] = [];
  for (let back = 6; back >= 0; back--) {
    const at = new Date(now);
    at.setUTCDate(at.getUTCDate() - back);
    const date = istDate(at);
    days.push({
      date,
      met: dayQualified(lessonsByDay.get(date) ?? 0, practiceByDay.get(date) ?? 0),
      isToday: date === today,
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
