import { getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { LanguagePicker } from "@/components/ui/LanguagePicker";
import type { Locale } from "@/i18n/config";

/**
 * Day 0 placeholder. Slice 1.1 replaces this with the real splash that redirects
 * by auth state (docs/SCREENS.md Flow 1).
 *
 * It exists now so the first Vercel deploy renders something real: it proves the
 * fonts load, the tokens resolve, both scripts render at their correct sizes, and
 * — since prompt 5 — that switching language re-renders the whole page from the
 * server dictionary with no hardcoded strings left behind.
 */
export default async function Home() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations();

  return (
    <main className="flex-1 w-full max-w-(--container-content) mx-auto px-lg py-2xl flex flex-col gap-xl">
      <header className="flex flex-col gap-sm">
        <h1 className="text-h1 text-ink">{t("common.appName")}</h1>
        <p className="text-body text-body">{t("common.tagline")}</p>
      </header>

      <LanguagePicker current={locale} />

      <Card className="flex flex-col gap-lg">
        <div className="flex items-center justify-between gap-md">
          <h2 className="text-h3 text-ink">{t("dashboard.dailyGoalTitle")}</h2>
          <Badge tone="developing">{t("mastery.developing")}</Badge>
        </div>
        <ProgressBar
          value={3}
          max={5}
          label={t("dashboard.lessonsProgress", { done: 3, total: 5 })}
        />
        <Button>{t("common.continue")}</Button>
      </Card>

      <p className="text-caption text-muted">{t("streak.days", { days: 3 })}</p>
    </main>
  );
}
