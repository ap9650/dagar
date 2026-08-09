/**
 * npm run eval — is the tutor any good, on the questions learners actually ask?
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS, AND WHY THE CASES ARE REAL.
 *
 * The tutor is the differentiating claim in the whole product, and until now
 * every prompt edit was an untested deploy. `HOW_WE_BUILT_IT` §14 lists that as
 * the mistake we would most like back: we tuned the prompt several times with
 * no harness, and each of those edits was an act of faith.
 *
 * The golden set is not invented. Every message in it was typed by a learner
 * aged 11 to 14 into the live tutor between 6 and 9 August, verbatim. That
 * matters more than it sounds. An invented set would be full of well-formed
 * questions like "can you explain equivalent fractions", and the real
 * distribution looks nothing like that:
 *
 *   "Don't know"                       a learner with no words for the problem
 *   "Answer 40"                        an answer typed into the wrong box
 *   "Where to select answers"          lost in the interface, not the maths
 *   "Muje hindi me bhi mil sakta h"    switching language mid-conversation
 *   "What d9es the less then half..."  a real question, through a typo
 *
 * A tutor that handles textbook questions and falls over on "0k" is a tutor
 * that fails most of its actual traffic.
 *
 * ── HOW IT SCORES ───────────────────────────────────────────────────────────
 * Each case runs the REAL prompt with the REAL lesson grounding, then a judge
 * scores the reply against `evals/rubric.md` plus that case's own `must` list.
 * The judge is Haiku: judging is a classification job, and paying Sonnet rates
 * to mark homework is how an eval harness stops being run.
 *
 * Reads only. It creates no learner rows and writes nothing to `ai_calls`,
 * because eval spend is not product spend and mixing them would corrupt the
 * cost-per-learner figure the price floor rests on.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import nextEnv from "@next/env";
import { tutorSystemPrompt, lessonGrounding } from "../lib/ai/prompts/tutor.ts";

nextEnv.loadEnvConfig(process.cwd());

const TUTOR_MODEL = "claude-sonnet-5";
const JUDGE_MODEL = "claude-haiku-4-5-20251001";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

type Case = {
  id: string;
  category: string;
  lesson: string;
  locale: "en" | "hi";
  message: string;
  must: string[];
};

type Verdict = {
  pass: boolean;
  criteria: { name: string; verdict: "pass" | "fail" | "n/a"; why: string }[];
};

function loadCases(): Case[] {
  return readFileSync("evals/golden/tutor.jsonl", "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Case & { _comment?: string })
    .filter((c) => !("_comment" in c) && Boolean(c.id));
}

/** The lesson a case is grounded in, by slug, exactly as the app would load it. */
async function grounding(slug: string, locale: "en" | "hi") {
  const { data: lesson, error } = await db
    .from("lessons")
    .select("title, body_md, steps, i18n, chapter_id")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !lesson) throw new Error(`no lesson "${slug}" — run npm run seed`);

  const { data: chapter } = await db
    .from("chapters")
    .select("title, grade, i18n")
    .eq("id", lesson.chapter_id)
    .maybeSingle();

  const localised = (row: Record<string, unknown>, field: string) => {
    const i18n = row.i18n as Record<string, Record<string, string>> | null;
    return (locale !== "en" && i18n?.[locale]?.[field]) || (row[field] as string);
  };

  // Steps are the lesson body since D18; body_md is the pre-steps fallback.
  const steps = (lesson.steps as { md?: string }[] | null) ?? [];
  const stepText = steps.map((s) => s?.md ?? "").filter(Boolean).join("\n\n");

  return {
    grade: chapter?.grade ?? null,
    chapterTitle: chapter ? localised(chapter, "title") : "",
    lessonTitle: localised(lesson, "title"),
    body: stepText || localised(lesson, "body_md") || "",
  };
}

