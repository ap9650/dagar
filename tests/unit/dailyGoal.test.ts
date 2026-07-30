import { describe, expect, it } from "vitest";
import { dailyGoal } from "@/lib/learning/dailyGoal";
import { daysBetween, istDate, istDayStart } from "@/lib/learning/dates";

describe("dailyGoal", () => {
  it("is empty for a learner who has not started today", () => {
    expect(dailyGoal(0, 0)).toMatchObject({ fraction: 0, complete: false, done: 0 });
  });

  it("closes on one completed lesson", () => {
    expect(dailyGoal(1, 0)).toMatchObject({ fraction: 1, complete: true });
  });

  it("closes on five practice questions", () => {
    expect(dailyGoal(0, 5)).toMatchObject({ fraction: 1, complete: true });
  });

  it("shows partial progress on practice, so the ring is never stuck at zero", () => {
    expect(dailyGoal(0, 2)).toMatchObject({
      fraction: 0.4,
      complete: false,
      track: "practice",
      done: 2,
      total: 5,
    });
  });

  it("does not exceed 1 when the learner does far more than the goal", () => {
    // A ring rendered past 100% is a visual bug, and the copy switches to
    // "Done for today!" — it must not then claim 3 of 1.
    expect(dailyGoal(3, 40)).toMatchObject({ fraction: 1, complete: true, done: 1 });
  });

  it("treats the two tracks as OR, not AND", () => {
    expect(dailyGoal(1, 0).complete).toBe(true);
    expect(dailyGoal(0, 5).complete).toBe(true);
    expect(dailyGoal(0, 4).complete).toBe(false);
  });
});

describe("IST day boundary (D7)", () => {
  it("puts 23:50 IST and 00:10 IST on DIFFERENT dates", () => {
    // The whole reason dates.ts exists. In UTC both of these are 2026-07-30,
    // and a streak computed in UTC would silently fail to increment.
    const lateNight = new Date("2026-07-30T18:20:00Z"); // 23:50 IST on the 30th
    const afterMidnight = new Date("2026-07-30T18:40:00Z"); // 00:10 IST on the 31st

    expect(istDate(lateNight)).toBe("2026-07-30");
    expect(istDate(afterMidnight)).toBe("2026-07-31");
    expect(lateNight.toISOString().slice(0, 10)).toBe(
      afterMidnight.toISOString().slice(0, 10),
    );
  });

  it("puts 00:10 IST on the IST date, not the UTC one", () => {
    // 00:10 IST on 1 Aug is 18:40 UTC on 31 Jul — a naive UTC read loses a day.
    const justAfterMidnightIST = new Date("2026-07-31T18:40:00Z");
    expect(istDate(justAfterMidnightIST)).toBe("2026-08-01");
  });

  it("istDayStart is IST midnight, i.e. 18:30 UTC the previous day", () => {
    expect(istDayStart("2026-07-31").toISOString()).toBe("2026-07-30T18:30:00.000Z");
  });

  it("counts whole days between IST dates, including across a month end", () => {
    expect(daysBetween("2026-07-30", "2026-07-31")).toBe(1);
    expect(daysBetween("2026-07-31", "2026-08-01")).toBe(1);
    expect(daysBetween("2026-07-30", "2026-08-06")).toBe(7);
    expect(daysBetween("2026-07-31", "2026-07-30")).toBe(-1);
    expect(daysBetween("2026-07-30", "2026-07-30")).toBe(0);
  });
});
