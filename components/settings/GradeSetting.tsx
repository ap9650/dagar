"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

const GRADES = [6, 7, 8] as const;

/**
 * Change your class, from Settings.
 *
 * ── WHY THIS IS NOT OPTIONAL ────────────────────────────────────────────────
 * It was read-only text for a long time, which is the same defect the language
 * picker exists to prevent: *"without it, a learner who taps the wrong option at
 * onboarding is permanently stuck."* Grade decides which chapters exist for you,
 * so a mis-tap at onboarding meant never reaching your own curriculum — with the
 * app looking like it simply had the wrong content in it.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * The same three cards as onboarding, deliberately. A learner recognises the
 * control they used the first time; a settings-shaped variant of it is a new
 * thing to work out.
 *
 * **Nothing is reset.** Progress is per lesson and per concept, and lessons
 * belong to a chapter of one grade — so switching to Class 7 and back finds
 * Class 6 exactly as it was. The caption says so, because a learner who thinks
 * they might lose their streak will not touch this.
 */
export function GradeSetting({ current }: { current: number }) {
  const t = useTranslations();
  const router = useRouter();

  const [grade, setGrade] = useState(current);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function choose(next: number) {
    if (next === grade || busy) return;
    const previous = grade;

    // Optimistic: the tap is the answer. On a 4G connection the alternative is a
    // control that does nothing for a second and gets tapped again.
    setGrade(next);
    setBusy(true);
    setFailed(false);

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grade: next }),
      });
      if (!response.ok) throw new Error("patch failed");
      // The dashboard is a server component keyed on grade, so it has to be told.
      router.refresh();
    } catch {
      setGrade(previous);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-md">
      <fieldset className="flex flex-col gap-sm border-0 p-0 m-0" disabled={busy}>
        <legend className="sr-only">{t("settings.gradeTitle")}</legend>
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
                name="settings-grade"
                value={option}
                checked={selected}
                onChange={() => void choose(option)}
                className="sr-only"
              />
              {t("onboarding.gradeOption", { grade: option })}
            </label>
          );
        })}
      </fieldset>

      <p className="text-caption text-muted">{t("settings.gradeHelp")}</p>

      {failed && (
        // A failed write IS a system error, so this is the one place red belongs.
        <p role="alert" className="text-body-sm text-error">
          {t("errors.generic")}
        </p>
      )}
    </div>
  );
}
