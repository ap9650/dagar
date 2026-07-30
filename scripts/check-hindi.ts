/**
 * npm run check:hindi — slice 1.6b.
 *
 * Checks every Hindi translation against the English it came from, mechanically:
 *
 *   - KaTeX blocks that differ from the English source
 *   - Devanagari numerals (१२३) where NCERT uses Arabic
 *   - Latin script left mid-sentence
 *   - missing NCERT mathematics terms, and transliterated English in their place
 *   - rows with no Hindi at all
 *
 * **Why this exists:** it makes the Day 4 human read-through about TONE ONLY.
 * Reading 126 rows for both meaning and mechanics is how a tired person at 9pm
 * on submission day misses a formula that got mangled. A machine never misses one
 * and never gets tired, so it does that half.
 *
 * Exits non-zero on any hit, so it can gate a deploy.
 */
import { readFileSync, existsSync } from "node:fs";
import { chapters } from "../supabase/seed/index.ts";
import { validateField, type Problem } from "./hindi-validate.ts";

const TRANSLATIONS = new URL("../supabase/seed/translations/hi.json", import.meta.url);

if (!existsSync(TRANSLATIONS)) {
  console.error("✗ No supabase/seed/translations/hi.json — run npm run translate:hi first.");
  process.exit(1);
}

const hi: Record<string, Record<string, string | Array<{ id: string; label: string }>>> =
  JSON.parse(readFileSync(TRANSLATIONS, "utf8"));

type Row = { slug: string; kind: string; fields: Array<[string, string]> };

// Every translatable row, paired with its English source.
const rows: Row[] = [];

for (const chapter of chapters) {
  rows.push({
    slug: chapter.slug,
    kind: "chapter",
    fields: [
      ["title", chapter.title],
      ["summary", chapter.summary],
    ],
  });

  for (const concept of chapter.concepts) {
    rows.push({ slug: concept.slug, kind: "concept", fields: [["name", concept.name]] });
  }

  for (const lesson of chapter.lessons) {
    rows.push({
      slug: lesson.slug,
      kind: "lesson",
      fields: [
        ["title", lesson.title],
        ["body_md", lesson.body_md],
      ],
    });
  }

  for (const question of chapter.questions) {
    const fields: Array<[string, string]> = [
      ["stem_md", question.stem_md],
      ["solution_md", question.solution_md],
    ];
    rows.push({ slug: question.slug, kind: "question", fields });
  }
}

const findings: Array<{ slug: string; kind: string } & Problem> = [];
let missingRows = 0;
let checkedFields = 0;

for (const row of rows) {
  const translation = hi[row.slug];

  if (!translation) {
    missingRows++;
    findings.push({
      slug: row.slug,
      kind: row.kind,
      field: "—",
      message: "no Hindi at all (English will render)",
    });
    continue;
  }

  for (const [field, english] of row.fields) {
    const hindi = translation[field];
    if (typeof hindi !== "string") {
      findings.push({ slug: row.slug, kind: row.kind, field, message: "field not translated" });
      continue;
    }
    checkedFields++;
    for (const problem of validateField(english, hindi, field)) {
      findings.push({ slug: row.slug, kind: row.kind, ...problem });
    }
  }
}

// MCQ choices: the label is translated, the id never is — the id is what gets
// graded, so translating it would make a Hindi learner's correct answer wrong.
for (const chapter of chapters) {
  for (const question of chapter.questions) {
    if (!question.choices) continue;
    const translation = hi[question.slug];
    const translatedChoices = translation?.choices;

    if (!Array.isArray(translatedChoices)) {
      findings.push({
        slug: question.slug,
        kind: "question",
        field: "choices",
        message: "options not translated",
      });
      continue;
    }

    const englishIds = question.choices.map((c) => c.id).join(",");
    const hindiIds = translatedChoices.map((c) => c.id).join(",");
    if (englishIds !== hindiIds) {
      findings.push({
        slug: question.slug,
        kind: "question",
        field: "choices",
        message: `option ids changed: ${englishIds} became ${hindiIds} — ids are what get graded`,
      });
    }

    for (const choice of question.choices) {
      const match = translatedChoices.find((c) => c.id === choice.id);
      if (!match) continue;
      checkedFields++;
      for (const problem of validateField(choice.label, match.label, `choice ${choice.id}`)) {
        findings.push({ slug: question.slug, kind: "question", ...problem });
      }
    }
  }
}

// ─── report ──────────────────────────────────────────────────────────────────

console.log(`\nHindi mechanical check`);
console.log(`  rows          : ${rows.length}`);
console.log(`  fields checked: ${checkedFields}`);
console.log(`  rows with no Hindi: ${missingRows}`);
console.log(`  findings      : ${findings.length}`);

if (findings.length > 0) {
  const width = Math.max(...findings.map((f) => f.slug.length), 8);
  console.log(
    `\n  ${"row".padEnd(width)}  ${"field".padEnd(12)}  problem`,
  );
  console.log(`  ${"─".repeat(width)}  ${"─".repeat(12)}  ${"─".repeat(40)}`);
  for (const f of findings) {
    console.log(`  ${f.slug.padEnd(width)}  ${f.field.padEnd(12)}  ${f.message}`);
  }
  console.log(
    `\n✗ Fix these before the Day 4 read-through — that pass is for TONE, not mechanics.`,
  );
  process.exit(1);
}

console.log(`\n✓ Every translation keeps its maths, its Arabic numerals and its NCERT terms.`);
