import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { LanguagePicker } from "@/components/ui/LanguagePicker";
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

  return (
    <main className="flex-1 w-full max-w-(--container-content) mx-auto px-lg py-3xl flex flex-col gap-3xl">
      {/* Reads the same in both scripts, so it needs no translation. */}
      <h1 className="text-h1 text-primary-strong text-center">Saathi</h1>

      <LanguagePicker current={locale} continueHref="/login" />
    </main>
  );
}
