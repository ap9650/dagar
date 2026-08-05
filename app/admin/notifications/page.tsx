import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/security/adminGuard";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/server";
import { planReminders } from "@/lib/notify/reminderPlan";
import { pushConfigured } from "@/lib/notify/push";
import { DryRun, NotificationTester, SummaryPreview } from "@/components/admin/NotificationTester";
import type { Locale } from "@/i18n/config";

/**
 * `/admin/notifications` — see the messages, and send one to your own phone.
 *
 * ── THE GAP THIS FILLS ──────────────────────────────────────────────────────
 * Reminders and the weekly parent summary are the only two features that
 * cannot be checked by using the app. They fire from crons — 4pm, 8pm, Sunday
 * — so the only way to see them was to wait, and the only way to see them go
 * WRONG was to wait and then read a log.
 *
 * That left the single most important question unanswered: does a notification
 * actually arrive on a real handset? Every other part is provable server-side
 * and was proven, but a push that never reaches a device looks identical in
 * every record we keep.
 *
 * ── ENGLISH ONLY, AND UNTRANSLATED ──────────────────────────────────────────
 * Same as `/admin/metrics`: one reader, so a message key that only ever renders
 * in English is maintenance for nobody. The MESSAGES below are real dictionary
 * strings in both languages — it is the page around them that is English.
 */
export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage() {
  await requireAdmin();

  /*
    The real decision for THIS operator's own devices, read through the same
    planner the cron sends from. Shown beside the delivery buttons, which do not
    consult it — see the note further down for why that confusion was worth
    designing out rather than explaining once.
  */
  const me = await getCurrentUser();
  const mine =
    (await planReminders(createAdminClient(), "evening")).find(
      (item) => item.subscription.student_id === me?.id,
    ) ?? null;

  // The real strings, read the way the cron reads them — not retyped here. If
  // someone edits the copy, this screen changes with it, which is the only way
  // a preview stays worth looking at.
  const variants = [];
  for (const locale of ["en", "hi"] as const) {
    const t = await getTranslations({ locale: locale as Locale, namespace: "push" });
    variants.push(
      {
        key: `afternoon-${locale}`,
        label: `~4pm IST · after school · ${locale === "en" ? "English" : "Hindi"}`,
        locale,
        slot: "afternoon",
        title: t("afternoonTitle"),
        body: t("afternoonBody"),
      },
      {
        key: `evening-${locale}`,
        label: `~8pm IST · after dinner · ${locale === "en" ? "English" : "Hindi"}`,
        locale,
        slot: "evening",
        title: t("eveningTitle"),
        body: t("eveningBody"),
      },
      {
        key: `rung-${locale}`,
        label: `~8pm IST · one day from a streak badge · ${locale === "en" ? "English" : "Hindi"}`,
        locale,
        slot: "evening",
        title: t("eveningTitle"),
        body: t("rungBody", { days: 7 }),
        days: 7,
      },
    );
  }

  return (
    <main className="flex-1 w-full max-w-(--container-content) mx-auto px-lg py-lg flex flex-col gap-xl">
      <header className="flex flex-col gap-sm">
        <Link href="/admin/metrics" className="text-body-sm text-primary-strong underline underline-offset-4">
          Metrics
        </Link>
        <h1 className="text-h1 text-ink">Notifications</h1>
        <p className="text-body-sm text-body">
          What gets sent, when, and a way to put one on your own phone right now.
        </p>
      </header>

      {!pushConfigured() && (
        <p role="status" className="text-body-sm text-notquite">
          VAPID keys are not set in this environment, so nothing can be sent from here. The
          messages below are still the real ones.
        </p>
      )}

      {/* ── when they fire ──────────────────────────────────────────────── */}
      <section className="flex flex-col gap-md">
        <h2 className="text-h3 text-ink">When they fire</h2>
        <ul className="flex flex-col gap-sm text-body-sm text-body list-none m-0 p-0">
          <li>
            <strong className="text-ink">~4pm IST</strong> — only if today&rsquo;s goal is not
            done yet.
          </li>
          <li>
            <strong className="text-ink">~8pm IST</strong> — only if it is still not done. If
            the learner is one day from a streak badge, the wording changes to name it.
          </li>
          <li>
            <strong className="text-ink">Sunday</strong> — the weekly summary to a linked
            parent.
          </li>
        </ul>
        <p className="text-body-sm text-muted">
          So a learner who studies after school gets nothing, one who studies in the evening
          gets one, and one who does not show up gets two. Vercel fires these within the hour
          of the schedule, which is why every line is anchored to a routine and never to a
          countdown.
        </p>
      </section>

      {/* ── the dry run ─────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-md">
        <h2 className="text-h3 text-ink">Who would get one right now</h2>
        <p className="text-body-sm text-muted">
          The part you cannot see from anywhere else: neither slot fires once a learner has met
          today&rsquo;s goal, which is what makes two a day safe. This runs the same code the
          cron sends from, and sends nothing.
        </p>
        <p className="text-body-sm text-muted">
          To watch the rule work: run it, finish a lesson on a test account, run it again — that
          row flips from &ldquo;would be sent&rdquo; to &ldquo;skipped&rdquo;.
        </p>
        <DryRun />
      </section>

      {/* ── the messages ────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-md">
        <h2 className="text-h3 text-ink">Does a notification reach my phone?</h2>
        <p className="text-body-sm text-muted">
          Sending goes only to devices signed in on <em>this</em> account — never to a
          learner. Turn reminders on in Settings on the phone you want to test, then send.
        </p>

        {/*
          ── SAYING THE QUIET PART, BECAUSE IT WAS MISREAD ───────────────────
          Reported after a careful test: finish a lesson, press send, and the
          notification still arrives — which looks like the skip rule failing.

          It is not. These buttons are a DELIVERY test and deliberately bypass
          the goal check, because a button that respected it would refuse to
          send the moment the tester had studied — exactly when they are most
          likely to be testing. But nothing on screen said so, and two controls
          on one page that appear to simulate the same job while obeying
          different rules is a trap the page laid itself.

          The live line below is the fix: the real decision, for this account,
          right now, next to the button that ignores it.
        */}
        <p className="text-body-sm text-body rounded-(--radius-card) border border-hint/30 bg-primary-wash px-lg py-md">
          <strong className="text-ink">These always send.</strong> They prove a push reaches
          the handset, so they skip the goal check on purpose — otherwise they would stop
          working the moment you finished a lesson. Whether the real cron would send is the
          section above.
          {mine && (
            <>
              {" "}
              Right now the 8pm run{" "}
              <strong className="text-ink">
                {mine.send ? "would send to you" : "would SKIP you — today's goal is met"}
              </strong>
              .
            </>
          )}
        </p>

        <NotificationTester variants={variants} />
      </section>

      {/* ── the parent summary ──────────────────────────────────────────── */}
      <section className="flex flex-col gap-md">
        <h2 className="text-h3 text-ink">The weekly parent message</h2>
        <p className="text-body-sm text-muted">
          Written by the model from the week&rsquo;s facts, so it is different every time and
          cannot be read off a screen in advance. The first button runs the Sunday job against
          your real share links and shows what would go out, without sending it.
        </p>
        <SummaryPreview />
        <p className="text-body-sm text-muted">
          To see the full page a parent opens, use the product path instead: a learner&rsquo;s
          Settings → &ldquo;Share your progress&rdquo; → open the link.
        </p>
      </section>
    </main>
  );
}
