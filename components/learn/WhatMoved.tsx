import { getLocale, getTranslations } from "next-intl/server";
import { ArrowUpRight, Award, BookCheck, Sparkles } from "lucide-react";
import { entryDate, type DiaryEntry } from "@/lib/learning/diary";
import type { Locale } from "@/i18n/config";

/**
 * "What moved" — the week's news, newest first.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE ONLY ELEMENT ON THIS SCREEN THAT PROVES YESTERDAY HAPPENED.
 *
 * Everything above it reports a state — a streak number, a level, a list of
 * concepts — all of which read identically the morning after a hard evening's
 * work. That is what "the progress screen is static" actually meant. This
 * reports change, so effort leaves a mark.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Titles are resolved here rather than in `buildDiary`, which returns ids: the
 * curriculum has a Hindi name for every concept and lesson, and a diary module
 * that reached for content would have to know about locales too.
 */
export type DiaryNames = {
  concepts: Map<string, string>;
  lessons: Map<string, string>;
  chapters: Map<string, string>;
};

export async function WhatMoved({
  entries,
  names,
}: {
  entries: DiaryEntry[];
  names: DiaryNames;
}) {
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;

  // "Wed". `en-IN` and `hi-IN` both give a short weekday; the IST midnight
  // parse keeps it on the right day for a learner working late in the evening.
  const weekday = new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    weekday: "short",
    timeZone: "Asia/Kolkata",
  });

  return (
    <section aria-labelledby="moved-heading" className="flex flex-col gap-md">
      <h2 id="moved-heading" className="text-h3 text-ink">
        {t("moved.title")}
      </h2>

      {entries.length === 0 ? (
        /* The state a learner in their first week sees more than any other, so
           it is written warmly and says what will appear rather than reporting
           an absence. */
        <p className="text-body-sm text-body">{t("moved.empty")}</p>
      ) : (
        <ol className="flex flex-col gap-md list-none m-0 p-0">
          {entries.map((entry, index) => {
            const { icon, text } = describe(entry, names, t);

            return (
              <li key={`${entry.kind}-${index}`} className="flex items-start gap-md">
                <span className="text-caption text-muted font-medium w-10 shrink-0 pt-0.5">
                  {weekday.format(new Date(`${entryDate(entry)}T12:00:00+05:30`))}
                </span>
                <span className="shrink-0 pt-0.5">{icon}</span>
                <span className="text-body-sm text-ink min-w-0">{text}</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

/**
 * The ROOT translator, spelled out.
 *
 * `Awaited<ReturnType<typeof getTranslations>>` resolves to next-intl's
 * *namespaced* default, and every root key then fails to typecheck — the same
 * trap `Celebration.tsx` documents. `<never>` is what selects the un-namespaced
 * one, which is what lets this reach both `moved.*` and `milestone.*`.
 */
type Translator = Awaited<ReturnType<typeof getTranslations<never>>>;

function describe(entry: DiaryEntry, names: DiaryNames, t: Translator) {
  switch (entry.kind) {
    case "level":
      return {
        // Green, because a level going up is the strongest good news here — and
        // the only direction that reaches this list at all.
        icon: <ArrowUpRight size={16} strokeWidth={2.25} aria-hidden className="text-correct" />,
        text: t("moved.level", {
          concept: names.concepts.get(entry.conceptId) ?? "",
          level: t(`level.${entry.to}` as never),
        }),
      };
    case "lesson":
      return {
        icon: <BookCheck size={16} strokeWidth={1.75} aria-hidden className="text-primary" />,
        text: t("moved.lesson", { lesson: names.lessons.get(entry.lessonId) ?? "" }),
      };
    case "chapter":
      return {
        icon: <Sparkles size={16} strokeWidth={1.75} aria-hidden className="text-primary" />,
        text: t("moved.chapter", { chapter: names.chapters.get(entry.chapterId) ?? "" }),
      };
    case "badge":
      return {
        icon: <Award size={16} strokeWidth={1.75} aria-hidden className="text-celebrate" />,
        text: t("moved.badge", { badge: t(`milestone.${entry.code}` as never) }),
      };
  }
}
