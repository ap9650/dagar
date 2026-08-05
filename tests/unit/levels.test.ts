import { describe, expect, it } from "vitest";
import {
  chapterLevel,
  conceptLevel,
  LEVELS,
  movedUp,
  worthCelebrating,
} from "@/lib/learning/levels";

/**
 * Levels.
 *
 * These thresholds decide what a learner is told about themselves and what the
 * diary announces. A disagreement of 0.01 between two copies of them would
 * announce moves that no screen ever showed — which is why there is now one
 * copy, and why it has tests.
 */

const row = (score: number, attempts: number, mastered = false) => ({
  score,
  attempts_count: attempts,
  is_mastered: mastered,
});

describe("conceptLevel", () => {
  it("is not_started with no row at all", () => {
    expect(conceptLevel(null)).toBe("not_started");
    expect(conceptLevel(undefined)).toBe("not_started");
  });

  it("is not_started with a row but no attempts", () => {
    // A concept nobody has touched must NOT read as 0%. "Not started" is a
    // state; 0% is a verdict, and this learner does not need one on day one.
    expect(conceptLevel(row(0, 0))).toBe("not_started");
  });

  it("follows the D5 thresholds", () => {
    expect(conceptLevel(row(0.2, 3))).toBe("practising");
    expect(conceptLevel(row(0.49, 3))).toBe("practising");
    expect(conceptLevel(row(0.5, 3))).toBe("getting_there");
    expect(conceptLevel(row(0.79, 4))).toBe("getting_there");
  });

  it("trusts is_mastered rather than re-deriving it", () => {
    // The database owns the mastery rule — score >= 0.8 AND >= 3 attempts.
    // Re-deriving it here would be a second copy that could disagree.
    expect(conceptLevel(row(0.8, 3, true))).toBe("mastered");
    // High score, too few attempts: the database says not mastered, so neither
    // does this.
    expect(conceptLevel(row(1, 2, false))).toBe("getting_there");
  });
});

describe("chapterLevel — the roll-up", () => {
  const base = { total: 4, mastered: 0, started: true, quizPassed: false };

  it("is not_started before anything is attempted", () => {
    expect(chapterLevel({ ...base, started: false })).toBe("not_started");
  });

  it("is not_started for a chapter with no concepts", () => {
    expect(chapterLevel({ ...base, total: 0 })).toBe("not_started");
  });

  it("climbs with the share of ideas mastered", () => {
    expect(chapterLevel({ ...base, mastered: 0 })).toBe("practising");
    expect(chapterLevel({ ...base, mastered: 1 })).toBe("practising");
    expect(chapterLevel({ ...base, mastered: 2 })).toBe("getting_there");
    expect(chapterLevel({ ...base, mastered: 3 })).toBe("getting_there");
  });

  it("needs the quiz for the top level, not just every idea", () => {
    // Khan Academy's rule. Without it a learner reaches the top by drilling one
    // concept's practice until the last five happen to be right — a five-answer
    // window makes the top level the cheapest thing on the screen.
    expect(chapterLevel({ ...base, mastered: 4, quizPassed: false })).toBe("getting_there");
    expect(chapterLevel({ ...base, mastered: 4, quizPassed: true })).toBe("mastered");
  });

  it("does not award the top level on a passed quiz alone", () => {
    expect(chapterLevel({ ...base, mastered: 2, quizPassed: true })).toBe("getting_there");
    expect(chapterLevel({ ...base, mastered: 0, quizPassed: true })).toBe("practising");
  });

  it("copes with more mastered than total", () => {
    // A concept removed from a chapter after a learner mastered it. Should not
    // produce a level below the top just because the arithmetic went odd.
    expect(chapterLevel({ ...base, total: 2, mastered: 3, quizPassed: true })).toBe("mastered");
  });
});

describe("movedUp and worthCelebrating", () => {
  it("knows the ladder order", () => {
    expect(movedUp("practising", "mastered")).toBe(true);
    expect(movedUp("mastered", "practising")).toBe(false);
    expect(movedUp("getting_there", "getting_there")).toBe(false);
  });

  it("celebrates a first move off not_started", () => {
    expect(worthCelebrating("not_started", "practising")).toBe(true);
  });

  it("never celebrates a fall", () => {
    // Mastery genuinely drops — the score is the last five attempts. The badge
    // shows that truth; the diary does not narrate it back to a child who is
    // already behind.
    expect(worthCelebrating("mastered", "getting_there")).toBe(false);
    expect(worthCelebrating("getting_there", "not_started")).toBe(false);
  });

  it("never celebrates arriving at not_started", () => {
    // Unreachable upward, but asserted so a future reordering of LEVELS cannot
    // make "you have un-started this concept" a celebration.
    for (const from of LEVELS) {
      expect(worthCelebrating(from, "not_started")).toBe(false);
    }
  });
});
