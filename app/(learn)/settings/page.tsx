import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { LanguagePicker } from "@/components/ui/LanguagePicker";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { InviteParentCard } from "@/components/learn/InviteParentCard";
import type { Locale } from "@/i18n/config";

/**
 * `/settings` — slice 1.1a. Small screen, disproportionate importance.
 *
 * **Without it, a learner who taps the wrong language at onboarding is
 * permanently stuck in a language they cannot read** (SCREENS.md Flow 4). That is
 * the whole reason this ships in the same slice as onboarding rather than "later".
 *
 * The language control is the SAME `LanguagePicker` component as `/welcome`, not
 * a settings-shaped variant of it. A learner who cannot read the labels around it
 * has to recognise the control itself — so it must look identical to the one they
 * used the first time.
 *
 * The back arrow is an icon, deliberately: it is the one exit that works when you
 * cannot read a word on the screen.
 */
export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, grade")
    .eq("id", user!.id)
    .single();

  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;

  return (
    <main className="flex-1 w-full max-w-(--container-content) mx-auto px-lg py-lg flex flex-col gap-xl">
      <header className="flex items-center gap-md">
        <Link
          href="/learn"
          aria-label={t("common.back")}
          className="inline-flex items-center justify-center size-11 -ml-sm rounded-(--radius-control) text-body hover:bg-surface"
        >
          <ArrowLeft size={20} strokeWidth={1.75} aria-hidden />
        </Link>
        <h1 className="text-h2 text-ink">{t("settings.title")}</h1>
      </header>

      <section className="flex flex-col gap-md">
        <h2 className="text-label text-muted">{t("settings.languageTitle")}</h2>
        {/* No continueHref: in Settings the change simply applies and the page
            re-renders in place. It never signs the learner out and never resets
            progress. */}
        <LanguagePicker current={locale} />
      </section>

      <section className="flex flex-col gap-md">
        <h2 className="text-label text-muted">{t("settings.gradeTitle")}</h2>
        <Card>
          <p className="text-body text-ink">
            {t("onboarding.gradeOption", { grade: profile?.grade ?? 6 })}
          </p>
        </Card>
      </section>

      {profile?.display_name && (
        <section className="flex flex-col gap-md">
          <h2 className="text-label text-muted">{t("settings.nameTitle")}</h2>
          <Card>
            <p className="text-body text-ink">{profile.display_name}</p>
          </Card>
        </section>
      )}

      {/* D2's learner half: the code is generated on tap, never on page load —
          an uninvited learner should not have a live key to their account
          sitting in the database. */}
      <section className="flex flex-col gap-md">
        <h2 className="text-label text-muted">{t("settings.shareTitle")}</h2>
        <InviteParentCard />
      </section>

      {/* Sign out is reachable in two taps from anywhere: /learn → here → out.
          On a shared phone that is the common path, not an edge case. */}
      <SignOutButton className="mt-auto" />
    </main>
  );
}
