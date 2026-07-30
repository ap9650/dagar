/**
 * The daily goal (D17).
 *
 * ONE RULE, SHARED WITH THE STREAK: a day counts when the learner completes
 * **1 micro-lesson OR 5 practice questions** (D7).
 *
 * That sharing is deliberate and worth protecting. If the ring and the flame used
 * different rules, a learner could close the ring and still lose their streak — the
 * app would be contradicting itself about whether they showed up today, which is
 * exactly the kind of thing that makes a struggling learner stop trusting it.
 *
 * The goal is also **closable in one session**. A goal a learner cannot finish on a
 * bad day is a daily reminder that they failed.
 */

export const LESSONS_FOR_GOAL = 1;
export const PRACTICE_QUESTIONS_FOR_GOAL = 5;

export type DailyGoal = {
  /** Progress toward the goal, 0…1. */
  fraction: number;
  complete: boolean;
  /** Which half of the OR the learner is closest to — decides what the ring counts. */
  track: "lesson" | "practice";
  /** For the label: "{done} of {total} done". */
  done: number;
  total: number;
};

/**
 * Today's goal state from today's activity.
 *
 * Pure: takes counts, returns state. The IST "today" window is applied by the
 * caller (see `lib/learning/dates.ts`) so this stays trivially testable.
 */
export function dailyGoal(
  lessonsCompletedToday: number,
  practiceAttemptsToday: number,
): DailyGoal {
  const complete =
    lessonsCompletedToday >= LESSONS_FOR_GOAL ||
    practiceAttemptsToday >= PRACTICE_QUESTIONS_FOR_GOAL;

  if (complete) {
    // Once it is closed, it stops asking. No second goal, no upsell to more (D17).
    return { fraction: 1, complete: true, track: "lesson", done: 1, total: 1 };
  }

  // Not complete, so lessonsCompletedToday is 0 and practice is under 5. Count the
  // practice questions — it is the only track with visible progress to show, and a
  // ring stuck at zero all the way until a lesson completes teaches the learner
  // nothing about how close they are.
  if (practiceAttemptsToday > 0) {
    return {
      fraction: practiceAttemptsToday / PRACTICE_QUESTIONS_FOR_GOAL,
      complete: false,
      track: "practice",
      done: practiceAttemptsToday,
      total: PRACTICE_QUESTIONS_FOR_GOAL,
    };
  }

  return { fraction: 0, complete: false, track: "lesson", done: 0, total: 1 };
}
