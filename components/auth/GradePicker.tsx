"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { Locale } from "@/i18n/config";

const GRADES = [6, 7, 8] as const;

/**
 * Grade selection — the last step of onboarding, and the step that creates the
 * profile.
 *
 * Three tap targets and nothing else. No free-text age field, no school, no city,
 * no district. We never ask a minor for personal information, and what we do not
 * collect cannot leak (saathi-security §5).
 */
export function GradePicker({ locale }: { locale: Locale }) {
  const t = useTranslations();
  const router = useRouter();

  const [grade, setGrade] = useState<6 | 7 | 8 | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!grade) return;
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The locale chosen back at /welcome is written to profiles.locale here —
        // this is the moment the cookie becomes a durable record (D16).
        body: JSON.stringify({ grade, locale }),
      });

      if (!response.ok) {
        setError(t("errors.generic"));
        return;
      }

      router.replace("/learn");
      router.refresh();
    } catch {
      setError(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-xl">
      <fieldset className="flex flex-col gap-md" disabled={busy}>
        <legend className="sr-only">{t("onboarding.gradeTitle")}</legend>

        {GRADES.map((option) => {
          const selected = grade === option;
          return (
            <label
              key={option}
              className={cn(
                "flex min-h-16 items-center justify-center",
                "px-lg rounded-(--radius-card) border cursor-pointer",
                "text-h3 transition-colors duration-150 ease-out",
                "focus-within:outline focus-within:outline-2 focus-within:outline-primary focus-within:outline-offset-2",
                selected
                  ? "bg-primary-soft border-primary text-primary-strong"
                  : "bg-background border-border text-ink",
              )}
            >
              <input
                type="radio"
                name="grade"
                value={option}
                checked={selected}
                onChange={() => setGrade(option)}
                className="sr-only"
              />
              {t("onboarding.gradeOption", { grade: option })}
            </label>
          );
        })}
      </fieldset>

      {error && (
        <p role="alert" className="text-body-sm text-error">
          {error}
        </p>
      )}

      <Button onClick={save} disabled={!grade} loading={busy}>
        {t("common.continue")}
      </Button>

      <p className="text-caption text-muted text-center">
        {t("onboarding.gradeHelp")}
      </p>
    </div>
  );
}
