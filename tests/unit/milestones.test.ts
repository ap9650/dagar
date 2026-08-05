import { readFileSync } from "node:fs";
import { join } from "node:path";
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
 * in the integration suite, not here. What this file guards is the catalogue —
 * that the app and the database agree on which codes exist, that every one can
 * be rendered in both languages, and that locked badges stay visible beside
 * earned ones.
 */

/**
 * The codes the DATABASE will accept, read out of the migration that defines
 * them.
 *
 * This used to be a hand-copied list of D7b's seven, which made it a fourth
 * place the catalogue lived rather than a check on the other three — and when
 * the streak ladder added five codes on 5 Aug 2026 it failed for being stale
 * rather than for finding anything. Reading the constraint means the test grows
 * with the catalogue and still fails for the reason it exists: a code the app
 * knows about that the database would reject, or the reverse.
 */
function codesAllowedByTheDatabase(): string[] {
  const sql = readFileSync(
    join(__dirname, "..", "..", "supabase/migrations/0025_streak_ladder.sql"),
    "utf8",
  );
  const constraint = /add constraint milestones_code_check check \(code in \(([\s\S]*?)\)\)/.exec(sql);
  if (!constraint) throw new Error("milestones_code_check not found in 0025");
  return [...constraint[1].matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]);
}

describe("the milestone catalogue", () => {
  it("matches the codes the database will accept", () => {
    // The database has these in a check constraint, the SQL function awards
    // them, and this list renders them. Three places, one list — if they drift,
    // a badge is either earned that no screen can show, or awarded into a
    // constraint violation that `award_milestones` swallows.
    expect([...MILESTONE_CODES].sort()).toEqual([...codesAllowedByTheDatabase()].sort());
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
  it("returns the whole catalogue for a learner who has earned none", () => {
    // The first-visit state (spec §8): a roadmap, not an empty page.
    const grid = milestoneGrid([]);
    expect(grid).toHaveLength(MILESTONE_CODES.length);
    expect(grid.every((m) => !m.earned)).toBe(true);
    expect(earnedCount(grid)).toBe(0);
  });

  it("marks the earned ones and leaves the rest visible", () => {
    const grid = milestoneGrid([
      { code: "first_lesson", earned_at: "2026-08-01T10:00:00Z" },
      { code: "first_practice", earned_at: "2026-08-01T10:05:00Z" },
    ]);

    // Still the whole catalogue — locked ones do not disappear.
    expect(grid).toHaveLength(MILESTONE_CODES.length);
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
    expect(grid).toHaveLength(MILESTONE_CODES.length);
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
