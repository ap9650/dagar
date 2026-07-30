import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
// Scoped to the lesson route, not globals.css: the 23KB stylesheet is only paid
// for on screens that actually render maths.
import "katex/dist/katex.min.css";
import { createClient } from "@/lib/supabase/server";
import { t as tContent } from "@/lib/i18n/content";
import { LessonBody } from "@/components/learn/LessonBody";
import { LessonProgress } from "@/components/learn/LessonProgress";
import { LessonCompleteButton } from "@/components/learn/LessonCompleteButton";
import type { Locale } from "@/i18n/config";

/**
 * `/learn/[chapter]/[lesson]` — the micro-lesson (slice 1.4).
 *
 * This screen plus practice plus the tutor IS the product. Everything else is
 * evidence for it.
 *
 * Nothing here is gated. A learner may open any lesson in any order (D17 rejects
 * gating) — progress simply records what they did.
 */
export default async function LessonPage({
  params,
}: {
  params: Promise<{ chapter: string; lesson: string }>;
}) {
  const { chapter: chapterId, lesson: lessonId } = await params;
  const supabase = await createClient();
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const studentId = user!.id;

  const [{ data: lessons }, { data: progress }] = await Promise.all([
    // The whole chapter's lessons, because the progress dots need to know where
    // this one sits. One query, not one per dot.
    supabase
      .from("lessons")
      .select("id, title, body_md, est_minutes, order_index, concept_id, i18n")
      .eq("chapter_id", chapterId)
      .order("order_index"),
    supabase
      .from("lesson_progress")
      .select("lesson_id, status")
      .eq("student_id", studentId),
  ]);

  const ordered = lessons ?? [];
  const index = ordered.findIndex((l) => l.id === lessonId);
  if (index === -1) notFound();

  const lesson = ordered[index];
  const completedIds = new Set(
    (progress ?? []).filter((p) => p.status === "completed").map((p) => p.lesson_id),
  );

  const nextLesson = ordered[index + 1];
  // After completion there is always somewhere to go: the next lesson, or — at
  // the end of the chapter — practice on this lesson's concept.
  const nextHref = nextLesson
    ? `/learn/${chapterId}/${nextLesson.id}`
    : `/practice/${lesson.concept_id}`;

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
          {/* The step count belongs to the progress dots below and is NOT
              repeated here — it was, and reading the same sentence twice in two
              places makes a screen feel unfinished. */}
          <span className="text-caption text-muted">
            {tContent(lesson, "title", locale)}
          </span>
        </div>

        <LessonProgress
          step={index + 1}
          total={ordered.length}
          completedSteps={ordered
            .map((l, i) => (completedIds.has(l.id) ? i + 1 : 0))
            .filter(Boolean)}
        />

        <h1 className="text-h1 text-ink">{tContent(lesson, "title", locale)}</h1>
      </header>

      {/* Falls back to the English body when Hindi is absent — a learner sees
          content, never a blank (D16). Slice 1.6 fills the Hindi in. */}
      <LessonBody markdown={tContent(lesson, "body_md", locale)} />

      <LessonCompleteButton
        lessonId={lesson.id}
        nextHref={nextHref}
        alreadyComplete={completedIds.has(lesson.id)}
      />
    </main>
  );
}
