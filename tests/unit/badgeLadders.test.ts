import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BADGE_LADDERS,
  FIRST_CODES,
  ladderState,
  unknownRungCodes,
} from "@/lib/learning/badgeLadders";
import { MILESTONE_CODES } from "@/lib/learning/milestones";
import enMessages from "@/messages/en.json";
import hiMessages from "@/messages/hi.json";

/**
 * Badge ladders.
 *
 * Two silent failures to guard. A rung whose code the database rejects is
 * celebrated by the screen and never awarded — `award_milestones` swallows the
 * constraint violation. And a distance off by one tells a learner they are two
 * away from a badge they will earn tomorrow, which nothing anywhere errors on.
 */

const SQL = readFileSync(
  join(__dirname, "..", "..", "supabase/migrations/0027_badge_ladders.sql"),
  "utf8",
);

describe("the catalogue agrees with itself", () => {
  it("has no rung code the app does not know", () => {
    expect(unknownRungCodes()).toEqual([]);
  });

  it("has no milestone code that belongs to no group", () => {
    // The opposite direction: a code on the canonical list that appears in
    // neither a ladder nor the firsts would be earnable and unrenderable — it
    // would simply never appear on the progress screen.
    const placed = new Set<string>([
      ...BADGE_LADDERS.flatMap((l) => l.rungs.map((r) => r.code)),
      ...FIRST_CODES,
    ]);
    expect(MILESTONE_CODES.filter((code) => !placed.has(code))).toEqual([]);
  });

  it("has copy for every rung in BOTH languages", () => {
    for (const ladder of BADGE_LADDERS) {
      for (const rung of ladder.rungs) {
        expect(enMessages.milestone, `en missing ${rung.code}`).toHaveProperty(rung.code);
        expect(hiMessages.milestone, `hi missing ${rung.code}`).toHaveProperty(rung.code);
      }
      expect(enMessages.ladder, `en missing ${ladder.key}`).toHaveProperty(ladder.key);
      expect(hiMessages.ladder, `hi missing ${ladder.key}`).toHaveProperty(ladder.key);
    }
  });

  it("keeps rungs ascending", () => {
    for (const ladder of BADGE_LADDERS) {
      for (let i = 1; i < ladder.rungs.length; i++) {
        expect(ladder.rungs[i].at).toBeGreaterThan(ladder.rungs[i - 1].at);
      }
    }
  });

  it("tops out at the edge of the content, not inside it", () => {
    // Four concepts a chapter and roughly ten chapters a class means ~40 ideas
    // IS a class. A first draft stopped at 20, which a learner reaches halfway
    // through Class 6 — a dead end inside the product, which is the exact thing
    // ladders exist to prevent.
    const top = (key: string) =>
      BADGE_LADDERS.find((l) => l.key === key)!.rungs.at(-1)!.at;
    expect(top("ideas")).toBe(40);
    expect(top("chapters")).toBe(10);
    expect(top("coming_back")).toBe(365);
  });
});

describe("the SQL mirror", () => {
  // `award_milestones` loops over hard-coded arrays because the award has to
  // happen inside the write that earned it. Those arrays and BADGE_LADDERS are
  // the same lists written twice — add a rung to one and the badge is drawn by
  // the UI and never actually given.
  const arrayIn = (marker: string) => {
    const at = SQL.indexOf(marker);
    expect(at, `marker not found: ${marker}`).toBeGreaterThan(-1);
    const match = /foreach v_rung in array array\[([^\]]+)\]/.exec(SQL.slice(at));
    return match![1].split(",").map((n) => Number(n.trim()));
  };

  it("awards the same ideas rungs the app draws", () => {
    // Rung 1 keeps its legacy name `concept_mastered` and is awarded above the
    // loop, so the loop holds the rest.
    expect(arrayIn("the ideas-mastered ladder")).toEqual([5, 15, 40]);
  });

  it("awards the same chapters rungs the app draws", () => {
    expect(arrayIn("the chapters-finished ladder")).toEqual([3, 10]);
  });

  it("allows every rung's code in the check constraint", () => {
    for (const code of MILESTONE_CODES) {
      expect(SQL, `constraint missing ${code}`).toContain(`'${code}'`);
    }
  });

  it("excludes chapters with no lessons from the finished count", () => {
    // Without the guard an empty chapter counts as finished by vacuous truth,
    // and a placeholder chapter would award a badge for nothing.
    const section = SQL.slice(SQL.indexOf("the chapters-finished ladder"));
    expect(section).toContain("exists (select 1 from public.lessons l where l.chapter_id = c.id)");
  });
});

describe("ladderState", () => {
  const ideas = BADGE_LADDERS.find((l) => l.key === "ideas")!;

  it("names the next rung and the distance", () => {
    const state = ladderState(ideas, new Set(["concept_mastered"]), 6);
    expect(state.next).toEqual({ at: 15, code: "concepts_15", remaining: 9 });
  });

  it("points past a rung the moment it is reached", () => {
    // Standing exactly on 5 means the next thing to aim at is 15, not 5 again.
    expect(ladderState(ideas, new Set(), 5).next?.at).toBe(15);
  });

  it("points at the first rung for a learner with nothing", () => {
    const state = ladderState(ideas, new Set(), 0);
    expect(state.next).toEqual({ at: 1, code: "concept_mastered", remaining: 1 });
    expect(state.reached).toBe(0);
  });

  it("returns null once the ladder is finished", () => {
    // A learner at the top gets their count and no further ask. Inventing a
    // target beyond the ladder is the dead end this replaced, moved upward.
    expect(ladderState(ideas, new Set(), 40).next).toBeNull();
    expect(ladderState(ideas, new Set(), 99).next).toBeNull();
  });

  it("counts earned rungs from the badges, not from the live number", () => {
    // The two can legitimately disagree for a moment: a learner crosses 5 and
    // the badge is awarded on the NEXT write. Reading `reached` off the count
    // would light a rung the learner has not been given.
    const state = ladderState(ideas, new Set(["concept_mastered"]), 7);
    expect(state.reached).toBe(1);
    expect(state.rungs.find((r) => r.at === 5)?.earned).toBe(false);
  });

  it("marks every earned rung", () => {
    const state = ladderState(ideas, new Set(["concept_mastered", "concepts_5"]), 6);
    expect(state.rungs.map((r) => r.earned)).toEqual([true, true, false, false]);
  });

  it("never reports zero remaining", () => {
    for (let n = 0; n < 50; n++) {
      const state = ladderState(ideas, new Set(), n);
      if (state.next) expect(state.next.remaining).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("the one-shots", () => {
  it("keeps chapter_mastered off the chapters ladder", () => {
    // It measures DEPTH, not count. On the chapters ladder it would say that
    // mastering one chapter is the same achievement as finishing ten.
    const chapters = BADGE_LADDERS.find((l) => l.key === "chapters")!;
    expect(chapters.rungs.map((r) => r.code)).not.toContain("chapter_mastered");
    expect(FIRST_CODES).toContain("chapter_mastered");
  });
});
