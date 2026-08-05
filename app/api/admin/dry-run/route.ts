import { NextResponse } from "next/server";
import { getAdminEmail } from "@/lib/security/adminGuard";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/server";
import { planReminders, type Slot } from "@/lib/notify/reminderPlan";
import { fetchWeeklySummary } from "@/lib/parent/summary";
import { generateParentSummary } from "@/lib/ai/summaries";
import { istDate } from "@/lib/learning/dates";
import type { Locale } from "@/i18n/config";

/**
 * POST /api/admin/dry-run — what would the crons do if they ran right now?
 *
 * ── WHY A DRY RUN AND NOT "JUST WAIT FOR 4PM" ───────────────────────────────
 * The reminders' whole design is who does NOT get one: neither slot fires once
 * the day's goal is met (D17b), which is what makes two a day safe. That rule
 * is invisible from every screen in the product. The only way to see it was to
 * wait for a cron and then read a log — by which point the notifications had
 * already gone to real learners.
 *
 * So this answers the question directly, and it is testable in the ordinary
 * way: run it, finish a lesson on a test account, run it again, and watch that
 * learner flip from "due" to "goal met".
 *
 * **Nothing is sent and nothing is written.** `planReminders` is a pure read,
 * and it is the SAME function the cron sends from — a dry run that reimplemented
 * the rule would prove the reimplementation, not the job.
 *
 * ── ON NAMES ────────────────────────────────────────────────────────────────
 * The reminder rows carry no learner identity at all: a masked id, whether the
 * goal is met, the streak, and the message. That is everything needed to test
 * the rule and nothing more — `/admin/metrics` never names a learner and this
 * does not either.
 *
 * The weekly summary is the deliberate exception, because the thing being
 * checked IS the message, and a message about a child cannot be verified
 * without reading what it says about them. It is the same text their own parent
 * receives, shown to the person who operates the pilot, and only ever for links
 * that already exist.
 */
export const dynamic = "force-dynamic";

/** Enough to tell two rows apart across runs; not enough to identify anybody. */
const mask = (id: string) => `learner ${id.slice(0, 4)}`;

export async function POST(request: Request) {
  const email = await getAdminEmail();
  if (!email) return new NextResponse(null, { status: 404 });

  const me = await getCurrentUser();
  const body = (await request.json().catch(() => ({}))) as { job?: string; slot?: string };
  const admin = createAdminClient();

  if (body.job === "summary") return summaryDryRun(admin);

  const slot: Slot = body.slot === "evening" ? "evening" : "afternoon";
  const plan = await planReminders(admin, slot);

  return NextResponse.json({
    ok: true,
    job: "reminders",
    slot,
    today: istDate(),
    wouldSend: plan.filter((p) => p.send).length,
    wouldSkip: plan.filter((p) => !p.send).length,
    rows: plan.map((item) => ({
      who: mask(item.subscription.student_id),
      // So the operator can find their OWN test device in the list without
      // anybody else being identifiable.
      isYou: item.subscription.student_id === me?.id,
      send: item.send,
      reason: item.reason,
      locale: item.locale,
      streakDays: item.streakDays,
      rung: item.rung,
      body: item.message.body,
    })),
  });
}

/**
 * The Sunday job, without sending anything.
 *
 * Generates the real message through the real prompt for each active link, so
 * what is shown is what would arrive. That costs one Haiku call per link, which
 * is why it is a button an operator presses rather than something this page
 * does on load.
 */
async function summaryDryRun(admin: ReturnType<typeof createAdminClient>) {
  // `summary_links`, the same table the Sunday cron walks — a share link that
  // is live and not revoked. `parent_links` is the account-and-code path and
  // carries no recipient of its own.
  const { data: links } = await admin
    .from("summary_links")
    .select("id, student_id, recipient_e164, recipient_opted_in_at, expires_at")
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .limit(10);

  if (!links?.length) {
    return NextResponse.json({ ok: true, job: "summary", rows: [], reason: "no_active_links" });
  }

  const rows = [];
  for (const link of links) {
    const { data: learner } = await admin
      .from("profiles")
      .select("locale")
      .eq("id", link.student_id)
      .maybeSingle();
    const locale = (learner?.locale ?? "en") as Locale;

    const summary = await fetchWeeklySummary({
      supabase: admin,
      studentId: link.student_id,
      locale,
    });
    const generated = await generateParentSummary({
      summary,
      locale,
      studentId: link.student_id,
    });

    rows.push({
      who: mask(link.student_id),
      locale,
      // WhatsApp only where a number was given AND opted in — otherwise the
      // parent reads it in the app or through their share link.
      channel: link.recipient_e164 && link.recipient_opted_in_at ? "whatsapp" : "in_app",
      quiet: summary.quiet,
      lessons: summary.lessonsThisWeek,
      practice: summary.practiceThisWeek,
      body: generated.body,
      source: generated.source,
    });
  }

  return NextResponse.json({ ok: true, job: "summary", rows });
}
