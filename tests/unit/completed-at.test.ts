import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * **`completed_at` is the day a learner finished a lesson, and it never moves.**
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE BUG THIS EXISTS TO PREVENT, WHICH WAS SHIPPED FOR A DAY.
 *
 * Making finished lessons revisitable (5 Aug) left the completion route writing
 * `completed_at = now()` BEFORE it checked whether the lesson was already done.
 * So rereading a lesson moved the date it was finished to today, and then the
 * route returned early — skipping the streak, the event and the milestones.
 *
 * Reported from a phone as **"2 days this week, but a 1 day streak"**, which is
 * exactly how it looks from outside: the app disagreeing with itself. Confirmed
 * in the database — a `lesson_progress` row dated that morning, with zero
 * `lesson_completed` and zero `streak_extended` events to go with it.
 *
 * It is not a cosmetic date. FOUR things read `completed_at` to mean "work done
 * today", and every one of them was wrong for that learner:
 *
 *   · the week strip       lit a square on a day with no new work
 *   · the daily goal ring  closed a goal nobody had earned
 *   · the reminder cron    suppressed both nudges for the day
 *   · the parent summary   counted a reread as a lesson
 *
 * while the streak — a stored counter, correctly left alone — did not move.
 *
 * Revisiting is not a lesser completion. It is not a completion at all.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const ROOT = join(__dirname, "..", "..");
const source = readFileSync(join(ROOT, "app/api/lessons/[id]/complete/route.ts"), "utf8");

describe("finishing a lesson a second time", () => {
  it("returns before anything is written", () => {
    // Order is the whole fix: the early return must come first in the file, so
    // a reread cannot reach the write at all.
    const guard = source.indexOf("if (alreadyComplete)");
    const write = source.indexOf('.from("lesson_progress").upsert');

    expect(guard).toBeGreaterThan(-1);
    expect(write).toBeGreaterThan(-1);
    expect(
      guard,
      "the alreadyComplete return must come BEFORE the upsert, or a reread restamps completed_at",
    ).toBeLessThan(write);
  });

  it("writes completed_at exactly once in the file", () => {
    // A second write anywhere would be a second chance to move the date.
    const writes = source.match(/completed_at:/g) ?? [];
    expect(writes).toHaveLength(1);
  });

  it("still records the day when it IS a first completion", () => {
    // The other half. Not writing at all would be a worse bug than writing
    // twice — nothing downstream would ever see the work.
    expect(source).toContain('await track("lesson_completed"');
    expect(source).toContain("extend_streak");
  });
});
