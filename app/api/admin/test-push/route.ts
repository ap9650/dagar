import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { getAdminEmail } from "@/lib/security/adminGuard";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/server";
import { pushConfigured, sendPush } from "@/lib/notify/push";
import type { Locale } from "@/i18n/config";

/**
 * POST /api/admin/test-push — send one reminder to my OWN devices, now.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * The reminders shipped without the one proof that matters: a notification
 * actually arriving on a real phone. Everything else was verified — the cron
 * skips learners who met the goal, the copy avoids every banned word, dead
 * endpoints get deleted — but all of that is provable server-side, and a push
 * that never reaches a device would look identical in every log we keep.
 *
 * Waiting for 4pm to find out is not a test, it is a hope.
 *
 * ── THE ONE RULE THAT MAKES THIS SAFE ───────────────────────────────────────
 * It sends ONLY to subscriptions belonging to the signed-in admin's own user
 * id. Not to a chosen learner, not to everyone — a route that could push
 * arbitrary text to children's phones is not a debugging tool, it is a
 * megaphone pointed at minors, and no amount of admin-gating makes that a
 * sensible thing to leave in a codebase.
 *
 * So the blast radius is the operator's own handset, and the guard is the same
 * fail-closed allowlist as `/admin/metrics`.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // 404, not 403 — the guard does not confirm that an admin surface exists.
  const email = await getAdminEmail();
  if (!email) return new NextResponse(null, { status: 404 });

  if (!pushConfigured()) {
    return NextResponse.json({ ok: false, reason: "push_not_configured" }, { status: 200 });
  }

  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as {
    slot?: string;
    locale?: string;
    days?: number;
  };
  const slot = body.slot === "evening" ? "evening" : "afternoon";
  const locale = (body.locale === "hi" ? "hi" : "en") as Locale;
  const rungDays = typeof body.days === "number" ? body.days : null;

  const admin = createAdminClient();

  // The operator's OWN rows. `student_id` is the auth user id (see 0024), so an
  // admin who enabled reminders on their phone has rows here like anyone else.
  const { data: subscriptions } = await admin
    .from("push_subscriptions")
    .select("id, student_id, endpoint, p256dh, auth")
    .eq("student_id", user.id);

  if (!subscriptions?.length) {
    return NextResponse.json({ ok: false, reason: "no_subscriptions", sent: 0 });
  }

  const t = await getTranslations({ locale, namespace: "push" });
  const message = {
    title: slot === "evening" ? t("eveningTitle") : t("afternoonTitle"),
    body: rungDays
      ? t("rungBody", { days: rungDays })
      : slot === "evening"
        ? t("eveningBody")
        : t("afternoonBody"),
    url: "/learn",
  };

  let sent = 0;
  const gone: string[] = [];
  for (const subscription of subscriptions) {
    const result = await sendPush(subscription, message);
    if (result.ok) sent++;
    else if (result.gone) gone.push(subscription.id);
  }

  // Same housekeeping as the cron: a browser that has gone for good should not
  // be retried every evening forever.
  if (gone.length > 0) await admin.from("push_subscriptions").delete().in("id", gone);

  return NextResponse.json({
    ok: sent > 0,
    sent,
    removed: gone.length,
    devices: subscriptions.length,
    message,
  });
}
