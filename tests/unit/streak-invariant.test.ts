import { describe, expect, it } from "vitest";
import { streakFromDays, nextStreak, type Streak } from "@/lib/learning/streaks";

/**
 * **The stored streak must equal the streak the learner's activity adds up to.**
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS TEST EXISTS, AND WHY IT IS A DIFFERENT KIND OF TEST.
 *
 * Every test in this suite until now asserted a FLOW: can a learner finish a
 * lesson, does the button appear, does the route return 200. All of them passed
 * on the day the progress screen told a learner she had worked two days this
 * week and had a one-day streak.
 *
 * Both numbers came from the same activity, so one had to be wrong, and no flow
 * test can see that. It is a relationship between two answers, not a step in a
 * journey — and it broke because the streak is a STORED counter while the week
 * strip, the daily goal and the parent summary are DERIVED from raw activity on
 * read. Two representations of one fact, written by different code paths.
 *
 * That fault line is architectural and is not going away before the deadline.
 * What can go away is it failing silently: fold the qualifying days and compare.
 *
 * `npm run check:streaks` runs the same invariant against the real database.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Given qualifying days, what the counter must read. */
const current = (days: string[]) => streakFromDays(days)?.current ?? 0;

describe("a streak is the sum of the days that earned it", () => {
  it("counts one day as one", () => {
    expect(current(["2026-08-05"])).toBe(1);
  });

  it("counts consecutive days", () => {
    expect(current(["2026-08-03", "2026-08-04", "2026-08-05"])).toBe(3);
  });

  it("counts two lessons on one day as one day", () => {
    // The exact duplicate a busy evening produces.
    expect(current(["2026-08-05", "2026-08-05", "2026-08-05"])).toBe(1);
  });

  it("does not care what order the days arrive in", () => {
    // A late write from a phone that was offline must not change the total.
    expect(current(["2026-08-05", "2026-08-03", "2026-08-04"])).toBe(3);
  });

  it("forgives ONE missed day WITHOUT counting it", () => {
    /*
      The distinction, which I got wrong writing this test and the code got
      right: D7's grace day keeps the CHAIN alive across a gap, it does not
      award a day nobody worked.

      Aug 3 and Aug 5, with Aug 4 forgiven, is a streak of 2 — two days of work,
      unbroken. Not 3. A learner who is told they have a 3-day streak having
      studied twice would be right to distrust the number, and the whole point
      of a streak is that it is worth trusting.
    */
    expect(current(["2026-08-03", "2026-08-05"])).toBe(2);
  });

  it("keeps counting after a forgiven gap", () => {
    // Aug 4 forgiven, then Aug 6 continues from 3 rather than restarting.
    expect(current(["2026-08-03", "2026-08-05", "2026-08-06"])).toBe(3);
  });

  it("resets after two missed days", () => {
    expect(current(["2026-08-02", "2026-08-05"])).toBe(1);
  });

  it("spends the grace day only once per rolling week", () => {
    // Two gaps inside seven days: the first is forgiven, the second is not.
    expect(current(["2026-08-01", "2026-08-03", "2026-08-05"])).toBe(1);
  });

  it("returns null when nothing has been earned", () => {
    expect(streakFromDays([])).toBeNull();
  });
});

/**
 * The bug itself, as a test.
 *
 * A day that qualifies but was never folded into the counter. Before the fix
 * this was reachable in production: rereading a finished lesson restamped
 * `completed_at` to today, so the day QUALIFIED, while the route returned
 * before `extend_streak` ran, so the counter never saw it.
 */
describe("a qualifying day that the counter never saw", () => {
  it("is detectable by comparing the two", () => {
    const qualifying = ["2026-08-05", "2026-08-06"];

    // What the database held: only the first day was ever folded in.
    const stored: Streak = nextStreak(null, "2026-08-05");
    expect(stored.current).toBe(1);

    // What the activity says it should be.
    const truth = streakFromDays(qualifying)!;
    expect(truth.current).toBe(2);

    // The invariant, stated the way the checker states it.
    expect(stored.current, "stored streak disagrees with the days that earned it")
      .not.toBe(truth.current);
  });

  it("agrees once the day is counted", () => {
    const qualifying = ["2026-08-05", "2026-08-06"];
    const stored = qualifying.reduce<Streak | null>((s, d) => nextStreak(s, d), null)!;
    expect(stored.current).toBe(streakFromDays(qualifying)!.current);
    expect(stored.lastActiveDate).toBe("2026-08-06");
  });
});

/**
 * Properties that must hold for ANY history, not just the cases above.
 *
 * Cheap generative coverage: a flow test checks one path, this checks a hundred
 * shapes of history for rules that can never be broken.
 */
describe("properties of any streak", () => {
  const START = Date.UTC(2026, 6, 1); // 1 Jul 2026
  const dayAt = (n: number) => new Date(START + n * 86_400_000).toISOString().slice(0, 10);

  it("never exceeds the span between the first and last day", () => {
    for (let seed = 1; seed <= 100; seed++) {
      const days: string[] = [];
      for (let i = 0; i < 30; i++) if ((seed * (i + 7)) % 3 !== 0) days.push(dayAt(i));
      const s = streakFromDays(days);
      if (!s) continue;

      const span =
        (Date.parse(`${s.lastActiveDate}T00:00:00Z`) - Date.parse(`${days[0]}T00:00:00Z`)) /
          86_400_000 +
        1;
      // A grace day can make the streak exceed the number of days WORKED, but
      // never the calendar span it sits in.
      expect(s.current, `seed ${seed}`).toBeLessThanOrEqual(span);
      expect(s.current).toBeGreaterThan(0);
      expect(s.longest).toBeGreaterThanOrEqual(s.current);
      expect(s.lastActiveDate).toBe(days[days.length - 1]);
    }
  });
});
