import { describe, expect, it } from "vitest";
import { NO_STREAK, nextStreak, streakStatus, type Streak } from "@/lib/learning/streaks";
import { istDate, daysBetween } from "@/lib/learning/dates";

/**
 * Streaks (D7).
 *
 * The spec names the bug that ships here: "a learner active at 11pm IST and again
 * at 1am IST has been active on two days, and UTC gets that wrong". That case is
 * tested first and explicitly.
 *
 * The rest is the grace day, which is the part with real arithmetic in it: one
 * missed day per rolling 7 is forgiven, two are not, and the grace becomes
 * available again after 7 days.
 */

const on = (current: number, lastActiveDate: string, graceUsedOn: string | null = null): Streak => ({
  current,
  longest: current,
  lastActiveDate,
  graceUsedOn,
});

describe("the IST day boundary — the bug the spec says will ship", () => {
  it("counts 11pm and 1am IST as two different days", () => {
    // 2026-08-01 23:50 IST is 18:20 UTC on the 1st.
    // 2026-08-02 01:10 IST is 19:40 UTC on the 1st — the SAME UTC date.
    const lateNight = new Date("2026-08-01T18:20:00Z");
    const afterMidnight = new Date("2026-08-01T19:40:00Z");

    expect(lateNight.toISOString().slice(0, 10)).toBe(afterMidnight.toISOString().slice(0, 10));

    // …and IST, correctly, does not.
    expect(istDate(lateNight)).toBe("2026-08-01");
    expect(istDate(afterMidnight)).toBe("2026-08-02");

    // So the streak moves. Under UTC it would have silently stalled: the learner
    // does everything right, the number does not change, and nothing errors.
    const after = nextStreak(on(3, istDate(lateNight)), istDate(afterMidnight));
    expect(after.current).toBe(4);
  });

  it("treats a lesson at 00:10 IST as belonging to the new day, not the old one", () => {
    const justAfterMidnight = new Date("2026-08-01T18:31:00Z"); // 00:01 IST on the 2nd
    expect(istDate(justAfterMidnight)).toBe("2026-08-02");
  });
});

describe("nextStreak — the D7 rules", () => {
  it("starts a streak at 1 for a learner with no row", () => {
    expect(nextStreak(null, "2026-08-01").current).toBe(1);
    expect(nextStreak(NO_STREAK, "2026-08-01").current).toBe(1);
  });

  it("increments on consecutive days", () => {
    let streak = nextStreak(null, "2026-08-01");
    streak = nextStreak(streak, "2026-08-02");
    streak = nextStreak(streak, "2026-08-03");
    expect(streak.current).toBe(3);
    expect(streak.longest).toBe(3);
  });

  it("is idempotent within a day — a second lesson does not extend it again", () => {
    // The acceptance criterion in the spec, and the reason `extend_streak` checks
    // `last_active_date = p_date` before anything else.
    const first = nextStreak(on(4, "2026-08-01"), "2026-08-02");
    const second = nextStreak(first, "2026-08-02");
    const third = nextStreak(second, "2026-08-02");
    expect(first.current).toBe(5);
    expect(second.current).toBe(5);
    expect(third.current).toBe(5);
  });

  it("never rewinds on a backdated write", () => {
    // A phone that was offline finally syncs an attempt from three days ago. That
    // must not undo the days the learner has earned since.
    const streak = on(6, "2026-08-05");
    expect(nextStreak(streak, "2026-08-02")).toEqual(streak);
  });

  it("keeps `longest` as a high-water mark when the streak resets", () => {
    const long = { current: 9, longest: 9, lastActiveDate: "2026-08-01", graceUsedOn: null };
    const afterBreak = nextStreak(long, "2026-08-20");
    expect(afterBreak.current).toBe(1);
    expect(afterBreak.longest).toBe(9); // the achievement stands
  });
});

