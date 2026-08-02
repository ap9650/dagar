/**
 * What a model call cost, in rupees.
 *
 * `ai_calls.cost_inr` is written from this on every call, and the D11 daily
 * ceiling (₹150) sums that column — so a wrong number here does not just skew a
 * dashboard, it moves the point at which the tutor turns itself off.
 *
 * Every rate below is a **stated assumption with a date**, not a lookup. Prices
 * change and this file cannot notice; when it drifts, the symptom is a budget
 * that trips early or late rather than an error.
 */

/**
 * USD → INR. Assumption, not a live rate — Dagar does not call an FX API for
 * a number that only feeds a spend ceiling with a wide margin.
 */
export const USD_TO_INR = 88;

/**
 * Sonnet 5 introductory pricing runs to **2026-08-31**, after which input goes
 * $2 → $3 and output $10 → $15 per million tokens (D11).
 *
 * The date is checked at call time rather than hardcoded to one rate, because
 * the switch lands four weeks after this was written — during the pilot, not
 * after it. Getting a 50% cost rise as a surprise mid-pilot is exactly the kind
 * of thing the daily ceiling exists to catch, and exactly the kind of thing it
 * would catch too late.
 */
const INTRO_PRICING_ENDS = Date.parse("2026-09-01T00:00:00+05:30");

type Rates = { input: number; output: number; cacheRead: number };

/** USD per million tokens. */
function ratesFor(model: string, at: Date): Rates {
  if (model.startsWith("claude-haiku")) {
    return { input: 1, output: 5, cacheRead: 0.1 };
  }

  // Sonnet 5 — the tutor.
  const intro = at.getTime() < INTRO_PRICING_ENDS;
  return {
    input: intro ? 2 : 3,
    output: intro ? 10 : 15,
    // Cache reads are 0.1x the input rate (D11). This is the ~40% saving the
    // caching work buys, and it only materialises if the prefix actually caches
    // — see the 1024-token minimum in prompts/tutor.ts.
    cacheRead: (intro ? 2 : 3) * 0.1,
  };
}

export function costInr({
  model,
  inputTokens,
  outputTokens,
  cacheReadTokens = 0,
  cacheWriteTokens = 0,
  at = new Date(),
}: {
  model: string;
  /** Uncached input only — Anthropic reports it that way. */
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  at?: Date;
}): number {
  const rates = ratesFor(model, at);
  const perToken = (usdPerMillion: number) => (usdPerMillion / 1_000_000) * USD_TO_INR;

  return (
    inputTokens * perToken(rates.input) +
    outputTokens * perToken(rates.output) +
    cacheReadTokens * perToken(rates.cacheRead) +
    // Writing the cache costs 1.25x the input rate. Counting it as plain input
    // would under-report every first-turn call by 25%.
    cacheWriteTokens * perToken(rates.input * 1.25)
  );
}
