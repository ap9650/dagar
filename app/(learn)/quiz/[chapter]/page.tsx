import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
// Scoped to this route, not globals.css: the 23KB stylesheet is only paid for on
// screens that actually render maths.
import "katex/dist/katex.min.css";
import { createClient } from "@/lib/supabase/server";
import { t as tContent } from "@/lib/i18n/content";
import { trackRecommendationArrival } from "@/lib/analytics/track";
import { QuizRunner } from "@/components/learn/QuizRunner";
import type { MasteryBand } from "@/lib/learning/mastery";
import type { Locale } from "@/i18n/config";

/**
 * `/quiz/[chapter]` — the chapter quiz (slice 2.4).
 *
 * This page **starts nothing**. It reads how many quiz questions the chapter has,
 * what the learner scored last time, and the concept names it will need for the
 * results screen — then hands over to a client component that opens the session
 * only when the learner presses Start.
 *
 * That is the opposite of the practice page, which server-renders question 1 so
 * entering practice never shows a spinner. Practice is somewhere you wander into;
 * a quiz is something you decide to take, and a mis-tap on the dashboard should
 * not silently open one.
 *
 * Nothing here reads an answer key. The count comes from `questions_public`,
 * which has no answer columns at all.
 */
export default async function QuizPage({
  params,
  searchParams,
}: {
  params: Promise<{ chapter: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { chapter: chapterId } = await params;
  await trackRecommendationArrival(searchParams, { target: "quiz" });
  const supabase = await createClient();
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const studentId = user!.id; // the (learn) layout guarantees this

  const [{ data: chapter }, { count: questionCount }, { data: lastSession }] =
    await Promise.all([
      supabase
        .from("chapters")
        .select("id, title, i18n, concepts(id, name, i18n)")
        .eq("id", chapterId)
        .maybeSingle(),
      supabase
        .from("questions_public")
        .select("id", { count: "exact", head: true })
        .eq("chapter_id", chapterId)
        .eq("kind", "quiz"),
      supabase
        .from("quiz_sessions")
        .select("score, total, mastery_band, submitted_at")
        .eq("student_id", studentId)
        .eq("chapter_id", chapterId)
        .not("submitted_at", "is", null)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (!chapter) notFound();

  const chapterTitle = tContent(chapter, "title", locale);

  // Names for the results screen's "practise this" link. Resolved here rather
  // than shipped from the API: the quiz payload carries `concept_id` only, and a
  // concept name is curriculum content the server already has in hand.
  const conceptNames = Object.fromEntries(
    (chapter.concepts ?? []).map((concept) => [
      concept.id,
      tContent(concept, "name", locale),
    ]),
  );

  const lastResult =
    lastSession?.total && lastSession.total > 0
      ? {
          score: lastSession.score ?? 0,
          total: lastSession.total,
          band: (lastSession.mastery_band as MasteryBand | null) ?? "needs_revision",
        }
      : null;

  return (
    <main className="flex-1 w-full max-w-(--container-content) mx-auto px-lg py-lg flex flex-col gap-xl">
      <header className="flex flex-col gap-lg">
        <div className="flex items-center gap-md">
          <Link
            href="/learn"
            aria-label={t("quiz.backToChapter")}
            className="inline-flex items-center justify-center size-11 -ms-sm rounded-(--radius-control) text-body hover:bg-surface"
          >
            <ArrowLeft size={20} strokeWidth={1.75} aria-hidden />
          </Link>
          <span className="text-caption text-muted">{t("quiz.title")}</span>
        </div>

        <h1 className="text-h1 text-ink">{chapterTitle}</h1>
      </header>

      {questionCount && questionCount > 0 ? (
        <QuizRunner
          chapterId={chapterId}
          questionCount={questionCount}
          conceptNames={conceptNames}
          lastResult={lastResult}
        />
      ) : (
        // A chapter with no seeded quiz is a real state while the Class 7 and 8
        // banks fill in — not an error, and never a quiz of zero questions
        // (spec §6).
        <p className="text-body text-body">{t("quiz.comingSoon")}</p>
      )}
    </main>
  );
}
