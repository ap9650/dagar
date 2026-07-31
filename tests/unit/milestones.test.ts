import { describe, expect, it } from "vitest";
import enMessages from "@/messages/en.json";
import hiMessages from "@/messages/hi.json";
import {
  MILESTONE_CODES,
  earnedCount,
  milestoneGrid,
} from "@/lib/learning/milestones";

/**
 * Milestones (D7b).
 *
 * The awarding itself is SQL — `award_milestones` — and its idempotency is the
 * `unique(student_id, code)` constraint, so it is proved against a live database
 * in the integration suite, not here. What this file guards is the catalogue: the
 * seven codes, that every one of them can actually be rendered in both languages,
 * and that the locked ones are shown alongside the earned ones.
 */

const D7B_CODES = [
  "first_lesson",
  "first_practice",
  "streak_3",
  "streak_7",
  "concept_mastered",
  "chapter_complete",
  "chapter_mastered",
];

describe("the milestone catalogue", () => {
  it("is exactly the seven codes in D7b", () => {
    // The database has these in a check constraint, the SQL function awards them,
    // and this list renders them. Three places, one list — if they drift, a badge
    // is earned that no screen can show.
    expect([...MILESTONE_CODES].sort()).toEqual([...D7B_CODES].sort());
  });

  it("has copy for every code in BOTH languages", () => {
    // A missing translation here renders a raw enum — a learner would see
    // `chapter_mastered` where the badge name should be.
    for (const code of MILESTONE_CODES) {
      expect(enMessages.milestone, `en missing ${code}`).toHaveProperty(code);
      expect(hiMessages.milestone, `hi missing ${code}`).toHaveProperty(code);
      expect((enMessages.milestone as Record<string, string>)[code].length).toBeGreaterThan(0);
      expect((hiMessages.milestone as Record<string, string>)[code].length).toBeGreaterThan(0);
    }
  });

  it("carries nothing competitive — no points, levels, XP or ranks (D17)", () => {
    // The audience is learners who are already behind. Ranking them against peers
    // works against the reason the product exists, so the absence is a product
    // decision worth a test rather than a comment.
    const copy = Object.values(enMessages.milestone as Record<string, string>)
      .join(" ")
      .toLowerCase();
    for (const banned of ["xp", "points", "level", "rank", "leaderboard", "lives", "hearts"]) {
      expect(copy).not.toContain(banned);
    }
  });
});

describe("milestoneGrid — earned and unearned together", () => {
  it("returns all seven for a learner who has earned none", () => {
    // The first-visit state (spec §8): a roadmap, not an empty page.
    const grid = milestoneGrid([]);
    expect(grid).toHaveLength(7);
    expect(grid.every((m) => !m.earned)).toBe(true);
    expect(earnedCount(grid)).toBe(0);
  });

  it("marks the earned ones and leaves the rest visible", () => {
    const grid = milestoneGrid([
      { code: "first_lesson", earned_at: "2026-08-01T10:00:00Z" },
      { code: "first_practice", earned_at: "2026-08-01T10:05:00Z" },
    ]);

    expect(grid).toHaveLength(7); // still seven — locked ones do not disappear
    expect(earnedCount(grid)).toBe(2);
    expect(grid.find((m) => m.code === "first_lesson")?.earned).toBe(true);
    expect(grid.find((m) => m.code === "chapter_mastered")?.earned).toBe(false);
  });

  it("keeps a stable order regardless of the order rows come back in", () => {
    const forwards = milestoneGrid([
      { code: "first_lesson", earned_at: "2026-08-01T10:00:00Z" },
      { code: "streak_7", earned_at: "2026-08-08T10:00:00Z" },
    ]);
    const backwards = milestoneGrid([
      { code: "streak_7", earned_at: "2026-08-08T10:00:00Z" },
      { code: "first_lesson", earned_at: "2026-08-01T10:00:00Z" },
    ]);
    expect(forwards.map((m) => m.code)).toEqual(backwards.map((m) => m.code));
  });

  it("ignores a code it has no name for", () => {
    // A future migration awarding a new badge must not put an untranslated enum
    // on a learner's screen before it has copy.
    const grid = milestoneGrid([
      { code: "first_lesson", earned_at: "2026-08-01T10:00:00Z" },
      { code: "some_future_badge", earned_at: "2026-08-02T10:00:00Z" },
    ]);
    expect(grid).toHaveLength(7);
    expect(grid.map((m) => m.code)).not.toContain("some_future_badge");
    expect(earnedCount(grid)).toBe(1);
  });

  it("never double-counts a duplicated row", () => {
    const grid = milestoneGrid([
      { code: "first_lesson", earned_at: "2026-08-01T10:00:00Z" },
      { code: "first_lesson", earned_at: "2026-08-01T10:00:00Z" },
    ]);
    expect(earnedCount(grid)).toBe(1);
  });
});
