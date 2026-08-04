import { NextResponse } from "next/server";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/security/authGuard";
import { parseBody, productFeedbackSchema } from "@/lib/security/validation";
import { LIMITS, memoryLimit, tooManyRequests } from "@/lib/security/rateLimiter";
import { track } from "@/lib/analytics/track";

/**
 * POST /api/feedback — what a real user thinks of Dagar (0018).
 *
 * ── one row per person, updated rather than appended ────────────────────────
 * `product_feedback` is unique on `user_id`, so this upserts. Someone who
 * answers twice has changed their mind, not held two opinions — and it means a
 * row count is a PEOPLE count, which is exactly the claim the submission makes
 * ("feedback from N real users").
 *
 * ── the id comes from the session ───────────────────────────────────────────
 * As everywhere else: `auth.userId`, never the body. Feedback attributed to
 * whoever the client says would make the headline number forgeable, and that
 * number is going in front of judges.
 *
 * The locale is read on the server too — it records which language the person
 * actually used the app in, which is worth knowing. Sent by the client it would
 * be one more thing to get wrong.
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const limited = memoryLimit(
    `feedback:${auth.userId}`,
    LIMITS.feedback.limit,
    LIMITS.feedback.windowSeconds,
  );
  if (!limited.allowed) return tooManyRequests(limited.retryAfterSeconds);

  const parsed = await parseBody(request, productFeedbackSchema);
  if (!parsed.ok) return parsed.response;

  const { respondent_role, understood, would_return, improve_most, worked_well, confusing } =
    parsed.data;
  const locale = await getLocale();
  const supabase = await createClient();

  const { error } = await supabase.from("product_feedback").upsert(
    {
      user_id: auth.userId,
      respondent_role,
      understood,
      would_return,
      improve_most: improve_most ?? null,
      // Empty strings become null: a blank textarea is "they did not answer",
      // not "they answered with nothing", and the export should show the
      // difference.
      worked_well: worked_well?.length ? worked_well : null,
      confusing: confusing?.length ? confusing : null,
      locale,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error("[feedback]", error.message);
    return NextResponse.json(
      { error: "Could not save your feedback", code: "FEEDBACK_FAILED" },
      { status: 500 },
    );
  }

  // The row is still the record — the answers live in `product_feedback` and
  // this event carries none of them. What it adds is a place on the FUNNEL:
  // `feedback_shown` counts who was asked, this counts who answered, and the
  // ratio is the number that says whether the ask is working. Without it the
  // response rate was uncomputable, which is the same hole `dashboard_viewed`
  // was added to fill for Recommendation Acceptance.
  //
  // `respondent_role` is the only prop: a learner and a teacher answering are
  // different signals. Nothing free-text goes near this — `track()` would
  // scrub it anyway, and it should never get the chance.
  await track("feedback_submitted", { respondent_role });

  return NextResponse.json({ ok: true });
}
