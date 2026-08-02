import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/security/authGuard";
import { memoryLimit, tooManyRequests } from "@/lib/security/rateLimiter";
import { generateShareToken, isShareLinkExpired } from "@/lib/parent/shareToken";

/**
 * The learner's control over their own share link (migration 0014).
 *
 *   POST   create it, or return the live one
 *   DELETE revoke it
 *
 * `requireRole("student")` on both: this is the learner's link to their own
 * data, and nobody else — not even a linked parent — can mint or revoke one.
 *
 * DELETE is as important as POST here and is not an afterthought. The link is
 * the one thing in Dagar a learner hands to someone outside the app, so being
 * able to take it back has to be as easy as giving it. Revocation is immediate:
 * the token stops resolving on the next request, with nothing cached in between.
 */

export async function POST() {
  const auth = await requireRole("student");
  if (!auth.ok) return auth.response;

  const limit = memoryLimit(`summary-link:${auth.userId}`, 10, 600);
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

  const supabase = await createClient();

  // Reuse the live one. Sharing twice must not mint a second token — the first
  // is already out there in somebody's WhatsApp, and a learner who revokes
  // "the" link should not discover an older one still works.
  const { data: existing } = await supabase
    .from("summary_links")
    .select("token, expires_at, last_viewed_at, view_count")
    .eq("student_id", auth.userId)
    .is("revoked_at", null)
    .maybeSingle();

  if (existing && !isShareLinkExpired(existing.expires_at)) {
    return NextResponse.json({
      token: existing.token,
      expires_at: existing.expires_at,
      last_viewed_at: existing.last_viewed_at,
      view_count: existing.view_count,
      reused: true,
    });
  }

  // Expired but not revoked: retire it so the partial unique index frees up.
  if (existing) {
    await supabase
      .from("summary_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("student_id", auth.userId)
      .is("revoked_at", null);
  }

  const { data: created, error } = await supabase
    .from("summary_links")
    .insert({ student_id: auth.userId, token: generateShareToken() })
    .select("token, expires_at")
    .single();

  if (error || !created) {
    console.error("[summary-links]", error?.message);
    return NextResponse.json(
      { error: "Could not create a link", code: "SHARE_LINK_FAILED" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    token: created.token,
    expires_at: created.expires_at,
    last_viewed_at: null,
    view_count: 0,
    reused: false,
  });
}

export async function DELETE() {
  const auth = await requireRole("student");
  if (!auth.ok) return auth.response;

  const supabase = await createClient();

  // Revoked, never deleted. The row is the record that a link existed and was
  // withdrawn; deleting it would lose that, and `revoked_at` is what the token
  // lookup checks.
  const { error } = await supabase
    .from("summary_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("student_id", auth.userId)
    .is("revoked_at", null);

  if (error) {
    console.error("[summary-links DELETE]", error.message);
    return NextResponse.json(
      { error: "Could not turn off the link", code: "SHARE_LINK_REVOKE_FAILED" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
