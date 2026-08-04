import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { t as tContent } from "@/lib/i18n/content";
import { selectNextAction } from "@/lib/learning/adaptivity";
import { track } from "@/lib/analytics/track";
import { Badge } from "@/components/ui/Badge";
import { BackLink } from "@/components/ui/BackLink";
import { buttonClasses } from "@/components/ui/Button";
import { JourneyPath, type JourneyNode } from "@/components/learn/JourneyPath";
import type { Locale } from "@/i18n/config";

/**
 * `/learn/[chapter]` — one chapter: the path through it, what it covers, its quiz.
 *
 * ── THE ROUTE THAT WAS SPECIFIED AND NEVER BUILT ────────────────────────────
 * `docs/SCREENS.md` line 23 has listed this route since the beginning —
 * "Chapter path, lessons as nodes". It was never built, and `/learn` grew the
 * chapter view inside itself instead, rendering `chapters[0]` and discarding
 * the rest.
 *
 * That worked while every class had exactly one chapter. The day a second was
 * seeded, half the curriculum became unreachable: no screen rendered a link to
 * a lesson outside the first chapter, so a Class 7 learner could not open an
 * Integers lesson at all. Building this route is what makes the home screen
 * able to list chapters instead of being one.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * **Nothing is gated**, here or anywhere. A learner may open any chapter and any
 * lesson in any order (D17 rejects gating, and the lesson route says the same).
 * That is not only a philosophy: the teacher this was built for is teaching
 * Class 6 chapter 4 and Class 7 chapter 6, which are not the first chapters of
 * anything. A learner told to open chapter 6 must be able to.
 */
export default async function ChapterPage({
  params,
}: {
  params: Promise<{ chapter: string }>;
}) {
  const { chapter: chapterId } = await params;
  const supabase = await createClient();
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations();

  const user = await getCurrentUser();
  const studentId = user!.id;

  const [{ data: chapter }, { data: progress }, { data: mastery }] = await Promise.all([
    supabase
      .from("chapters")
      .select(
        "id, title, summary, i18n, concepts(id, name, slug, order_index, i18n), lessons(id, title, order_index, concept_id, i18n)",
      )
      .eq("id", chapterId)
      .maybeSingle(),
    supabase.from("lesson_progress").select("lesson_id, status").eq("student_id", studentId),
    supabase
      .from("concept_mastery")
      .select("concept_id, score, is_mastered, attempts_count")
      .eq("student_id", studentId),
  ]);

  // A bad id in the address bar is a 404, not a crash and not an empty page.
  if (!chapter) notFound();

  const lessons = [...chapter.lessons].sort((a, b) => a.order_index - b.order_index);
  const concepts = [...chapter.concepts].sort((a, b) => a.order_index - b.order_index);

  const completedIds = new Set(
    (progress ?? []).filter((p) => p.status === "completed").map((p) => p.lesson_id),
  );
  // Only THIS chapter's lessons. `progress` holds every lesson the learner has
  // ever finished, including other grades — a learner who changes class keeps
  // their old progress, and counting it here would show "2 of 5" on a chapter
  // they had never opened.
  const done = lessons.filter((l) => completedIds.has(l.id)).length;

  const action = selectNextAction({
    lessons: lessons.map((l) => ({ id: l.id, order_index: l.order_index })),
    progress: (progress ?? []).map((p) => ({
      lesson_id: p.lesson_id,
      status: p.status === "completed" ? ("completed" as const) : ("started" as const),
    })),
    mastery: mastery ?? [],
    concepts: concepts.map((c) => c.id),
  });
  const currentLessonId = action.kind === "lesson" ? action.lessonId : null;

  const nodes: JourneyNode[] = lessons.map((lesson) => ({
    lessonId: lesson.id,
    title: tContent(lesson, "title", locale),
    state: completedIds.has(lesson.id)
      ? "completed"
      : lesson.id === currentLessonId
        ? "current"
        : "upcoming",
    href: `/learn/${chapter.id}/${lesson.id}`,
  }));

  const masteryByConcept = new Map((mastery ?? []).map((m) => [m.concept_id, m]));

  // The drop-off the chapter picker creates: opened a chapter, started no
  // lesson. Emitted here rather than on the tap, for the same reason
  // `recommendation_clicked` is — arriving is what actually happened, and a tap
  // that never finished loading on 4G is not an arrival.
  await track("chapter_opened", { chapter_id: chapter.id, lessons: lessons.length });

  return (
    <main className="flex-1 w-full max-w-(--container-content) mx-auto px-lg py-lg flex flex-col gap-xl">
      <div className="flex flex-col gap-md">
        <BackLink href="/learn" label={t("nav.learn")} />
        <div className="flex flex-col gap-xs">
          <h1 className="text-h1 text-ink">{tContent(chapter, "title", locale)}</h1>
          <p className="text-body-sm text-muted">
            {t("dashboard.lessonsProgress", { done, total: lessons.length })}
          </p>
        </div>
      </div>

      {lessons.length === 0 ? (
        // A seeded chapter with no lessons is a real state while content is
        // written, and a designed one rather than a blank screen. Its own
        // string: `dashboard.comingSoonHelp` names a different class to go and
        // look at, which is right on an empty CLASS and nonsense here.
        <p className="text-body-sm text-body">{t("chapter.noLessons")}</p>
      ) : (
        <JourneyPath nodes={nodes} />
      )}

      {concepts.length > 0 && (
        <section className="flex flex-col gap-md">
          <h2 className="text-label text-muted">{t("dashboard.conceptsTitle")}</h2>
          <ul className="flex flex-col gap-sm">
            {concepts.map((concept) => {
              const m = masteryByConcept.get(concept.id);
              // A never-attempted concept shows NO badge. Rendering it as 0%
              // reads as failure rather than "not started", and this learner
              // does not need that on day one.
              const band =
                !m || m.attempts_count === 0
                  ? null
                  : m.is_mastered
                    ? "mastered"
                    : m.score >= 0.5
                      ? "developing"
                      : "needs_revision";

              return (
                <li key={concept.id} className="flex items-center justify-between gap-md min-h-11">
                  <span className="text-body text-body min-w-0">
                    {tContent(concept, "name", locale)}
                  </span>
                  {band && (
                    <Badge tone={band} className="shrink-0">
                      {t(`mastery.${band}`)}
                    </Badge>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="flex flex-col gap-md">
        <Link href={`/quiz/${chapter.id}`} className={buttonClasses("secondary")}>
          {t("chapter.quizStart")}
        </Link>
        <Link href="/progress" className={buttonClasses("ghost")}>
          {t("progress.open")}
        </Link>
      </div>
    </main>
  );
}
