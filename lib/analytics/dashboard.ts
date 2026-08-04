import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  againstTargets,
  byProp,
  cohort,
  conversion,
  dailyActive,
  forCohort,
  funnel,
  funnelByLocale,
  headline,
  learners,
  localeSwitches,
  registrationSplit,
  since,
  steepestDrop,
  volume,
  windowStart,
  type EventRow,
  type LessonTally,
  type MetricWindow,
} from "@/lib/analytics/metrics";

/**
 * The reader. Fetches, hands everything to `metrics.ts`, returns one object.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SERVICE ROLE, AND WHY THAT IS CORRECT HERE.
 *
 * `events` is insert-only for learners and has no read policy at all — nobody
 * reads it through the browser client, ever. So the aggregation runs with the
 * service role on the server, which is the fourth legitimate use of that client
 * alongside grading, the derived-state functions and the weekly cron.
 *
 * The output is COUNTS. No `student_id` leaves this module, no display name is
 * read, no email is read. That is not incidental — it is the property that lets
 * `/admin/metrics` be honest when it says it cannot see an individual learner
 * (ANALYTICS.md §9). If a future section needs a learner id to compute
 * something, it computes it in here and returns a number.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ── SCALE ───────────────────────────────────────────────────────────────────
 * This pulls every event row and folds it in TypeScript. At Dagar's size — tens
 * of learners, low thousands of rows — that is one query instead of fifteen and
 * every counting rule stays unit-testable. It stops being the right call
 * somewhere around a hundred thousand events, at which point the folds in
 * `metrics.ts` become SQL and the tests come with them.
 */

const EVENT_FETCH_LIMIT = 100_000;

export type ChapterProgress = {
  chapterId: string;
  title: string;
  grade: number;
  /** Learners who opened at least one lesson in this chapter. */
  reached: number;
  lessonsCompleted: number;
  chaptersCompleted: number;
  lessons: LessonTally[];
  dropOff: { title: string; drop: number } | null;
};

export type Metrics = Awaited<ReturnType<typeof loadMetrics>>;

export async function loadMetrics(window: MetricWindow = "all", now: Date = new Date()) {
  const admin = createAdminClient();
  const from = windowStart(window, now);

  const [eventsResult, chapters, lessons, progress, exits, feedback] = await Promise.all([
    admin
      .from("events")
      .select("name, student_id, props, created_at")
      .order("created_at", { ascending: true })
      .limit(EVENT_FETCH_LIMIT),
    admin.from("chapters").select("id, title, grade").order("grade"),
    admin.from("lessons").select("id, chapter_id, title, order_index"),
    admin.from("lesson_progress").select("student_id, lesson_id, status"),
    admin.from("exit_reasons").select("reason, locale"),
    admin.from("product_feedback").select("respondent_role, understood, would_return"),
  ]);

  if (eventsResult.error) {
    // Loud. An empty dashboard that looks like "nobody used it" is the worst
    // possible failure mode for this page — it is a number somebody might act
    // on. Better to show nothing and say why.
    throw new Error(`Could not read events: ${eventsResult.error.message}`);
  }

  const all = (eventsResult.data ?? []) as EventRow[];
  const truncated = all.length >= EVENT_FETCH_LIMIT;

  // The window picks a COHORT — who joined in it — and every rate then asks
  // whether those people ever reached each stage. Filtering events by date
  // instead lets completion exceed 100%; see `cohort()`.
  const members = cohort(all, from);
  const cohortRows = forCohort(all, members);
  const windowed = since(all, from);

  return {
    window,
    generatedAt: now.toISOString(),
    truncated,

    // ── §6 the CEO view ─────────────────────────────────────────────────────
    headline: headline(cohortRows, members),
    targets: againstTargets(cohortRows, members),
    daily: dailyActive(cohortRows, 14, now),

    // ── §7A the funnel ──────────────────────────────────────────────────────
    funnel: funnel(windowed, cohortRows),

    // ── §7B onboarding ──────────────────────────────────────────────────────
    byGrade: countsOf(registrationSplit(cohortRows, "grade")),
    byLocale: countsOf(registrationSplit(cohortRows, "locale")),

    // ── §7C content ─────────────────────────────────────────────────────────
    chapters: buildChapterProgress(
      chapters.data ?? [],
      lessons.data ?? [],
      progress.data ?? [],
      cohortRows,
      members,
    ),

    // ── §7E retention ───────────────────────────────────────────────────────
    activeDays: activeDayHistogram(cohortRows),

    // ── §7F language ────────────────────────────────────────────────────────
    localeFunnel: Object.fromEntries(funnelByLocale(cohortRows, members)),
    localeSwitchedTo: countsOf(localeSwitches(cohortRows)),

    // ── §7H demand and feedback ─────────────────────────────────────────────
    mentor: {
      ...conversion(cohortRows, "mentor_cta_shown", "mentor_request_submitted"),
      byTrigger: Object.fromEntries(byProp(cohortRows, "mentor_request_submitted", "trigger")),
    },
    feedback: {
      ...conversion(cohortRows, "feedback_shown", "feedback_submitted"),
      understood: tally(feedback.data ?? [], "understood"),
      wouldReturn: tally(feedback.data ?? [], "would_return"),
      byRole: tally(feedback.data ?? [], "respondent_role"),
    },
    // No learner column exists on this table at all (migration 0023), so this
    // section is aggregate by construction rather than by our restraint.
    exitReasons: tally(exits.data ?? [], "reason"),

    // ── the parent loop, §7G ────────────────────────────────────────────────
    parents: {
      invited: learners(cohortRows, "parent_invite_created").size,
      linked: volume(cohortRows, "parent_linked"),
      summariesSent: volume(cohortRows, "parent_summary_sent"),
      summariesViewed: volume(cohortRows, "parent_summary_viewed"),
    },
  };
}

