import { describe, expect, it } from "vitest";
import { containsAnswer } from "@/lib/ai/prompts/hints";
import { costInr } from "@/lib/ai/pricing";

/**
 * The answer-leak guard, and the cost function that decides when the tutor
 * turns itself off. Both are small, both fail silently, and both are the kind
 * of thing nobody notices is wrong until it has been wrong for a week.
 */

/**
 * Coverage was measured against the real bank rather than reasoned about: of 73
 * non-MCQ seeded questions, the guard is **active on 65** and stands down on
 * **8** whose answer is printed in the stem — with no question falling through
 * both. The stand-down cases are fill-in-the-box questions where the helpful
 * hint and the answer are genuinely the same sentence.
 */
describe("containsAnswer — the hint leak guard", () => {
  it("catches the answer stated plainly", () => {
    expect(containsAnswer("The answer is 3.", "3")).toBe(true);
    expect(containsAnswer("So you get 3", "3")).toBe(true);
    expect(containsAnswer("3 goes in the box.", "3")).toBe(true);
  });

  it("catches a fraction answer", () => {
    expect(containsAnswer("This simplifies to 1/2.", "1/2")).toBe(true);
    expect(containsAnswer("You should reach 7/12 here", "7/12")).toBe(true);
  });

  it("catches a negative answer", () => {
    expect(containsAnswer("You end up with -7 on the left.", "-7")).toBe(true);
  });

  it("lets the answer's digits appear as part of the WORKING", () => {
    // The whole point. An answer of 3 legitimately shows up all over a hint
    // about thirds — rejecting those would gut the hint quality it protects.
    expect(containsAnswer("The denominator went from 3 to 9.", "27")).toBe(false);
    expect(containsAnswer("Look at $\\frac{1}{3}$ first.", "27")).toBe(false);
    expect(containsAnswer("There are 13 sweets in the packet.", "3")).toBe(false);
    expect(containsAnswer("Try multiplying by 30.", "3")).toBe(false);
  });

  it("does not treat a fraction's parts as the fraction", () => {
    expect(containsAnswer("Split it into 2 equal parts.", "1/2")).toBe(false);
  });

  it("never fires on a single-letter MCQ id", () => {
    // "a" and "b" occur in nearly every English sentence, and in Hindi hints
    // the ids appear nowhere at all. Checking them would reject every hint.
    expect(containsAnswer("Look at the bottom number of a fraction.", "a")).toBe(false);
    expect(containsAnswer("Both numbers must change.", "b")).toBe(false);
  });

  it("survives regex-special characters in the answer", () => {
    // `1/2` and `x+3` contain characters that would otherwise be operators and
    // could throw or match wildly.
    expect(() => containsAnswer("anything", "1/2")).not.toThrow();
    expect(() => containsAnswer("anything", "x+3")).not.toThrow();
    expect(() => containsAnswer("anything", "(")).not.toThrow();
    expect(containsAnswer("You get x+3 at this point.", "x+3")).toBe(true);
  });

  it("returns false rather than throwing on junk", () => {
    expect(containsAnswer("", "3")).toBe(false);
    expect(containsAnswer("some hint", "")).toBe(false);
    expect(containsAnswer("some hint", "   ")).toBe(false);
    expect(containsAnswer(null as unknown as string, "3")).toBe(false);
    expect(containsAnswer("some hint", null as unknown as string)).toBe(false);
  });

  it("stands down when the answer is already PRINTED in the question", () => {
    // Found by running all three tiers against `1/3 = □/9`, answer 3: every
    // hint was rejected, because 3 is in the question. A hint repeating a
    // number the learner is looking at reveals nothing — and the fallback it
    // was being replaced with contained the same 3 anyway.
    const stem = "$\\frac{1}{3} = \\frac{\\square}{9}$ — what goes in the box?";
    expect(containsAnswer("The denominator went 3 to 9, so do the same on top.", "3", stem)).toBe(
      false,
    );
  });

  it("still bites when the answer is NOT in the question", () => {
    // The case that matters. 12 and 1/4 are in the stem; 3 is not.
    const stem = "A bag has 12 laddoos. Meera eats $\\frac{1}{4}$ of them. How many?";
    expect(containsAnswer("Work it through and you get 3.", "3", stem)).toBe(true);
    expect(containsAnswer("Split the 12 into 4 equal groups.", "3", stem)).toBe(false);
  });

  it("catches a Hindi hint that leaks the answer", () => {
    // The guard compares against `answer_value`, which is never translated —
    // so it works identically whatever language the hint is written in.
    expect(containsAnswer("अंश के साथ भी यही करो, जवाब 3 है।", "3")).toBe(true);
    expect(containsAnswer("पहले हर को देखो।", "3")).toBe(false);
  });
});

describe("costInr — what the daily ceiling is counting", () => {
  const intro = new Date("2026-08-01T12:00:00+05:30");
  const standard = new Date("2026-09-15T12:00:00+05:30");

  it("prices an ordinary tutor exchange in paise, not rupees", () => {
    // A realistic exchange: a cached prefix, a short question, a short reply.
    const cost = costInr({
      model: "claude-sonnet-5",
      inputTokens: 200,
      outputTokens: 150,
      cacheReadTokens: 1800,
      at: intro,
    });
    // Well under the ₹7/week/learner cap in D11 — roughly 15 exchanges a week
    // has to fit inside it.
    expect(cost).toBeLessThan(0.5);
    expect(cost).toBeGreaterThan(0);
  });

  it("charges cache reads at a tenth of the input rate", () => {
    const cached = costInr({
      model: "claude-sonnet-5",
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 10_000,
      at: intro,
    });
    const uncached = costInr({
      model: "claude-sonnet-5",
      inputTokens: 10_000,
      outputTokens: 0,
      at: intro,
    });
    expect(cached).toBeCloseTo(uncached * 0.1, 6);
  });

  it("charges a cache WRITE at 1.25x input, not 1x", () => {
    // Counting the write as plain input under-reports every first turn by 25%.
    const write = costInr({
      model: "claude-sonnet-5",
      inputTokens: 0,
      outputTokens: 0,
      cacheWriteTokens: 10_000,
      at: intro,
    });
    const plain = costInr({
      model: "claude-sonnet-5",
      inputTokens: 10_000,
      outputTokens: 0,
      at: intro,
    });
    expect(write).toBeCloseTo(plain * 1.25, 6);
  });

  it("switches off introductory pricing after 31 Aug 2026", () => {
    // The rise lands DURING the pilot, not after it. A hardcoded intro rate
    // would silently under-count by 50% from September and the ₹150 ceiling
    // would stop stopping anything.
    const before = costInr({ model: "claude-sonnet-5", inputTokens: 1e6, outputTokens: 0, at: intro });
    const after = costInr({ model: "claude-sonnet-5", inputTokens: 1e6, outputTokens: 0, at: standard });
    expect(after).toBeCloseTo(before * 1.5, 4);
  });

  it("prices Haiku below Sonnet for the same work", () => {
    const haiku = costInr({ model: "claude-haiku-4-5", inputTokens: 1e6, outputTokens: 1e6, at: standard });
    const sonnet = costInr({ model: "claude-sonnet-5", inputTokens: 1e6, outputTokens: 1e6, at: standard });
    expect(haiku).toBeLessThan(sonnet);
  });

  it("is zero for zero tokens", () => {
    expect(costInr({ model: "claude-sonnet-5", inputTokens: 0, outputTokens: 0 })).toBe(0);
  });
});
