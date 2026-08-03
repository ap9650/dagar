/**
 * npm run verify:answers — slice 2.1c.
 *
 * Solves every seeded question COLD with Claude Haiku and compares its answer to
 * the stored key through the real `grade()`. Prints only the disagreements.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE RULE THAT MAKES THIS WORTH RUNNING:
 *
 *   **The stored answer is never sent to the model.**
 *
 * A model shown the answer agrees with it. That turns the whole exercise into
 * theatre — a green report that proves nothing. The model gets the stem, the
 * answer type, and (for MCQ) the options. Nothing else.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Two independent solves agreeing is real evidence. Where they disagree, a human
 * reads ONLY those — which is the point: 96 questions is too many to hand-check,
 * and a handful of flagged ones is not.
 *
 * It also runs the entire bank through `grade()`, so a GRADER bug shows up here
 * as a flood of false disagreements. If many rows disagree, suspect the grader
 * before the content.
 *
 * Complements `npm run check:keys`, which re-derives the arithmetic ones exactly
 * and for free. This one covers the word problems and MCQs that one cannot.
 */
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/supabase/database.types.ts";
import { grade, type AnswerType } from "../lib/learning/grading.ts";

const MODEL = "claude-haiku-4-5";
const ONLY = process.argv.find((a) => a.startsWith("--only="))?.split("=")[1];

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
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
const db = createClient<Database>(
  env.NEXT_PUBLIC_SUPABASE_URL!,
  env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const SYSTEM = `You are solving NCERT school mathematics questions for Classes 6 to 8.

Work the problem out, then give ONLY the final answer on the last line, prefixed with "ANSWER: ".

Format the final answer to match the answer type you are told:
- mcq       -> the option letter only, e.g. ANSWER: b
- integer   -> a whole number, e.g. ANSWER: -12
- fraction  -> a fraction in lowest terms, e.g. ANSWER: 3/4
- decimal   -> a decimal number, e.g. ANSWER: 2.5
- expression-> the expression, e.g. ANSWER: x=4

Use Arabic numerals. Never write the answer in words. No units, no currency symbols, no explanation after the ANSWER line.`;

type Row = {
  slug: string | null;
  stem_md: string;
  answer_type: string;
  answer_value: string;
  choices: unknown;
  input: unknown;
  stem_viz: unknown;
};

function choicesToText(choices: unknown): string {
  if (!Array.isArray(choices)) return "";
  const lines = choices
    .filter(
      (c): c is { id: string; label: string } =>
        typeof c === "object" && c !== null && "id" in c && "label" in c,
    )
    .map((c) => `${c.id}) ${c.label}`);
  return lines.length ? `\n\nOptions:\n${lines.join("\n")}` : "";
}

/**
 * The options of a pictorial question (D18 slice 5.2).
 *
 * Without this the verifier solves a `choiceViz` question BLIND: "which picture
 * shows more than half?" has no answer from the stem alone, and a cold solve
 * that cannot see the options is not a check, it is a coin toss reported as a
 * verification. The learner sees three diagrams; the verifier gets the value each
 * diagram stands for, which is the same information without the drawing.
 */
function optionsToText(input: unknown): string {
  if (typeof input !== "object" || input === null) return "";
  const spec = input as { kind?: unknown; options?: unknown };
  if (spec.kind !== "choiceViz" || !Array.isArray(spec.options)) return "";
  const values = spec.options
    .filter((o): o is { value: string } => typeof o === "object" && o !== null && "value" in o)
    .map((o) => `- ${o.value}`);
  return values.length
    ? `\n\nThe learner picks one of these, shown as diagrams:\n${values.join("\n")}`
    : "";
}

/**
 * The diagram that IS the question (slice 5.2c), described in words.
 *
 * Without this the verifier reads "this balance is level, what is x?" with no
 * balance, and a cold solve of an unanswerable question is not a check — it is a
 * guess reported as a verification. The learner sees a picture; the model gets
 * the same information as a sentence.
 *
 * Only `balanceScale` is described so far, because it is the only kind authored
 * into a stem. An undescribed kind returns "" and the question fails the check
 * loudly rather than being silently waved through.
 */
function stemVizToText(stemViz: unknown): string {
  if (typeof stemViz !== "object" || stemViz === null) return "";
  const spec = stemViz as {
    kind?: unknown;
    left?: { xs?: number; n?: number };
    right?: { xs?: number; n?: number };
  };
  if (spec.kind !== "balanceScale") return "";

  const side = (pan?: { xs?: number; n?: number }) => {
    const parts: string[] = [];
    if (pan?.xs) parts.push(pan.xs === 1 ? "x" : `${pan.xs}x`);
    if (pan?.n) parts.push(String(pan.n));
    return parts.length ? parts.join(" + ") : "0";
  };

  return `\n\nThe diagram is a level pan balance: ${side(spec.left)} on the left weighs the same as ${side(spec.right)} on the right.`;
}

async function solveCold(row: Row): Promise<string> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        // Stem, type and options. NOT the stored answer.
        content: `Answer type: ${row.answer_type}\n\nQuestion:\n${row.stem_md}${choicesToText(row.choices)}${optionsToText(row.input)}${stemVizToText(row.stem_viz)}`,
      },
    ],
  });

  const block = response.content.find((b) => b.type === "text");
  const text = block && block.type === "text" ? block.text : "";

  // Take the LAST line that starts with ANSWER:, and require it at the start of
  // a line. The first naive version took the first case-insensitive "answer:"
  // anywhere in the working — so reasoning like "The correct answer: we need a
  // common denominator" was extracted as the answer, and a question the model
  // had actually got right was reported as a disagreement. False flags here cost
  // a human's review time, which is the one thing this script exists to save.
  const matches = [...text.matchAll(/^\s*ANSWER:\s*(.+?)\s*$/gim)];
  return matches.length ? matches[matches.length - 1][1].trim() : "";
}