describe("the grace day — one per rolling 7", () => {
  it("forgives ONE missed day and keeps the streak", () => {
    // Active the 1st, nothing the 2nd, back on the 3rd.
    const after = nextStreak(on(5, "2026-08-01"), "2026-08-03");
    expect(after.current).toBe(6);
    expect(after.graceUsedOn).toBe("2026-08-02"); // the day that was forgiven
  });

  it("does NOT forgive two missed days", () => {
    const after = nextStreak(on(5, "2026-08-01"), "2026-08-04");
    expect(after.current).toBe(1);
    expect(after.graceUsedOn).toBeNull(); // nothing was spent
  });

  it("refuses a second grace day inside the same rolling 7", () => {
    // Grace spent on the 2nd; miss another day on the 5th and return on the 6th.
    const after = nextStreak(on(6, "2026-08-04", "2026-08-02"), "2026-08-06");
    expect(after.current).toBe(1);
  });

  it("makes grace available again after 7 days", () => {
    // Grace spent on 2026-08-02. Returning on 2026-08-09 is exactly 7 days later.
    expect(daysBetween("2026-08-02", "2026-08-09")).toBe(7);
    const after = nextStreak(on(6, "2026-08-07", "2026-08-02"), "2026-08-09");
    expect(after.current).toBe(7); // forgiven again
    expect(after.graceUsedOn).toBe("2026-08-08");
  });

  it("is still unavailable at day 6", () => {
    // The boundary that matters: 6 days is inside the window, 7 is out.
    expect(daysBetween("2026-08-02", "2026-08-08")).toBe(6);
    const after = nextStreak(on(6, "2026-08-06", "2026-08-02"), "2026-08-08");
    expect(after.current).toBe(1);
  });

  it("survives a month boundary", () => {
    // Date arithmetic on strings is where this kind of code breaks.
    const after = nextStreak(on(4, "2026-07-31"), "2026-08-02");
    expect(after.current).toBe(5);
    expect(after.graceUsedOn).toBe("2026-08-01");
  });
});

describe("streakStatus — what the learner is shown", () => {
  it("shows the streak on the day it was earned and the day after", () => {
    expect(streakStatus(on(5, "2026-08-10"), "2026-08-10").days).toBe(5);
    expect(streakStatus(on(5, "2026-08-10"), "2026-08-11").days).toBe(5);
  });

  it("keeps showing it on the grace day, with the lighter flame", () => {
    // The learner missed yesterday. Coming back today still continues the streak,
    // so telling them it is broken would be both wrong and discouraging on the
    // one day encouragement matters most.
    const status = streakStatus(on(5, "2026-08-10"), "2026-08-12");
    expect(status.alive).toBe(true);
    expect(status.days).toBe(5);
    expect(status.graceActive).toBe(true);
  });

  it("shows zero once the streak is genuinely gone", () => {
    // The stored row still says 5 — nothing has run to knock it down, because the
    // recompute happens on write and there have been no writes. Rendering that 5
    // would tell a learner they have a streak they lost a fortnight ago.
    const status = streakStatus(on(5, "2026-08-10"), "2026-08-24");
    expect(status.alive).toBe(false);
    expect(status.days).toBe(0);
    expect(status.longest).toBe(5); // the best-ever line still stands
  });

  it("does not extend grace to someone who already spent it", () => {
    const status = streakStatus(on(5, "2026-08-10", "2026-08-08"), "2026-08-12");
    expect(status.alive).toBe(false);
  });

  it("is a clean zero for a learner who has never been active", () => {
    expect(streakStatus(null, "2026-08-10")).toEqual({
      days: 0,
      alive: false,
      graceActive: false,
      longest: 0,
    });
    expect(streakStatus(NO_STREAK, "2026-08-10").days).toBe(0);
  });
});

describe("the two halves agree", () => {
  it("a streak extended today is shown today", () => {
    // The bug this guards: `nextStreak` says the streak survived and
    // `streakStatus` says it is dead, so a learner watches their streak vanish
    // on the very screen that just extended it.
    const days = ["2026-08-01", "2026-08-03", "2026-08-04", "2026-08-05"];
    let streak: Streak | null = null;
    for (const day of days) {
      streak = nextStreak(streak, day);
      expect(streakStatus(streak, day).alive).toBe(true);
      expect(streakStatus(streak, day).days).toBe(streak.current);
    }
    expect(streak!.current).toBe(4);
  });
});