async function askTutor(testCase: Case): Promise<string> {
  const context = await grounding(testCase.lesson, testCase.locale);
  const response = await anthropic.messages.create({
    model: TUTOR_MODEL,
    max_tokens: 700,
    system: [
      { type: "text", text: tutorSystemPrompt(testCase.locale) },
      {
        type: "text",
        text: lessonGrounding({
          grade: context.grade,
          chapterTitle: context.chapterTitle,
          lessonTitle: context.lessonTitle,
          body: context.body,
          // No mastery: a first question on a fresh lesson is the common case,
          // and inventing scores would test a situation nobody is in.
          mastery: [],
        }),
      },
    ],
    messages: [{ role: "user", content: testCase.message }],
  });
  return response.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("");
}

const RUBRIC = readFileSync("evals/rubric.md", "utf8");

async function judge(testCase: Case, reply: string): Promise<Verdict> {
  const response = await anthropic.messages.create({
    model: JUDGE_MODEL,
    max_tokens: 900,
    system:
      "You are marking one reply from a maths tutor written for a child aged 11 " +
      "to 14. Judge only against the rubric and the case requirements. Be strict " +
      "about the five non-negotiables and generous about style. Reply with JSON " +
      'only: {"pass": boolean, "criteria": [{"name": string, "verdict": ' +
      '"pass"|"fail"|"n/a", "why": string}]}.\n\n' +
      RUBRIC,
    messages: [
      {
        role: "user",
        content:
          `LESSON: ${testCase.lesson}\nLEARNER WROTE: ${testCase.message}\n\n` +
          `THIS CASE ALSO REQUIRES:\n${testCase.must.map((m) => `- ${m}`).join("\n")}\n\n` +
          `THE TUTOR REPLIED:\n${reply}`,
      },
    ],
  });
  const text = response.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("");
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return JSON.parse(json) as Verdict;
}

async function main() {
  const cases = loadCases();
  const only = process.argv.includes("--case")
    ? process.argv[process.argv.indexOf("--case") + 1]
    : null;
  const running = only ? cases.filter((c) => c.id === only) : cases;

  console.log(`\nRunning ${running.length} real learner questions through the tutor.\n`);

  const results: { case: Case; reply: string; verdict: Verdict }[] = [];
  for (const testCase of running) {
    try {
      const reply = await askTutor(testCase);
      const verdict = await judge(testCase, reply);
      results.push({ case: testCase, reply, verdict });
      const failed = verdict.criteria.filter((c) => c.verdict === "fail");
      console.log(
        `  ${verdict.pass ? "PASS" : "FAIL"}  ${testCase.id.padEnd(14)} ` +
          `${testCase.category.padEnd(20)} ${JSON.stringify(testCase.message).slice(0, 44)}`,
      );
      for (const criterion of failed) console.log(`          ${criterion.name}: ${criterion.why}`);
    } catch (error) {
      console.log(`  ERROR ${testCase.id}: ${(error as Error).message}`);
    }
  }

  const passed = results.filter((r) => r.verdict.pass).length;
  console.log(`\n${passed} of ${results.length} passed.\n`);

  const byCategory = new Map<string, { pass: number; total: number }>();
  for (const r of results) {
    const entry = byCategory.get(r.case.category) ?? { pass: 0, total: 0 };
    entry.total += 1;
    if (r.verdict.pass) entry.pass += 1;
    byCategory.set(r.case.category, entry);
  }
  for (const [category, { pass, total }] of [...byCategory].sort())
    console.log(`  ${category.padEnd(22)} ${pass}/${total}`);

  // The transcript is the point. A score tells you something regressed; the
  // replies tell you what to change about the prompt.
  mkdirSync("evals/runs", { recursive: true });
  const path = `evals/runs/${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`;
  writeFileSync(path, JSON.stringify(results, null, 2));
  console.log(`\ntranscript: ${path}\n`);

  if (passed < results.length) process.exitCode = 1;
}

await main();
