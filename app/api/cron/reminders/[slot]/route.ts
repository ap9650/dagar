import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushConfigured, sendPush } from "@/lib/notify/push";
import { planReminders } from "@/lib/notify/reminderPlan";

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

  // Who gets what is decided in `planReminders`, which the dry run at
  // `/admin/notifications` also calls. One copy of the rule — a dry run that
  // reimplemented it would prove the reimplementation, not this job.
  const plan = await planReminders(admin, slot);
  if (plan.length === 0) return NextResponse.json({ ok: true, sent: 0, reason: "none" });

  let sent = 0;
  let skipped = 0;
  const expired: string[] = [];

  for (const item of plan) {
    if (!item.send) {
      skipped++;
      continue;
    }

    const result = await sendPush(item.subscription, item.message);

    if (result.ok) sent++;
    // 404/410: the browser is gone for good. Retrying it every day forever is
    // wasted work against an endpoint that will never accept anything again.
    else if (result.gone) expired.push(item.subscription.id);
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
        plan.filter((item) => item.send).map((item) => item.subscription.id),
      );
  }

  return NextResponse.json({ ok: true, slot, sent, skipped, expired: expired.length });
}
