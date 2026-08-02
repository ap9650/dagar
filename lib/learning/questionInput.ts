import { z } from "zod";
import { vizSchema } from "./lessonSteps";

/**
 * How a practice answer is ENTERED (D18, slice 5.2) — never how it is judged.
 *
 * ── the point, which is not "pictures" ──────────────────────────────────────
 * What transfers from Duolingo is that **you never type**. Typing is where a
 * learner's understanding gets lost in transit: into an Android number pad with
 * no `/` on it, and into a rounding decision nobody taught them. Both are real
 * defects reported from a real phone. A learner who assembles `5/12` from tiles
 * meets neither.
 *
 * ── every kind produces a STRING for the existing grader ────────────────────
 * `tiles` joins what was picked. `choiceViz` submits the chosen option's value.
 * `shade` reports `shaded/parts`. `place` reports the number tapped. All four
 * hand `lib/learning/grading.ts` exactly what the text field would have handed
 * it, through the same route. **That file is not touched by this slice** — it is
 * the highest-harm file in the product (D3), and a second grading path would be
 * the worst possible way to add pictures.
 *
 * That also means equivalence keeps working for free: a learner who shades 2 of
 * 4 parts submits `2/4`, and D3 already grades that correct against `1/2`.
 *
 * ── nothing here reveals the answer ─────────────────────────────────────────
 * A `choiceViz` option carries its value, exactly as today's MCQ `choices` carry
 * their labels: the client learns what the options ARE, never which one is right.
 * A `tiles` bank must carry distractors — a bank of exactly the answer's
 * characters is a giveaway, and `tests/unit/seed-input.test.ts` fails on one.
 *
 * ── same discipline as lessons.steps ────────────────────────────────────────
 * `parseInput` NEVER throws. Anything it cannot vouch for becomes `null` and the
 * caller renders today's text field or radios. A content typo costs the pictorial
 * version of one question; it never costs the question.
 */

/**
 * A bank of tiles to assemble an answer from.
 *
 * Order as authored is the order shown — the component does not shuffle. A
 * shuffle would make the same question feel different on a retry, and retries
 * are how a struggling learner gets to mastery (D5).
 */
const tiles = z.object({
  kind: z.literal("tiles"),
  /**
   * 3–10. Below 3 the answer is barely assembled; above 10 the bank wraps past
   * two rows on a 360px screen and the tiles drop under the 44px target.
   */
  bank: z.array(z.string().min(1).max(3)).min(3).max(10),
});

/** Pick between diagrams. The strongest kind for "which one shows 3/8?". */
const choiceViz = z.object({
  kind: z.literal("choiceViz"),
  options: z
    .array(
      z.object({
        /** Submitted and graded. Never translated (D16), like an MCQ choice id. */
        value: z.string().min(1).max(24),
        viz: vizSchema,
      }),
    )
    .min(2)
    .max(4),
});

/** Shade parts of a shape until it matches. Submits `shaded/parts`. */
const shade = z.object({
  kind: z.literal("shade"),
  shape: z.enum(["circle", "bar", "grid"]),
  /**
   * Capped at 8 for the touch target, not for the maths: an interactive circle
   * needs ≥44px per part, so 8 parts already means a ~200px circle.
   */
  parts: z.number().int().min(2).max(8),
});

/** Tap a position on a number line. Submits the number. */
const place = z.object({
  kind: z.literal("place"),
  from: z.number(),
  to: z.number(),
  step: z.number().positive(),
});

const input = z.discriminatedUnion("kind", [tiles, choiceViz, shade, place]);

export type QuestionInput = z.infer<typeof input>;
export type TilesInput = z.infer<typeof tiles>;
export type ChoiceVizInput = z.infer<typeof choiceViz>;
export type ShadeInput = z.infer<typeof shade>;
export type PlaceInput = z.infer<typeof place>;

/**
 * Validate an authored `questions.input` blob.
 *
 * Returns `null` for absent, malformed, or unrecognised input — all three mean
 * the same thing to the caller: render the control we have always rendered.
 */
export function parseInput(value: unknown): QuestionInput | null {
  if (value == null) return null;
  const result = input.safeParse(value);
  return result.success ? result.data : null;
}

/**
 * The string a `place` tap submits.
 *
 * Rounded to the line's own step, so a thumb landing at 2.03 on a step-1 line
 * submits `2` and not `2.03`. Without this the learner is graded on their aim.
 */
export function placedValue(spec: PlaceInput, at: number): string {
  const snapped = Math.round((at - spec.from) / spec.step) * spec.step + spec.from;
  const clamped = Math.min(Math.max(snapped, spec.from), spec.to);

  // Binary floating point turns 0.1 + 0.2 into 0.30000000000000004, and a
  // learner must never be marked wrong for our arithmetic. Round to the step's
  // own precision, then drop a trailing ".0".
  const decimals = decimalsIn(spec.step);
  return Number(clamped.toFixed(decimals)).toString();
}

function decimalsIn(step: number): number {
  const text = String(step);
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : text.length - dot - 1;
}

/**
 * The string a `shade` tap submits: how many parts are shaded, over how many
 * there are. Deliberately NOT reduced — `2/4` is what the learner did, and D3
 * already grades it correct against `1/2`. Reducing it here would hide their
 * actual answer from the attempt record and from the mentor context.
 */
export function shadedValue(spec: ShadeInput, shaded: number): string {
  return `${shaded}/${spec.parts}`;
}
