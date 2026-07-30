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
export const DAILY_SPEND_CEILING_INR = 150;

export type BudgetVerdict =
  | { allowed: true }
  | { allowed: false; reason: "rate_limited"; retryAfterSeconds: number }
  | { allowed: false; reason: "daily_ceiling" };

/**
 * Call BEFORE the model call. Returning `allowed: false` means: skip the call and
 * render the tutor-unavailable state. Lessons, practice and the quiz must keep
 * working — the ceiling degrades the tutor, never the app.
 */
export async function checkAiBudget(studentId: string): Promise<BudgetVerdict> {
  const admin = createAdminClient();

  // 1. Per-learner hourly rate (D11).
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count, error: countError } = await admin
    .from("ai_calls")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId)
    .eq("kind", "tutor")
    .gte("created_at", since);

  // Fail OPEN on an infrastructure error: a flaky count query must not take the
  // tutor down. The daily ceiling below is the backstop that bounds the damage.
  if (!countError && (count ?? 0) >= TUTOR_MESSAGES_PER_HOUR) {
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
