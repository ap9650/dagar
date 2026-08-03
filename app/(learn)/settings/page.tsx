import Link from "next/link";
import { ChevronRight, MessageSquare } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { getCurrentProfile } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { LanguagePicker } from "@/components/ui/LanguagePicker";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { InviteParentCard } from "@/components/learn/InviteParentCard";
import { InstallSettings } from "@/components/install/InstallSettings";
import { HapticsToggle } from "@/components/settings/HapticsToggle";
import { GradeSetting } from "@/components/settings/GradeSetting";
import type { Locale } from "@/i18n/config";
import { BackLink } from "@/components/ui/BackLink";

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
  // Already fetched by the (learn) layout and cached for this request — free.
  const profile = await getCurrentProfile();

  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;

  return (
    <main className="flex-1 w-full max-w-(--container-content) mx-auto px-lg py-lg flex flex-col gap-xl">
      <header className="flex items-center gap-md">
        <BackLink href="/learn" label={t("common.back")} />
        <h1 className="text-h2 text-ink">{t("settings.title")}</h1>
      </header>

      <section className="flex flex-col gap-md">
        <h2 className="text-label text-muted">{t("settings.languageTitle")}</h2>
        {/* No continueHref: in Settings the change simply applies and the page
            re-renders in place. It never signs the learner out and never resets
            progress. */}
        <LanguagePicker current={locale} />
      </section>

      {/* Was read-only text, which is the same defect the language picker exists
          to prevent: grade decides which chapters exist for you, so a mis-tap at
          onboarding meant never reaching your own curriculum — and the app just
          looked like it had the wrong content in it. */}
      <section className="flex flex-col gap-md">
        <h2 className="text-label text-muted">{t("settings.gradeTitle")}</h2>
        <GradeSetting current={profile?.grade ?? 6} />
      </section>

      {profile?.display_name && (
        <section className="flex flex-col gap-md">
          <h2 className="text-label text-muted">{t("settings.nameTitle")}</h2>
          <Card>
            <p className="text-body text-ink">{profile.display_name}</p>
          </Card>
        </section>
      )}

      {/* Renders its own heading, and renders NOTHING at all on a device without
          the Vibration API — every iPhone — or under prefers-reduced-motion. The
          heading has to live inside it, or an iPhone gets a section title with
          nothing under it. */}
      <HapticsToggle />

      {/* The install route that does not depend on having caught a prompt.
          The dashboard card offers once and can be dismissed — for a while it
          was the ONLY way in, so one mis-tap meant the app could never be
          installed at all. This row is always here. */}
      <section className="flex flex-col gap-md">
        <h2 className="text-label text-muted">{t("install.settingsTitle")}</h2>
        <InstallSettings />
      </section>

      {/* D2's learner half: the code is generated on tap, never on page load —
          an uninvited learner should not have a live key to their account
          sitting in the database. */}
      <section className="flex flex-col gap-md">
        <h2 className="text-label text-muted">{t("settings.shareTitle")}</h2>
        <InviteParentCard />
      </section>

      {/* Its own section with a heading, like every other block on this page.
          It was a bare underlined link squeezed between the share section and
          Sign out — no heading, so it read as part of sharing, and visually
          quieter than a control people rarely want. Feedback being less
          prominent than Sign out is the wrong way round, especially now. */}
      <section className="flex flex-col gap-md">
        <h2 className="text-label text-muted">{t("productFeedback.sectionTitle")}</h2>
        <Link
          href="/feedback"
          className="flex items-center gap-md min-h-14 px-lg rounded-(--radius-card)
                     border border-border bg-background text-ink
                     transition-colors duration-150 ease-out hover:bg-surface
                     focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        >
          <MessageSquare size={20} strokeWidth={1.75} aria-hidden className="text-primary shrink-0" />
          <span className="text-body">{t("productFeedback.openFromSettings")}</span>
          <ChevronRight size={20} strokeWidth={1.75} aria-hidden className="ms-auto text-muted shrink-0" />
        </Link>
      </section>

      {/* Sign out is reachable in two taps from anywhere: /learn → here → out.
          On a shared phone that is the common path, not an edge case. */}
      <SignOutButton className="mt-auto" />
    </main>
  );
}
