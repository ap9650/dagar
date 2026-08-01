import { describe, expect, it } from "vitest";
import { orderQuizQuestions } from "@/lib/learning/quizSet";

/**
 * Quiz ordering (option A of the repetitive-quiz fix).
 *
 * The bank is 8 questions and the quiz is all 8, so a retake cannot contain a
 * new question. The order is the only thing that can vary, and these tests pin
 * both halves of what it must do:
 *
 *   - vary between attempts, so a third retake is not a memory test
 *   - keep a concept's questions together, so a learner is never thrown
 *     between four topics and back
 *
 * The second is easy to lose. A future "simplification" to a plain shuffle would
 * still look random and would quietly undo a deliberate decision about how a
 * struggling learner experiences a quiz.
 */

type Q = { id: string; concept_id: string };

const bank: Q[] = [
  { id: "fb-1", concept_id: "fb" },
  { id: "fb-2", concept_id: "fb" },
  { id: "eqf-1", concept_id: "eqf" },
  { id: "eqf-2", concept_id: "eqf" },
  { id: "cmp-1", concept_id: "cmp" },
  { id: "cmp-2", concept_id: "cmp" },
  { id: "add-1", concept_id: "add" },
  { id: "add-2", concept_id: "add" },
];

/** Deterministic stand-in for Math.random, so these tests never flake. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

describe("orderQuizQuestions", () => {
  it("serves every question exactly once — nothing added, nothing dropped", () => {
    const ordered = orderQuizQuestions(bank, seeded(1));

    expect(ordered).toHaveLength(bank.length);
    expect([...ordered.map((q) => q.id)].sort()).toEqual([...bank.map((q) => q.id)].sort());
  });

  it("keeps each concept's questions contiguous", () => {
    // The property the old fixed order gave for free, and the reason this is not
    // a plain shuffle. A learner should meet one topic at a time.
    for (const seed of [1, 7, 42, 99, 12345]) {
      const concepts = orderQuizQuestions(bank, seeded(seed)).map((q) => q.concept_id);

      // Each concept id must appear in exactly one unbroken run.
      const runs = concepts.filter((c, i) => c !== concepts[i - 1]);
      expect(new Set(runs).size).toBe(runs.length);
    }
  });

  it("varies the order between attempts", () => {
    // The whole point: two attempts should not be the same test.
    const orders = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8].map((seed) =>
        orderQuizQuestions(bank, seeded(seed))
          .map((q) => q.id)
          .join(","),
      ),
    );

    expect(orders.size).toBeGreaterThan(1);
  });

  it("is deterministic for a given random source", () => {
    // Same source, same order — so a stored question_ids array can be trusted to
    // describe what was actually served.
    expect(orderQuizQuestions(bank, seeded(7))).toEqual(orderQuizQuestions(bank, seeded(7)));
  });

  it("handles a single concept, one question, and an empty bank", () => {
    const oneConcept = bank.filter((q) => q.concept_id === "fb");
    expect(orderQuizQuestions(oneConcept, seeded(3))).toHaveLength(2);

    expect(orderQuizQuestions([bank[0]], seeded(3))).toEqual([bank[0]]);
    expect(orderQuizQuestions([], seeded(3))).toEqual([]);
  });

  it("does not mutate the bank it was given", () => {
    const original = bank.map((q) => q.id);
    orderQuizQuestions(bank, seeded(5));
    expect(bank.map((q) => q.id)).toEqual(original);
  });
});
