import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { LanguagePicker } from "@/components/ui/LanguagePicker";
import { GoodbyeCard } from "@/components/settings/GoodbyeCard";
import { EXIT_COOKIE } from "@/lib/exit";
import type { Locale } from "@/i18n/config";

/**
 * `/welcome` — the language picker. THE FIRST SCREEN (D16, SCREENS.md Flow 1).
 *
 * It runs before login and before any user row exists. That ordering is the
 * single most important one in the product: a learner who cannot read English
 * must not have to get through an English screen to reach it.
 *
 * Note what is NOT on this page: no heading sentence, no instructions, no
 * explanatory paragraph. Any text here would have to be in *some* language, and
 * whichever we chose would be the wrong one for half the learners. The wordmark
 * is script-neutral enough to keep; nothing else earns its place.
 */
export default async function WelcomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // A learner who already has a profile has already answered this question.
  // Never re-show the picker to them — that is what /settings is for.
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile) redirect(profile.role === "parent" ? "/parent" : "/learn");
    redirect("/onboarding/grade"); // authenticated but never finished
  }

  const locale = (await getLocale()) as Locale;
  const t = await getTranslations();

  // Set by DELETE /api/account and cleared once a reason is given. Its presence
  // is the only thing that turns this screen into a goodbye.
  const justDeleted = Boolean((await cookies()).get(EXIT_COOKIE)?.value);

  return (
    <main className="flex-1 w-full max-w-(--container-content) mx-auto px-lg py-3xl flex flex-col gap-3xl">
      {/* Reads the same in both scripts, so it needs no translation. */}
      <h1 className="text-h1 text-primary-strong text-center">Dagar</h1>

      {/*
        ABOVE the picker, which looks like a violation of this screen's one rule
        and is not.

        The rule exists so that a learner who cannot read English is not made to
        get through an English screen to reach the language choice. This card
        renders ONLY for someone who has just deleted an account — which means
        they have used Dagar, which means they already have a locale cookie and
        are reading their own language. A brand-new arrival never sees it.

        It goes above rather than below because it is the answer to the thing
        they just did. Underneath the picker it would read as a footnote to a
        screen they did not ask for.
      */}
      {justDeleted && <GoodbyeCard />}

      <LanguagePicker current={locale} continueHref="/login" />

      {/* BELOW the picker, never above it. The design rule for this screen is
          that nothing above the language choice may require reading a language
          — and a parent who has picked their language is exactly who this is
          for. It is the only door for the fourth kind of arrival: an adult who
          heard about Dagar and has no code and no child account to start from. */}
      <a
        href="/for-parents"
        className="self-center min-h-11 inline-flex items-center text-body-sm text-body underline underline-offset-4"
      >
        {t("welcome.forParents")}
      </a>
    </main>
  );
}
