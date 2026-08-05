import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { dayQualified, daysMet, weekOfActivity } from "@/lib/learning/week";
import { PRACTICE_QUESTIONS_FOR_GOAL } from "@/lib/learning/dailyGoal";

/**
 * The week strip.
 *
 * The failure it guards is a screen contradicting itself: a filled square beside
 * a flame that did not move. The squares use the SAME rule as the streak (D7),
 * and these tests are what keep the two in agreement.
 */

const NOW = new Date("2026-08-05T12:00:00Z"); // 5:30pm IST on Wednesday 5 Aug

describe("dayQualified — the D7 rule", () => {
  it("counts one completed lesson", () => {
    expect(dayQualified(1, 0)).toBe(true);
  });

  it("counts five practice questions", () => {
    expect(dayQualified(0, PRACTICE_QUESTIONS_FOR_GOAL)).toBe(true);
  });

  it("does not count four practice questions", () => {
    expect(dayQualified(0, PRACTICE_QUESTIONS_FOR_GOAL - 1)).toBe(false);
  });

  it("does not count an empty day", () => {
    expect(dayQualified(0, 0)).toBe(false);
  });
});

describe("weekOfActivity", () => {
  it("returns seven days, oldest first, ending today", () => {
    const week = weekOfActivity([], [], NOW);
    expect(week).toHaveLength(7);
    expect(week.map((d) => d.date)).toEqual([
      "2026-07-30",
      "2026-07-31",
      "2026-08-01",
      "2026-08-02",
      "2026-08-03",
      "2026-08-04",
      "2026-08-05",
    ]);
    expect(week[6].isToday).toBe(true);
    expect(week.slice(0, 6).every((d) => !d.isToday)).toBe(true);
  });

  it("fills a day with one completed lesson", () => {
    const week = weekOfActivity(["2026-08-03T09:00:00Z"], [], NOW);
    expect(week.find((d) => d.date === "2026-08-03")?.met).toBe(true);
    expect(daysMet(week)).toBe(1);
  });

  it("needs five practice questions, not four", () => {
    const four = Array.from({ length: 4 }, () => "2026-08-03T09:00:00Z");
    expect(daysMet(weekOfActivity([], four, NOW))).toBe(0);

    const five = [...four, "2026-08-03T09:05:00Z"];
    expect(daysMet(weekOfActivity([], five, NOW))).toBe(1);
  });

  it("groups by IST, not UTC", () => {
    // 18:20Z is 23:50 IST on the 3rd; 18:40Z is 00:10 IST on the 4th. Grouping
    // by UTC would put both on the 3rd and leave the 4th empty — a learner who
    // studied late on two days would see one square.
    const week = weekOfActivity(["2026-08-03T18:20:00Z", "2026-08-03T18:40:00Z"], [], NOW);
    expect(week.find((d) => d.date === "2026-08-03")?.met).toBe(true);
    expect(week.find((d) => d.date === "2026-08-04")?.met).toBe(true);
    expect(daysMet(week)).toBe(2);
  });

  it("ignores activity older than the week", () => {
    expect(daysMet(weekOfActivity(["2026-07-20T09:00:00Z"], [], NOW))).toBe(0);
  });

  it("does not double-count two lessons on one day", () => {
    const week = weekOfActivity(["2026-08-03T09:00:00Z", "2026-08-03T15:00:00Z"], [], NOW);
    expect(daysMet(week)).toBe(1);
  });

  it("combines lessons and practice on the same day", () => {
    const week = weekOfActivity(["2026-08-05T06:00:00Z"], ["2026-08-05T07:00:00Z"], NOW);
    expect(daysMet(week)).toBe(1);
  });
});

/**
 * The rest day.
 *
 * Reported from a phone: the streak card read "3 day streak · Rest day used"
 * while the strip showed two ticks and a hole indistinguishable from any other
 * missed day. Nothing on screen accounted for the third day, so the two
 * elements appeared to contradict each other — the exact failure the rest of
 * this file exists to prevent, arriving through the one state that had no
 * representation.
 */
describe("weekOfActivity — the forgiven day", () => {
  it("marks the day the streak forgave", () => {
    const week = weekOfActivity([], [], NOW, "2026-08-03");
    const monday = week.find((d) => d.date === "2026-08-03")!;
    expect(monday.rested).toBe(true);
    expect(monday.met).toBe(false);
  });

  it("marks nothing when no grace has been spent", () => {
    const week = weekOfActivity([], [], NOW);
    expect(week.every((d) => !d.rested)).toBe(true);
  });

  it("marks nothing outside the seven days", () => {
    const week = weekOfActivity([], [], NOW, "2026-07-20");
    expect(week.every((d) => !d.rested)).toBe(true);
  });

  it("never marks a day that met the goal", () => {
    // Contradictory input on purpose: a qualifying day needed no forgiving, and
    // a square cannot be both. `met` wins.
    const week = weekOfActivity(["2026-08-03T10:00:00Z"], [], NOW, "2026-08-03");
    const monday = week.find((d) => d.date === "2026-08-03")!;
    expect(monday.met).toBe(true);
    expect(monday.rested).toBe(false);
  });

  it("does not count a rest day towards the week's total", () => {
    // "2 days this week" stays honest: a forgiven day is not a worked day.
    const week = weekOfActivity(["2026-08-05T10:00:00Z"], [], NOW, "2026-08-04");
    expect(daysMet(week)).toBe(1);
  });
});

/**
 * Every square keeps its weekday letter.
 *
 * The tick used to REPLACE it, so the only days a learner could not identify
 * were the days they had worked, and the row stopped reading as a week at all
 * (`W T F S ✓ M ✓`). Asserted against the component source because the letter
 * and the state must both be present — a component test would prove one render;
 * this proves the rule.
 */
describe("the week strip's squares", () => {
  it("renders the weekday letter unconditionally, not as the else-branch", () => {
    const source = readFileSync(
      join(__dirname, "..", "..", "components/learn/WeekStrip.tsx"),
      "utf8",
    );
    // The letter is its own element, outside any met/rested ternary.
    expect(source).toMatch(/<span className="leading-none">\{t\(`week\.\$\{weekday\}`/);
    // And the tick is decoration on top of it, never a substitute.
    expect(source).toMatch(/aria-hidden/);
  });
});
