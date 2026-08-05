import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { istDate, istDayStart } from "@/lib/learning/dates";
import { dayQualified } from "@/lib/learning/week";
import { fromRow, streakStatus } from "@/lib/learning/streaks";
import { oneDayFromRung } from "@/lib/learning/streakLadder";
import { pushConfigured, sendPush } from "@/lib/notify/push";
import type { Locale } from "@/i18n/config";

/**
 * GET /api/cron/reminders/[slot] — the daily nudge (D17b).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TWO A DAY, AND THE SECOND ONE IS CONDITIONAL.
 *
 * D17b originally capped reminders at one a day. That cap was set in July
 * before there was a cohort, and the argument against it is stronger: a learner
 * who forgets loses a streak they earned, and one reminder is a thin defence
 * against a habit that does not exist yet.
 *
 * What makes two safe is not the number, it is that neither fires once the
 * day's goal is met:
 *
 *   studies after school  → ZERO notifications
 *   studies in the evening → ONE
 *   has not shown up at all → TWO
 *
 * The volume lands exactly on the learners it is for and never on the ones
 * already doing the work — which is also what defuses the shared-phone worry,
 * because a parent watching an engaged child sees almost nothing.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ── ROUTINE, NEVER A DEADLINE ───────────────────────────────────────────────
 * ~4pm is after school; ~8pm is after dinner and before bed. The IST day does
 * not end until midnight, so the evening slot is a genuine window rather than a
 * countdown. Vercel Hobby fires within the hour of the scheduled time, which is
 * fine for a routine anchor and would be useless for a deadline — one more
 * reason not to build one.
 *
 * Nothing here says "hours left", "your streak dies", or "you have not
 * studied". Every line has to be safe for a parent to read over a shoulder,
 * because that is who is often holding the phone.
 */
export const dynamic = "force-dynamic";

type Slot = "afternoon" | "evening";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slot: string }> },
) {
  // The only thing between the internet and a job that pushes to children's
  // devices. Same guard as the weekly summary.
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const { slot: raw } = await params;
  if (raw !== "afternoon" && raw !== "evening") {
    return NextResponse.json({ error: "Unknown slot", code: "BAD_REQUEST" }, { status: 400 });
  }
  const slot: Slot = raw;

  // Missing VAPID keys is a real state, not a failure — local and preview
  // environments have none. A 200 with a reason beats a 500 every evening.
  if (!pushConfigured()) {
    return NextResponse.json({ ok: true, skipped: "push_not_configured" });
  }

  const admin = createAdminClient();
  const today = istDate();
  const dayStart = istDayStart(today).toISOString();

  const { data: subscriptions, error } = await admin
    .from("push_subscriptions")
    .select("id, student_id, endpoint, p256dh, auth");

  if (error) {
    console.error("[reminders] could not read subscriptions:", error.message);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }
  if (!subscriptions?.length) return NextResponse.json({ ok: true, sent: 0, reason: "none" });

  const studentIds = [...new Set(subscriptions.map((row) => row.student_id))];

  // ── who has already met today's goal ──────────────────────────────────────
  // Batched, not per learner: three queries for the whole cohort rather than
  // three per subscription. The rule is D7's, shared with the streak and the
  // week strip via `dayQualified` — an app that reminds you to do something you
  // have done is an app you stop trusting.
  const [{ data: lessonsToday }, { data: practiceToday }, { data: streaks }, { data: profiles }] =
    await Promise.all([
      admin
        .from("lesson_progress")
        .select("student_id")
        .in("student_id", studentIds)
        .eq("status", "completed")
        .gte("completed_at", dayStart),
      admin
        .from("attempts")
        .select("student_id, question_id")
        .in("student_id", studentIds)
        .eq("session_kind", "practice")
        .gte("created_at", dayStart),
      admin
        .from("streaks")
        .select("student_id, current, longest, last_active_date, grace_used_on")
        .in("student_id", studentIds),
      admin.from("profiles").select("id, locale").in("id", studentIds),
    ]);

  const lessonCount = tally((lessonsToday ?? []).map((row) => row.student_id));

  // DISTINCT questions, matching the goal ring: answering one question five
  // times is not five questions of practice.
  const practiceCount = new Map<string, Set<string>>();
  for (const row of practiceToday ?? []) {
    const set = practiceCount.get(row.student_id) ?? new Set<string>();
    set.add(row.question_id);
    practiceCount.set(row.student_id, set);
  }

  const streakByStudent = new Map((streaks ?? []).map((row) => [row.student_id, row]));
  const localeByStudent = new Map((profiles ?? []).map((row) => [row.id, row.locale as Locale]));

  const done = new Set(
    studentIds.filter((id) =>
      dayQualified(lessonCount.get(id) ?? 0, practiceCount.get(id)?.size ?? 0),
    ),
  );

  let sent = 0;
  let skipped = 0;
  const expired: string[] = [];

  for (const subscription of subscriptions) {
    if (done.has(subscription.student_id)) {
      skipped++;
      continue;
    }

    const locale = localeByStudent.get(subscription.student_id) ?? "en";
    const t = await getTranslations({ locale, namespace: "push" });

    /**
     * The evening line changes when the learner is one day from a rung.
     *
     * That is the only moment a reminder carries information they do not
     * already have — and it is stated as an OPPORTUNITY, never a threat.
     * "One more day and you reach a 7-day streak", not "your streak is at
     * risk". The first is a fact; the second is a countdown wearing a helpful
     * voice, and it lands on a parent's phone.
     */
    const streak = streakStatus(
      fromRow(streakByStudent.get(subscription.student_id) ?? null),
      today,
    );
    const rung = slot === "evening" && streak.alive ? oneDayFromRung(streak.days) : null;

    const body = rung
      ? t("rungBody", { days: rung })
      : slot === "evening"
        ? t("eveningBody")
        : t("afternoonBody");

    const result = await sendPush(subscription, {
      title: slot === "evening" ? t("eveningTitle") : t("afternoonTitle"),
      body,
      url: "/learn",
    });

    if (result.ok) sent++;
    // 404/410: the browser is gone for good. Retrying it every day forever is
    // wasted work against an endpoint that will never accept anything again.
    else if (result.gone) expired.push(subscription.id);
  }

  if (expired.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", expired);
  }

  if (sent > 0) {
    await admin
      .from("push_subscriptions")
      .update({ last_sent_at: new Date().toISOString() })
      .in(
        "id",
        subscriptions.filter((s) => !done.has(s.student_id)).map((s) => s.id),
      );
  }

  return NextResponse.json({ ok: true, slot, sent, skipped, expired: expired.length });
}

function tally(ids: readonly string[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const id of ids) out.set(id, (out.get(id) ?? 0) + 1);
  return out;
}
