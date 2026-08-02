import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchWeeklySummary } from "@/lib/parent/summary";
import { generateParentSummary } from "@/lib/ai/summaries";
import { sendParentSummary } from "@/lib/notify";
import { istDate, istDayStart } from "@/lib/learning/dates";
import { generateShareToken } from "@/lib/parent/shareToken";
import { trackForStudent } from "@/lib/analytics/track";
import type { Locale } from "@/i18n/config";

/**
 * The weekly parent summary (D4).
 *
 * Fired by Vercel Cron at `30 12 * * 0` — **12:30 UTC on Sunday, which is 18:00
 * IST**. Vercel schedules in UTC only, so the IST time is the offset applied by
 * hand; if this ever needs moving, move it in UTC and recompute.
 *
 * Sunday evening on purpose: the week is over, the family is likely together,
 * and it is the moment an adult can actually act on "sit with them for ten
 * minutes" rather than reading it on the way to work.
 *
 * ── WHO THIS RUNS FOR ───────────────────────────────────────────────────────
 * Every learner with a live share link. Not every learner: a summary is only
 * meaningful to somebody, and a learner who has never shared has nobody to send
 * it to. The link IS the subscription.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ── AND WHAT IT DOES WHEN NOTHING CAN BE DELIVERED ──────────────────────────
 * It still writes the summary. WhatsApp may be unconfigured, the recipient may
 * never have opted in, the sandbox window may have closed — none of that stops
 * the summary existing, because the summary's real home is the `/s/[token]`
 * page the adult can open whenever they like. Delivery is a notification about
 * something that is already there, not the thing itself.
 *
 * That is why `sendParentSummary` ends in an in-app adapter that always
 * succeeds: "nobody could be messaged this week" is not a failure state.
 * ────────────────────────────────────────────────────────────────────────────
 */

/** Never prerender or cache — this mutates. */
export const dynamic = "force-dynamic";
/** Generous: this loops over learners and makes a model call for each. */
export const maxDuration = 300;

/**
 * The IST Monday that starts the week being reported, as `YYYY-MM-DD`.
 * `parent_summaries` is unique on (link, week_start), so this is the value that
 * makes a re-run a no-op rather than a duplicate message.
 */
function weekStart(today = istDate()): string {
  const at = istDayStart(today);
  // getUTCDay on an IST-midnight instant: 0 = Sunday.
  const dayOfWeek = new Date(at.getTime() + 5.5 * 60 * 60 * 1000).getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  at.setUTCDate(at.getUTCDate() - daysSinceMonday);
  return istDate(at);
}

export async function GET(request: Request) {
  // ── the only thing standing between the internet and this job ────────────
  // Vercel sends `Authorization: Bearer $CRON_SECRET`. Without this check the
  // route is a public button that spends money on model calls and messages
  // people's parents.
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const admin = createAdminClient();
  const week = weekStart();

  const { data: links, error } = await admin
    .from("summary_links")
    .select("id, student_id, token, recipient_e164, recipient_opted_in_at, expires_at")
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString());

  if (error) {
    console.error("[cron/weekly-summary] could not list links:", error.message);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  const report = { considered: links?.length ?? 0, written: 0, delivered: 0, skipped: 0, failed: 0 };

  for (const link of links ?? []) {
    try {
      // Idempotent on (link, week). A cron that fires twice — a retry, a manual
      // trigger, a redeploy — must not message a family twice.
      const { data: already } = await admin
        .from("parent_summaries")
        .select("id")
        .eq("summary_link_id", link.id)
        .eq("week_start", week)
        .maybeSingle();

      if (already) {
        report.skipped++;
        continue;
      }

      // The RECIPIENT's language. It follows the learner's, because that is the
      // only signal we have about a household that never registered — but the
      // account path lets a parent change it independently (D16).
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

      const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dagar-ap19.vercel.app";
      const url = `${origin}/s/${link.token}`;

      const outcome = await sendParentSummary(
        { e164: link.recipient_e164, optedInAt: link.recipient_opted_in_at },
        { body: generated.body, url },
      );

      // Written whether or not it reached anyone — see the header. The row is
      // the summary; delivery is a note about how it travelled.
      await admin.from("parent_summaries").insert({
        summary_link_id: link.id,
        week_start: week,
        channel: outcome.delivered.channel,
        delivered_at: new Date().toISOString(),
        delivery_status: outcome.delivered.ok ? "sent" : "failed",
        // No learner id, no phone number, no answers. The body is the message
        // itself, which the recipient is about to read anyway.
        payload: {
          body: generated.body,
          source: generated.source,
          locale,
          attempts: outcome.attempts.map((a) => ({
            channel: a.channel,
            ok: a.ok,
            reason: a.ok ? null : a.reason,
          })),
        },
        tracking_token: generateShareToken(),
      });

      // The denominator of Parent Summary Engagement (viewed ÷ sent, PRD §12).
      // `parent_summary_viewed` fires in `/s/[token]`; without this line its
      // partner never fires and the metric divides by zero forever — which is
      // exactly the silent failure the canonical list exists to prevent. The
      // dashboard would have rendered a confident, permanent blank.
      //
      // Every WRITTEN summary counts as sent, including `in_app`. The link is
      // how an adult reads it; the channel only says whether we also managed to
      // nudge them. Counting only pushed messages would make the denominator 0
      // for every household on the frictionless path, which is most of them.
      // The nuance is kept in `channel` rather than thrown away.
      await trackForStudent(link.student_id, "parent_summary_sent", {
        channel: outcome.delivered.channel,
        delivered: outcome.delivered.ok,
        source: generated.source,
        locale,
      });

      report.written++;
      if (outcome.delivered.channel !== "in_app") report.delivered++;
    } catch (cause) {
      // One learner's failure must not end the run for everyone else.
      console.error("[cron/weekly-summary] link failed:", cause);
      report.failed++;
    }
  }

  return NextResponse.json({ ok: true, week_start: week, ...report });
}
