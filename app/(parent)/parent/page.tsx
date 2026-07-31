import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { fetchWeeklySummary } from "@/lib/parent/summary";
import { WeeklySummary } from "@/components/parent/WeeklySummary";
import { LanguagePicker } from "@/components/ui/LanguagePicker";
import { SignOutButton } from "@/components/auth/SignOutButton";
import type { Locale } from "@/i18n/config";

/**
 * `/parent` — the account path to one child's week (D2, D4).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * READ-ONLY, AND THERE IS NO WRITE PATH TO REMOVE.
 *
 * Not "we chose not to add editing" — there is no parent write policy on any
 * table in the database (D2), so a write from this session would be refused by
 * Postgres even if someone added a button.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The summary itself is rendered by the SAME component and assembled by the
 * SAME function as `/s/[token]`, deliberately. Two surfaces showing "the same"
 * summary is exactly how one of them quietly ends up exposing a field the other
 * does not — so neither builds its own.
 *
 * The difference between the two is authorisation, and only that: here the rows
 * are read under the parent's own session, so the `parent_links` RLS policies
 * do the scoping; there, a token does.
 *
 * Locale is the PARENT's own (D16) — it defaulted to the learner's when they
 * claimed the code, and the picker below changes it independently.
 */
export default async function ParentPage() {
  const supabase = await createClient();
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .maybeSingle();

  // A learner who reached this URL goes home. Roles are exclusive.
  if (profile?.role === "student") redirect("/learn");
  if (!profile) redirect("/parent/claim");

  const { data: link } = await supabase
    .from("parent_links")
    .select("student_id")
    .eq("parent_id", user!.id)
    .eq("status", "active")
    .order("claimed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // A parent account with no live link has nothing to show and one thing to do.
  if (!link) redirect("/parent/claim");

  // Read under the PARENT's session, not the service role: the parent_links
  // policies are the boundary, and nothing on this page needs the ability to
  // cross a user boundary on its own.
  const summary = await fetchWeeklySummary({
    supabase,
    studentId: link.student_id,
    locale,
  });

  return (
    <main className="flex-1 w-full max-w-(--container-content) mx-auto px-lg py-lg flex flex-col gap-xl">
      <header className="flex flex-col gap-sm">
        <h1 className="text-h1 text-ink">
          {summary.learnerName
            ? t("parent.title", { name: summary.learnerName })
            : t("parent.titleNoName")}
        </h1>
        {/* Said plainly, and early. A parent who is unsure whether they can
            break something will not tap anything. */}
        <p className="text-body-sm text-muted">{t("parent.readOnly")}</p>
      </header>

      <WeeklySummary summary={summary} />

      <section className="flex flex-col gap-md">
        <h2 className="text-label text-muted">{t("parent.languageTitle")}</h2>
        <LanguagePicker current={locale} />
      </section>

      <SignOutButton className="mt-auto" />
    </main>
  );
}
