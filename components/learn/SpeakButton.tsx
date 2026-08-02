"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Volume2, Square } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import {
  getServerSnapshot,
  getSnapshot,
  refresh,
  setLang,
  speak,
  stop,
  subscribe,
  watchVoices,
} from "@/lib/speech";
import type { Locale } from "@/i18n/config";

/**
 * Listen to this step — and choose the language you listen in.
 *
 * The language pill only appears when the device can actually speak both. On a
 * phone with no Hindi voice pack there is nothing to choose between, and a
 * toggle that silently falls back to English would be worse than no toggle.
 *
 * The pill is written in its OWN script — `हिं` / `EN` — for the same reason the
 * language picker is (D16): a learner who cannot read one of them must still
 * recognise the other.
 *
 * `text` arrives PRE-RENDERED IN BOTH LANGUAGES, and that is the whole point of
 * the feature: this button reads in the language IT is set to, not the one the
 * page is written in. Passing a single string would have quietly re-coupled the
 * two settings that the teacher's feedback was about separating.
 */
export function SpeakButton({ text }: { text: Record<Locale, string> }) {
  const t = useTranslations("lesson");
  const { available, lang, speaking } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  useEffect(() => {
    // Chrome returns an EMPTY voice list on the first call and fills it
    // asynchronously, so this needs the event as well as the initial read —
    // otherwise the button decides there are no voices and never comes back.
    watchVoices();
    refresh();
  }, []);

  // Stop when the step changes. Otherwise the previous screen keeps talking
  // over the one the learner is now looking at.
  useEffect(() => stop, [text.en]);

  if (available.length === 0) return null;

  const other: Locale | null =
    available.length > 1 ? (lang === "hi" ? "en" : "hi") : null;

  return (
    <div className="flex items-center gap-sm">
      <button
        type="button"
        onClick={() => (speaking ? stop() : speak(text[lang], lang))}
        aria-label={speaking ? t("stopListening") : t("listen")}
        className={cn(
          "inline-flex items-center justify-center gap-sm min-h-11 px-lg",
          "rounded-(--radius-control) border border-border-strong bg-background",
          "text-label font-medium text-body",
          "transition-colors duration-150 ease-out hover:bg-surface",
          "focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2",
          speaking && "border-primary bg-primary-soft text-primary-strong",
        )}
      >
        {speaking ? (
          <Square size={18} strokeWidth={2} aria-hidden />
        ) : (
          <Volume2 size={20} strokeWidth={1.75} aria-hidden />
        )}
        {speaking ? t("stopListening") : t("listen")}
      </button>

      {other && (
        <button
          type="button"
          onClick={() => {
            stop();
            setLang(other);
          }}
          // Says what tapping DOES, not what is currently set — the pill shows
          // the current language, so the two together would contradict.
          aria-label={t("listenIn", { lang: other === "hi" ? "हिंदी" : "English" })}
          className={cn(
            "inline-flex items-center justify-center size-11 shrink-0",
            "rounded-(--radius-control) border border-border text-label font-medium text-muted",
            "transition-colors duration-150 ease-out hover:bg-surface",
            "focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2",
          )}
        >
          {/* Each script writes itself. */}
          <span lang={lang}>{lang === "hi" ? "हिं" : "EN"}</span>
        </button>
      )}
    </div>
  );
}
