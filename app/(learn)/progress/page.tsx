import { Flame } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient, getCurrentProfile, getCurrentUser } from "@/lib/supabase/server";
import { t as tContent } from "@/lib/i18n/content";
import { dailyGoal } from "@/lib/learning/dailyGoal";
import { istDate, istDayStart } from "@/lib/learning/dates";
import { fromRow, streakStatus } from "@/lib/learning/streaks";
import { rungProgress } from "@/lib/learning/streakLadder";
import { earnedCount, milestoneGrid } from "@/lib/learning/milestones";
import { BADGE_LADDERS, FIRST_CODES, ladderState } from "@/lib/learning/badgeLadders";
import { chapterMastery, type MasteryBand } from "@/lib/learning/mastery";
import { chapterLevel, conceptLevel, type Level } from "@/lib/learning/levels";
import { weekOfActivity } from "@/lib/learning/week";
import { buildDiary, DIARY_EVENTS } from "@/lib/learning/diary";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ConceptRow } from "@/components/learn/ConceptRow";
import { DailyGoalRing } from "@/components/learn/DailyGoalRing";
import { BadgeLadders } from "@/components/learn/BadgeLadders";
import { WeekStrip } from "@/components/learn/WeekStrip";
import { WhatMoved } from "@/components/learn/WhatMoved";
import { cn } from "@/lib/cn";
import type { Locale } from "@/i18n/config";
import { BackLink } from "@/components/ui/BackLink";

/**
 * `/progress` — mastery, streak, milestones (slice 2.5).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THIS SCREEN COMPUTES NOTHING THAT MATTERS. It reads.
 *
 * The streak was extended by `extend_streak` on the write that earned it, mastery
 * by `recompute_concept_mastery`, badges by `award_milestones`. Every number here
 * already existed before the page was requested. That is the point of D7's
 * "server-side truth": a learner cannot manufacture a streak by opening a screen,
 * and two devices looking at the same account cannot disagree.
 *
 * The one thing computed here is `streakStatus` — whether the STORED streak is
 * still alive today — and that is display logic, not truth. See streaks.ts.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * One server component, one round of queries, same as the dashboard. Fetching
 * six things from the client would be six round trips on a phone.
 */
