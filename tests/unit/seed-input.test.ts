import { describe, expect, it } from "vitest";
import { chapters } from "@/supabase/seed";
import { barsFromValue, barsValue, parseInput } from "@/lib/learning/questionInput";
import { grade } from "@/lib/learning/grading";

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

  it.each(tiled)("%s uses only digits and answer symbols", (_slug, question) => {
    const spec = parseInput(question.input)!;
    if (spec.kind !== "tiles") return;
    for (const tile of spec.bank) {
      expect(/^[0-9]$|^[/.-]$/.test(tile), `tile "${tile}"`).toBe(true);
    }
  });

  /**
   * THE BANK MUST NOT LEAK THE SHAPE OF THE ANSWER.
   *
   * The first version of these banks added `/` only when the answer was a
   * fraction and `-` only when it was negative. Both are tells. In Class 6 the
   * slash quietly announced "this one is a fraction, not a whole number". In
   * Class 7 it would have been far worse: half the answers are negative, so a
   * minus tile would have announced the sign — and the sign is the entire
   * misconception that chapter exists to correct.
   *
   * So the symbol set is a property of the CHAPTER, not the question. A learner
   * must always be able to express the wrong form; that is what makes it a
   * question rather than a hint.
   *
   * This is asserted per chapter rather than per question because a single
   * question cannot be judged on its own — the leak only exists in the contrast
   * between one bank and its neighbours.
   */
  describe("a tile bank never reveals the form of its answer", () => {
    const byChapter = chapters.map(
      (chapter) =>
        [
          chapter.slug,
          chapter.questions
            .map((q) => parseInput(q.input))
            .filter((spec) => spec?.kind === "tiles"),
        ] as const,
    );

    it.each(byChapter.filter(([, specs]) => specs.length > 0))(
      "%s uses one symbol set across every bank",
      (_slug, specs) => {
        for (const symbol of ["/", "-"]) {
          const carrying = specs.filter(
            (spec) => spec!.kind === "tiles" && spec!.bank.includes(symbol),
          ).length;
          expect(
            carrying === 0 || carrying === specs.length,
            `"${symbol}" is on ${carrying} of ${specs.length} banks — that contrast is the leak`,
          ).toBe(true);
        }
      },
    );
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

/**
 * TWO OPTIONS THAT ARE MATHEMATICALLY EQUAL BOTH GRADE CORRECT.
 *
 * The check above only catches identical STRINGS. But `3/4` and `6/8` are
 * different strings and the same number, and D3 grades fractions by value — so
 * offering both would mean two right answers, with the learner graded on which
 * of two correct pictures they happened to tap.
 *
 * Nearly shipped: a distractor for "which picture shows 6/8?" was very nearly
 * the simplified `3/4`, which is the same fraction wearing different numbers.
 */
describe("no two pictorial options are the same number", () => {
  const asNumber = (value: string): number | null => {
    const fraction = value.match(/^(-?\d+)\/(\d+)$/);
    if (fraction) return Number(fraction[1]) / Number(fraction[2]);
    const plain = Number(value);
    return Number.isFinite(plain) ? plain : null;
  };

  const pictorial = chapters.flatMap((chapter) =>
    chapter.questions
      .map((q) => [q.slug, parseInput(q.input)] as const)
      .filter(([, spec]) => spec?.kind === "choiceViz"),
  );

  it("has pictorial questions to check", () => {
    expect(pictorial.length).toBeGreaterThan(0);
  });

  it.each(pictorial)("%s offers no two options of equal value", (_slug, spec) => {
    if (spec?.kind !== "choiceViz") return;
    const values = spec.options.map((o) => asNumber(o.value));
    for (let i = 0; i < values.length; i++) {
      for (let j = i + 1; j < values.length; j++) {
        if (values[i] === null || values[j] === null) continue;
        expect(
          values[i],
          `options ${i + 1} and ${j + 1} are both ${values[i]} — two correct answers`,
        ).not.toBe(values[j]);
      }
    }
  });
});

/**
 * A built bar graph that is right must GRADE right.
 *
 * `buildBars` is the first input kind whose value is a list, and it rides on
 * `answer_type: "expression"` — an exact string compare. That makes it the kind
 * most likely to mark a correct learner wrong over a formatting detail, which is
 * the highest-harm failure in the product (D3). So every authored question of
 * this kind is graded here against the exact string the component would submit.
 */
describe("buildBars answers survive the real grader", () => {
  const questions = chapters
    .flatMap((chapter) => chapter.questions)
    .filter((q) => (q.input as { kind?: string } | undefined)?.kind === "buildBars");

  it("has some to check", () => {
    expect(questions.length).toBeGreaterThan(0);
  });

  it("grades the component's own output as correct", () => {
    for (const question of questions) {
      const spec = parseInput(question.input) as { categories: string[] } | null;
      expect(spec, question.slug).not.toBeNull();

      // Exactly what BuildBarsInput submits when the bars are set correctly.
      const submitted = barsValue(barsFromValue(question.answer_value, spec!.categories.length));
      const correct = grade(question.answer_value, question.answer_type, submitted);
      expect(correct, `${question.slug}: submitted "${submitted}"`).toBe(true);
    }
  });

  it("has one height per bar, so the graph can actually be drawn", () => {
    for (const question of questions) {
      const spec = parseInput(question.input) as { categories: string[]; max: number } | null;
      const heights = question.answer_value.split(",");
      expect(heights.length, question.slug).toBe(spec!.categories.length);

      // And every one is reachable on the axis the learner is given. An answer
      // above `max` cannot be built at all — the learner is stuck, not wrong.
      for (const height of heights) {
        expect(Number(height), `${question.slug}: ${height} exceeds max`).toBeLessThanOrEqual(
          spec!.max,
        );
      }
    }
  });

  it("marks a wrong graph wrong", () => {
    // Guards against the list somehow grading everything correct.
    const question = questions[0];
    expect(grade(question.answer_value, question.answer_type, "1,1,1")).toBe(false);
  });
});
