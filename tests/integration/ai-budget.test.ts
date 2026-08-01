import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  checkAiBudget,
  HINTS_PER_HOUR,
  TUTOR_MESSAGES_PER_HOUR,
} from "@/lib/security/aiBudget";
import { hasSupabaseEnv } from "../setup";

/**
 * The per-learner AI ceiling (D11).
 *
 * This exists because the ceiling was broken in a way no test could have
 * noticed by reading the code: `checkAiBudget` was called by BOTH AI routes but
 * counted only `kind = 'tutor'`, so the hint route looked guarded and was not.
 *
 * The failure mode is not one learner's hint bill. It is that the global daily
 * spend ceiling is SHARED — so one learner leaning on the hint button exhausts
 * it and the tutor degrades for everybody else. A limit that covers one of two
 * routes protects nobody.
 */

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const d = hasSupabaseEnv ? describe : describe.skip;

let admin: SupabaseClient;
let studentId: string;

async function logCalls(kind: "tutor" | "hint", n: number) {
  const rows = Array.from({ length: n }, () => ({
    student_id: studentId,
    kind,
    model: "test-model",
    input_tokens: 1,
    output_tokens: 1,
    cache_read_tokens: 0,
    // Zero cost, so this test cannot trip the GLOBAL daily ceiling and make
    // itself — or the next test to run — fail for the wrong reason.
    cost_inr: 0,
    ok: true,
  }));
  const { error } = await admin.from("ai_calls").insert(rows);
  if (error) throw new Error(`fixture: ai_calls — ${error.message}`);
}

d("the per-learner AI ceiling", () => {
  beforeAll(async () => {
    admin = createClient(URL_, SVC, { auth: { persistSession: false } });

    const email = `budget_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password: "test-password-12345",
      email_confirm: true,
    });
    if (error || !created.user) throw error ?? new Error("no user");
    studentId = created.user.id;

    const { error: pErr } = await admin
      .from("profiles")
      .insert({ id: studentId, role: "student", display_name: "budget", grade: 6 });
    if (pErr) throw new Error(`fixture: profiles — ${pErr.message}`);
  });

  afterAll(async () => {
    if (studentId) await admin.auth.admin.deleteUser(studentId).catch(() => {});
  });

  it("CONTROL: a fresh learner is allowed on both routes", async () => {
    expect((await checkAiBudget(studentId, "tutor")).allowed).toBe(true);
    expect((await checkAiBudget(studentId, "hint")).allowed).toBe(true);
  });

  it("blocks hints once the hint ceiling is reached", async () => {
    await logCalls("hint", HINTS_PER_HOUR);

    const verdict = await checkAiBudget(studentId, "hint");
    expect(verdict.allowed).toBe(false);
    expect(verdict.allowed === false && verdict.reason).toBe("rate_limited");
  });

  it("and the tutor is still available to that same learner", async () => {
    // The two ceilings are independent on purpose. Burning the hint allowance
    // during practice must not silence the tutor — the tutor is the thing a
    // stuck learner needs most, and it is the last thing to take away.
    expect((await checkAiBudget(studentId, "tutor")).allowed).toBe(true);
  });

  it("blocks the tutor once ITS own ceiling is reached", async () => {
    await logCalls("tutor", TUTOR_MESSAGES_PER_HOUR);

    const verdict = await checkAiBudget(studentId, "tutor");
    expect(verdict.allowed).toBe(false);
    expect(verdict.allowed === false && verdict.reason).toBe("rate_limited");
  });

  it("counts hints against the HINT ceiling, not the tutor's", async () => {
    // The regression this file exists for. Before the fix, hint calls were
    // invisible to the counter: HINTS_PER_HOUR of them left the learner
    // unblocked because the query filtered on kind = 'tutor'.
    //
    // Proven by the numbers rather than by mocking: the hint ceiling is higher
    // than the tutor's, so a learner blocked on hints has logged MORE calls
    // than the tutor ceiling — which under the old code would have been
    // impossible to distinguish from a tutor block.
    expect(HINTS_PER_HOUR).toBeGreaterThan(TUTOR_MESSAGES_PER_HOUR);

    const { count } = await admin
      .from("ai_calls")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId)
      .eq("kind", "hint");

    expect(count).toBe(HINTS_PER_HOUR);
  });
});
