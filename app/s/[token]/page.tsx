import Link from "next/link";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchWeeklySummary } from "@/lib/parent/summary";
import { isShareLinkExpired, isShareTokenShape } from "@/lib/parent/shareToken";
import { WeeklySummary } from "@/components/parent/WeeklySummary";
import { trackForStudent } from "@/lib/analytics/track";
import type { Locale } from "@/i18n/config";

/**
 * `/s/[token]` — a learner's week, for a supporting adult with no account.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE ONLY PAGE IN DAGAR THAT RENDERS A LEARNER'S DATA WITHOUT A SESSION.
 *
 * Everything that makes that acceptable:
 *
 *   the token      192 bits of CSPRNG entropy — not guessable, and never typed
 *   the learner    mints it, sees whether it has been opened, and can revoke it
 *   expiry         90 days, enforced here as well as in the column default
 *   the payload    `WeeklySummary` and nothing else. Answers, tutor messages
 *                  and learner free text are not merely hidden — this page has
 *                  no code path that reaches them.
 *   no indexing    noindex, so a forwarded link cannot end up in a search result
 *
 * The service role is used because there is no session to scope by: the token
 * IS the authorisation, exactly as claiming a parent code is. The scoping is
 * that `fetchWeeklySummary` is called with the one `student_id` the token
 * resolved to, and there is no parameter here a visitor can influence.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export const metadata: Metadata = {
  // A link shared over WhatsApp gets forwarded. It must never become a search
  // result — this is a child's progress, not a public page.
  robots: { index: false, follow: false, nocache: true },
};

/** Always fresh: the learner may have revoked it a second ago. */
export const dynamic = "force-dynamic";

export default async function SharedSummaryPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;

  // Shape first, before any query. A path segment can contain anything.
  if (!isShareTokenShape(token)) return <Unavailable />;

  const admin = createAdminClient();

  const { data: link } = await admin
    .from("summary_links")
    .select("id, student_id, expires_at, revoked_at, view_count")
    .eq("token", token)
    .maybeSingle();

  // One state for missing, revoked and expired. A visitor learns only that the
  // link does not work — never whether it once did, or for whom.
  if (!link || link.revoked_at || isShareLinkExpired(link.expires_at)) {
    return <Unavailable />;
  }

  const summary = await fetchWeeklySummary({
    supabase: admin,
    studentId: link.student_id,
    locale,
  });

  // Recorded so the LEARNER can see their link is being read and decide whether
  // to keep it. Not analytics about the reader — no address, no agent, no
  // identity, because we have none and want none.
  await admin
    .from("summary_links")
    .update({ last_viewed_at: new Date().toISOString(), view_count: link.view_count + 1 })
    .eq("id", link.id);

  // D4's Parent Engagement metric: the weekly-summary open rate. The student id
  // comes from the row the token resolved to, never from the request — see
  // `trackForStudent`. Nothing about the viewer is recorded.
  await trackForStudent(link.student_id, "parent_summary_viewed");

  return (
    <main className="flex-1 w-full max-w-(--container-content) mx-auto px-lg py-lg flex flex-col gap-xl">
      <header className="flex flex-col gap-sm">
        <h1 className="text-h1 text-ink">
          {summary.learnerName
            ? t("parent.linkTitle", { name: summary.learnerName })
            : t("parent.linkTitleNoName")}
        </h1>
        <p className="text-body-sm text-muted">{t("parent.linkIntro")}</p>
      </header>

      <WeeklySummary summary={summary} />

      {/* For a reader who has never heard of Dagar — which, on a forwarded
          link, is most of them. */}
      <Link
        href="/for-parents"
        className="self-center min-h-11 inline-flex items-center text-body-sm text-primary-strong underline underline-offset-4"
      >
        {t("parent.linkAbout")}
      </Link>
    </main>
  );
}

async function Unavailable() {
  const t = await getTranslations();
  return (
    <main className="flex-1 w-full max-w-(--container-content) mx-auto px-lg py-3xl flex flex-col gap-lg">
      <h1 className="text-h2 text-ink">{t("parent.linkRevoked")}</h1>
      {/* Amber-free and blame-free: the likeliest reason is that the learner
          turned it off, which is a thing they are entitled to do. */}
      <p className="text-body text-body">{t("parent.linkRevokedHelp")}</p>
      <Link
        href="/for-parents"
        className="self-start min-h-11 inline-flex items-center text-body-sm text-primary-strong underline underline-offset-4"
      >
        {t("parent.linkAbout")}
      </Link>
    </main>
  );
}
