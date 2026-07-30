import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { GradePicker } from "@/components/auth/GradePicker";
import { SignOutButton } from "@/components/auth/SignOutButton";
import type { Locale } from "@/i18n/config";

/**
 * `/onboarding/grade` — "Which class are you in?"
 *
 * Requires a session (you cannot create a profile without a user), but NOT a
 * profile — this is the screen that creates one.
 */
export default async function GradePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  // Already onboarded — don't ask again.
  if (profile) redirect(profile.role === "parent" ? "/parent" : "/learn");

  const locale = (await getLocale()) as Locale;
  const t = await getTranslations();

  return (
    <main className="flex-1 w-full max-w-(--container-content) mx-auto px-lg py-3xl flex flex-col gap-xl">
      <h1 className="text-h1 text-ink">{t("onboarding.gradeTitle")}</h1>

      <GradePicker locale={locale} />

      {/*
        The back button from here lands on a signed-in /login, which redirects
        straight back — so without an exit this screen is a trap for anyone who
        signed in with the wrong account. Common on a shared phone where a parent
        is already logged into Google (auth-onboarding spec §7).
      */}
      <SignOutButton className="mt-auto" />
    </main>
  );
}
