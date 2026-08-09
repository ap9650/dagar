import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/security/authGuard";
import { memoryLimit, tooManyRequests } from "@/lib/security/rateLimiter";
import { generateShareToken, isShareLinkExpired } from "@/lib/parent/shareToken";
import { summaryRecipientSchema, parseBody } from "@/lib/security/validation";
import { track } from "@/lib/analytics/track";

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
    .select("token, expires_at, last_viewed_at, view_count, recipient_e164, recipient_opted_in_at")
    .eq("student_id", auth.userId)
    .is("revoked_at", null)
    .maybeSingle();

  if (existing && !isShareLinkExpired(existing.expires_at)) {
    return NextResponse.json({
      token: existing.token,
      expires_at: existing.expires_at,
      last_viewed_at: existing.last_viewed_at,
      view_count: existing.view_count,
      // The learner's own number, back to the learner's own browser. Needed so
      // the card can show what is already saved rather than an empty field
      // that looks like nothing was ever entered.
      recipient_e164: existing.recipient_e164,
      recipient_opted_in: Boolean(existing.recipient_opted_in_at),
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

  // The parent funnel's first step, which had none: only `parent_linked`
  // existed, so an invite nobody redeemed was indistinguishable from an invite
  // nobody made — and those call for opposite fixes.
  //
  // NOT on the reuse path above. Handing out the same link twice is one learner
  // reaching for a parent once, and this number is a count of learners who
  // tried. The token itself never goes near an event: it is the secret.
  await track("parent_invite_created", { kind: "summary_link" });

  return NextResponse.json({
    token: created.token,
    expires_at: created.expires_at,
    last_viewed_at: null,
    view_count: 0,
    recipient_e164: null,
    recipient_opted_in: false,
    reused: false,
  });
}

/**
 * PATCH — where the weekly summary should be sent.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE HALF OF D4 THAT WAS NEVER BUILT.
 *
 * Migration 0015 added `recipient_e164` and `recipient_opted_in_at`, the cron
 * reads both, the WhatsApp adapter is written and Twilio is configured. Nothing
 * ever collected the number, so every row held null and the weekly cron sent
 * nothing on 2 August and would have sent nothing again. A delivery path that
 * cannot be reached is not a feature, it is four working parts and a gap.
 *
 * ── THE NUMBER IS AN INTENTION. IT IS NOT A PERMISSION. ─────────────────────
 * A child typing an adult's number cannot consent on that adult's behalf, so
 * this writes `recipient_e164` and NOTHING ELSE. `recipient_opted_in_at` stays
 * null until the adult sends the join code from their own handset, and delivery
 * checks it. Setting both here would be a child granting consent for a parent,
 * which is exactly what 0015 forbids.
 *
 * ── IT NEVER REACHES AN EVENT, A PROMPT OR A LOG ────────────────────────────
 * No analytics event is emitted here at all. The error path logs Postgres's own
 * text and never the request body. This is PII, and it is not even the PII of
 * the account holder.
 *
 * (Written without naming the analytics function: `tests/unit/events.test.ts`
 * scans 400 characters past any call to it, and a prose mention of it in a
 * comment is enough to trip the check. A blunt guard is the right kind here.)
 * ═══════════════════════════════════════════════════════════════════════════
 */
export async function PATCH(request: Request) {
  const auth = await requireRole("student");
  if (!auth.ok) return auth.response;

  const limit = memoryLimit(`summary-recipient:${auth.userId}`, 10, 600);
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

  const parsed = await parseBody(request, summaryRecipientSchema);
  if (!parsed.ok) return parsed.response;

  const supabase = await createClient();

  // Scoped to the learner's own live link. A number cannot be attached to a
  // revoked or expired one, because that link will never be delivered to.
  const { data: updated, error } = await supabase
    .from("summary_links")
    .update({
      recipient_e164: parsed.data.recipient_e164,
      // Changing the number withdraws any previous opt-in. The adult who
      // agreed is not the adult now listed.
      recipient_opted_in_at: null,
    })
    .eq("student_id", auth.userId)
    .is("revoked_at", null)
    .select("token")
    .maybeSingle();

  if (error) {
    console.error("[summary-links PATCH]", error.message);
    return NextResponse.json(
      { error: "Could not save that number", code: "SUMMARY_RECIPIENT_FAILED" },
      { status: 500 },
    );
  }

  if (!updated) {
    return NextResponse.json(
      { error: "Create the link first", code: "NO_LIVE_LINK" },
      { status: 409 },
    );
  }

  return NextResponse.json({ saved: parsed.data.recipient_e164 !== null });
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
