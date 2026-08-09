import { getLocale, getTranslations } from "next-intl/server";
import { ArrowUpRight, Award, BookCheck, Sparkles } from "lucide-react";
import { entryDate, type DiaryEntry } from "@/lib/learning/diary";
import type { Locale } from "@/i18n/config";
import { weekdayFormatter } from "@/lib/i18n/weekday";

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

  // The SAME formatter the week strip's squares use. A line here reading "Wed"
  // beside a square reading "We" is what made the two sections impossible to
  // cross-check by eye — see `lib/i18n/weekday.ts`.
  const weekday = weekdayFormatter(locale);

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
            const line = describe(entry, names, t);
            if (!line) return null;
            const { icon, text } = line;

            return (
              <li key={`${entry.kind}-${index}`} className="flex items-start gap-md">
                <span className="text-caption text-muted font-medium w-10 shrink-0 pt-0.5">
                  {weekday(entryDate(entry))}
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

/**
 * One line, or null if we cannot name what it is about.
 *
 * Every branch used to fall back to an empty string, which produced a line
 * reading " -> Keep practising" with a hole where the concept belonged. That
 * looks like a rendering fault to a learner, and it reached a screenshot bound
 * for the pitch deck before anybody noticed.
 *
 * The root cause is fixed upstream (names are now loaded for every grade, not
 * just the learner's current one). This is the net under it: a diary entry
 * whose subject cannot be named is dropped, because saying nothing is honest
 * and saying half a sentence is not.
 */
function describe(entry: DiaryEntry, names: DiaryNames, t: Translator) {
  switch (entry.kind) {
    case "level": {
      const concept = names.concepts.get(entry.conceptId);
      if (!concept) return null;
      return {
        // Green, because a level going up is the strongest good news here — and
        // the only direction that reaches this list at all.
        icon: <ArrowUpRight size={16} strokeWidth={2.25} aria-hidden className="text-correct" />,
        text: t("moved.level", { concept, level: t(`level.${entry.to}` as never) }),
      };
    }
    case "lesson": {
      const lesson = names.lessons.get(entry.lessonId);
      if (!lesson) return null;
      return {
        icon: <BookCheck size={16} strokeWidth={1.75} aria-hidden className="text-primary" />,
        text: t("moved.lesson", { lesson }),
      };
    }
    case "chapter": {
      const chapter = names.chapters.get(entry.chapterId);
      if (!chapter) return null;
      return {
        icon: <Sparkles size={16} strokeWidth={1.75} aria-hidden className="text-primary" />,
        text: t("moved.chapter", { chapter }),
      };
    }
    case "badge":
      return {
        icon: <Award size={16} strokeWidth={1.75} aria-hidden className="text-celebrate" />,
        text: t("moved.badge", { badge: t(`milestone.${entry.code}` as never) }),
      };
  }
}
