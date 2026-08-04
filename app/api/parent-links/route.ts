import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/security/authGuard";
import { memoryLimit, tooManyRequests } from "@/lib/security/rateLimiter";
import { generateLinkCode, isLinkCodeExpired } from "@/lib/parent/linkCode";
import { track } from "@/lib/analytics/track";

/**
 * POST /api/parent-links — the learner asks for a code to give a parent.
 *
 * `requireRole("student")`: a parent cannot mint an invitation to a child's
 * account. That is the whole shape of D2 — links are issued by the learner, in
 * the learner's own session, and claimed by whoever they hand the code to.
 *
 * IDEMPOTENT, and that matters more than it looks. A learner who opens Settings
 * three times must not create three live codes: every extra code is another
 * guessable key to the same account, and the guess space is what the rate limit
 * on redemption is protecting. One pending code per learner at a time.
 */
export async function POST() {
  const auth = await requireRole("student");
  if (!auth.ok) return auth.response;

  const limit = memoryLimit(`parent-link:${auth.userId}`, 10, 600);
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

  const supabase = await createClient();

  // Reuse a pending code that has not expired. Showing the learner the same code
  // they saw yesterday is correct — they may have already read it to a parent.
  const { data: pending } = await supabase
    .from("parent_links")
    .select("id, link_code, created_at")
    .eq("student_id", auth.userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pending && !isLinkCodeExpired(pending.created_at)) {
    return NextResponse.json({
      link_code: pending.link_code,
      created_at: pending.created_at,
      reused: true,
    });
  }

  // Retry on collision. `link_code` is unique across the whole table, so two
  // learners generating at the same instant can clash — vanishingly unlikely at
  // 31^6, but a unique-violation shown to a learner as "something went wrong"
  // for a one-in-a-billion event is a worse outcome than three cheap attempts.
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateLinkCode();
    const { data: created, error } = await supabase
      .from("parent_links")
      .insert({ student_id: auth.userId, link_code: code })
      .select("link_code, created_at")
      .single();

    if (!error && created) {
      // Same reasoning as the share link: created only, never the reuse path
      // above, and the code itself is never a prop — it is the secret that
      // grants an adult access to a child's progress.
      await track("parent_invite_created", { kind: "link_code" });

      return NextResponse.json({
        link_code: created.link_code,
        created_at: created.created_at,
        reused: false,
      });
    }

    if (error && error.code !== "23505") {
      console.error("[parent-links]", error.message);
      break;
    }
  }

  return NextResponse.json(
    { error: "Could not create a code", code: "LINK_CODE_FAILED" },
    { status: 500 },
  );
}
