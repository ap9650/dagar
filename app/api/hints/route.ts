import { NextResponse } from "next/server";
import { getLocale } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/security/authGuard";
import { hintSchema, parseBody } from "@/lib/security/validation";
import { checkAiBudget, logAiCall } from "@/lib/security/aiBudget";
import { anthropic, TUTOR_MODEL } from "@/lib/ai/client";
import { costInr } from "@/lib/ai/pricing";
import { containsAnswer, hintSystemPrompt, hintUserPrompt } from "@/lib/ai/prompts/hints";
import { methodHint } from "@/lib/learning/hints";
import { track } from "@/lib/analytics/track";
import { t as tContent, tChoices } from "@/lib/i18n/content";
import type { Locale } from "@/i18n/config";

/**
 * POST /api/hints — one grounded hint, at the requested tier.
 *
 * Not streamed: a hint is two sentences, and a streaming envelope would add
 * complexity for a payload that arrives in one breath.
 *
 * ── THE ANSWER NEVER LEAVES THIS HANDLER ────────────────────────────────────
 * The model IS given `solution_md`, so its hint is grounded rather than
 * re-derived (a confidently wrong hint is worse than none — the learner trusts
 * it). It is then checked against the real `answer_value` before anything is
 * sent, and a hint that leaked the answer is thrown away in favour of the
 * deterministic fallback. Prompt plus check, because the prompt alone is a
 * request and the check is a guarantee.
 * ────────────────────────────────────────────────────────────────────────────
 */

/** Bounded tight — a hint is two sentences and a runaway one costs money. */
const MAX_HINT_TOKENS = 300;

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const parsed = await parseBody(request, hintSchema);
  if (!parsed.ok) return parsed.response;

  const { question_id, tier } = parsed.data;
  const locale = (await getLocale()) as Locale;
  const admin = createAdminClient();

  // "Hints before answers" is a claim this product makes, and nothing measured
  // whether anyone takes them. `tier` is the interesting half: a learner who
  // escalates to the worked step is a different learner from one who reads the
  // nudge and gets it. The question id is a curriculum id, not learner data —
  // which question is hard is exactly what we want to know.
  //
  // Emitted BEFORE the AI call, so a hint that times out still counts as asked.
  await track("hint_requested", { question_id, tier });

  // Service role: one of the three places in the product that read the base
  // `questions` table — the others being practice grading in `/api/attempts` and
  // quiz grading in `lib/learning/quiz.ts`. Everything else goes through
  // `questions_public`, which has no answer columns at all.
  const { data: question } = await admin
    .from("questions")
    .select("id, concept_id, stem_md, answer_value, solution_md, choices, i18n")
    .eq("id", question_id)
    .maybeSingle();

  if (!question) {
    return NextResponse.json({ error: "Question not found", code: "NOT_FOUND" }, { status: 404 });
  }

  const solutionLocalised = tContent(question, "solution_md", locale);
  const stem = tContent(question, "stem_md", locale);

  // The fallback goes through the SAME guard as the AI hint.
  //
  // It did not, at first, and that was the more serious of the two bugs found
  // testing this route: `methodHint` returns the opening line of the worked
  // solution, and for one seeded question that line is "the denominator went
  // from 3 to 9, so it was multiplied by 3" — for a question whose answer is 3.
  // Every rejected AI hint was being replaced by something that leaked at least
  // as badly. A guard the fallback path walks around is not a guard.
  const rawFallback = methodHint(solutionLocalised);
  const fallback = containsAnswer(rawFallback, question.answer_value, stem)
    ? ""
    : rawFallback;

  // "hint", not the default: this route was silently unlimited while appearing
  // to be guarded, because the count was hardcoded to tutor calls.
  const budget = await checkAiBudget(auth.userId, "hint");
  if (!budget.allowed) {
    return NextResponse.json({ hint: fallback, source: "fallback" });
  }

  const startedAt = Date.now();

  try {
    const response = await anthropic().messages.create({
      model: TUTOR_MODEL,
      max_tokens: MAX_HINT_TOKENS,
      system: hintSystemPrompt(locale),
      // Latency matters as much here as in the tutor: this fires while the
      // learner is sitting on a wrong answer waiting to try again.
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
      messages: [
        {
          role: "user",
          content: hintUserPrompt({
            tier,
            stem,
            solution: solutionLocalised,
            choices: tChoices(question, locale),
          }),
        },
      ],
    });

    const text = response.content
      .filter((block): block is { type: "text"; text: string; citations: null } =>
        block.type === "text",
      )
      .map((block) => block.text)
      .join("")
      .trim();

    const leaked = containsAnswer(text, question.answer_value, stem);
    if (leaked) {
      console.warn(`[hints] tier ${tier} leaked the answer for ${question_id}; using fallback`);
    }

    await logAiCall({
      student_id: auth.userId,
      kind: "hint",
      model: TUTOR_MODEL,
      concept_id: question.concept_id,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_read_tokens: response.usage.cache_read_input_tokens ?? 0,
      cost_inr: costInr({
        model: TUTOR_MODEL,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
      }),
      latency_ms: Date.now() - startedAt,
      ok: true,
    });

    return NextResponse.json({
      hint: text.length > 0 && !leaked ? text : fallback,
      source: text.length > 0 && !leaked ? "ai" : "fallback",
    });
  } catch (error) {
    console.error("[hints]", error);

    await logAiCall({
      student_id: auth.userId,
      kind: "hint",
      model: TUTOR_MODEL,
      concept_id: question.concept_id,
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 0,
      cost_inr: 0,
      latency_ms: Date.now() - startedAt,
      ok: false,
      error: error instanceof Error ? error.message.slice(0, 300) : "unknown",
    });

    // 200, not 500. The learner gets a real hint; the outage is our problem,
    // not something to show someone who is stuck on a fraction.
    return NextResponse.json({ hint: fallback, source: "fallback" });
  }
}
