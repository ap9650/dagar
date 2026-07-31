import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/security/authGuard";
import { claimLinkCodeSchema, parseBody } from "@/lib/security/validation";
import { LIMITS, memoryLimit, tooManyRequests } from "@/lib/security/rateLimiter";
import { track } from "@/lib/analytics/track";
import { isLinkCodeExpired } from "@/lib/parent/linkCode";

/**
 * POST /api/parent-links/claim — a parent redeems a 6-character code.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THIS ROUTE CREATES THE ONLY CROSS-USER READ PATH IN SAATHI.
 *
 * Everything else in the product is "a learner reads their own rows". After this
 * handler succeeds, one adult can read one child's learning data — so this is
 * the single place where getting it wrong exposes a minor to a stranger.
 *
 * Four things hold the line, and all four are here rather than in RLS, because
 * RLS cannot express "the claimer knows a secret":
 *
 *   1. the rate limit — 5 attempts per 10 minutes. A 6-character code from a
 *      31-character alphabet is ~887 million combinations; unlimited guessing
 *      turns that into an afternoon's work, and the limit is what makes the code
 *      length sufficient rather than decorative.
 *   2. expiry — a code stops working after 72 hours (D2)
 *   3. single use — the claim is a conditional update on `status = 'pending'`,
 *      so a code cannot be redeemed twice even by two simultaneous requests
 *   4. self-claim and role checks — a learner cannot link to themselves, and
 *      someone who is already a learner cannot become a parent
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Uses the SERVICE ROLE to look the code up, and it must: a parent has no RLS
 * path to a `parent_links` row that is not already theirs. That is why the write
 * is a route handler and never a client write (migration 0001 says so in as many
 * words) — a client that could set `parent_id` to itself on an arbitrary row
 * would be the whole boundary, gone.
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  // Keyed on the CLAIMANT, and this is the enumeration defence named above.
  const limit = memoryLimit(
    `parent-claim:${auth.userId}`,
    LIMITS.parentLinkClaim.limit,
    LIMITS.parentLinkClaim.windowSeconds,
  );
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

  const parsed = await parseBody(request, claimLinkCodeSchema);
  if (!parsed.ok) return parsed.response;

  // Already normalised by the schema; the constant is what the DB stores.
  const code = parsed.data.link_code;
  const admin = createAdminClient();
  const supabase = await createClient();

  // Is the claimant already a learner? Roles are exclusive: a `profiles` row is
  // one or the other, and a student who claims a code would otherwise flip their
  // own role and lose their grade — and their whole dashboard with it.
  const { data: ownProfile } = await supabase
    .from("profiles")
    .select("id, role, locale")
    .eq("id", auth.userId)
    .maybeSingle();

  if (ownProfile?.role === "student") {
    return NextResponse.json(
      { error: "This is for a parent's account", code: "ALREADY_A_LEARNER" },
      { status: 409 },
    );
  }

  const { data: link } = await admin
    .from("parent_links")
    .select("id, student_id, status, created_at")
    .eq("link_code", code)
    .maybeSingle();

  // One message for "no such code" and for "already claimed", deliberately.
  // Distinguishing them tells someone guessing which codes exist, which is the
  // first half of the attack the rate limit is there to stop.
  if (!link || link.status !== "pending") {
    return NextResponse.json(
      { error: "That code did not work", code: "INVALID_CODE" },
      { status: 404 },
    );
  }

  if (isLinkCodeExpired(link.created_at)) {
    // Expiry IS distinguished, because the recovery is different: the parent
    // needs to ask for a new code rather than re-check the one they have. That
    // is worth the small amount it leaks — the code was real but is now dead.
    return NextResponse.json(
      { error: "That code has expired", code: "EXPIRED_CODE" },
      { status: 410 },
    );
  }

  // Belt and braces, and currently unreachable: only a learner can create a
  // link, and a learner is already turned away by the role check above. It stays
  // because it is the check that would still be right if roles ever changed, and
  // because "you cannot be your own parent" should be stated somewhere.
  if (link.student_id === auth.userId) {
    return NextResponse.json(
      { error: "That is your own code", code: "SELF_CLAIM" },
      { status: 409 },
    );
  }

  // The learner's locale becomes the parent's default (D16). A Hindi-medium
  // household is a Hindi-medium household; making the parent find a language
  // toggle before they can read anything is the wall this decision removes.
  // They can change it afterwards in the parent view.
  const { data: learner } = await admin
    .from("profiles")
    .select("locale, display_name")
    .eq("id", link.student_id)
    .maybeSingle();

  if (!ownProfile) {
    // `role` is set HERE, server-side, and is absent from every zod schema in
    // the product. A client that could send `role: "parent"` could read a child's
    // data through the parent policy.
    const { error: profileError } = await admin.from("profiles").insert({
      id: auth.userId,
      role: "parent",
      grade: null,
      locale: learner?.locale ?? "en",
    });

    if (profileError) {
      console.error("[parent-claim] profile insert failed:", profileError.message);
      return NextResponse.json(
        { error: "Could not set up your account", code: "PROFILE_FAILED" },
        { status: 500 },
      );
    }
  }

  // Single use, atomically. `.eq("status", "pending")` in the UPDATE is what
  // makes two simultaneous claims resolve to one winner — a read-then-write
  // check would let both through.
  const { data: claimed } = await admin
    .from("parent_links")
    .update({
      parent_id: auth.userId,
      status: "active",
      claimed_at: new Date().toISOString(),
    })
    .eq("id", link.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (!claimed) {
    return NextResponse.json(
      { error: "That code did not work", code: "INVALID_CODE" },
      { status: 404 },
    );
  }

  // No student_id, no name, no code — the metric is "a link was made".
  await track("parent_linked", {});

  return NextResponse.json({
    ok: true,
    learner_name: learner?.display_name ?? null,
    locale: learner?.locale ?? "en",
  });
}
