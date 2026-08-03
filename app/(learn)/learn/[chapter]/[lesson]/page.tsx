import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
// Scoped to the lesson route, not globals.css: the 23KB stylesheet is only paid
// for on screens that actually render maths.
import "katex/dist/katex.min.css";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { t as tContent } from "@/lib/i18n/content";
import { trackRecommendationArrival } from "@/lib/analytics/track";
import { localisedSteps, parseSteps } from "@/lib/learning/lessonSteps";
import { stepSpeech } from "@/lib/learning/speakable";
import { nextAfterLesson, nextStepHref } from "@/lib/learning/nextStep";
import { LessonBody } from "@/components/learn/LessonBody";
import { SteppedLesson } from "@/components/learn/SteppedLesson";
import { LessonProgress } from "@/components/learn/LessonProgress";
import { LessonCompleteButton } from "@/components/learn/LessonCompleteButton";
import { TutorSheet } from "@/components/learn/TutorSheet";
import type { Locale } from "@/i18n/config";
import { BackLink } from "@/components/ui/BackLink";

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
  searchParams,
}: {
  params: Promise<{ chapter: string; lesson: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { chapter: chapterId, lesson: lessonId } = await params;
  await trackRecommendationArrival(searchParams, { target: "lesson" });
  const supabase = await createClient();
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations();

  const user = await getCurrentUser();
  const studentId = user!.id;

  const [{ data: lessons }, { data: progress }, { data: tutorHistory }] = await Promise.all([
    // The whole chapter's lessons, because the progress dots need to know where
    // this one sits. One query, not one per dot.
    supabase
      .from("lessons")
      .select("id, title, body_md, steps, est_minutes, order_index, concept_id, i18n")
      .eq("chapter_id", chapterId)
      .order("order_index"),
    supabase
      .from("lesson_progress")
      .select("lesson_id, status")
      .eq("student_id", studentId),
    // Rendered on the server so reopening a lesson shows the conversation
    // already there, with no fetch and no flash of an empty sheet.
    supabase
      .from("tutor_messages")
      .select("id, role, content, created_at")
      .eq("student_id", studentId)
      .eq("lesson_id", lessonId)
      .order("created_at", { ascending: true })
      .limit(40),
  ]);

  const ordered = lessons ?? [];
  const index = ordered.findIndex((l) => l.id === lessonId);
  if (index === -1) notFound();

  const lesson = ordered[index];
  const completedIds = new Set(
    (progress ?? []).filter((p) => p.status === "completed").map((p) => p.lesson_id),
  );

  // Validated here, on the server. A malformed blob becomes null and the prose
  // renders instead — a content mistake must never blank a lesson (spec §10).
  const steps = localisedSteps(lesson, locale);

  // What the listen button will SAY, per step, in each language — built on the
  // server from each language's own steps.
  //
  // This is the fix for a real bug: audio used to be generated from whatever
  // steps were on screen, with only the symbol words swapped. Asked for Hindi it
  // read English prose with Hindi words for the fractions, which is exactly how
  // it sounded on a phone. `hi` is NULL when there is no Hindi text, so the
  // button offers a language only when it has something to say in it.
  const stepsEn = parseSteps(lesson.steps);
  const stepsHi = localisedSteps(lesson, "hi");
  const speech = (steps ?? []).map((_, i) => ({
    en: stepsEn?.[i] ? stepSpeech(stepsEn[i], "en") : "",
    hi: stepsHi && stepsHi !== stepsEn && stepsHi[i] ? stepSpeech(stepsHi[i], "hi") : null,
  }));

  // Practice at a concept boundary, not after every lesson — and the label has
  // to be able to say which it is. See `lib/learning/nextStep.ts` for why this
  // is a value rather than a ternary here.
  const next = nextAfterLesson(lesson, ordered[index + 1]);
  const nextHref = nextStepHref(next, chapterId);
  const goesToPractice = next.kind === "practice";

  return (
    <main className="flex-1 w-full max-w-(--container-content) mx-auto px-lg py-lg flex flex-col gap-xl">
      <header className="flex flex-col gap-lg">
        <div className="flex items-center gap-md">
          <BackLink href="/learn" label={t("lesson.backToChapter")} />
          {/* The step count belongs to the progress dots below and is NOT
              repeated here — it was, and reading the same sentence twice in two
              places makes a screen feel unfinished. */}
          <span className="text-caption text-muted">
            {tContent(lesson, "title", locale)}
          </span>
        </div>

        {/* Chapter position is hidden on a stepped lesson. Two progress bars on a
            360px screen is the opposite of "one thing at a time" (design rule
            11), and inside a lesson "where am I in THIS lesson" is the more
            actionable of the two — chapter position is on the journey path they
            arrived from. */}
        {!steps && (
          <LessonProgress
            step={index + 1}
            total={ordered.length}
            completedSteps={ordered
              .map((l, i) => (completedIds.has(l.id) ? i + 1 : 0))
              .filter(Boolean)}
          />
        )}

        <h1 className="text-h1 text-ink">{tContent(lesson, "title", locale)}</h1>
      </header>

      {/* D18's fallback, and the reason this slice can ship a chapter at a time:
          steps present → the player; steps absent or malformed → the prose that
          has always been here. Falls back to the English body when Hindi is
          absent too — a learner sees content, never a blank (D16). */}
      {steps ? (
        <SteppedLesson
          lessonId={lesson.id}
          steps={steps}
          speech={speech}
          nextHref={nextHref}
          nextIsPractice={goesToPractice}
          alreadyComplete={completedIds.has(lesson.id)}
        />
      ) : (
        <LessonBody markdown={tContent(lesson, "body_md", locale)} />
      )}

      {/* The tutor sits WITH the lesson, not on a route of its own: a learner
          who taps it is confused about the paragraph in front of them, and
          navigating away loses that paragraph. */}
      <TutorSheet
        lessonId={lesson.id}
        conceptId={lesson.concept_id}
        initialMessages={(tutorHistory ?? []).map((turn) => ({
          id: turn.id,
          role: turn.role as "user" | "assistant",
          content: turn.content,
        }))}
      />

      {/* The prose path's own footer. A stepped lesson finishes at its last
          step instead — see SteppedLesson. */}
      {!steps && (
        <LessonCompleteButton
          lessonId={lesson.id}
          nextHref={nextHref}
          nextIsPractice={goesToPractice}
          alreadyComplete={completedIds.has(lesson.id)}
        />
      )}
    </main>
  );
}
