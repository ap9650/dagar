/**
 * Rate limiting.
 *
 * Two mechanisms, deliberately:
 *
 *   memoryLimit()  — in-process sliding window. Cheap, instant, and good enough
 *                    for auth brute-force. HONEST LIMITATION: Vercel runs many
 *                    instances, each with its own memory, so the effective limit
 *                    is (limit × instances). That is fine for slowing a password
 *                    guesser; it is NOT fine for anything that costs money.
 *
 *   dbLimit()      — counts real rows in Postgres. Slower (one query) but exact
 *                    across every instance. Use it wherever exceeding the limit
 *                    costs money or exposes data.
 *
 * The rule: if going over the limit spends rupees, use dbLimit.
 */

// ─── in-memory sliding window ────────────────────────────────────────────────

type Bucket = { hits: number[] };
const buckets = new Map<string, Bucket>();

export type LimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function memoryLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): LimitResult {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const bucket = buckets.get(key) ?? { hits: [] };

  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0];
    buckets.set(key, bucket);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
    };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);

  // Keep the map from growing forever in a long-lived instance.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.hits.every((t) => now - t >= windowMs)) buckets.delete(k);
    }
  }

  return { allowed: true, remaining: limit - bucket.hits.length, retryAfterSeconds: 0 };
}

// ─── the limits, in one place ────────────────────────────────────────────────

export const LIMITS = {
  /** D2 — slows credential guessing against a child's account. */
  auth: { limit: 10, windowSeconds: 60 },
  /** D2 — a 6-char link code with unlimited guesses is an enumeration attack. */
  parentLinkClaim: { limit: 5, windowSeconds: 600 },
  /** D11 — 30 tutor messages/hour/learner. Enforced against the DB, not memory. */
  tutor: { limit: 30, windowSeconds: 3600 },
  /** Blocks a scripted answer-submission loop. */
  attempts: { limit: 120, windowSeconds: 60 },
} as const;

// ─── helper for route handlers ───────────────────────────────────────────────

import { NextResponse } from "next/server";

export function tooManyRequests(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Too many requests", code: "RATE_LIMITED" },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}
