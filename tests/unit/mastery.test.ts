import { describe, expect, it } from "vitest";
import { chapterMastery, computeMastery, masteryBand, quizBand } from "@/lib/learning/mastery";

/**
 * D5 mastery. The boundary cases are the point: 0.8 exactly, 3 attempts exactly,
 * and the window that must be 5 and not 6.
 *
 * This file also guards the thing a learner actually feels — that "0%" is never
 * shown to someone who has barely started.
 */

const T = true;
const F = false;

describe("computeMastery — the D5 formula", () => {
  it("is correct ÷ attempted", () => {
    expect(computeMastery([T, T, F, T]).score).toBe(0.75);
    expect(computeMastery([T, T, T, T]).score).toBe(1);
    expect(computeMastery([F, F, F]).score).toBe(0);
  });

  it("counts only the LAST 5 attempts", () => {
    // A learner who started badly and improved watches the early failures fall
    // out of the window. An all-time average would pin them below the line
    // forever, which is precisely what this product exists not to do.
    const history = [F, F, F, F, F, T, T, T, T, T];
    expect(computeMastery(history).score).toBe(1);
    expect(computeMastery(history).attempts).toBe(5);
  });

  it("rounds to 3dp, matching numeric(4,3) in the database", () => {
    // Without this, 2/3 is 0.6666666666666666 here and 0.667 there, and every
    // read looks like mastery has changed.
    expect(computeMastery([T, T, F]).score).toBe(0.667);
  });
});

describe("the mastered threshold — both conditions required", () => {
  it("is mastered at exactly 0.8 with exactly 3 attempts... ", () => {
    // 4 of 5 is 0.8 exactly. A `>` instead of `>=` here would deny mastery to a
    // learner who met the published bar.
    expect(computeMastery([T, T, T, T, F]).isMastered).toBe(true);
  });

  it("is mastered at 3 attempts all correct", () => {
    expect(computeMastery([T, T, T]).isMastered).toBe(true);
  });

  it("is NOT mastered below 0.8", () => {
    expect(computeMastery([T, T, T, F, F]).isMastered).toBe(false); // 0.6
  });

  it("is NOT mastered on fewer than 3 attempts, however good", () => {
    // Two lucky answers is not mastery. Both conditions, always.
    expect(computeMastery([T, T]).isMastered).toBe(false);
    expect(computeMastery([T]).isMastered).toBe(false);
  });

  it("can lose mastery — the window moves both ways", () => {
    expect(computeMastery([T, T, T, T, T]).isMastered).toBe(true);
    expect(computeMastery([T, T, T, T, T, F, F]).isMastered).toBe(false);
  });
});

describe("a learner who has barely started is never shown 0%", () => {
  it("reports hasEnoughData false below 3 attempts", () => {
    // "0% mastered" reads as failure. "Not enough practice yet" is the truth
    // (spec §8), and the UI branches on this flag to say so.
    expect(computeMastery([]).hasEnoughData).toBe(false);
    expect(computeMastery([F]).hasEnoughData).toBe(false);
    expect(computeMastery([T, T]).hasEnoughData).toBe(false);
  });

  it("reports hasEnoughData true from 3 attempts — the same bar the badge uses", () => {
    // If this were 5, a learner could see a "Mastered" badge sitting next to
    // "not enough practice yet". The two must agree.
    expect(computeMastery([T, T, T]).hasEnoughData).toBe(true);
    expect(computeMastery([T, T, T]).isMastered).toBe(true);
  });

  it("handles no attempts at all without dividing by zero", () => {
    expect(computeMastery([])).toMatchObject({ score: 0, attempts: 0, isMastered: false });
  });
});

