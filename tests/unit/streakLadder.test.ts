import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isRung,
  nextRung,
  oneDayFromRung,
  reachedRung,
  rungCode,
  rungFromCode,
  rungProgress,
  STREAK_RUNGS,
} from "@/lib/learning/streakLadder";
import { MILESTONE_CODES } from "@/lib/learning/milestones";

/**
 * The streak ladder.
 *
 * The failure this guards is silent: an off-by-one in `remaining` tells a learner
 * they are two days from a badge they will reach tomorrow, and nothing anywhere
 * errors. Same for a bar that measures from zero — it looks fine and reports the
 * wrong thing every day between rungs.
 */

describe("the rungs", () => {
  it("are ascending with no duplicates", () => {
    for (let i = 1; i < STREAK_RUNGS.length; i++) {
      expect(STREAK_RUNGS[i]).toBeGreaterThan(STREAK_RUNGS[i - 1]);
    }
  });

  it("stop at a school year", () => {
    // The top rung sits at the edge of the learner's horizon, never inside it.
    // A learner in Class 6 is in Class 6 for a year; after that they move up.
    expect(STREAK_RUNGS[STREAK_RUNGS.length - 1]).toBe(365);
  });

  it("every rung has a milestone code on the canonical list", () => {
    // A rung whose code is not on the list awards nothing and celebrates
    // nothing — it would simply never fire, in silence.
    for (const rung of STREAK_RUNGS) {
      expect(MILESTONE_CODES).toContain(rungCode(rung));
    }
  });
});

describe("the SQL mirror", () => {
  // `award_milestones` loops over a hard-coded array of rungs, because the
  // award has to happen inside the write that earned it. That array and
  // STREAK_RUNGS are the same list written twice, which is exactly the shape of
  // a silent drift: add a rung here and the badge is celebrated by the UI and
  // never actually awarded.
  const sql = readFileSync(
    join(__dirname, "..", "..", "supabase/migrations/0025_streak_ladder.sql"),
    "utf8",
  );

  it("loops over the same rungs the app knows about", () => {
    const match = /foreach v_rung in array array\[([^\]]+)\]/.exec(sql);
    expect(match, "the rung loop was not found — did the migration change shape?").toBeTruthy();

    const inSql = match![1].split(",").map((n) => Number(n.trim()));
    expect(inSql).toEqual([...STREAK_RUNGS]);
  });

  it("allows every rung's code in the check constraint", () => {
    for (const rung of STREAK_RUNGS) {
      expect(sql).toContain(`'${rungCode(rung)}'`);
    }
  });
});

describe("nextRung", () => {
  it("points a new learner at the first rung", () => {
    expect(nextRung(0)).toBe(3);
    expect(nextRung(1)).toBe(3);
    expect(nextRung(2)).toBe(3);
  });

  it("points past a rung the moment it is reached", () => {
    // Standing ON 3 means the next thing to aim at is 7, not 3 again.
    expect(nextRung(3)).toBe(7);
    expect(nextRung(7)).toBe(14);
    expect(nextRung(180)).toBe(365);
  });

  it("returns null at and beyond the top", () => {
    expect(nextRung(365)).toBeNull();
    expect(nextRung(400)).toBeNull();
  });
});

describe("reachedRung", () => {
  it("fires only on the exact day", () => {
    expect(reachedRung(3)).toBe(3);
    expect(reachedRung(4)).toBeNull();
    expect(reachedRung(2)).toBeNull();
  });
});

describe("rungProgress — the bar between rungs", () => {
  it("measures from the previous rung, not from zero", () => {
    // THE bug this exists to prevent. Day 31 heading for 100 is 1 day into a
    // 70-day span. From zero it would read 31% — so earning the 30-day badge
    // would appear to collapse a nearly-full bar to a third full, which reads
    // as losing progress for doing the right thing.
    const p = rungProgress(31)!;
    expect(p.from).toBe(30);
    expect(p.next).toBe(100);
    expect(p.remaining).toBe(69);
    expect(p.fraction).toBeCloseTo(1 / 70, 5);
  });

  it("starts the first span at zero", () => {
    const p = rungProgress(1)!;
    expect(p.from).toBe(0);
    expect(p.next).toBe(3);
    expect(p.remaining).toBe(2);
    expect(p.fraction).toBeCloseTo(1 / 3, 5);
  });

  it("is empty, not full, on the day a rung is reached", () => {
    // Day 3 has just earned 3 and is now aiming at 7 — zero days into that span.
    const p = rungProgress(3)!;
    expect(p.next).toBe(7);
    expect(p.fraction).toBe(0);
    expect(p.remaining).toBe(4);
  });

  it("never reports zero days remaining", () => {
    // "0 more days to your badge" is a sentence that should never render — the
    // day it would be true, the rung has been reached and the celebration fires
    // instead.
    for (let days = 0; days < 365; days++) {
      const p = rungProgress(days);
      if (p) expect(p.remaining).toBeGreaterThanOrEqual(1);
    }
  });

  it("keeps the fraction inside 0..1 at every point on the ladder", () => {
    for (let days = 0; days <= 400; days++) {
      const p = rungProgress(days);
      if (!p) continue;
      expect(p.fraction).toBeGreaterThanOrEqual(0);
      expect(p.fraction).toBeLessThanOrEqual(1);
    }
  });

  it("returns null once the ladder is finished", () => {
    expect(rungProgress(365)).toBeNull();
    expect(rungProgress(500)).toBeNull();
  });
});

describe("rungFromCode", () => {
  it("reads a rung out of its code", () => {
    expect(rungFromCode("streak_3")).toBe(3);
    expect(rungFromCode("streak_365")).toBe(365);
  });

  it("returns null for an ordinary badge", () => {
    // These must read as "a normal badge", never as a number — the celebration
    // branches on it, and a misread would headline a chapter badge with a
    // streak invitation.
    expect(rungFromCode("first_lesson")).toBeNull();
    expect(rungFromCode("chapter_mastered")).toBeNull();
  });

  it("returns null for a streak-shaped code that is not a rung", () => {
    expect(rungFromCode("streak_5")).toBeNull();
    expect(rungFromCode("streak_")).toBeNull();
    expect(rungFromCode("streak_3x")).toBeNull();
  });

  it("round-trips every rung", () => {
    for (const rung of STREAK_RUNGS) {
      expect(rungFromCode(rungCode(rung))).toBe(rung);
    }
  });
});

describe("oneDayFromRung — the evening nudge trigger", () => {
  it("fires the day before a rung", () => {
    expect(oneDayFromRung(2)).toBe(3);
    expect(oneDayFromRung(6)).toBe(7);
    expect(oneDayFromRung(364)).toBe(365);
  });

  it("stays silent on every other day", () => {
    // The nudge is worth sending only when it carries information the learner
    // does not already have. Two days out, it is just a reminder they have.
    expect(oneDayFromRung(1)).toBeNull();
    expect(oneDayFromRung(3)).toBeNull();
    expect(oneDayFromRung(5)).toBeNull();
    expect(oneDayFromRung(365)).toBeNull();
  });
});

describe("isRung", () => {
  it("accepts the rungs and nothing else", () => {
    expect(isRung(3)).toBe(true);
    expect(isRung(365)).toBe(true);
    expect(isRung(4)).toBe(false);
    expect(isRung(0)).toBe(false);
    expect(isRung(-3)).toBe(false);
  });
});
