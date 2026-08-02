import { describe, expect, it } from "vitest";
import { celebrationFor } from "@/lib/learning/celebration";

/**
 * The ranking is the whole module, so the tests are mostly about what does NOT
 * celebrate. That is the part a future change is likely to erode: adding a
 * celebration is easy and feels generous, and the reason each silence is here is
 * only visible in D17.
 */

describe("celebrationFor", () => {
  it("celebrates a milestone", () => {
    expect(celebrationFor({ milestonesEarned: ["first_lesson"], streak: 1 })).toEqual({
      kind: "milestone",
      codes: ["first_lesson"],
    });
  });

  it("carries every code earned in the same write", () => {
    // `award_milestones` can return two — finishing the last lesson of a chapter
    // whose concepts are all mastered earns chapter_complete AND chapter_mastered.
    const result = celebrationFor({
      milestonesEarned: ["chapter_complete", "chapter_mastered"],
    });
    expect(result).toEqual({
      kind: "milestone",
      codes: ["chapter_complete", "chapter_mastered"],
    });
  });

  it("celebrates the day when it is newly counted", () => {
    expect(celebrationFor({ dayCounted: true, streak: 3 })).toEqual({
      kind: "day",
      streak: 3,
    });
  });

  it("prefers the milestone over the day, never both", () => {
    // The day a milestone is earned is almost always the day the streak moved, by
    // the same action. Showing both reports one event twice.
    expect(
      celebrationFor({ milestonesEarned: ["streak_3"], dayCounted: true, streak: 3 }),
    ).toEqual({ kind: "milestone", codes: ["streak_3"] });
  });

  // ── the silences ─────────────────────────────────────────────────────────

  it("says nothing for a second lesson on a day already counted", () => {
    // The most common completion in the product, and deliberately quiet. A
    // celebration here would be XP by another name (D17 reject list).
    expect(celebrationFor({ milestonesEarned: [], dayCounted: false, streak: 4 })).toBeNull();
  });

  it("says nothing when the streak read failed", () => {
    // The routes swallow derived-state failures so the lesson stays complete. A
    // celebration built on the missing half would claim "0 days in a row".
    expect(celebrationFor({ dayCounted: true, streak: 0 })).toBeNull();
    expect(celebrationFor({ dayCounted: true })).toBeNull();
    expect(celebrationFor({ dayCounted: true, streak: null })).toBeNull();
  });

  it("says nothing for an empty response", () => {
    expect(celebrationFor({})).toBeNull();
  });

  it("treats nulls as absent rather than throwing", () => {
    // Every field is optional because the route can omit any of them. This runs on
    // the completion path; a throw here would break a finished lesson.
    expect(celebrationFor({ milestonesEarned: null, dayCounted: null, streak: null })).toBeNull();
  });

  it("celebrates the very first day, when there is no streak yet to speak of", () => {
    // streak === 1 is a real moment and the copy handles it separately — it must
    // not fall through to silence.
    expect(celebrationFor({ dayCounted: true, streak: 1 })).toEqual({ kind: "day", streak: 1 });
  });
});
