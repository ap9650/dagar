"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { setLocale } from "@/i18n/actions";
import { LOCALES, LOCALE_LABEL, type Locale } from "@/i18n/config";
import { cn } from "@/lib/cn";
import { Button } from "./Button";

/**
 * Language picker — dagar-design § Language picker, D16.
 *
 * The same component serves `/welcome` (first screen, before any account) and
 * `/settings` (SCREENS.md Flow 4). Do not fork it: a learner who taps the wrong
 * language at onboarding has to recognise this exact control to get back out.
 *
 * Three rules it exists to enforce:
 *   1. Each option is written in its OWN script — never "Hindi" in English.
 *   2. No flags. Flags are countries; Hindi has no flag.
 *   3. Selected state is fill + border + a check icon. Colour is never the only
 *      signal (design rule 10).
 *
 * Native radios do the keyboard work (arrow keys, roving focus) for free — the
 * cards are styled labels over a visually-hidden input, not divs with handlers.
 */
export function LanguagePicker({
  current,
  continueHref,
  className,
}: {
  current: Locale;
  /**
   * Onboarding (`/welcome`) passes the next screen, so the learner confirms with
   * a second tap. Settings passes nothing and the change simply applies.
   *
   * Why a Continue button rather than navigating on select: the page re-renders
   * in the chosen language first, so the button's own label — `Continue` or
   * `आगे बढ़ो` — is the confirmation that they picked the one they can read. A
   * learner who taps the wrong card sees it immediately and can still fix it,
   * instead of being carried into a login screen they cannot read.
   */
  continueHref?: string;
  className?: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(locale: Locale) {
    if (locale === current) return;
    startTransition(async () => {
      await setLocale(locale);
    });
  }

  return (
    <div className={cn("flex flex-col gap-xl", className)}>
      <fieldset className="flex flex-col gap-md" disabled={pending}>
        {/* Visually hidden: SCREENS.md forbids any text above the picker that
            requires reading a language to understand. Screen readers still get a
            group name. */}
        <legend className="sr-only">{t("welcome.chooseLanguage")}</legend>

        {LOCALES.map((locale) => {
          const selected = locale === current;
          return (
            <label
              key={locale}
              lang={locale}
              className={cn(
                // 64px, not the usual 48px — this is the one tap that gates
                // everything after it.
                "relative flex min-h-16 items-center justify-between gap-md",
                "px-lg rounded-(--radius-card) border cursor-pointer",
                "transition-colors duration-150 ease-out",
                "focus-within:outline focus-within:outline-2 focus-within:outline-primary focus-within:outline-offset-2",
                selected
                  ? "bg-primary-soft border-primary text-primary-strong"
                  : "bg-background border-border text-ink",
                pending && "opacity-60",
              )}
            >
              <input
                type="radio"
                name="locale"
                value={locale}
                checked={selected}
                onChange={() => choose(locale)}
                className="sr-only"
              />
              <span className="text-h3">{LOCALE_LABEL[locale]}</span>
              {selected && (
                <Check
                  size={20}
                  strokeWidth={1.75}
                  aria-hidden
                  className="shrink-0"
                />
              )}
            </label>
          );
        })}
      </fieldset>

      {continueHref && (
        <Button
          onClick={() => router.push(continueHref)}
          disabled={pending}
          lang={current}
        >
          {t("common.continue")}
        </Button>
      )}
    </div>
  );
}
