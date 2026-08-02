import { describe, expect, it } from "vitest";
import { chapters } from "@/supabase/seed";
import { parseInput } from "@/lib/learning/questionInput";

/**
 * The authored pictorial inputs, checked at test time.
 *
 * `parseInput` already protects the learner — a bad blob falls back to the text
 * field. But that fallback is silent by design, so without this the failure mode
 * is: an author makes a typo, the question quietly reverts to the keyboard this
 * slice exists to remove, and nobody finds out.
 */

const withInput = chapters.flatMap((chapter) =>
  chapter.questions.filter((q) => q.input).map((q) => [q.slug, q] as const),
);

const answerable = (bank: string[], answer: string) =>
  [...answer].every((character) => bank.includes(character));

describe("authored question input", () => {
  it("has at least one — otherwise this file is asleep", () => {
    expect(withInput.length).toBeGreaterThan(0);
  });

  it.each(withInput)("%s passes validation", (_slug, question) => {
    expect(parseInput(question.input)).not.toBeNull();
  });

  it.each(withInput)("%s is practice, never the quiz", (_slug, question) => {
    // The quiz is the assessment surface and stays plain (spec §10b). Authoring
    // an input on a quiz question would not even take effect — `toQuizQuestion`
    // hard-codes null — so this catches the mistake where it is made.
    expect(question.kind).toBe("practice");
  });

  it.each(withInput)("%s keeps its answer_value untouched by the input", (_slug, question) => {
    // This slice changes how an answer is ENTERED, never what it is. A question
    // that lost its canonical answer while gaining tiles has broken grading.
    expect(question.answer_value.trim().length).toBeGreaterThan(0);
  });

  // ── tiles ────────────────────────────────────────────────────────────────

  const tiled = withInput.filter(([, q]) => parseInput(q.input)?.kind === "tiles");

  it.each(tiled)("%s can actually build its own answer from its bank", (_slug, question) => {
    // The one bug that makes a question UNANSWERABLE. Everything else here is
    // quality; this is correctness.
    const spec = parseInput(question.input)!;
    if (spec.kind !== "tiles") return;
    expect(answerable(spec.bank, question.answer_value), `bank ${spec.bank.join(" ")}`).toBe(true);
  });

  it.each(tiled)("%s bank is not just the answer handed over", (_slug, question) => {
    // A bank containing exactly the answer's characters and nothing else is a
    // giveaway: tap everything, in order, and you are right. Distractors are
    // what make it a question.
    const spec = parseInput(question.input)!;
    if (spec.kind !== "tiles") return;
    const answerChars = new Set([...question.answer_value]);
    const extras = spec.bank.filter((tile) => !answerChars.has(tile));
    expect(extras.length, `bank ${spec.bank.join(" ")}`).toBeGreaterThan(0);
  });

  it.each(tiled)("%s has no tile that cannot appear in any answer", (_slug, question) => {
    // A stray "-" under an addition question is a tile that can only ever
    // produce a wrong answer. That happened: the first generator keyed the minus
    // tile off the STEM, and an em-dash in the prose put one there.
    const spec = parseInput(question.input)!;
    if (spec.kind !== "tiles") return;
    for (const tile of spec.bank) {
      expect(/^[0-9]$|^[/.-]$/.test(tile), `tile "${tile}"`).toBe(true);
      if (tile === "-") {
        expect(question.answer_value.includes("-"), "minus tile on a positive answer").toBe(true);
      }
      if (tile === "/") {
        expect(question.answer_type, "slash tile on a non-fraction").toBe("fraction");
      }
    }
  });

  // ── choiceViz ────────────────────────────────────────────────────────────

  const pictorial = withInput.filter(([, q]) => parseInput(q.input)?.kind === "choiceViz");

  it.each(pictorial)("%s offers its own answer as one of the options", (_slug, question) => {
    const spec = parseInput(question.input)!;
    if (spec.kind !== "choiceViz") return;
    expect(spec.options.map((o) => o.value)).toContain(question.answer_value);
  });

  it.each(pictorial)("%s has no two options with the same value", (_slug, question) => {
    // Two options carrying the same value means two correct answers, and the
    // learner is graded on which identical thing they happened to tap.
    const spec = parseInput(question.input)!;
    if (spec.kind !== "choiceViz") return;
    const values = spec.options.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
  });
});
