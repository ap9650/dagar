/**
 * ═══════════════════════════════════════════════════════════════════════════
 * GRADING (D3). The highest-stakes module in this product.
 *
 * A grading bug does not throw, does not log, and does not look like anything
 * from inside the app. It just tells a learner who was right that they were
 * wrong — and a learner who is already behind concludes they are bad at maths.
 * That is the most damaging thing Saathi can do, so this file is deterministic,
 * pure, and tested harder than anything else here.
 *
 * RULES THIS FILE MUST NEVER BREAK
 *   1. No I/O, no AI, no randomness. Same inputs, same answer, forever.
 *   2. No locale, and no import from any i18n module. `answer_value` is
 *      language-independent (D16), which is what keeps a translation error from
 *      ever being able to mark a correct learner wrong.
 *   3. Equivalent answers are correct. `2/4`, `1/2` and `0.5` all match `1/2` —
 *      a learner who writes 2/4 understood the maths.
 *   4. Sign errors stay wrong. `7` never matches `-7`.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export type AnswerType = "mcq" | "integer" | "fraction" | "decimal" | "expression";

export type GradeReason =
  | "match"
  | "mismatch"
  /** Blank. The caller must NOT write an attempt row — see the spec's edge cases. */
  | "empty"
  /** Understood the type but not the input: `१/२`, `abc`, `1/0`. */
  | "unparseable";

export type GradeResult = { correct: boolean; reason: GradeReason };

/** Longer than any legitimate answer to these questions. Bounds the work. */
const MAX_ANSWER_LENGTH = 200;

/** D3: decimals compare within this tolerance. */
const TOLERANCE = 1e-6;

// ─── safe numeric parsing ────────────────────────────────────────────────────
//
// `Number()` is NOT safe here and is never called directly on learner input:
//   Number("")      === 0   ← a blank answer would match an expected "0"
//   Number(" ")     === 0
//   Number("0x10")  === 16  ← hex is not an answer a learner meant to give
//   Number("1e3")   === 1000
//   Number("Infinity") === Infinity
// Devanagari digits do return NaN, but they are rejected explicitly rather than
// left to depend on that (i18n.md: answers are Arabic numerals).

const INTEGER_PATTERN = /^[+-]?\d+$/;
const DECIMAL_PATTERN = /^[+-]?(\d+\.?\d*|\.\d+)$/;
const FRACTION_PATTERN = /^([+-]?\d+)\s*\/\s*([+-]?\d+)$/;

/** Any digit that is not 0-9. Rejected rather than silently mis-graded. */
const NON_ARABIC_DIGIT = /[^\P{Nd}0-9]/u;

function normalise(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (raw.length > MAX_ANSWER_LENGTH) return null;

  const cleaned = raw
    .trim()
    // Learners paste from anywhere. A minus sign copied out of a PDF is often
    // U+2212, and an en-dash sometimes stands in for it.
    .replace(/[−–—]/g, "-")
    // Strip spaces INSIDE the number so "- 7" reads as "-7", and "1 / 2" as
    // "1/2". Spec: `- 7` must equal `-7`.
    .replace(/\s+/g, "");

  return cleaned;
}

function parseInteger(text: string): number | null {
  if (!INTEGER_PATTERN.test(text)) return null;
  const value = Number(text);
  return Number.isSafeInteger(value) ? value : null;
}

