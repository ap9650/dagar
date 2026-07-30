import { describe, expect, it } from "vitest";
import { detectStruggle } from "@/lib/learning/struggle";
import { HINT_TIERS, methodHint } from "@/lib/learning/hints";

/**
 * D6 struggle detection, and the hint ladder that feeds rule 2.
 *
 * The cost of a false positive here is low — an inline card offering help, which
 * a learner dismisses. The cost of a false NEGATIVE is a learner quietly giving
 * up. So these tests lean on the triggers firing when they should.
 */

const wrong = (hints = 0) => ({ is_correct: false, hints_used: hints });
const right = (hints = 0) => ({ is_correct: true, hints_used: hints });

describe("rule 1 — three consecutive incorrect on one concept", () => {
  it("fires on exactly three in a row", () => {
    expect(detectStruggle([wrong(), wrong(), wrong()])).toBe("three_consecutive_incorrect");
  });

  it("does not fire on two", () => {
    expect(detectStruggle([wrong(), wrong()])).toBeNull();
  });

  it("needs them CONSECUTIVE — a correct answer in the middle resets it", () => {
    expect(detectStruggle([wrong(), right(), wrong(), wrong()])).toBeNull();
  });

  it("looks at the most recent three, not the first three", () => {
    // A learner who struggled at the start and has since recovered is not
    // struggling now, and must not be offered help as if they were.
    expect(detectStruggle([wrong(), wrong(), wrong(), right(), right()])).toBeNull();
  });

  it("fires on a fresh run after an earlier recovery", () => {
    expect(
      detectStruggle([right(), right(), wrong(), wrong(), wrong()]),
    ).toBe("three_consecutive_incorrect");
  });
});

describe("rule 2 — all hints exhausted, twice", () => {
  it("fires on two attempts that used every hint", () => {
    expect(detectStruggle([wrong(HINT_TIERS), right(HINT_TIERS)])).toBe(
      "hints_exhausted_twice",
    );
  });

  it("does not fire on one", () => {
    expect(detectStruggle([wrong(HINT_TIERS), right(0)])).toBeNull();
  });

  it("counts correct answers too", () => {
    // D6 says "attempts where all hints were exhausted" — it does not say wrong.
    // A learner who needs every hint to get there twice running is one a human
    // could help, even though both attempts scored.
    expect(detectStruggle([right(HINT_TIERS), right(HINT_TIERS)])).toBe(
      "hints_exhausted_twice",
    );
  });

  it("forgets hint exhaustion outside the recent window", () => {
    // Otherwise two hint-heavy attempts weeks apart trigger a mentor offer out of
    // nowhere, about a concept the learner has since got the hang of.
    const longAgo = [right(HINT_TIERS), right(0), right(0), right(0), right(0), right(0)];
    expect(detectStruggle([...longAgo, right(HINT_TIERS)])).toBeNull();
  });

  it("never fires when there are no hints to exhaust", () => {
    // Guards the `maxHints > 0` case: with zero tiers, every attempt trivially
    // satisfies `hints_used >= 0` and every learner would be flagged.
    expect(detectStruggle([wrong(0), right(0)], 0)).toBeNull();
  });

  it("follows the tier count rather than a hardcoded number", () => {
    // Slice 2.3 raises HINT_TIERS to 3. Rule 2 must follow it, not a literal 1.
    expect(detectStruggle([wrong(1), wrong(1)], 3)).toBeNull();
    expect(detectStruggle([wrong(3), wrong(3)], 3)).toBe("hints_exhausted_twice");
  });
});

describe("precedence and quiet cases", () => {
  it("prefers rule 1 when both apply", () => {
    // Three wrong in a row is someone stuck NOW; hint exhaustion may be someone
    // who leans on hints. The stronger signal names the trigger a mentor reads.
    expect(
      detectStruggle([wrong(HINT_TIERS), wrong(HINT_TIERS), wrong(HINT_TIERS)]),
    ).toBe("three_consecutive_incorrect");
  });

  it("stays quiet for a learner who is doing fine", () => {
    expect(detectStruggle([right(), right(), right(), wrong(), right()])).toBeNull();
  });

  it("stays quiet on no history at all", () => {
    expect(detectStruggle([])).toBeNull();
  });
});

describe("methodHint — tier 1", () => {
  it("takes the first paragraph, not the whole solution", () => {
    const solution = "First find $\\frac{1}{3}$ of ₹60.\n\n$$60 \\div 3 = 20$$\n\nSo ₹40 is left.";
    expect(methodHint(solution)).toBe("First find $\\frac{1}{3}$ of ₹60.");
  });

  it("returns nothing when the solution opens with display maths", () => {
    // "$$12 ÷ 4 = 3$$" as an opening hint just hands over the working. Better to
    // return nothing and let the caller fall through to the full solution.
    expect(methodHint("$$\n12 \\div 4 = 3\n$$\n\nSo Meera ate 3.")).toBe("");
  });

  it("survives an empty or malformed solution without throwing", () => {
    expect(methodHint("")).toBe("");
    expect(methodHint("   \n\n  ")).toBe("");
    expect(methodHint(undefined as unknown as string)).toBe("");
  });
});
