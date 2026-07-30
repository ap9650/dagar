import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { buttonClasses } from "@/components/ui/Button";
import type { Locale } from "@/i18n/config";

/**
 * `/learn` — placeholder. **Slice 1.3 replaces this** with the real journey
 * layout (D17): chapter path, you-are-here node, daily goal ring, streak.
 *
 * It exists now so slice 1.1 has somewhere real to land: onboarding is not
 * verifiable until the last redirect arrives at a page that proves the session
 * and the profile both survived.
 */
export default async function LearnPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The layout guarantees both of these exist — this read is for the greeting.
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, grade, locale")
    .eq("id", user!.id)
    .single();

  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;

  return (
    <main className="flex-1 w-full max-w-(--container-content) mx-auto px-lg py-2xl flex flex-col gap-xl">
      <header className="flex flex-col gap-sm">
        <h1 className="text-h1 text-ink">
          {profile?.display_name
            ? t("dashboard.greeting", { name: profile.display_name })
            : t("dashboard.greetingNoName")}
        </h1>
        <p className="text-body-sm text-body">
          {t("onboarding.gradeOption", { grade: profile?.grade ?? 6 })}
        </p>
      </header>

      <Card className="flex flex-col gap-md">
        <h2 className="text-h3 text-ink">{t("dashboard.chaptersTitle")}</h2>
        <p className="text-body-sm text-muted">{t("progress.empty")}</p>
      </Card>

      <Link href="/settings" className={buttonClasses("secondary")}>
        {t("settings.title")}
      </Link>

      <p className="text-caption text-muted">
        Slice 1.1 — profile locale: {profile?.locale} · rendering in: {locale}
      </p>
    </main>
  );
}