export default async function ProgressPage() {
  const supabase = await createClient();
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations();

  const user = await getCurrentUser();
  const studentId = user!.id; // the (learn) layout guarantees this

  // Already fetched by the (learn) layout and cached for this request — free.
  const profile = await getCurrentProfile();

  const grade = profile?.grade ?? 6;
  const today = istDate();
  const todayStart = istDayStart(today).toISOString();

  // Seven days back from IST MIDNIGHT, not from "now minus 8 days".
  //
  // Anchoring to the day boundary is what makes the oldest square whole: from
  // `now` it would start mid-morning and silently clip work the learner did
  // early on that day. It also keeps `Date.now()` out of the render, which the
  // React compiler flags as impure — the two reasons happen to agree.
  const weekAgo = new Date(istDayStart(today).getTime() - 7 * 86_400_000).toISOString();

  const [
    { data: chapters },
    { data: mastery },
    { data: streakRow },
    { data: earned },
    { count: lessonsToday },
    { count: practiceToday },
    { data: weekLessons },
    { data: weekPractice },
    { data: diaryEvents },
    { data: allLessons },
    { data: namedChapters },
    { data: passedQuizzes },
  ] = await Promise.all([
    supabase
      .from("chapters")
      .select("id, title, i18n, order_index, concepts(id, name, order_index, i18n)")
      .eq("grade", grade)
      .order("order_index"),
    supabase
      .from("concept_mastery")
      .select("concept_id, score, attempts_count, is_mastered")
      .eq("student_id", studentId),
    supabase
      .from("streaks")
      .select("current, longest, last_active_date, grace_used_on")
      .eq("student_id", studentId)
      .maybeSingle(),
    supabase
      .from("milestones")
      .select("code, earned_at")
      .eq("student_id", studentId)
      .order("earned_at"),
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

    // ── every completed lesson ──────────────────────────────────────────────
    // Timestamps, not counts: the week squares are per-day and the IST grouping
    // happens in `weekOfActivity`, so that a lesson finished at 11:50pm lands
    // on the day the learner thinks it did.
    //
    // ALL of them, not just this week's: the chapters-finished ladder counts
    // whole chapters over a learner's whole history, and a window would make a
    // badge un-earn itself every Monday. `weekOfActivity` does its own filtering.
    supabase
      .from("lesson_progress")
      .select("completed_at, lesson_id")
      .eq("student_id", studentId)
      .eq("status", "completed"),
    supabase
      .from("attempts")
      .select("created_at")
      .eq("student_id", studentId)
      .eq("session_kind", "practice")
      .gte("created_at", weekAgo),

    // ── the diary ───────────────────────────────────────────────────────────
    // Under the learner's own session, never the service role: RLS is what
    // keeps one child's history out of another's screen, and on a learner-facing
    // page that boundary should not be a `.eq()` somebody has to remember.
    // `events` was insert-only until 0026 added the own-rows read policy — the
    // filter below is belt to that policy's braces.
    supabase
      .from("events")
      .select("name, props, created_at")
      .eq("student_id", studentId)
      .in("name", DIARY_EVENTS)
      .gte("created_at", weekAgo)
      .order("created_at", { ascending: false })
      .limit(200),

    // Titles for the diary, and the chapter each lesson belongs to for the
    // chapters-finished count. Whole-curriculum rather than per-entry: one read
    // of a small seeded table beats a query per diary line.
    supabase.from("lessons").select("id, chapter_id, title, i18n"),

    // Names for the diary, across EVERY grade rather than the learner's current
    // one. The chapter list above is filtered by grade because that is the
    // learner's own curriculum; the diary is a record of what they did, and a
    // learner who changed class still did it. Filtering both left a level-up
    // rendering as " -> Keep practising", with nothing where the concept name
    // should be. Five rows and twenty concepts, so the extra read is free.
    supabase.from("chapters").select("id, title, i18n, concepts(id, name, i18n)"),

    // Which chapter quizzes have been passed at the Mastered band — the last
    // condition on a chapter reaching Mastered (Khan Academy's rule: the top
    // level cannot be earned by drilling one concept's practice).
    supabase
      .from("quiz_sessions")
      .select("chapter_id, mastery_band")
      .eq("student_id", studentId)
      .eq("mastery_band", "mastered")
      .not("submitted_at", "is", null),
  ]);

  const streak = streakStatus(fromRow(streakRow), today);

  // Null once the ladder is finished, and null while the streak is broken — a
  // learner being told "start again today" should not be handed a distance to a
  // badge in the same breath. The invitation belongs to a streak that is alive.
  const ladder = streak.alive ? rungProgress(streak.days) : null;
  const goal = dailyGoal(lessonsToday ?? 0, practiceToday ?? 0);
  const grid = milestoneGrid(earned ?? []);
  const badges = earnedCount(grid);

  const masteryByConcept = new Map((mastery ?? []).map((m) => [m.concept_id, m]));
  const masteredIds = new Set(
    (mastery ?? []).filter((m) => m.is_mastered).map((m) => m.concept_id),
  );

  const week = weekOfActivity(
    (weekLessons ?? []).map((row) => row.completed_at).filter((at): at is string => Boolean(at)),
    (weekPractice ?? []).map((row) => row.created_at),
    new Date(),
    // Only while the streak is alive — the same condition as the rung bar above,
    // and for the same reason. `grace_used_on` keeps its value after a streak
    // breaks, and marking a rest day on a screen that is saying "start again
    // today" would describe a streak that is no longer there.
    streak.alive ? (streakRow?.grace_used_on ?? null) : null,
  );

  const completedLessonIds = new Set((weekLessons ?? []).map((row) => row.lesson_id));

  const diary = buildDiary(diaryEvents ?? []);

  const quizPassedChapters = new Set((passedQuizzes ?? []).map((row) => row.chapter_id));

  /**
   * ── THE LIVE COUNTS BEHIND "YOU ARE 4 AWAY" ─────────────────────────────
   * Read from the same tables `award_milestones` counts, so the screen and the
   * awarding cannot disagree about whether a rung has been reached.
   *
   * Chapters finished is counted across the WHOLE curriculum, not just this
   * learner's class: a learner who changes class keeps their progress (spec
   * §7), and a badge already earned must not un-earn itself because the
   * dashboard now shows different chapters.
   */
  const conceptsMastered = masteredIds.size;
  const chaptersFinished = countFinishedChapters(allLessons ?? [], completedLessonIds);

  const earnedCodes = new Set((earned ?? []).map((row) => row.code));
  const ladders = BADGE_LADDERS.map((ladder) =>
    ladderState(
      ladder,
      earnedCodes,
      ladder.key === "coming_back"
        ? streak.days
        : ladder.key === "ideas"
          ? conceptsMastered
          : chaptersFinished,
    ),
  );
  const firsts = grid.filter((milestone) => FIRST_CODES.includes(milestone.code));

  // Names in the learner's language, for the diary's lines. Built from the
  // curriculum we already fetched plus the lesson list.
  const diaryNames = {
    concepts: new Map(
      (namedChapters ?? []).flatMap((chapter) =>
        chapter.concepts.map((c) => [c.id, tContent(c, "name", locale)] as const),
      ),
    ),
    lessons: new Map(
      (allLessons ?? []).map((lesson) => [lesson.id, tContent(lesson, "title", locale)] as const),
    ),
    chapters: new Map(
      (namedChapters ?? []).map(
        (chapter) => [chapter.id, tContent(chapter, "title", locale)] as const,
      ),
    ),
  };

  return (
    <main className="flex-1 w-full max-w-(--container-content) mx-auto px-lg py-lg flex flex-col gap-xl">
      <header className="flex flex-col gap-lg">
        <div className="flex items-center gap-md">
          <BackLink href="/learn" label={t("errors.backHome")} />
        </div>
        <h1 className="text-h1 text-ink">{t("progress.title")}</h1>
      </header>

      {/* ── the streak (D7) ──────────────────────────────────────────────── */}
      <section
        aria-labelledby="streak-heading"
        className="flex items-center gap-lg rounded-(--radius-card) border border-border bg-surface px-lg py-lg"
      >
        <Flame
          size={32}
          strokeWidth={1.75}
          aria-hidden
          className={cn(
            "shrink-0",
            !streak.alive && "text-streak-rest",
            streak.alive && streak.graceActive && "text-celebrate",
            streak.alive && !streak.graceActive && "text-streak-active",
          )}
        />
        <div className="flex flex-col gap-xs min-w-0">
          <h2 id="streak-heading" className="text-h3 text-ink">
            {/* Never a loss message. A broken streak reads "Start again today" —
                the learner who missed a day is the one least helped by being
                told what they lost. */}
            {streak.alive ? t("streak.days", { days: streak.days }) : t("streak.broken")}
          </h2>
          {streak.graceActive && (
            <p className="text-body-sm text-celebrate">{t("streak.grace")}</p>
          )}
          {streak.longest > 0 && (
            <p className="text-body-sm text-muted">
              {t("progress.longestStreak", { days: streak.longest })}
            </p>
          )}

          {/*
            ── WHERE THE STREAK IS GOING ─────────────────────────────────────
            A streak that counts up forever is a number; one with a named next
            rung is a goal. D17 already endorses a visible finish line inside a
            lesson — this is the same principle at the scale of a week.

            The bar measures from the PREVIOUS rung, not from zero (see
            `rungProgress`): a learner on day 31 heading for 100 is one day into
            a seventy-day span, and a bar starting at zero would appear to
            collapse the moment they earned 30.

            Nothing renders past the top rung. A learner who has kept this going
            for a year gets their streak and no further ask — inventing a target
            beyond the ladder would be the dead end this replaced, moved upward.
          */}
          {ladder && (
            <div className="flex flex-col gap-xs pt-xs">
              {/* The TRACK is `border`, not `background`. This card sits on
                  `surface`, so a white track vanished into it — and on the day a
                  rung is reached the fill is legitimately zero, which made the
                  whole thing read as a broken white rule rather than as a fresh
                  span with everything still to go. */}
              <div className="h-1.5 rounded-full bg-border overflow-hidden" aria-hidden>
                <div
                  className="h-full rounded-full bg-streak-active"
                  style={{ width: `${ladder.fraction * 100}%` }}
                />
              </div>
              <p className="text-body-sm text-body">
                {t("streak.toNextRung", { days: ladder.remaining, target: ladder.next })}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── the last seven days ──────────────────────────────────────────── */}
      {/* Directly under the streak, because it is the same fact drawn a second
          way: the flame says how long, the squares say which days. Reading them
          together is how a learner sees a grace day rather than a mistake. */}
      <WeekStrip week={week} />

      {/* ── today's goal (D17) — the same rule as the streak ─────────────── */}
      <section aria-label={t("dashboard.dailyGoalTitle")}>
        <DailyGoalRing goal={goal} />
      </section>

      {/* ── what moved this week ─────────────────────────────────────────── */}
      {/* ABOVE the concept list and the badges, both of which report state.
          A learner opening this screen should meet the evidence that yesterday
          happened before they meet another table of where they currently are. */}
      <WhatMoved entries={diary} names={diaryNames} />

      {/* ── mastery per concept (D5) ─────────────────────────────────────── */}
      <section aria-labelledby="concepts-heading" className="flex flex-col gap-lg">
        <h2 id="concepts-heading" className="text-h3 text-ink">
          {t("progress.conceptsTitle")}
        </h2>

        {(chapters ?? []).length === 0 ? (
          <p className="text-body-sm text-body">{t("nextAction.noContent")}</p>
        ) : (
          (chapters ?? []).map((chapter) => {
            const concepts = [...chapter.concepts].sort(
              (a, b) => a.order_index - b.order_index,
            );
            const chapterProgress = chapterMastery(
              concepts.map((c) => c.id),
              masteredIds,
            );

            /**
             * ── THE ROLL-UP ────────────────────────────────────────────────
             * The chapter's own level, in the same four words a concept uses.
             * This is the answer to a parent's "what level is my child at" —
             * previously unanswerable without reading four rows and doing the
             * arithmetic yourself.
             *
             * Deliberately the SAME vocabulary at both scales: a learner should
             * not have to hold two ladders in their head for one idea.
             */
            const level = chapterLevel({
              total: chapterProgress.total,
              mastered: chapterProgress.mastered,
              started: concepts.some(
                (c) => (masteryByConcept.get(c.id)?.attempts_count ?? 0) > 0,
              ),
              quizPassed: quizPassedChapters.has(chapter.id),
            });

            return (
              <div key={chapter.id} className="flex flex-col gap-md">
                <div className="flex items-center justify-between gap-md">
                  <h3 className="text-h3 text-ink min-w-0">
                    {tContent(chapter, "title", locale)}
                  </h3>
                  <Badge tone={badgeToneFor(level)} className="shrink-0">
                    {t(`level.${level}` as never)}
                  </Badge>
                </div>

                <ProgressBar
                  value={chapterProgress.mastered}
                  max={chapterProgress.total}
                  // A bar is always paired with a number (design rule: "a ring
                  // alone is not readable to everyone").
                  label={t("chapterLevel.conceptsMastered", {
                    mastered: chapterProgress.mastered,
                    total: chapterProgress.total,
                  })}
                />

                {/* Says what the last step is rather than leaving a learner to
                    guess why four mastered ideas did not make a mastered
                    chapter. Only when that IS the remaining step. */}
                {chapterProgress.mastered === chapterProgress.total &&
                  chapterProgress.total > 0 &&
                  !quizPassedChapters.has(chapter.id) && (
                    <p className="text-body-sm text-muted">{t("chapterLevel.quizLeft")}</p>
                  )}

                <ul className="flex flex-col gap-sm">
                  {concepts.map((concept) => {
                    // A concept nobody has attempted shows "Not started", never
                    // 0% (spec §7). A learner who has not begun something is not
                    // failing at it, and 0% reads as failure.
                    //
                    // The thresholds used to be written out here, and again on
                    // the dashboard, and again on the chapter page. They live in
                    // `conceptLevel` now — a fourth copy would have decided when
                    // the diary announces a move, and a copy disagreeing by 0.01
                    // would announce moves no screen ever showed.
                    // The same row as the chapter screen, and now literally the
                    // same component. It was a hover-underlined name here and
                    // plain text there — one screen let you practise a weak
                    // concept and the other only told you it was weak.
                    return (
                      <ConceptRow
                        key={concept.id}
                        conceptId={concept.id}
                        name={tContent(concept, "name", locale)}
                        level={conceptLevel(masteryByConcept.get(concept.id))}
                        showNotStarted
                      />
                    );
                  })}
                </ul>
              </div>
            );
          })
        )}
      </section>

      {/* ── badges (D7b) — earned and unearned ───────────────────────────── */}
      <section aria-labelledby="badges-heading" className="flex flex-col gap-lg">
        <div className="flex items-baseline justify-between gap-md">
          <h2 id="badges-heading" className="text-h3 text-ink">
            {t("progress.milestonesTitle")}
          </h2>
          <span className="text-body-sm text-muted">
            {t("progress.badgeCount", { earned: badges, total: grid.length })}
          </span>
        </div>

        {badges === 0 && <p className="text-body-sm text-body">{t("progress.empty")}</p>}

        <BadgeLadders ladders={ladders} firsts={firsts} />
      </section>
    </main>
  );
}

/**
 * A level's badge tone.
 *
 * The `Badge` component's tones predate levels and are named for the mastery
 * bands (D5). Mapping here rather than renaming the tones keeps one vocabulary
 * for learners — four level words — without churning a primitive that quiz
 * results and practice feedback also use.
 *
 * `not_started` has no tone: it renders as `neutral`, and callers that want no
 * badge at all check the level itself first.
 */
/**
 * How many chapters the learner has finished every lesson of.
 *
 * The TypeScript mirror of the count in `award_milestones` (0027), and it must
 * agree with it — the badge is awarded there and the distance to the next rung
 * is computed here, so a disagreement would show "1 to go" beside a badge the
 * learner already has.
 *
 * A chapter with no lessons seeded is excluded. Without that guard an empty
 * chapter counts as finished by vacuous truth, and Class 8's placeholder
 * chapters would each have awarded a badge for nothing.
 */
function countFinishedChapters(
  lessons: readonly { id: string; chapter_id: string }[],
  completed: ReadonlySet<string>,
): number {
  const byChapter = new Map<string, string[]>();
  for (const lesson of lessons) {
    byChapter.set(lesson.chapter_id, [...(byChapter.get(lesson.chapter_id) ?? []), lesson.id]);
  }

  let finished = 0;
  for (const ids of byChapter.values()) {
    if (ids.length > 0 && ids.every((id) => completed.has(id))) finished++;
  }
  return finished;
}

function badgeToneFor(level: Level): MasteryBand {
  switch (level) {
    case "mastered":
      return "mastered";
    case "getting_there":
      return "developing";
    default:
      return "needs_revision";
  }
}
