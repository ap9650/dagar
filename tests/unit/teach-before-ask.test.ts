import { describe, expect, it } from "vitest";
import { chapters } from "@/supabase/seed/index.ts";
import type { SeedChapter, SeedLesson, SeedQuestion } from "@/supabase/seed/types.ts";
import type { LessonStep } from "@/lib/learning/lessonSteps";

/**
 * **Nothing is asked before it has been taught.**
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE RULE, AND WHY IT IS A TEST AND NOT A GUIDELINE.
 *
 * A learner meeting a question about a word nobody has shown them does not
 * conclude the app is incomplete. They conclude they are stupid — and for a
 * child who is already behind, which is Dagar's entire audience, that is the
 * single most damaging thing this product can do. It costs nothing to prevent
 * and cannot be caught by reading, because the teaching usually exists
 * SOMEWHERE; it is just not where the learner is standing.
 *
 * Found by a real reading of the app: Class 8's first algebra lesson asked
 * "which of these is linear, in one variable?" at step 4, having never said what
 * linear meant — nor, in the steps, the word "equation". The definitions were in
 * `body_md`, which D18's step player replaces. An audit then found 18 of these
 * across four of the five chapters.
 *
 * The mechanism was uniform: chapters were authored as prose, steps were derived
 * from the prose, and the QUESTIONS carried over while the DEFINITIONS did not.
 * Class 6 Fractions had none, because it was authored steps-first.
 *
 * ── WHAT COUNTS AS TEACHING ─────────────────────────────────────────────────
 * Only what the learner actually sees, in the order they see it:
 *
 *   - `steps` when a lesson has them — `body_md` is NOT read, because the player
 *     hides it. This is the exact trap the whole class of bugs came through.
 *   - Earlier lessons in the same chapter, since a chapter is walked in order.
 *   - A question's own `solution_md` never counts. It is read AFTER answering,
 *     which is too late to be the reason you could answer.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Vocabulary a question may lean on.
 *
 * Deliberately maths words and not every noun. The test is about TERMS OF ART —
 * words that carry a definition a learner cannot guess from ordinary speech.
 * "Bundle" needs no lesson; "denominator" does.
 */
const TERMS = [
  // algebra
  "linear equation", "linear", "quadratic", "variable", "coefficient", "solution",
  "equation", "expression", "constant", "substitute",
  // data handling
  "pictograph", "bar graph", "tally", "frequency", "scale", "category", "axis", "data",
  // fractions
  "fraction", "numerator", "denominator", "equivalent", "simplest form",
  "improper", "mixed number", "number line", "common denominator",
  // integers and number play
  "integer", "negative", "positive", "opposite", "parity", "factor", "multiple",
  "prime", "magic square",
] as const;

const norm = (value: string | null | undefined) => (value ?? "").toLowerCase().replace(/\s+/g, " ");

/** Everything a step puts on screen, including the answer a reveal opens to. */
function stepText(step: LessonStep): string {
  const s = step as LessonStep & {
    md?: string;
    answer?: string | number;
    why?: string;
    options?: { label: string }[];
    lines?: string[];
  };
  return [
    s.md,
    typeof s.answer === "string" ? s.answer : "",
    s.why,
    ...(s.lines ?? []),
    ...(s.options ?? []).map((o) => o.label),
  ]
    .filter(Boolean)
    .join(" ");
}

/** What a step ASKS — the prompt and the options, never the explanation after. */
function askedByStep(step: LessonStep): string {
  const s = step as LessonStep & { md?: string; options?: { label: string }[] };
  return [s.md, ...(s.options ?? []).map((o) => o.label)].filter(Boolean).join(" ");
}

/** What a question asks. `solution_md` is excluded on purpose — see the header. */
function askedByQuestion(question: SeedQuestion): string {
  return [question.stem_md, ...(question.choices ?? []).map((c) => c.label)]
    .filter(Boolean)
    .join(" ");
}

function shownBy(lesson: SeedLesson): string {
  const steps = lesson.steps;
  return steps && steps.length > 0
    ? steps.map(stepText).join(" ")
    : // No steps means the prose IS what renders (D18's fallback).
      (lesson.body_md ?? "");
}

type Violation = { chapter: string; where: string; term: string };

/**
 * Walks a chapter the way a learner does and reports anything asked too early.
 *
 * Concepts in `order_index`, lessons in `order_index`, steps in array order —
 * so "taught" always means "taught BEFORE this point", never merely "present
 * somewhere in the chapter".
 */
function violationsIn(chapter: SeedChapter): Violation[] {
  const found: Violation[] = [];
  const concepts = [...chapter.concepts].sort((a, b) => a.order_index - b.order_index);
  const lessons = [...chapter.lessons].sort((a, b) => a.order_index - b.order_index);

  let seen = "";

  for (const concept of concepts) {
    for (const lesson of lessons.filter((l) => l.concept_slug === concept.slug)) {
      // A `tap` inside a lesson is a question too, and is checked against what
      // came before it IN THAT LESSON — not against the lesson as a whole.
      const steps = lesson.steps ?? [];
      let before = seen;
      for (const [index, step] of steps.entries()) {
        if (step.kind === "tap") {
          const asked = norm(askedByStep(step));
          for (const term of TERMS) {
            if (asked.includes(term) && !norm(before).includes(term)) {
              found.push({
                chapter: chapter.title,
                where: `${lesson.title} · step ${index + 1}`,
                term,
              });
            }
          }
        }
        before += " " + stepText(step);
      }

      seen += " " + shownBy(lesson);
    }

    for (const question of chapter.questions.filter((q) => q.concept_slug === concept.slug)) {
      const asked = norm(askedByQuestion(question));
      for (const term of TERMS) {
        if (asked.includes(term) && !norm(seen).includes(term)) {
          found.push({
            chapter: chapter.title,
            where: `${question.kind} ${question.slug}`,
            term,
          });
        }
      }
    }
  }

  return found;
}

describe("nothing is asked before it is taught", () => {
  for (const chapter of chapters) {
    it(`${chapter.title} teaches every term it tests`, () => {
      const found = violationsIn(chapter);
      // The message is the finding: file, place and word, so a failure is
      // actionable without re-running an audit by hand.
      const report = found.map((v) => `  ${v.where} uses "${v.term}" before it is shown`).join("\n");
      expect(found, `\n${report}\n`).toEqual([]);
    });
  }
});
