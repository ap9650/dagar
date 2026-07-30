/**
 * npm run check:keys — deterministically re-derive every answer key that can be
 * read straight off the question stem, and compare it to what is stored.
 *
 * WHY THIS EXISTS: a wrong answer key marks correct learners wrong. It is the
 * highest-harm bug this product can have and the only one that is completely
 * invisible from inside the app — nothing errors, nothing logs, the learner just
 * concludes they are bad at maths.
 *
 * This is the CHEAP half of that defence, and it is exact:
 *
 *   - it parses the KaTeX in the stem and computes with integer rationals, so
 *     there is no floating-point slop and no model in the loop
 *   - it costs nothing and runs in a second, so it can run on every commit
 *   - it re-derives from the STEM ONLY. It never reads `answer_value` before
 *     computing — a check that looks at the stored answer first will agree with it.
 *
 * It only covers stems that are pure symbolic arithmetic. Word problems ("a tank
 * holds 40 litres…") need semantics, and those are what `verify:answers` (slice
 * 2.1c, Claude Haiku solving cold) is for. This script reports exactly how many it
 * could not judge, so the gap is visible rather than implied.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/supabase/database.types.ts";

// ─── exact rational arithmetic ───────────────────────────────────────────────

type Rational = { n: number; d: number };

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

function rational(n: number, d: number): Rational {
  if (d === 0) throw new Error("divide by zero");
  const sign = d < 0 ? -1 : 1;
  const g = gcd(n, d);
  return { n: (sign * n) / g, d: (sign * d) / g };
}

const add = (a: Rational, b: Rational) => rational(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a: Rational, b: Rational) => rational(a.n * b.d - b.n * a.d, a.d * b.d);
const show = (r: Rational) => (r.d === 1 ? `${r.n}` : `${r.n}/${r.d}`);

// ─── stem parsing ────────────────────────────────────────────────────────────

/** Strip KaTeX delimiters and collapse whitespace so one regex set covers all stems. */
function normalise(stem: string): string {
  return stem
    .replace(/\$\$/g, " ")
    .replace(/\$/g, " ")
    .replace(/\\qquad|\\text\{[^}]*\}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const FRAC = String.raw`\\frac\{\s*(-?\d+)\s*\}\{\s*(-?\d+)\s*\}`;
const BOX = String.raw`\\frac\{\s*\\square\s*\}\{\s*(-?\d+)\s*\}`;
const BOX_BOTTOM = String.raw`\\frac\{\s*(-?\d+)\s*\}\{\s*\\square\s*\}`;

/**
 * Returns the answer this stem implies, or null if the stem is not pure
 * arithmetic. Never consults the stored answer.
 */
function derive(stem: string): string | null {
  const s = normalise(stem);

  // a/b + c/d
  const plus = s.match(new RegExp(`^${FRAC}\\s*\\+\\s*${FRAC}$`));
  if (plus) {
    const [, a, b, c, d] = plus.map(Number);
    return show(add(rational(a, b), rational(c, d)));
  }

  // a/b - c/d
  const minus = s.match(new RegExp(`^${FRAC}\\s*-\\s*${FRAC}$`));
  if (minus) {
    const [, a, b, c, d] = minus.map(Number);
    return show(sub(rational(a, b), rational(c, d)));
  }

  // a/b = □/d  → box is the missing NUMERATOR
  const boxTop = s.match(new RegExp(`${FRAC}\\s*=\\s*${BOX}`));
  if (boxTop) {
    const [, a, b, d] = boxTop.map(Number);
    if ((a * d) % b !== 0) return null; // not a whole number: not this pattern
    return String((a * d) / b);
  }

  // a/b = c/□  → box is the missing DENOMINATOR
  const boxBottom = s.match(new RegExp(`${FRAC}\\s*=\\s*${BOX_BOTTOM}`));
  if (boxBottom) {
    const [, a, b, c] = boxBottom.map(Number);
    if ((b * c) % a !== 0) return null;
    return String((b * c) / a);
  }

  // Plain integer arithmetic: (-7) + 3, (-2) \times 3 \times (-5), (-48) \div (-4) \div (-3).
  // This is most of Class 7, so teaching the checker to evaluate it moves a large
  // block of answer keys from "trust me" to "proved".
  const arithmetic = s
    .replace(/\\times/g, "*")
    .replace(/\\div/g, "/")
    .replace(/\\cdot/g, "*")
    .replace(/\\left|\\right/g, "")
    .trim();

  if (/^[-+*/()\d\s]+$/.test(arithmetic) && /\d/.test(arithmetic)) {
    try {
      return show(evaluate(arithmetic));
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * A tiny recursive-descent evaluator over integers.
 *
 * Hand-written rather than `eval` or `new Function`: this runs over seeded
 * content, and a checker that executes its own input is a checker that can be
 * made to lie. It is also exact — every intermediate value stays a rational, so
 * there is no floating-point drift to explain away.
 */
function evaluate(input: string): Rational {
  let pos = 0;
  const peek = () => {
    while (input[pos] === " ") pos++;
    return input[pos];
  };

  function parseExpression(): Rational {
    let left = parseTerm();
    for (;;) {
      const op = peek();
      if (op !== "+" && op !== "-") return left;
      pos++;
      const right = parseTerm();
      left = op === "+" ? add(left, right) : sub(left, right);
    }
  }

  function parseTerm(): Rational {
    let left = parseFactor();
    for (;;) {
      const op = peek();
      if (op !== "*" && op !== "/") return left;
      pos++;
      const right = parseFactor();
      left =
        op === "*"
          ? rational(left.n * right.n, left.d * right.d)
          : rational(left.n * right.d, left.d * right.n);
    }
  }

  function parseFactor(): Rational {
    const ch = peek();
    if (ch === "-") {
      pos++;
      const value = parseFactor();
      return rational(-value.n, value.d);
    }
    if (ch === "+") {
      pos++;
      return parseFactor();
    }
    if (ch === "(") {
      pos++;
      const value = parseExpression();
      if (peek() !== ")") throw new Error("unbalanced");
      pos++;
      return value;
    }
    const digits = /^\d+/.exec(input.slice(pos));
    if (!digits) throw new Error("expected a number");
    pos += digits[0].length;
    return rational(Number(digits[0]), 1);
  }

  const result = parseExpression();
  if (peek() !== undefined) throw new Error("trailing input");
  return result;
}

/** Same-value comparison, so 6/8 and 3/4 are not reported as a disagreement. */
function sameValue(a: string, b: string): boolean {
  const parse = (v: string): Rational | null => {
    const frac = v.trim().match(/^(-?\d+)\s*\/\s*(-?\d+)$/);
    if (frac) return rational(Number(frac[1]), Number(frac[2]));
    const int = v.trim().match(/^-?\d+$/);
    if (int) return rational(Number(v), 1);
    return null;
  };
  const x = parse(a);
  const y = parse(b);
  if (!x || !y) return a.trim() === b.trim();
  return x.n === y.n && x.d === y.d;
}

// ─── run ─────────────────────────────────────────────────────────────────────

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of raw.split("\n")) {
      if (!/^[A-Z]/.test(line)) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      out[line.slice(0, eq)] = line.slice(eq + 1).replace(/\s+#.*$/, "").trim();
    }
  } catch {
    /* fall through to process.env */
  }
  return { ...out, ...process.env } as Record<string, string>;
}

const env = loadEnv();
const db = createClient<Database>(
  env.NEXT_PUBLIC_SUPABASE_URL!,
  env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const { data: questions, error } = await db
  .from("questions")
  .select("slug, stem_md, answer_type, answer_value")
  .order("slug");

if (error || !questions) {
  console.error(`✗ could not read questions: ${error?.message}`);
  process.exit(1);
}

const mismatches: string[] = [];
let checked = 0;
let skipped = 0;

for (const q of questions) {
  const derived = derive(q.stem_md);

  if (derived === null) {
    skipped++;
    continue;
  }

  checked++;
  if (!sameValue(derived, q.answer_value)) {
    mismatches.push(
      `  ✗ ${q.slug}\n      stem implies : ${derived}\n      stored       : ${q.answer_value}`,
    );
  }
}

console.log(`\nArithmetic answer-key check`);
console.log(`  re-derived from the stem : ${checked}`);
console.log(`  disagreements            : ${mismatches.length}`);
console.log(
  `  not machine-checkable    : ${skipped}  (word problems and MCQ — see npm run verify:answers, slice 2.1c)`,
);

if (mismatches.length > 0) {
  console.log(`\n${mismatches.join("\n")}`);
  console.log(
    `\n✗ Check the GRADER before assuming the content is wrong — a grader bug that` +
      `\n  rejects an equivalent form shows up here as a false disagreement.`,
  );
  process.exit(1);
}

console.log(`\n✓ Every machine-checkable answer key agrees.`);
