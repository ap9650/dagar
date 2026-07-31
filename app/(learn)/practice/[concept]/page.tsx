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
import { selectPracticeQuestion } from "@/lib/learning/practice";
import { PracticeSession } from "@/components/learn/PracticeSession";
import type { Locale } from "@/i18n/config";

/**
 * `/practice/[concept]` — guided practice (slice 2.2).
 *
 * The first question is chosen and rendered HERE, in the server render, so
 * entering practice puts a question on screen immediately rather than a spinner.
 * Everything after it is fetched by the session component through
 * `GET /api/practice/[conceptId]/next` — the same selection code either way, so
 * question 1 can never be picked by different rules from question 2.
 *
 * Note what this page reads: `questions_public`, via `selectPracticeQuestion`.
 * No answer key is fetched, held, or rendered anywhere on this route.
 */
export default async function PracticePage({
  params,
  searchParams,
}: {
  params: Promise<{ concept: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { concept: conceptId } = await params;
  await trackRecommendationArrival(searchParams, { target: "practice" });
  const supabase = await createClient();
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const studentId = user!.id;

  const { data: concept } = await supabase
    .from("concepts")
    .select("id, name, chapter_id, i18n")
    .eq("id", conceptId)
    .maybeSingle();

  if (!concept) notFound();

  const { question } = await selectPracticeQuestion({
    supabase,
    studentId,
    conceptId,
  });

  const conceptName = tContent(concept, "name", locale);

  return (
    <main className="flex-1 w-full max-w-(--container-content) mx-auto px-lg py-lg flex flex-col gap-xl">
      <header className="flex flex-col gap-lg">
        <div className="flex items-center gap-md">
          <Link
            href="/learn"
            aria-label={t("lesson.backToChapter")}
            className="inline-flex items-center justify-center size-11 -ms-sm rounded-(--radius-control) text-body hover:bg-surface"
          >
            <ArrowLeft size={20} strokeWidth={1.75} aria-hidden />
          </Link>
          <span className="text-caption text-muted">{t("practice.title")}</span>
        </div>

        <h1 className="text-h1 text-ink">{conceptName}</h1>
      </header>

      {question ? (
        <PracticeSession conceptId={conceptId} firstQuestion={question} />
      ) : (
        // A concept with no seeded practice questions is a real state while the
        // Class 7 and 8 banks fill in — not an error, and not a blank screen.
        <p className="text-body text-body">{t("practice.noQuestions")}</p>
      )}
    </main>
  );
}
