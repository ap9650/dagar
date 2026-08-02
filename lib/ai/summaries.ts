import "server-only";
import { anthropic, BATCH_MODEL } from "./client";
import { costInr } from "./pricing";
import { logAiCall } from "@/lib/security/aiBudget";
import { parentSummaryFacts, parentSummarySystemPrompt } from "./prompts/parentSummary";
import type { WeeklySummary } from "@/lib/parent/summary";
import type { Locale } from "@/i18n/config";

/**
 * Turning one learner's week into three sentences an adult will read (D4).
 *
 * Haiku 4.5, not Sonnet (D11): short-form rewriting of facts we already have,
 * run for every learner every week. This is the volume driver in the product,
 * and paying tutor prices for a paragraph would be the single easiest way to
 * blow the cost target.
 *
 * ── IT ALWAYS RETURNS A MESSAGE ─────────────────────────────────────────────
 * The deterministic fallback below is not a nicety. This runs in a cron over
 * many learners; a model outage must degrade the *prose*, never skip a family's
 * summary. The fallback says less and says it plainly, and a parent reading it
 * would not obviously know the difference.
 * ────────────────────────────────────────────────────────────────────────────
 */

/** Three sentences. Enough headroom for Devanagari, which runs longer. */
const MAX_SUMMARY_TOKENS = 400;

export type GeneratedSummary = {
  body: string;
  source: "ai" | "fallback";
};

/**
 * The deterministic version — real sentences, no model.
 *
 * Written from the same facts, in the recipient's language, using the message
 * dictionary's own copy where it exists so the tone matches the app. It is
 * short on purpose: a fallback that tries to sound generated is how you get a
 * fallback nobody notices is broken.
 */
function fallbackSummary(summary: WeeklySummary, locale: Locale): string {
  const name = summary.learnerName;

  if (locale === "hi") {
    if (summary.quiet) {
      return name
        ? `इस हफ़्ते ${name} ने साथी नहीं खोला। कोई बात नहीं — दस मिनट भी काफ़ी होते हैं। पूछिए कि आज एक लेसन कर लें।`
        : `इस हफ़्ते साथी नहीं खुला। कोई बात नहीं — दस मिनट भी काफ़ी होते हैं।`;
    }
    const who = name ?? "आपके बच्चे";
    const focus = summary.focus
      ? ` ${summary.focus.name} पर दस मिनट साथ बैठिए — उनसे कहिए कि आपको समझाएँ।`
      : " उनसे कहिए कि कोई सवाल आपको करके दिखाएँ।";
    return `इस हफ़्ते ${who} ने ${summary.lessonsThisWeek} लेसन और ${summary.practiceThisWeek} सवाल पूरे किए।${focus}`;
  }

  if (summary.quiet) {
    return name
      ? `${name} did not open Dagar this week. That is alright — even ten minutes counts. Ask them to try one lesson today.`
      : `Dagar was not opened this week. That is alright — even ten minutes counts.`;
  }
  const who = name ?? "Your child";
  const focus = summary.focus
    ? ` If you have ten minutes, sit with them on ${summary.focus.name} — ask them to explain it to you.`
    : " Ask them to show you a question they worked out.";
  return `${who} finished ${summary.lessonsThisWeek} lessons and ${summary.practiceThisWeek} practice questions this week.${focus}`;
}

/**
 * `studentId` is passed for the AI-call log only — it is not in the prompt.
 * Nothing identifying the learner beyond their display name reaches the model.
 */
export async function generateParentSummary({
  summary,
  locale,
  studentId,
}: {
  summary: WeeklySummary;
  /** The RECIPIENT's language, not the learner's (D16). */
  locale: Locale;
  studentId: string;
}): Promise<GeneratedSummary> {
  const startedAt = Date.now();

  try {
    const response = await anthropic().messages.create({
      model: BATCH_MODEL,
      max_tokens: MAX_SUMMARY_TOKENS,
      system: parentSummarySystemPrompt(locale),
      // No thinking: the task is rewriting supplied facts, not reasoning about
      // them.
      //
      // NOTE: no `output_config.effort` here, unlike the tutor. That parameter
      // is Claude 5 only, and Haiku 4.5 rejects it outright —
      // `400 This model does not support the effort parameter`. Copying the
      // tutor's call shape onto a different model generation is exactly how
      // this broke, and the failure was invisible: the fallback caught it and a
      // plausible summary went out with `source: "fallback"` in the payload.
      thinking: { type: "disabled" },
      messages: [{ role: "user", content: parentSummaryFacts(summary) }],
    });

    const text = response.content
      .filter((block): block is { type: "text"; text: string; citations: null } =>
        block.type === "text",
      )
      .map((block) => block.text)
      .join("")
      .trim();

    await logAiCall({
      student_id: studentId,
      kind: "summary",
      model: BATCH_MODEL,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_read_tokens: response.usage.cache_read_input_tokens ?? 0,
      cost_inr: costInr({
        model: BATCH_MODEL,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
      }),
      latency_ms: Date.now() - startedAt,
      ok: true,
    });

    if (text.length === 0) return { body: fallbackSummary(summary, locale), source: "fallback" };
    return { body: text, source: "ai" };
  } catch (error) {
    console.error("[parent-summary]", error);

    await logAiCall({
      student_id: studentId,
      kind: "summary",
      model: BATCH_MODEL,
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 0,
      cost_inr: 0,
      latency_ms: Date.now() - startedAt,
      ok: false,
      error: error instanceof Error ? error.message.slice(0, 300) : "unknown",
    });

    return { body: fallbackSummary(summary, locale), source: "fallback" };
  }
}
