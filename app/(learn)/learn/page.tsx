import Link from "next/link";
import { Settings as SettingsIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { t as tContent } from "@/lib/i18n/content";
import { selectNextAction } from "@/lib/learning/adaptivity";
import { dailyGoal } from "@/lib/learning/dailyGoal";
import { istDate, istDayStart } from "@/lib/learning/dates";
import { fromRow, streakStatus } from "@/lib/learning/streaks";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { buttonClasses } from "@/components/ui/Button";
import { DailyGoalRing } from "@/components/learn/DailyGoalRing";
import { StreakBadge } from "@/components/learn/StreakBadge";
import { JourneyPath, type JourneyNode } from "@/components/learn/JourneyPath";
import { NextLessonCard } from "@/components/learn/NextLessonCard";
import { track } from "@/lib/analytics/track";
import { InstallPrompt } from "@/components/InstallPrompt";
import type { Locale } from "@/i18n/config";

/**
 * `/learn` — the learner's home (slice 1.3).
 *
 * Three jobs in priority order (curriculum-dashboard spec §1):
 *   1. tell them what to do next — ONE action, not a menu
 *   2. show progress they can SEE — a journey path, not a percentage
 *   3. sustain the habit — streak in the header, daily goal ring at the top
 *
 * **One server component, one round of queries.** Everything below is fetched here
 * and passed down. Fetching per chapter from the client is the difference between a
 * 1s and a 4s dashboard on 4G, and this audience is on 4G.
 *
 * Writes nothing. Reads run under the learner's own session, so RLS is the boundary
 * rather than any check written here.
 */
export default async function LearnPage() {
  const supabase = await createClient();
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations();

  const user = await getCurrentUser();
  const studentId = user!.id; // the (learn) layout guarantees this

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, grade")
    .eq("id", studentId)
    .single();

  const grade = profile?.grade ?? 6;
  const todayStart = istDayStart(istDate()).toISOString();

  // ─── one round of queries, in parallel ─────────────────────────────────────
  const [
    { data: chapters },
    { data: progress },
    { data: mastery },
    { data: streak },
    { count: lessonsToday },
    { count: practiceToday },
  ] = await Promise.all([
    // Nested select: chapter → concepts → lessons in a single round trip. Three
    // separate queries here would be three sequential network hops on a phone.
    // The select MUST be one string literal, not assembled with `+`. Supabase
    // infers the row type from the literal, and a concatenated string degrades
    // every nested relation to `GenericStringError`.
    supabase
      .from("chapters")
      .select(
        "id, title, summary, i18n, order_index, concepts(id, name, slug, order_index, i18n), lessons(id, title, order_index, concept_id, i18n)",
      )
      .eq("grade", grade)
      .order("order_index"),
    supabase.from("lesson_progress").select("lesson_id, status").eq("student_id", studentId),
    supabase
      .from("concept_mastery")
      .select("concept_id, score, is_mastered, attempts_count")
      .eq("student_id", studentId),
    supabase
      .from("streaks")
      .select("current, longest, last_active_date, grace_used_on")
      .eq("student_id", studentId)
      .maybeSingle(),
    supabase
      .from("lesson_progress")
      .select("*", { count: "exact", head: true })
      .eq("student_id", studentId)
      .eq("status", "completed")
      .gte("completed_at", todayStart),
    supabase
      .from("attempts")
      .select("*", { count: "exact", head: true })
      .eq("student_id", studentId)
      .eq("session_kind", "practice")
      .gte("created_at", todayStart),
  ]);

  const chapter = chapters?.[0];
  const goal = dailyGoal(lessonsToday ?? 0, practiceToday ?? 0);

  // Whether the STORED streak is still alive today — see streaks.ts. It lived
  // here as three inline lines until /progress needed the same answer, and two
  // screens quietly disagreeing about whether a learner still has their streak
  // is exactly the bug that erodes trust in the number.
  const streakState = streakStatus(fromRow(streak));

  const header = (
    <header className="flex items-center justify-between gap-md">
      <div className="min-w-0">
        <h1 className="text-h2 text-ink truncate">
          {profile?.display_name
            ? t("dashboard.greeting", { name: profile.display_name })
            : t("dashboard.greetingNoName")}
        </h1>
      </div>
      <div className="flex items-center gap-sm shrink-0">
        {/* The flame is the way in to /progress. Tapping the thing you want to
            know more about is where a learner already reaches, and it costs no
            room in a 360px header — which is why the bottom nav in SCREENS is
            still on the Day 3 list, alongside the parent tab that will make it a
            four-destination bar rather than a two. */}
        <Link href="/progress" aria-label={t("progress.open")}>
          <StreakBadge days={streakState.days} graceActive={streakState.graceActive} />
        </Link>
        {/* An icon, reachable from every screen: this is how a learner who picked
            the wrong language gets back out (auth-onboarding spec §7). */}
        <Link
          href="/settings"
          aria-label={t("settings.title")}
          className="inline-flex items-center justify-center size-11 rounded-(--radius-control) text-body hover:bg-surface"
        >
          <SettingsIcon size={20} strokeWidth={1.75} aria-hidden />
        </Link>
      </div>
    </header>
  );

  // ─── grade with no content seeded ──────────────────────────────────────────
  // Classes 7 and 8 land in slice 1.5, so this branch is live right now. An empty
  // dashboard is the worst possible failure, so it is a designed state with a way
  // out, not a white screen (spec §7).
  if (!chapter || chapter.lessons.length === 0) {
    return (
      <main className="flex-1 w-full max-w-(--container-content) mx-auto px-lg py-lg flex flex-col gap-xl">
        {header}
        <Card className="flex flex-col gap-md">
          <h2 className="text-h3 text-ink">{t("nextAction.noContent")}</h2>
          <p className="text-body-sm text-body">{t("dashboard.comingSoonHelp")}</p>
          {/* "Change your class", not "Class" — a field label is not an action. */}
          <Link href="/settings" className={buttonClasses("secondary")}>
            {t("dashboard.changeClass")}
          </Link>
        </Card>
      </main>
    );
  }

  const lessons = [...chapter.lessons].sort((a, b) => a.order_index - b.order_index);
  const concepts = [...chapter.concepts].sort((a, b) => a.order_index - b.order_index);

  const action = selectNextAction({
    lessons: lessons.map((l) => ({ id: l.id, order_index: l.order_index })),
    // `status` is a `text` column with a check constraint, so the generated types
    // widen it to string. The constraint is the real guarantee; this narrows it
    // back rather than loosening the type in lib/learning.
    progress: (progress ?? []).map((p) => ({
      lesson_id: p.lesson_id,
      status: p.status === "completed" ? ("completed" as const) : ("started" as const),
    })),
    mastery: mastery ?? [],
    concepts: concepts.map((c) => c.id),
  });

  const completedIds = new Set(
    (progress ?? []).filter((p) => p.status === "completed").map((p) => p.lesson_id),
  );

  // Count only THIS chapter's lessons. `progress` holds every lesson the learner
  // has ever finished, including other grades — a learner who changes grade in
  // Settings keeps their old progress (spec §7), and counting it here showed
  // "2 of 5" on a chapter they had not opened.
  const completedInChapter = lessons.filter((l) => completedIds.has(l.id)).length;

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

  const conceptById = new Map(concepts.map((c) => [c.id, c]));
  const masteryByConcept = new Map((mastery ?? []).map((m) => [m.concept_id, m]));

  const nextCard = (() => {
    if (action.kind === "lesson") {
      const lesson = lessons.find((l) => l.id === action.lessonId)!;
      return (
        <NextLessonCard
          reason={action.reason}
          title={tContent(lesson, "title", locale)}
          href={`/learn/${chapter.id}/${lesson.id}`}
        />
      );
    }
    if (action.kind === "practice") {
      const concept = conceptById.get(action.conceptId)!;
      const name = tContent(concept, "name", locale);
      return (
        <NextLessonCard
          reason="strengthen"
          title={name}
          conceptName={name}
          href={`/practice/${action.conceptId}`}
        />
      );
    }
    return (
      <NextLessonCard
        reason="revise"
        title={tContent(chapter, "title", locale)}
        href={`/quiz/${chapter.id}`}
      />
    );
  })();

  // The denominator of Recommendation Acceptance (PRD §12). Carries WHAT was
  // recommended, so the metric can be read per recommendation type rather than
  // as one blended number — "learners follow revision prompts but ignore
  // practice prompts" is the finding worth having, and a bare rate hides it.
  //
  // ── KNOWN IMPRECISION, measured 31 Jul 2026 ─────────────────────────────
  // This fires more than once per human visit. Observed in the events table:
  // two rows 354ms apart immediately after login, which is the auth redirect
  // and the page render both landing. Prefetch of /learn from another screen
  // does the same.
  //
  // Both inflate the DENOMINATOR of Recommendation Acceptance (PRD §12), so
  // the rate reads LOW rather than flattering — the safe direction for a
  // number that ends up in a deck. Left uncorrected on purpose: the honest fix
  // belongs in the aggregation layer, which should collapse views by learner
  // per minute rather than counting raw rows. Do that when /admin/metrics gets
  // built, and do not quote a raw acceptance rate before then.
  // ────────────────────────────────────────────────────────────────────────
  await track("dashboard_viewed", {
    recommendation: action.kind,
    reason: action.kind === "practice" ? "strengthen" : action.reason,
  });

  return (
    <main className="flex-1 w-full max-w-(--container-content) mx-auto px-lg py-lg flex flex-col gap-xl">
      {header}

      <DailyGoalRing goal={goal} />

      {nextCard}

      {/* Only after a first lesson is completed (D15). A learner who has not yet
          got anything out of Dagar has no reason to install it, and asking then
          teaches them to dismiss prompts without reading. */}
      <InstallPrompt show={completedIds.size > 0} />

      <section className="flex flex-col gap-lg">
        <div className="flex flex-col gap-xs">
          <h2 className="text-h3 text-ink">{tContent(chapter, "title", locale)}</h2>
          <p className="text-body-sm text-muted">
            {t("dashboard.lessonsProgress", {
              done: completedInChapter,
              total: lessons.length,
            })}
          </p>
        </div>

        <JourneyPath nodes={nodes} />
      </section>

      <section className="flex flex-col gap-md">
        <h2 className="text-label text-muted">{t("dashboard.conceptsTitle")}</h2>
        <ul className="flex flex-col gap-sm">
          {concepts.map((concept) => {
            const m = masteryByConcept.get(concept.id);
            // A never-attempted concept has NO mastery row. It shows no badge at
            // all — rendering it as 0% reads as failure rather than "not started"
            // (spec §7), and this learner does not need that on day one.
            const band = !m || m.attempts_count === 0
              ? null
              : m.is_mastered
                ? "mastered"
                : m.score >= 0.5
                  ? "developing"
                  : "needs_revision";

            return (
              <li
                key={concept.id}
                className="flex items-center justify-between gap-md min-h-11"
              >
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

      <div className="flex flex-col gap-md">
        <Link href={`/quiz/${chapter.id}`} className={buttonClasses("secondary")}>
          {t("chapter.quizStart")}
        </Link>
        {/* Spelled out as well as reachable through the flame: a learner who does
            not think to tap a badge should still be able to find the screen. */}
        <Link href="/progress" className={buttonClasses("ghost")}>
          {t("progress.open")}
        </Link>
      </div>
    </main>
  );
}