function parseDecimal(text: string): number | null {
  if (!DECIMAL_PATTERN.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

type Rational = { n: number; d: number };

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

/** Lowest terms, sign carried on the numerator. */
function reduce(n: number, d: number): Rational | null {
  if (d === 0) return null; // 1/0 is not an answer, it is a mistake
  const sign = d < 0 ? -1 : 1;
  const g = gcd(n, d);
  return { n: (sign * n) / g, d: (sign * d) / g };
}

/**
 * Accepts a fraction OR a decimal OR a whole number, because all three are
 * legitimate ways to write the same value. This is what makes `0.5` match `1/2`.
 */
function parseAsValue(text: string): { rational: Rational | null; value: number } | null {
  const fraction = text.match(FRACTION_PATTERN);
  if (fraction) {
    const n = parseInteger(fraction[1]);
    const d = parseInteger(fraction[2]);
    if (n === null || d === null) return null;
    const reduced = reduce(n, d);
    if (!reduced) return null;
    return { rational: reduced, value: reduced.n / reduced.d };
  }

  const decimal = parseDecimal(text);
  if (decimal === null) return null;
  return { rational: null, value: decimal };
}

// ─── expression ──────────────────────────────────────────────────────────────

/**
 * Deliberately modest (D3: "the small set used in Class 8 linear equations,
 * falls back to string compare").
 *
 * Class 8 answers are authored as the VALUE of x rather than as `x=4` precisely
 * so this path stays off the critical route. Anything cleverer here would be
 * risk without a question that needs it.
 */
function normaliseExpression(text: string): string {
  return text
    .toLowerCase()
    .replace(/\*/g, "")
    .replace(/[×]/g, "")
    .replace(/[{}[\]]/g, "");
}

function gradeExpression(expected: string, given: string): GradeResult {
  const a = normaliseExpression(expected);
  const b = normaliseExpression(given);
  if (a === b) return { correct: true, reason: "match" };

  // `x=4` and `x=4.0` are the same answer. Compare the right-hand sides
  // numerically when both look like `something=number`.
  const split = (text: string) => {
    const parts = text.split("=");
    return parts.length === 2 ? { left: parts[0], right: parts[1] } : null;
  };
  const left = split(a);
  const right = split(b);

  if (left && right && left.left === right.left) {
    const expectedValue = parseAsValue(left.right);
    const givenValue = parseAsValue(right.right);
    if (expectedValue && givenValue) {
      return {
        correct: Math.abs(expectedValue.value - givenValue.value) <= TOLERANCE,
        reason: Math.abs(expectedValue.value - givenValue.value) <= TOLERANCE
          ? "match"
          : "mismatch",
      };
    }
  }

  return { correct: false, reason: "mismatch" };
}

// ─── the entry points ────────────────────────────────────────────────────────

/**
 * Grade a learner's answer, with a reason.
 *
 * The reason lets the UI distinguish "you left it blank" from "I could not read
 * that" from "that is not right" — three different things a learner needs told
 * differently. `empty` in particular must NOT be written as an attempt: a blank
 * submission cannot be allowed to count against mastery.
 */
export function gradeDetailed(
  expectedValue: unknown,
  answerType: AnswerType,
  givenAnswer: unknown,
): GradeResult {
  const given = normalise(givenAnswer);
  const expected = normalise(expectedValue);

  if (given === null || given === "") return { correct: false, reason: "empty" };
  if (expected === null || expected === "") {
    // A question with no answer key is a content bug. Never mark a learner wrong
    // for it, but never mark them right either — surface it as unparseable.
    return { correct: false, reason: "unparseable" };
  }

  // Answers are Arabic numerals everywhere (i18n.md). `१/२` is rejected rather
  // than mis-parsed into something that happens to compare equal.
  if (NON_ARABIC_DIGIT.test(given)) return { correct: false, reason: "unparseable" };

  switch (answerType) {
    case "mcq": {
      // The choice ID, never the label — labels are translated (D16), so
      // grading a label would make Hindi answers wrong.
      const correct = given.toLowerCase() === expected.toLowerCase();
      return { correct, reason: correct ? "match" : "mismatch" };
    }

    case "integer": {
      const givenInt = parseInteger(given);
      const expectedInt = parseInteger(expected);
      if (givenInt === null) return { correct: false, reason: "unparseable" };
      if (expectedInt === null) return { correct: false, reason: "unparseable" };
      const correct = givenInt === expectedInt;
      return { correct, reason: correct ? "match" : "mismatch" };
    }

    case "fraction":
    case "decimal": {
      const expectedParsed = parseAsValue(expected);
      const givenParsed = parseAsValue(given);
      if (expectedParsed === null) return { correct: false, reason: "unparseable" };
      if (givenParsed === null) return { correct: false, reason: "unparseable" };

      // Both written as fractions: compare exactly in lowest terms, so no
      // floating-point rounding can ever decide a learner's mark.
      if (expectedParsed.rational && givenParsed.rational) {
        const correct =
          expectedParsed.rational.n === givenParsed.rational.n &&
          expectedParsed.rational.d === givenParsed.rational.d;
        return { correct, reason: correct ? "match" : "mismatch" };
      }

      // Mixed forms (`0.5` against `1/2`): compare by value within tolerance.
      const correct = Math.abs(expectedParsed.value - givenParsed.value) <= TOLERANCE;
      return { correct, reason: correct ? "match" : "mismatch" };
    }

    case "expression":
      return gradeExpression(expected, given);

    default: {
      // An unknown answer_type is a content or schema bug. Fail closed rather
      // than guessing — but as "unparseable", so it can be told apart from a
      // learner actually being wrong.
      return { correct: false, reason: "unparseable" };
    }
  }
}

/** Convenience wrapper. Most callers only need the boolean. */
export function grade(
  expectedValue: unknown,
  answerType: AnswerType,
  givenAnswer: unknown,
): boolean {
  return gradeDetailed(expectedValue, answerType, givenAnswer).correct;
}
