import { z } from "zod";

/**
 * The shape of a lesson step (D18), and the parser that refuses to trust one.
 *
 * ── WHY THIS VALIDATES AT ALL ───────────────────────────────────────────────
 * `lessons.steps` is authored by hand in a seed file and stored as jsonb, so it
 * arrives as `unknown` — a typo in a seed file is a runtime value, not a compile
 * error. And the failure mode matters: an unvalidated blob that throws while
 * rendering blanks the lesson entirely.
 *
 * So `parseSteps` never throws. Anything it cannot vouch for becomes `null`, and
 * the caller renders `body_md` instead. A content mistake costs the interactive
 * version of a lesson; it never costs the lesson.
 * ────────────────────────────────────────────────────────────────────────────
 */

const tone = z.enum(["neutral", "correct", "notquite", "hint"]);

const partWhole = z.object({
  kind: z.literal("partWhole"),
  shape: z.enum(["circle", "bar", "grid"]),
  parts: z.number().int().min(1).max(12),
  shaded: z.union([z.number().int(), z.array(z.number().int())]),
  compare: z.union([z.number().int(), z.array(z.number().int())]).optional(),
  label: z.string().optional(),
  interactive: z.boolean().optional(),
  target: z.union([z.number().int(), z.array(z.number().int())]).optional(),
});

const numberLine = z.object({
  kind: z.literal("numberLine"),
  from: z.number(),
  to: z.number(),
  step: z.number(),
  divisions: z.number().int().min(1).max(12).optional(),
  marks: z.array(z.object({ at: z.number(), label: z.string().optional(), tone: tone.optional() })).optional(),
  jumps: z
    .array(z.object({ from: z.number(), to: z.number(), label: z.string().optional(), tone: tone.optional() }))
    .optional(),
  interactive: z.boolean().optional(),
  target: z.number().optional(),
});

const viz = z.discriminatedUnion("kind", [partWhole, numberLine]);

/**
 * The prose on a step. Capped, not for storage reasons but because the content
 * contract says ≤25 words — and a limit that is only in a document is a limit
 * that drifts. 220 characters is roughly 35 words of English and leaves room for
 * Hindi, which runs 10–20% longer.
 */
const prose = z.string().min(1).max(220);

/** Read aloud instead of the prose, for steps whose prose is mostly notation. */
const speak = z.string().max(300).optional();

const seeStep = z.object({
  kind: z.literal("see"),
  md: prose,
  viz: viz.optional(),
  speak,
});

const buildStep = z.object({
  kind: z.literal("build"),
  md: prose,
  // Always a part-whole: "shade three quarters" has no meaning on a number line.
  viz: partWhole,
  speak,
});

const revealStep = z.object({
  kind: z.literal("reveal"),
  md: prose,
  answer: z.string().min(1).max(220),
  viz: viz.optional(),
  speak,
});

const tapStep = z.object({
  kind: z.literal("tap"),
  md: prose,
  options: z
    .array(z.object({ viz: viz.optional(), label: z.string().max(80).optional() }))
    .min(2)
    .max(4),
  answer: z.number().int().min(0),
  /** One line explaining why, shown after either outcome. Never a scolding. */
  why: z.string().max(220).optional(),
  speak,
});

const workedStep = z.object({
  kind: z.literal("worked"),
  md: prose,
  lines: z.array(z.string().min(1).max(220)).min(1).max(6),
  speak,
});

const step = z.discriminatedUnion("kind", [seeStep, buildStep, revealStep, tapStep, workedStep]);

/**
 * 3–12 steps. The content contract says 6–9; the schema is looser on purpose so
 * that a lesson slightly outside the guidance still renders and gets fixed by a
 * human reading it, rather than silently reverting to prose.
 */
