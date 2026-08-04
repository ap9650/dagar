import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { GradePicker } from "@/components/auth/GradePicker";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { track } from "@/lib/analytics/track";
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

  // ── THE MISSING FUNNEL STEP ──────────────────────────────────────────────
  // Fires here rather than in the auth routes because this one line covers
  // BOTH ways in: Google comes back through /auth/callback, email+password
  // comes back through a confirmation link, and they converge on this screen.
  // It also has something the signup route does not — a session, so `track()`
  // can attribute it without being handed an id.
  //
  // Everything above this point has already redirected anyone who finished
  // onboarding, so reaching this line means exactly: has an account, has no
  // profile. `learner_registered` minus this is the number of people who got
  // an account and never picked a class, which was previously unknowable.
  //
  // Count DISTINCT learners, not rows: someone who reloads this screen emits
  // twice, and `student_id` is on the row precisely so that is fixable.
  await track("onboarding_started", { locale });

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
