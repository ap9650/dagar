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

/**
 * Counters for integers: `+1` and `−1` chips.
 *
 * The one idea this exists for is the **zero pair** — a `+1` beside a `−1`
 * makes nothing, and that is why subtracting a negative leaves you better off.
 * Said in words it is a rule to memorise; shown as two chips cancelling it is
 * obvious.
 *
 * Positive is a filled chip, negative an outlined one, and each carries its own
 * sign glyph — so the two are told apart by fill AND by symbol, never by hue
 * alone (design rule 10). Deliberately not amber for negative: amber means
 * "not quite" everywhere else here, and a negative number is not a mistake.
 */
export type TokenRowSpec = {
  kind: "tokenRow";
  positive: number;
  negative: number;
  /** Draw matched +/− chips as a struck-through pair — the zero pair, visible. */
  pairing?: boolean;
  /** Wrap into rows of n: "three lots of four debts" for multiplication. */
  groupsOf?: number;
  /**
   * Unsigned counters — just *things*, with no `+` or `−` on them.
   *
   * Class 7 Ch 6 opens on parity, and parity is about a count of objects, not
   * about sign: seven students pair off into three pairs with one left over,
   * and that leftover IS oddness. Drawing them as `+1` chips would say
   * "positive seven", which is a different and irrelevant fact.
   *
   * With `groupsOf: 2` this is the whole even/odd picture: full rows mean even,
   * a stranded chip means odd.
   */
  plain?: boolean;
  label?: string;
};

/**
 * A small grid of numbers — Class 7 Ch 6 (Ganita Prakash, Number Play).
 *
 * Magic squares, and the grid-filling puzzles the chapter is built on. A blank
 * cell is the question: the learner works out what belongs there from the sums
 * that are already fixed.
 *
 * `showSums` is what makes it teachable rather than decorative. The magic
 * square's claim is that every row, every column and both diagonals total the
 * same — a claim you cannot check unless the totals are on screen next to the
 * grid they came from.
 */
export type NumberGridSpec = {
  kind: "numberGrid";
  /** 2–4 each way. Bigger stops being readable at 360px and stops being Class 7. */
  rows: number;
  cols: number;
  /** Row-major, length `rows × cols`. A cell with no value is drawn blank. */
  cells: { value?: number; tone?: Tone }[];
  /** Row and column totals, drawn outside the grid. */
  showSums?: boolean;
  label?: string;
};

/**
 * A pan balance — the mental model Class 8 is built on.
 *
 * Lesson 1 says it in words: *"An equation is a balance. Whatever is on the left
 * weighs exactly the same as whatever is on the right."* Every rule in the
 * chapter follows from it, including the one learners recite without believing:
 * whatever you do to one side, do to the other.
 *
 * Each pan holds `xs` boxes marked x, plus ONE weight labelled with the constant.
 *
 * A pile of unit blocks was tried first and does not survive contact with the
 * curriculum: `3x + 5 = 35` needs thirty-five of them. They overflowed the pan
 * and, capped, drew six — a picture that was simply untrue. One labelled weight
 * scales to any number and still reads as something with heft on a pan.
 */
export type BalanceScaleSpec = {
  kind: "balanceScale";
  left: { xs: number; n?: number };
  right: { xs: number; n?: number };
  /**
   * Level by default, because a written equation IS level — that is the claim
   * the `=` sign makes. Tilt only to show what taking from one side alone does.
   */
  tilt?: "left" | "right";
  label?: string;
};

/**
 * One set of counts, drawn three ways — Class 6 Ch 4 (Ganita Prakash).
 *
 * ── WHY ONE SPEC AND NOT THREE COMPONENTS ───────────────────────────────────
 * Tally marks, a pictograph and a bar graph are the SAME DATA at three levels
 * of abstraction, and the chapter's whole argument is that they are: you tally
 * because counting raw marks is hard, you draw a pictograph because a tally is
 * hard to compare, you draw a bar because a pictograph gets silly at scale.
 *
 * Authoring them as one spec with a `variant` means a lesson can show the same
 * five categories tallied, then pictured, then barred, and a learner sees the
 * translation rather than three unrelated pictures. It is also the same trick
 * `PartWhole` plays with circle/bar/grid, for the same reason.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * `label` on a category is a WORD, and words get translated — so categories
 * carry an index the Hindi seed can key against rather than the English text.
 */
export type ChartVariant = "bar" | "pictograph" | "tally";

export type ChartSpec = {
  kind: "chart";
  variant: ChartVariant;
  /** 2–6 categories. More than six stops fitting a 360px screen. */
  categories: { label: string; value: number; tone?: Tone }[];
  /**
   * Pictograph only: how many things one icon stands for. This is the single
   * most-missed idea in the chapter — a learner who reads the key as "one" gets
   * every question wrong — so it is required rather than defaulted.
   */
  each?: number;
  /** Bar only: axis top. Omit and it is computed from the tallest bar. */
  max?: number;
  /** Drawn under the chart. Notation or a short title, never a sentence. */
  label?: string;
  /** Bar only: learner drags each bar to height. One interactive viz per step. */
  interactive?: boolean;
  /** For `interactive`: the values that count as done. */
  target?: number[];
};

export type VizSpec =
  | PartWholeSpec
  | NumberLineSpec
  | TokenRowSpec
  | BalanceScaleSpec
  | ChartSpec
  | NumberGridSpec;

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