export const lessonStepsSchema = z
  .array(step)
  .min(3)
  .max(12)
  // The answer index has to exist. Out of range means the "correct" option is
  // one that is not on screen, and every learner is told they are wrong.
  .superRefine((steps, ctx) => {
    steps.forEach((s, i) => {
      if (s.kind === "tap" && s.answer >= s.options.length) {
        ctx.addIssue({
          code: "custom",
          path: [i, "answer"],
          message: `answer ${s.answer} is out of range for ${s.options.length} options`,
        });
      }
    });
  });

export type LessonStep = z.infer<typeof step>;
export type SeeStep = z.infer<typeof seeStep>;
export type BuildStep = z.infer<typeof buildStep>;
export type RevealStep = z.infer<typeof revealStep>;
export type TapStep = z.infer<typeof tapStep>;
export type WorkedStep = z.infer<typeof workedStep>;

/**
 * Validate a `lessons.steps` value.
 *
 * Returns `null` for anything it cannot vouch for — including `null`, `[]`, and
 * a well-formed array with one bad step. Partial rendering is worse than none:
 * a lesson missing its third screen teaches a gap, and nobody notices.
 */
export function parseSteps(value: unknown): LessonStep[] | null {
  if (value == null) return null;
  const result = lessonStepsSchema.safeParse(value);
  if (result.success) return result.data;

  // Server-side only, and deliberately loud: this means a seeded lesson has
  // silently reverted to prose, which is exactly the kind of regression that
  // otherwise gets noticed weeks later by a learner and never reported.
  if (typeof window === "undefined") {
    console.error("[lessonSteps] invalid steps, falling back to body_md:", result.error.issues);
  }
  return null;
}

/**
 * The translatable text of one step, and nothing else.
 *
 * ── WHY HINDI IS NOT A SECOND STEPS ARRAY ───────────────────────────────────
 * A circle cut into four is a circle cut into four in every language. If the
 * Hindi lived as its own complete `steps` array, every diagram would be
 * duplicated by hand — and the day someone fixes a `parts: 4` typo in English
 * only, the Hindi lesson teaches different maths. Silently, and to the learners
 * least able to notice.
 *
 * So a translator writes prose, positionally, and `mergeStepText` puts it onto
 * the English structure. The diagram cannot drift because it exists once.
 * ────────────────────────────────────────────────────────────────────────────
 */
export type StepText = {
  md?: string;
  /** `reveal` only. */
  answer?: string;
  /** `tap` only — the one line of why, after either outcome. */
  why?: string;
  /** `worked` only, positional. */
  lines?: string[];
  /** `tap` only — option labels, positional. Diagram options have none. */
  options?: { label?: string }[];
  speak?: string;
};

/**
 * Apply translated prose to the English steps.
 *
 * Returns `null` on a length mismatch rather than translating what it can. A
 * half-translated lesson is worse than an English one: the learner hits an
 * English screen mid-flow with no way to tell whether they have missed
 * something, and `tContent` already falls back to English cleanly.
 *
 * Notation is never taken from the translation — `viz.label` holds things like
 * "1/4", which is the same in both languages (D16: numerals stay Arabic).
 */
export function mergeStepText(steps: LessonStep[], text: StepText[] | undefined): LessonStep[] | null {
  if (!text || text.length !== steps.length) return null;

  return steps.map((step, i) => {
    const tr = text[i] ?? {};
    const merged = { ...step, md: tr.md ?? step.md, speak: tr.speak ?? step.speak };

    switch (merged.kind) {
      case "reveal":
        return { ...merged, answer: tr.answer ?? merged.answer };
      case "worked":
        return {
          ...merged,
          lines: tr.lines?.length === merged.lines.length ? tr.lines : merged.lines,
        };
      case "tap":
        return {
          ...merged,
          why: tr.why ?? merged.why,
          options: merged.options.map((option, j) => ({
            ...option,
            // Only a text label is translatable; a diagram option has none.
            label: option.label === undefined ? undefined : (tr.options?.[j]?.label ?? option.label),
          })),
        };
      default:
        return merged;
    }
  });
}

/** How many steps count as "done" for the progress bar at index `i`. */
export function progressAt(index: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round(((index + 1) / total) * 100));
}
