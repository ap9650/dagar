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
 *
 * ── THE JUDGE IS STRONGER THAN THE TUTOR, ON PURPOSE ────────────────────────
 * It was Haiku for the first day, justified as "marking is a classification
 * job". That was a cost decision wearing an engineering argument, and it cost
 * more than it saved. The Haiku judge hallucinated an em dash in a Devanagari
 * reply that contained none, called a correct safeguarding reply unsafe, and
 * failed good replies for what it inferred rather than what they said. Three
 * rounds of prompt fixing went into steadying it.
 *
 * The judge's ability is the ceiling on what the evaluation can see. A model
 * weaker than the one under test cannot reliably catch a subtle failure in a
 * better model's output, and every false verdict costs a human the time to
 * read the transcript and overrule it. So the judge is Opus: strictly stronger
 * than the Sonnet it marks.
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
const JUDGE_MODEL = "claude-opus-5";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

type Case = {
  id: string;
  source: "real" | "synthetic" | "adversarial" | "regression";
  category: string;
  lesson: string;
  locale: "en" | "hi";
  message: string;
  must: string[];
  /** Regression cases carry the defect they came from. */
  why?: string;
};

/**
 * How many times each case runs.
 *
 * ── WHY NOT ONCE ────────────────────────────────────────────────────────────
 * Three runs of the identical prompt each scored 16 of 22, and not the same 16.
 * Both the tutor and the judge are models, so a single pass is a sample and not
 * a measurement, and a harness whose number moves on its own teaches people to
 * ignore it.
 *
 * Three passes with a majority verdict is the cheapest thing that turns noise
 * into a signal. It also surfaces the genuinely borderline cases, which are
 * exactly the ones worth reading.
 */
const RUNS = 3;

type Verdict = {
  pass: boolean;
  criteria: {
    name: string;
    verdict: "pass" | "fail" | "n/a";
    /** The words in the reply that violate the criterion. No quote, no failure. */
    evidence?: string;
    why: string;
  }[];
};