// ─── run ─────────────────────────────────────────────────────────────────────

let query = db
  .from("questions")
  .select("slug, stem_md, answer_type, answer_value, choices, input, stem_viz")
  .order("slug");
if (ONLY) query = query.like("slug", `${ONLY}%`);

const { data: questions, error } = await query;

if (error || !questions) {
  console.error(`✗ could not read questions: ${error?.message}`);
  process.exit(1);
}

console.log(`Solving ${questions.length} questions cold with ${MODEL}…\n`);

type Disagreement = {
  slug: string;
  answerType: string;
  stored: string;
  model: string;
  stem: string;
};

const disagreements: Disagreement[] = [];
let agreed = 0;
/**
 * Questions the model would not answer at all.
 *
 * These used to be counted and then forgotten, and the run still finished with
 * "agrees with every stored answer key" — which is not true of a question that
 * was never checked. An unverified key is not a verified one, so they are named
 * and the run does not claim success.
 */
const unreadable: string[] = [];

for (const [index, row] of questions.entries()) {
  const modelAnswer = await solveCold(row as Row);

  if (!modelAnswer) {
    unreadable.push(row.slug ?? "(no slug)");
    continue;
  }

  // Compared through the REAL grader, so the model writing 2/4 against a stored
  // 1/2 counts as agreement — exactly as it would for a learner.
  if (grade(row.answer_value, row.answer_type as AnswerType, modelAnswer)) {
    agreed++;
  } else {
    disagreements.push({
      slug: row.slug ?? "(no slug)",
      answerType: row.answer_type,
      stored: row.answer_value,
      model: modelAnswer,
      stem: row.stem_md.replace(/\s+/g, " ").slice(0, 90),
    });
  }

  if ((index + 1) % 20 === 0) console.log(`  … ${index + 1}/${questions.length}`);
}

console.log(`\nCold-solve verification`);
console.log(`  questions      : ${questions.length}`);
console.log(`  agreed         : ${agreed}`);
console.log(`  disagreed      : ${disagreements.length}`);
console.log(`  no answer given: ${unreadable.length}`);
if (unreadable.length > 0) {
  console.log(`\n  NOT CHECKED — the model gave no answer for these:`);
  for (const slug of unreadable) console.log(`    ${slug}`);
  console.log(
    `  A question the verifier cannot answer is usually a question a learner\n` +
      `  cannot answer either. Read them by hand.`,
  );
}

if (disagreements.length > 0) {
  console.log(`\nReview these by hand — the model and the stored key differ:\n`);
  for (const d of disagreements) {
    console.log(`  ${d.slug}  [${d.answerType}]`);
    console.log(`    stem  : ${d.stem}`);
    console.log(`    stored: ${d.stored}`);
    console.log(`    model : ${d.model}\n`);
  }
  const rate = disagreements.length / questions.length;
  if (rate > 0.25) {
    console.log(
      `  ⚠ ${Math.round(rate * 100)}% disagreement is too high to be content alone.\n` +
        `    CHECK THE GRADER FIRST — a grader that rejects an equivalent form shows\n` +
        `    up here as a flood of false disagreements.`,
    );
  }
  process.exit(1);
}

if (unreadable.length === 0) {
  console.log(`\n✓ An independent cold solve agrees with every stored answer key.`);
} else {
  // Not a pass. Saying "every key" while one was skipped is exactly the kind
  // of green report this script exists to avoid.
  console.log(
    `\n⚠ ${agreed} keys verified. ${unreadable.length} NOT checked — see above.`,
  );
}