/** Map<key, Set<learner>> → Record<key, count>. Ids never leave this module. */
function countsOf(input: Map<string, Set<string>>): Record<string, number> {
  return Object.fromEntries([...input].map(([key, set]) => [key, set.size]));
}

function tally<T extends Record<string, unknown>>(rows: T[], key: keyof T): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const value = row[key] === null || row[key] === undefined ? "unknown" : String(row[key]);
    out[value] = (out[value] ?? 0) + 1;
  }
  return out;
}

/** How many learners were active on 1 day, 2 days, 3+ — never an average. */
function activeDayHistogram(rows: EventRow[]): Record<string, number> {
  const days = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!row.student_id) continue;
    const set = days.get(row.student_id) ?? new Set<string>();
    set.add(row.created_at.slice(0, 10));
    days.set(row.student_id, set);
  }

  // Buckets, not a mean. Six learners on day one and one on day fourteen is a
  // different product from a flat two, and an average cannot tell them apart.
  const out: Record<string, number> = { "1": 0, "2": 0, "3-4": 0, "5+": 0 };
  for (const set of days.values()) {
    const n = set.size;
    if (n <= 1) out["1"]++;
    else if (n === 2) out["2"]++;
    else if (n <= 4) out["3-4"]++;
    else out["5+"]++;
  }
  return out;
}

function buildChapterProgress(
  chapters: { id: string; title: string; grade: number }[],
  lessons: { id: string; chapter_id: string; title: string; order_index: number }[],
  progress: { student_id: string; lesson_id: string; status: string }[],
  cohortRows: EventRow[],
  members: Set<string>,
): ChapterProgress[] {
  // Only the cohort's progress rows count, or a windowed view would mix in
  // learners who are not in its funnel.
  const mine = progress.filter((row) => members.has(row.student_id));

  const chapterCompletions = new Map<string, number>();
  for (const row of cohortRows) {
    if (row.name !== "chapter_completed") continue;
    const id = row.props?.chapter_id;
    if (typeof id !== "string") continue;
    chapterCompletions.set(id, (chapterCompletions.get(id) ?? 0) + 1);
  }

  return chapters.map((chapter) => {
    const own = lessons
      .filter((lesson) => lesson.chapter_id === chapter.id)
      .sort((a, b) => a.order_index - b.order_index);
    const ids = new Set(own.map((lesson) => lesson.id));

    const reached = new Set<string>();
    const completedByLesson = new Map<string, Set<string>>();
    for (const row of mine) {
      if (!ids.has(row.lesson_id)) continue;
      reached.add(row.student_id);
      if (row.status !== "completed") continue;
      const set = completedByLesson.get(row.lesson_id) ?? new Set<string>();
      set.add(row.student_id);
      completedByLesson.set(row.lesson_id, set);
    }

    const tallies: LessonTally[] = own.map((lesson) => ({
      lessonId: lesson.id,
      title: lesson.title,
      order: lesson.order_index,
      completed: completedByLesson.get(lesson.id)?.size ?? 0,
    }));

    const drop = steepestDrop(tallies);

    return {
      chapterId: chapter.id,
      title: chapter.title,
      grade: chapter.grade,
      reached: reached.size,
      lessonsCompleted: tallies.reduce((sum, lesson) => sum + lesson.completed, 0),
      chaptersCompleted: chapterCompletions.get(chapter.id) ?? 0,
      lessons: tallies,
      dropOff: drop ? { title: drop.lesson.title, drop: drop.drop } : null,
    };
  });
}
