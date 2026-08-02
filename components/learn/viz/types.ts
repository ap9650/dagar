/**
 * The visual vocabulary of the curriculum (D18).
 *
 * Five parameterised shapes, instantiated ~60 times across three chapters —
 * **not forty-five drawings**. That is the whole reason this slice is a two-day
 * job rather than a three-week illustration commission, and it is why every new
 * shape has to earn its place in this union rather than being added casually.
 *
 * A `VizSpec` is authored as plain data in the seed files and stored in
 * `lessons.steps`, so it crosses a JSON boundary: it must stay serialisable, and
 * it must never contain prose. Prose is translated; a circle cut into four is a
 * circle cut into four in every language.
 */

/** Which way a part-whole is drawn. The maths is identical; the reading is not. */
export type PartWholeShape = "circle" | "bar" | "grid";

export type PartWholeSpec = {
  kind: "partWhole";
  shape: PartWholeShape;
  /** Total equal parts the whole is divided into. 1–12. */
  parts: number;
  /**
   * How many are filled. Either a count (the first `n`) or explicit indices,
   * which is what "shade the 2nd and 5th" needs.
   */
  shaded: number | number[];
  /**
   * A second, differently-marked selection drawn on the same whole — for
   * comparing 1/2 against 2/4 without two separate pictures.
   */
  compare?: number | number[];
  /** Drawn under the shape, e.g. "1/4". Notation only, never a sentence. */
  label?: string;
  /** Learner taps parts to fill them. Only one interactive viz per step. */
  interactive?: boolean;
  /** For `interactive`: the set that counts as done. */
  target?: number | number[];
};

export type NumberLineSpec = {
  kind: "numberLine";
  from: number;
  to: number;
  /** Distance between labelled ticks. Minor ticks come from `divisions`. */
  step: number;
  /** Unlabelled ticks between each labelled pair — how fractions get shown. */
  divisions?: number;
  /** Points to mark, with an optional label drawn above. */
  marks?: { at: number; label?: string; tone?: Tone }[];
  /** Arrows from → to, which is how integer addition is actually taught. */
  jumps?: { from: number; to: number; label?: string; tone?: Tone }[];
  interactive?: boolean;
  target?: number;
};

/**
 * Semantic colour, never a hex. `neutral` is the default fill; `correct` and
 * `notquite` exist so feedback states reuse the product's own palette — and so
 * a wrong answer is amber here too, never red.
 */
export type Tone = "neutral" | "correct" | "notquite" | "hint";

export type VizSpec = PartWholeSpec | NumberLineSpec;

/** Normalises `shaded: 3` and `shaded: [0,1,2]` to one shape for rendering. */
export function toIndexSet(value: number | number[] | undefined, parts: number): Set<number> {
  if (value === undefined) return new Set();
  if (Array.isArray(value)) return new Set(value.filter((i) => i >= 0 && i < parts));
  return new Set(Array.from({ length: Math.max(0, Math.min(value, parts)) }, (_, i) => i));
}

/** Same membership, ignoring order — what "did they shade the right parts" means. */
export function sameSet(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) if (!b.has(value)) return false;
  return true;
}
