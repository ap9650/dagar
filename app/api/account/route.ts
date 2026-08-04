import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/security/authGuard";
import { EXIT_COOKIE } from "@/lib/exit";

/**
 * DELETE /api/account — the learner deletes themselves, and it actually happens.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 *
 * `/privacy` promises: "you can ask us to delete everything at any time, and we
 * will." Until this route there was no way to ask — no address in the app, no
 * control anywhere — so the promise was made and could not be kept. For a
 * product whose every user is a child that is the worst kind of copy: reassuring
 * and untrue.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ── WHAT "EVERYTHING" MEANS, PRECISELY ──────────────────────────────────────
 * Deleting the auth user cascades through `profiles` and from there through
 * every table keyed to a learner: attempts, lesson_progress, concept_mastery,
 * streaks, milestones, quiz_sessions, tutor_messages, mentor_requests,
 * parent_links, product_feedback. That is one `on delete cascade` chain and it
 * is checked in the migrations rather than assumed.
 *
 * TWO tables are `on delete set null` rather than cascade, and they are treated
 * differently on purpose:
 *
 *   - `events` is a behavioural record OF A CHILD — what they opened, when, in
 *     what order. Nulling the id would leave exactly the thing a child is
 *     entitled to have removed. So these rows are DELETED outright, before the
 *     user goes, and the funnel loses that learner. That is what deletion means.
 *
 *   - `ai_calls` holds token counts, cost and latency and NO content, not even a
 *     lesson body. Once the id is nulled it is a billing record about nobody, so
 *     it is left to be anonymised by the cascade. Deleting it would destroy cost
 *     history for no gain in privacy.
 *
 * If either of those tables ever gains a content column, this comment is wrong
 * and the route has to change with it.
 *
 * ── SERVICE ROLE, AND WHY THAT IS SAFE HERE ─────────────────────────────────
 * Deleting an auth user needs the admin client, which bypasses RLS. The id is
 * taken from the SERVER SESSION and never from the request body — a learner can
 * only ever delete themselves, and there is no parameter to tamper with. That is
 * the same rule every other route follows (saathi-security §3).
 */
export async function DELETE() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const studentId = auth.userId;
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  // Behavioural rows first. If this fails we stop: half a deletion that leaves
  // the child's activity behind while removing their account is worse than a
  // clean failure they can retry, because nobody would ever know to retry it.
  const { error: eventsError } = await admin.from("events").delete().eq("student_id", studentId);
  if (eventsError) {
    console.error("[account] failed to delete events:", eventsError.message);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  const { error } = await admin.auth.admin.deleteUser(studentId);
  if (error) {
    console.error("[account] failed to delete user:", error.message);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  // Deliberately no analytics event. "This learner deleted themselves" is a row
  // about a person who just asked to stop being a row.
  const response = NextResponse.json({ ok: true });

  /*
    A one-time pass to say why they left.

    The reason is asked AFTER deletion, so the request that carries it has no
    session — which is the point (see `0023_exit_reasons.sql`) and also the
    problem: an unauthenticated write endpoint with nothing guarding it is an
    open door to anyone who finds it.

    This cookie is the guard. It proves only "this browser just deleted an
    account", carries no identity, expires in thirty minutes, and is cleared the
    moment a reason is submitted. It cannot be used to link the reason to the
    person, because by the time it exists the person is already gone.
  */
  response.cookies.set(EXIT_COOKIE, crypto.randomUUID(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 30,
  });

  return response;
}
