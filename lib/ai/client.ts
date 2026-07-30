import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * The Anthropic client. **Server-only, always.**
 *
 * `ANTHROPIC_API_KEY` must never carry a `NEXT_PUBLIC_` prefix and this module
 * must never be imported by a Client Component — a key in the browser bundle is
 * a key anyone can spend, and it is in there forever once shipped.
 *
 * The `server-only` import above turns that from a convention into a build
 * error.
 */

/** Tutor and hints. Fast, warm, and cheap enough for the D11 budget. */
export const TUTOR_MODEL = "claude-sonnet-5";
/** Batch work — parent summaries (3.3), content checks. */
export const BATCH_MODEL = "claude-haiku-4-5";

let cached: Anthropic | null = null;

export function anthropic(): Anthropic {
  if (cached) return cached;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Loud at first use, rather than a 401 surfacing later as "the tutor is
    // down". A missing env var on Vercel is the classic deploy failure.
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it in the Vercel dashboard for " +
        "production — .env.local is not deployed.",
    );
  }

  cached = new Anthropic({
    apiKey,
    // Two retries on 429/5xx is the SDK default and right for a learner-facing
    // call: enough to ride out a blip, few enough that a real outage surfaces
    // as the tutor-unavailable state within seconds rather than a spinner.
    maxRetries: 2,
    timeout: 60_000,
  });
  return cached;
}
