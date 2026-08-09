import { createAdminClient } from "@/lib/supabase/admin";

/**
 * AI cost and abuse limits, enforced against the database so they hold across
 * every serverless instance. In-memory counting cannot do this job — two Vercel
 * instances would each allow the full quota.
 *
 * Two independent ceilings (DECISIONS D11):
 *   - per learner, per hour  → stops one account draining the budget
 *   - global, per day        → stops a bug draining it
 */

export const TUTOR_MESSAGES_PER_HOUR = 30;

/**
 * Higher than the tutor's, because hints are how practice is MEANT to work.
 *
 * A learner escalating all four tiers (nudge → method → worked step → solution)
 * on fifteen questions in an hour is a good hour, not an attack. Set this too
 * tight and the limit fires on the product working correctly, which is how
 * limits get removed instead of tuned.
 */
export const HINTS_PER_HOUR = 60;

export const DAILY_SPEND_CEILING_INR = 150;

/** Per-learner hourly ceiling, by call kind. */
const HOURLY_CEILING: Record<AiCallKind, number> = {
  tutor: TUTOR_MESSAGES_PER_HOUR,
  hint: HINTS_PER_HOUR,
};

export type AiCallKind = "tutor" | "hint";

export type BudgetVerdict =
  | { allowed: true }
  | { allowed: false; reason: "rate_limited"; retryAfterSeconds: number }
  | { allowed: false; reason: "daily_ceiling" };

/**
 * Call BEFORE the model call. Returning `allowed: false` means: skip the call and
 * render the tutor-unavailable state. Lessons, practice and the quiz must keep
 * working — the ceiling degrades the tutor, never the app.
 */
export async function checkAiBudget(
  studentId: string,
  /**
   * Which ceiling to check. This was not a parameter until 31 Jul, and the
   * count was hardcoded to `kind = 'tutor'` — so the hint route called this
   * function, passed the check, and was never actually limited. A learner with
   * zero tutor messages had an unbounded hint allowance.
   *
   * The cost of one hint is trivial. The problem is the SHARED ceiling below:
   * one learner leaning on the hint button drains the global daily budget, and
   * the tutor then degrades for everybody. A per-learner limit that silently
   * covers only one of the two AI routes is not a per-learner limit.
   */
  kind: AiCallKind = "tutor",
): Promise<BudgetVerdict> {
  const admin = createAdminClient();

  // 1. Per-learner hourly rate, per kind (D11).
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count, error: countError } = await admin
    .from("ai_calls")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId)
    .eq("kind", kind)
    .gte("created_at", since);

  // Fail OPEN on an infrastructure error: a flaky count query must not take the
  // tutor down. The daily ceiling below is the backstop that bounds the damage.
  if (!countError && (count ?? 0) >= HOURLY_CEILING[kind]) {
    return { allowed: false, reason: "rate_limited", retryAfterSeconds: 300 };
  }

  // 2. Global daily spend ceiling (D11), Asia/Kolkata day.
  const { data: spend, error: spendError } = await admin.rpc("ai_spend_today");
  if (!spendError && Number(spend ?? 0) >= DAILY_SPEND_CEILING_INR) {
    return { allowed: false, reason: "daily_ceiling" };
  }

  return { allowed: true };
}

/**
 * Write one ai_calls row. MUST NEVER throw into the caller — a logging failure
 * cannot be allowed to break a learner's lesson (D11).
 */
export async function logAiCall(row: {
  student_id: string | null;
  kind: "tutor" | "hint" | "summary";
  model: string;
  lesson_id?: string | null;
  concept_id?: string | null;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  /**
   * Required, not optional, since 0030. It bills at 1.25x input and dominates a
   * first-turn exchange, so a call site that forgets it under-reports the most
   * expensive tokens in the product and `cost_inr` stops being reconstructable
   * from the row beside it. Making it mandatory means the compiler catches the
   * next call site rather than a spreadsheet catching it months later.
   */
  cache_write_tokens: number;
  cost_inr: number;
  latency_ms?: number | null;
  ttft_ms?: number | null;
  ok: boolean;
  error?: string | null;
}) {
  try {
    await createAdminClient().from("ai_calls").insert(row);
  } catch (e) {
    console.error("[ai-log] failed to record ai_call (swallowed):", e);
  }
}
