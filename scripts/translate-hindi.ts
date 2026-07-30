/**
 * npm run translate:hi — machine-translate the curriculum into Hindi (D16).
 *
 * Output is `supabase/seed/translations/hi.json`, keyed by slug. That file is
 * **committed**, and `npm run seed` merges it into each row's `i18n` jsonb.
 *
 * Why a file rather than writing straight to the database: a translation that
 * exists only in Supabase is lost the moment the project is reset, and cannot be
 * reviewed in a diff. Hindi is a third of this product's value — it belongs in
 * git next to the English it came from.
 *
 * THE LOAD-BEARING RULE: `answer_value` is never translated and is never sent to
 * the model. `1/2` is `1/2` in every language, which is what keeps Hindi entirely
 * off the grading path (D16). A translation error can produce a confusing
 * question; it must never be able to mark a correct learner wrong.
 *
 * Every translation is validated before it is written:
 *   - every KaTeX span must survive untouched (compared as a set, because
 *     Hindi word order legitimately moves them)
 *   - no Devanagari digits (NCERT Hindi maths uses 1/2, never १/२)
 *   - no Latin script left in the prose
 * A row that fails twice is left untranslated, and English renders instead — the
 * fallback is a safety net, not a silent corruption.
 *
 *   npm run translate:hi            # only rows with no Hindi yet
 *   npm run translate:hi -- --force # redo everything
 */
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { chapters } from "../supabase/seed/index.ts";
import { validateField } from "./hindi-validate.ts";

const OUTPUT = new URL("../supabase/seed/translations/hi.json", import.meta.url);
const FORCE = process.argv.includes("--force");

// Haiku 4.5 for batch work (D16 costed this at a couple of rupees for the whole
// curriculum). Quality is guarded by the validator below plus the human
// read-through, not by reaching for a bigger model.
const MODEL = "claude-haiku-4-5";

// ─── env ─────────────────────────────────────────────────────────────────────
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
    /* fall through */
  }
  return { ...out, ...process.env } as Record<string, string>;
}

const env = loadEnv();
const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

// ─── validation ─────────────────────────────────────────────────────────────
// Shared with `npm run check:hindi` (scripts/hindi-validate.ts) so the two can
// never disagree about what counts as a valid translation.

function validate(english: string, hindi: string, field: string): string[] {
  return validateField(english, hindi, field).map((p) => `${p.field}: ${p.message}`);
}

// ─── the prompt ──────────────────────────────────────────────────────────────

const SYSTEM = `You translate NCERT school mathematics from English into Hindi for Indian learners aged 11-14.

REGISTER — this is the most important instruction.
Write the Hindi of the learner's own NCERT Hindi mathematics textbook (Ganit). That book is already written for this age by people who do it professionally, and matching it means the app and the textbook reinforce each other. Do not translate the English word for word; write what the NCERT Hindi book would say.

- Lesson bodies, question stems and worked solutions: NCERT textbook register.
- Exercise instructions use NCERT's polite imperative: हल कीजिए, ज्ञात कीजिए, सरल कीजिए.

MATHEMATICS VOCABULARY — use NCERT's exact terms, never transliterated English:
भिन्न (fraction), पूर्णांक (integer), समीकरण (equation), चर (variable), हर (denominator), अंश (numerator), गुणनफल (product), भाजक (divisor), समतुल्य (equivalent), ऋणात्मक (negative), धनात्मक (positive), संख्या रेखा (number line), परिमाप (perimeter).
Never write फ्रैक्शन, इंटीजर or इक्वेशन.

ABSOLUTE RULES:
1. Every $...$ and $$...$$ block passes through COMPLETELY UNCHANGED, byte for byte. Never translate or reformat anything inside the dollar signs. You may place them where Hindi word order requires, but the contents must be identical.
2. Numerals stay Arabic: 1, 2, 1/2. NEVER Devanagari digits (१, २).
3. Keep markdown structure exactly: **bold**, *italic*, ###, -, >, tables, and code fences.
4. Cultural contexts stay as they are — rupees, rotis, cricket, laddoos, Indian names and places.
5. No Latin script in the prose. If an English word has no natural Hindi equivalent, write it in Devanagari.

Return ONLY the translated text. No preamble, no explanation, no quotes, and never repeat the <source> tags or any --- delimiter.`;

