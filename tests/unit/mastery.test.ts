import { describe, expect, it } from "vitest";
import { computeMastery, masteryBand } from "@/lib/learning/mastery";

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