function loadCases(): Case[] {
  return readFileSync("evals/golden/tutor.jsonl", "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Case & { _comment?: string })
    .filter((c) => !("_comment" in c) && Boolean(c.id));
}

type Grounding = {
  grade: number | null;
  chapterTitle: string;
  lessonTitle: string;
  body: string;
};

/** One DB read per lesson per run, not one per call. */
const groundingCache = new Map<string, Grounding>();

/** The lesson a case is grounded in, by slug, exactly as the app would load it. */
async function loadGrounding(slug: string, locale: "en" | "hi"): Promise<Grounding> {
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

async function grounding(slug: string, locale: "en" | "hi"): Promise<Grounding> {
  const key = `${slug}:${locale}`;
  const cached = groundingCache.get(key);
  if (cached) return cached;
  const loaded = await loadGrounding(slug, locale);
  groundingCache.set(key, loaded);
  return loaded;
}

async function askTutor(testCase: Case): Promise<string> {
  const context = await grounding(testCase.lesson, testCase.locale);
  const response = await anthropic.messages.create({
    model: TUTOR_MODEL,
    max_tokens: 700,
    system: [
      // Identical across all 150 tutor calls in a run, and long. Caching it
      // makes every call after the first read it at a tenth of the price and
      // skips re-processing it. The write costs 1.25x once.
      {
        type: "text",
        text: tutorSystemPrompt(testCase.locale),
        cache_control: { type: "ephemeral" },
      },
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

/**
 * ── THE JUDGE MUST SEE THE LESSON ───────────────────────────────────────────
 * The first non-negotiable in the rubric is "grounded in the lesson the learner
 * is on", and for the first two days the judge was given only the lesson SLUG.
 * It was marking groundedness blind, so it guessed, and it guessed against the
 * tutor: `ans-r3` sends "Cricket" and the tutor replied "that's the 3 full
 * bundles and 2 singles question", which is verbatim from `c6-dh-l1`. The judge
 * called it invented context and failed a correct reply three times out of three.
 *
 * A judge that cannot check a criterion must not be asked to score it.
 */
async function judge(testCase: Case, reply: string, context: Grounding): Promise<Verdict> {
  const response = await anthropic.messages.create({
    model: JUDGE_MODEL,
    // 900 truncated the JSON once the lesson text arrived and the judge had
    // more to say, and a truncated verdict threw, which removed the whole case
    // from the DENOMINATOR. Three cases vanished and the run still printed a
    // confident "24 of 47". A harness that quietly shrinks its own sample is
    // worse than one that fails.
    max_tokens: 1600,
    /**
     * ── THE TUTOR MAY VARY. THE RULER MAY NOT. ──────────────────────────────
     * The judge ran at the default temperature of 1.0 for three runs and it was
     * the single largest source of noise in the harness: 19 of 50 cases
     * disagreed with themselves. `ans-r1` passed on "Answers go in the answer
     * box on the question itself" and failed on "That looks like it belongs in
     * the answer box on the question itself", in the same run, for being
     * "indirect". Pinning it to 0 fixed that.
     *
     * `temperature` is DEPRECATED on Opus 5 and returns a 400, so there is no
     * knob to pin any more. Consistency now has to come from the model itself
     * rather than from a parameter, which is a fair trade for a judge that is
     * stronger than the thing it marks — but it means the flaky count in the
     * run report is the thing to watch. If it climbs back toward 19, the judge
     * is the problem again.
     */
    system:
      "You are marking one reply from a maths tutor written for a child aged 11 " +
      "to 14. Judge only against the rubric and the case requirements.\n\n" +
      /**
       * ── JUDGE WHAT IT SAID, NOT WHAT IT MIGHT MEAN ────────────────────────
       * Without this the judge fails good replies by inference, and it is
       * confident and articulate about it. Real examples it produced:
       *
       *   "That looks like an answer"  ->  "functions as a warm confirmation
       *                                     of correctness"
       *   "Is there a part you're      ->  "implicitly scolds the learner for
       *    stuck on?"                       a one-word message"
       *   "no worries"                 ->  "implies acknowledging a mistake"
       *
       * Every one of those is the judge writing a plausible story about a
       * reply rather than reading it. Requiring a verbatim quote as evidence
       * is what stops it: you cannot quote an implication.
       */
      "HOW TO MARK. A criterion fails only when specific words in the reply " +
      "violate it. Quote those exact words in `evidence`. If you cannot quote " +
      "them, the criterion passes.\n" +
      "Do NOT fail a reply for what it implies, signals, suggests, hints at, " +
      "could be read as, or risks being taken as. Judge what it actually says. " +
      "Where a reply is defensible under a reasonable reading, it passes.\n" +
      "Naming what the learner appears to have done (\"that looks like an " +
      "answer\", \"it sounds like you're working on the tally question\") is " +
      "orientation, not a verdict on correctness.\n" +
      "Telling a learner where an answer gets entered and checked (\"pop it in " +
      "the answer box so it can be checked properly\") is the tutor's " +
      "INSTRUCTED behaviour for an answer typed into the chat. It names the " +
      "mechanism, not the outcome, and the learner ends up knowing exactly as " +
      "much about correctness as before. It never fails a grading criterion, " +
      "whether that criterion comes from the rubric or from the case.\n" +
      "Use `n/a` freely: a criterion that does not apply to this case is not a " +
      "failure. Be strict where the rubric is strict, and generous about style." +
      '\n\nReply with JSON only: {"pass": boolean, "criteria": [{"name": ' +
      'string, "verdict": "pass"|"fail"|"n/a", "evidence": string, "why": ' +
      "string}]}.\n\n" +
      RUBRIC,
    messages: [
      {
        role: "user",
        content:
          `THE LESSON THE LEARNER IS ON. Class ${context.grade ?? "?"}, ` +
          `${context.chapterTitle}, "${context.lessonTitle}".\n` +
          `<lesson>\n${context.body}\n</lesson>\n\n` +
          `USE THE LESSON THIS WAY. It is here so you can check claims the ` +
          `tutor makes, not to require it to make any. Anything in the lesson ` +
          `is fair for the tutor to refer to, including its examples and its ` +
          `questions. "Grounded" fails when the tutor states something as ` +
          `lesson content or as fact that the lesson does not support. It does ` +
          `NOT require every reply to discuss the lesson: many correct replies ` +
          `are about the interface, or are one line acknowledging the learner. ` +
          `Mark "grounded" n/a for those rather than failing them.\n\n` +
          `LEARNER WROTE: ${testCase.message}\n\n` +
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

/**
 * Dashes joining clauses, checked mechanically.
 *
 * ── WHY THIS IS NOT THE JUDGE'S JOB ─────────────────────────────────────────
 * This lived in the rubric for one run. The judge failed a Hindi reply for
 * containing "an em dash", quoting a phrase that has no dash in it at all: it
 * had learned the criterion existed and confabulated the evidence to match.
 *
 * Anything a regular expression can decide should be decided by one. An LLM
 * judge is for the things that need reading, and every mechanical criterion
 * handed to it is a chance for it to invent a violation.
 */
function dashViolation(reply: string): string | null {
  // A hyphen inside a word is fine. A minus sign in maths is fine, and maths
  // arrives wrapped in $...$, so strip it before looking.
  const prose = reply.replace(/\$[^$]*\$/g, " ");
  const match = prose.match(/.{0,30}(?:—|–|\s-\s).{0,30}/);
  return match ? match[0].trim() : null;
}

/**
 * Three attempts, because a malformed verdict is a judge slip and not a tutor
 * failure, and losing the case would score the tutor for the judge's mistake.
 * Eight workers also make a rate-limit reply likelier, and that deserves a
 * pause rather than an immediate retry.
 */
async function judgeWithRetry(testCase: Case, reply: string, context: Grounding) {
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await judge(testCase, reply, context);
    } catch (error) {
      last = error;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  throw last;
}

/** The majority verdict over `RUNS` passes, and how close it was. */
function majority(verdicts: Verdict[]): { pass: boolean; passes: number; flaky: boolean } {
  const passes = verdicts.filter((v) => v.pass).length;
  return {
    pass: passes > verdicts.length / 2,
    passes,
    // Not unanimous: the case is genuinely borderline, or its criteria are in
    // tension with each other. Either way it is worth a human reading it.
    flaky: passes !== 0 && passes !== verdicts.length,
  };
}

async function main() {
  const cases = loadCases();
  // A full run is 45 minutes. Iterating on the JUDGE at that granularity is the
  // wrong loop, so both filters take comma-separated lists:
  //   npm run eval -- --case ans-r1,ans-r4,care-2
  //   npm run eval -- --category answer-in-wrong-box,wellbeing
  const arg = (name: string) =>
    process.argv.includes(name)
      ? process.argv[process.argv.indexOf(name) + 1].split(",").map((s) => s.trim())
      : null;
  const only = arg("--case");
  const categories = arg("--category");
  const running = cases.filter(
    (c) =>
      (!only || only.includes(c.id)) &&
      (!categories || categories.includes(c.category)),
  );
  if (!running.length) throw new Error("no cases matched --case / --category");

  console.log(`\nRunning ${running.length} real learner questions through the tutor.\n`);

  type Result = {
    case: Case;
    replies: string[];
    verdicts: Verdict[];
    pass: boolean;
    passes: number;
    flaky: boolean;
  };
  const results: Result[] = [];
  const errored: string[] = [];

  /**
   * ── WHY THIS IS A POOL AND NOT A FOR LOOP ──────────────────────────────────
   * 50 cases at 3 runs is 300 API calls. Run end to end they took over an hour,
   * and an eval nobody has time to run is an eval nobody runs, which defeats
   * the entire purpose of having built it.
   *
   * The calls are independent, so the only reason it was serial was that a
   * `for` loop is what you write first. Eight at a time takes it to a few
   * minutes. Kept at 8 rather than 50 because the point is to finish, not to
   * spend the run backing off from 429s.
   */
  const CONCURRENCY = 8;
  const queue = running.map((c, i) => ({ testCase: c, index: i }));
  const ordered: (Result | null)[] = new Array(running.length).fill(null);

  async function worker() {
    for (;;) {
      const item = queue.shift();
      if (!item) return;
      const { testCase, index } = item;
      try {
        const context = await grounding(testCase.lesson, testCase.locale);
        // The three passes are independent samples of the tutor, so they go out
        // together rather than one after another.
        const replies = await Promise.all(
          Array.from({ length: RUNS }, () => askTutor(testCase)),
        );
        const verdicts = await Promise.all(
          replies.map((reply) => judgeWithRetry(testCase, reply, context)),
        );
        // The deterministic criterion is applied here rather than sent to the
        // judge, and it can only ever turn a pass into a fail.
        replies.forEach((reply, i) => {
          const dash = dashViolation(reply);
          if (!dash) return;
          verdicts[i].pass = false;
          verdicts[i].criteria.push({
            name: "No dashes holding sentences together",
            verdict: "fail",
            evidence: dash,
            why: "Checked in code, not by the judge.",
          });
        });
        const { pass, passes, flaky } = majority(verdicts);
        ordered[index] = { case: testCase, replies, verdicts, pass, passes, flaky };

        const mark = pass ? (flaky ? "PASS?" : "PASS ") : flaky ? "FAIL?" : "FAIL ";
        console.log(
          `  ${mark} ${passes}/${RUNS}  ${testCase.id.padEnd(9)} ` +
            `${testCase.category.padEnd(20)} ${JSON.stringify(testCase.message).slice(0, 40)}`,
        );
        if (!pass) {
          // The criteria that failed in a MAJORITY of runs. One judge disliking
          // one phrasing once is noise, and printing it trains people to skim.
          const tally = new Map<string, number>();
          for (const v of verdicts)
            for (const c of v.criteria.filter((x) => x.verdict === "fail"))
              tally.set(c.name, (tally.get(c.name) ?? 0) + 1);
          for (const [name, n] of tally)
            if (n > RUNS / 2) console.log(`         ${n}/${RUNS} failed: ${name}`);
        }
      } catch (error) {
        console.log(`  ERROR ${testCase.id}: ${(error as Error).message}`);
        errored.push(testCase.id);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  // Finishing order is whatever the network decided. The report is grouped and
  // the transcript is diffed between runs, so both want set order.
  for (const r of ordered) if (r) results.push(r);

  const passed = results.filter((r) => r.pass).length;
  // Denominator is the set, not the cases that happened to complete. Reporting
  // "24 of 47" when the set holds 50 overstates the score and hides the loss.
  console.log(`\n${passed} of ${running.length} passed  (majority of ${RUNS} runs each).`);
  if (errored.length)
    console.log(
      `${errored.length} case(s) could not be scored and count as NOT passed: ${errored.join(", ")}`,
    );
  const flaky = results.filter((r) => r.flaky);
  if (flaky.length)
    console.log(`${flaky.length} did not agree across runs: ${flaky.map((r) => r.case.id).join(", ")}`);

  const group = (key: (r: Result) => string, label: string) => {
    const map = new Map<string, { pass: number; total: number }>();
    for (const r of results) {
      const entry = map.get(key(r)) ?? { pass: 0, total: 0 };
      entry.total += 1;
      if (r.pass) entry.pass += 1;
      map.set(key(r), entry);
    }
    console.log(`\nBy ${label}`);
    for (const [name, { pass, total }] of [...map].sort())
      console.log(`  ${name.padEnd(22)} ${pass}/${total}`);
  };
  group((r) => r.case.category, "category");
  group((r) => r.case.source, "source");

  // Regression cases are defects we already shipped once. One failing is a
  // different kind of news from a synthetic edge case failing.
  const regressions = results.filter((r) => r.case.source === "regression" && !r.pass);
  if (regressions.length) {
    console.log(`\nREGRESSED: ${regressions.length} defect(s) we had already fixed`);
    for (const r of regressions) console.log(`  ${r.case.id}: ${r.case.why ?? ""}`);
  }

  // The transcript is the point. A score tells you something regressed; the
  // replies tell you what to change about the prompt.
  mkdirSync("evals/runs", { recursive: true });
  // A filtered run is not a score of the set, and the pitch deck reads the
  // newest transcript to print the tutor's pass rate on slide 18. Naming
  // partial runs differently is what stops a six-case debugging run from
  // becoming the number on a slide.
  const partial = running.length < cases.length ? "partial-" : "";
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const path = `evals/runs/${partial}${stamp}.json`;
  // `total` is written explicitly so anything reading this file later (the
  // pitch deck quotes the score on slide 18) divides by the size of the SET
  // and not by however many cases happened to complete.
  writeFileSync(
    path,
    JSON.stringify({ total: running.length, passed, errored, results }, null, 2),
  );
  console.log(`\ntranscript: ${path}\n`);

  // The transcripts are large and gitignored, but the pitch deck quotes this
  // score and has to build from a fresh clone. So a full run also leaves a
  // small committed summary behind: the number travels, the 60KB of replies
  // does not. Filtered runs must not touch it.
  if (!partial) {
    writeFileSync(
      "evals/latest.json",
      // The per-source counts go in too, because slide 18 quotes them. A slide
      // that reads its headline from here but hardcodes the breakdown drifts
      // apart from itself at the first re-run.
      JSON.stringify(
        {
          total: running.length,
          passed,
          errored,
          flaky: results.filter((r) => r.flaky).length,
          by_source: results.reduce<Record<string, { pass: number; total: number }>>(
            (acc, r) => {
              const e = (acc[r.case.source] ??= { pass: 0, total: 0 });
              e.total += 1;
              if (r.pass) e.pass += 1;
              return acc;
            },
            {},
          ),
          judge: JUDGE_MODEL,
          run: path.split("/").pop(),
        },
        null,
        2,
      ) + "\n",
    );
  }

  if (passed < running.length) process.exitCode = 1;
}

await main();