describe("masteryBand — D5 quiz bands", () => {
  it("bands at <50 / 50–79 / >=80", () => {
    expect(masteryBand(0)).toBe("needs_revision");
    expect(masteryBand(0.49)).toBe("needs_revision");
    expect(masteryBand(0.5)).toBe("developing");
    expect(masteryBand(0.79)).toBe("developing");
    expect(masteryBand(0.8)).toBe("mastered");
    expect(masteryBand(1)).toBe("mastered");
  });

  it("agrees with isMastered at the boundary", () => {
    const atBoundary = computeMastery([T, T, T, T, F]);
    expect(atBoundary.score).toBe(0.8);
    expect(atBoundary.band).toBe("mastered");
    expect(atBoundary.isMastered).toBe(true);
  });

  it("can band 'mastered' while isMastered is false, on too few attempts", () => {
    // Not a contradiction — the band describes the score, the flag describes the
    // learner. Two correct answers score 100% and are not mastery, and the UI
    // must show the flag, not the band, for the badge.
    const twoCorrect = computeMastery([T, T]);
    expect(twoCorrect.band).toBe("mastered");
    expect(twoCorrect.isMastered).toBe(false);
  });
});

describe("chapterMastery — D5's percentage", () => {
  const concepts = ["a", "b", "c", "d"];

  it("is the share of the chapter's concepts that are mastered", () => {
    expect(chapterMastery(concepts, new Set(["a", "b"]))).toEqual({
      mastered: 2,
      total: 4,
      fraction: 0.5,
    });
  });

  it("counts ALL concepts, not just the attempted ones", () => {
    // The number that would flatter: one concept tried, one mastered, and a
    // progress screen reporting 100% of a chapter the learner has barely opened.
    expect(chapterMastery(concepts, new Set(["a"])).fraction).toBe(0.25);
  });

  it("ignores mastered concepts from other chapters", () => {
    // `masteredConceptIds` is the learner's whole set, across every chapter.
    expect(chapterMastery(concepts, new Set(["a", "z1", "z2"])).mastered).toBe(1);
  });

  it("is zero, not NaN, for a chapter with no concepts", () => {
    expect(chapterMastery([], new Set())).toEqual({ mastered: 0, total: 0, fraction: 0 });
  });
});

describe("quizBand — the band a learner is shown after a quiz", () => {
  it("bands the spec's exact examples: 49% revise, 50% developing, 80% mastered", () => {
    // chapter-quiz.md §5, stated as percentages, checked as the fractions a real
    // quiz actually produces.
    expect(quizBand(49, 100)).toBe("needs_revision");
    expect(quizBand(50, 100)).toBe("developing");
    expect(quizBand(79, 100)).toBe("developing");
    expect(quizBand(80, 100)).toBe("mastered");
  });

  it("bands the real 8-question chapter quiz", () => {
    // The set that exists today. 3/8 is 37.5%, 4/8 is 50%, 6/8 is 75%, 7/8 is 87.5%.
    expect(quizBand(0, 8)).toBe("needs_revision");
    expect(quizBand(3, 8)).toBe("needs_revision");
    expect(quizBand(4, 8)).toBe("developing");
    expect(quizBand(6, 8)).toBe("developing");
    expect(quizBand(7, 8)).toBe("mastered");
    expect(quizBand(8, 8)).toBe("mastered");
  });

  it("holds the 80% boundary on totals where floating point does not", () => {
    // The reason this is integer arithmetic rather than masteryBand(correct/total).
    // Every one of these is exactly 80% and every one must be Mastered — a single
    // ulp of division error here bands a learner down from Mastered on a quiz
    // they aced, and nothing would ever report it.
    for (const total of [5, 10, 15, 20, 25, 30, 35, 40, 45, 50]) {
      expect(quizBand((total * 4) / 5, total)).toBe("mastered");
    }
  });

  it("does not divide by zero on a quiz with no questions", () => {
    // Unreachable by design — the screen shows "coming soon" instead of a quiz of
    // zero questions (spec §6) — so this is about failing quietly if it ever is.
    expect(quizBand(0, 0)).toBe("needs_revision");
  });

  it("agrees with masteryBand wherever both are defined", () => {
    for (let correct = 0; correct <= 20; correct++) {
      expect(quizBand(correct, 20)).toBe(masteryBand(correct / 20));
    }
  });
});