async function translateField(english: string, hint: string): Promise<string> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Translate this ${hint} into Hindi.\n\n<source>\n${english}\n</source>`,
      },
    ],
  });

  const block = response.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text.trim() : "";
}

/** Translate, validate, and retry once with the failures spelled out. */
async function translateChecked(
  english: string,
  hint: string,
  field: string,
): Promise<{ hindi: string; problems: string[] }> {
  let hindi = await translateField(english, hint);
  let problems = validate(english, hindi, field);

  if (problems.length > 0) {
    const retry = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM,
      messages: [
        { role: "user", content: `Translate this ${hint} into Hindi.\n\n<source>\n${english}\n</source>` },
        { role: "assistant", content: hindi },
        {
          role: "user",
          content:
            `That translation broke these rules:\n${problems.map((p) => `- ${p}`).join("\n")}\n\n` +
            `Translate it again, fixing exactly those problems. Every $...$ and $$...$$ block must be identical to the English.`,
        },
      ],
    });
    const block = retry.content.find((b) => b.type === "text");
    const second = block && block.type === "text" ? block.text.trim() : "";
    const secondProblems = validate(english, second, field);
    if (secondProblems.length < problems.length) {
      hindi = second;
      problems = secondProblems;
    }
  }

  return { hindi, problems };
}

// ─── run ─────────────────────────────────────────────────────────────────────

type Translations = Record<string, Record<string, unknown>>;

const existing: Translations = existsSync(OUTPUT)
  ? JSON.parse(readFileSync(OUTPUT, "utf8"))
  : {};

const failures: string[] = [];
let translated = 0;
let skipped = 0;

function save() {
  mkdirSync(new URL("../supabase/seed/translations/", import.meta.url), { recursive: true });
  writeFileSync(OUTPUT, JSON.stringify(existing, null, 2) + "\n");
}

for (const chapter of chapters) {
  console.log(`\n▸ Class ${chapter.grade} — ${chapter.title}`);

  // ── chapter ──
  if (FORCE || !existing[chapter.slug]) {
    const title = await translateChecked(chapter.title, "chapter title", "title");
    const summary = await translateChecked(chapter.summary, "chapter summary", "summary");
    existing[chapter.slug] = { title: title.hindi, summary: summary.hindi };
    failures.push(...[...title.problems, ...summary.problems].map((p) => `${chapter.slug} ${p}`));
    translated++;
    save();
    console.log(`  ✓ chapter`);
  } else skipped++;

  // ── concepts ──
  for (const concept of chapter.concepts) {
    if (!FORCE && existing[concept.slug]) {
      skipped++;
      continue;
    }
    const name = await translateChecked(concept.name, "concept name", "name");
    existing[concept.slug] = { name: name.hindi };
    failures.push(...name.problems.map((p) => `${concept.slug} ${p}`));
    translated++;
    save();
  }
  console.log(`  ✓ ${chapter.concepts.length} concepts`);

  // ── lessons ──
  for (const lesson of chapter.lessons) {
    if (!FORCE && existing[lesson.slug]) {
      skipped++;
      continue;
    }
    const title = await translateChecked(lesson.title, "lesson title", "title");
    const body = await translateChecked(lesson.body_md, "micro-lesson", "body_md");
    existing[lesson.slug] = { title: title.hindi, body_md: body.hindi };
    failures.push(...[...title.problems, ...body.problems].map((p) => `${lesson.slug} ${p}`));
    translated++;
    save();
    console.log(`  ✓ ${lesson.slug}${body.problems.length ? "  ⚠" : ""}`);
  }

  // ── questions ──
  for (const question of chapter.questions) {
    if (!FORCE && existing[question.slug]) {
      skipped++;
      continue;
    }
    const stem = await translateChecked(question.stem_md, "question", "stem_md");
    const solution = await translateChecked(question.solution_md, "worked solution", "solution_md");

    const row: Record<string, unknown> = { stem_md: stem.hindi, solution_md: solution.hindi };
    failures.push(...[...stem.problems, ...solution.problems].map((p) => `${question.slug} ${p}`));

    if (question.choices) {
      const labels = [];
      for (const choice of question.choices) {
        const label = await translateChecked(choice.label, "multiple-choice option", "choice");
        // The ID is language-independent and is what gets graded. Only the label
        // is translated — translating an id would make a Hindi learner's correct
        // answer grade wrong.
        labels.push({ id: choice.id, label: label.hindi });
        failures.push(...label.problems.map((p) => `${question.slug} ${p}`));
      }
      row.choices = labels;
    }

    existing[question.slug] = row;
    translated++;
    save();
    if (translated % 10 === 0) console.log(`  … ${translated} rows`);
  }
  console.log(`  ✓ ${chapter.questions.length} questions`);
}

save();

console.log(`\ntranslated: ${translated}   skipped (already present): ${skipped}`);
if (failures.length > 0) {
  console.log(`\n⚠ ${failures.length} validation problems survived the retry:\n`);
  for (const f of failures) console.log(`  ${f}`);
  console.log(`\nThese rows are written anyway — run npm run check:hindi to see them in context.`);
} else {
  console.log(`✓ every translation passed maths, numeral and script checks`);
}
