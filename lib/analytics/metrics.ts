import { istDate } from "@/lib/learning/dates";
import type { EventName } from "@/lib/analytics/track";

/**
 * The metrics arithmetic — every counting rule in `docs/ANALYTICS.md` §5, in
 * one place, as pure functions.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NO DATABASE IN THIS FILE. It takes rows and returns numbers.
 *
 * That is the whole design. The counting rules here are the part most likely to
 * be quietly wrong — a raw `dashboard_viewed` count is roughly double the real
 * one, and nothing about a doubled number looks broken. Rules that live in a
 * query get verified by staring at SQL; rules that live in a pure function get
 * verified by a test with a row in it.
 *
 * `lib/analytics/dashboard.ts` does the reading. This does the thinking.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ── ON DOING THIS IN TYPESCRIPT RATHER THAN SQL ─────────────────────────────
 * At the scale Dagar is at — tens of learners, low thousands of events — pulling
 * the rows and folding them here is faster to write, far easier to test, and
 * costs one query instead of fifteen. It stops being the right call somewhere
 * around a hundred thousand events, and `dashboard.ts` says so at the fetch.
 */

/** One row of `public.events`, as it comes back. */
export type EventRow = {
  name: string;
  student_id: string | null;
  props: Record<string, unknown> | null;
  created_at: string;
};

/** The three fixed windows (ANALYTICS.md §12 item 2). */
export type MetricWindow = "all" | "week" | "today";

// ─────────────────────────────────────────────────────────────────────────────
// Windows
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The lower bound of a window, or null for "all time".
 *
 * "This week" is the last 7 days INCLUDING today, not a calendar week. A
 * Monday-to-Sunday week would show a near-empty box every Monday morning, which
 * is the moment somebody actually opens this page after a weekend.
 */
export function windowStart(window: MetricWindow, now: Date = new Date()): Date | null {
  if (window === "all") return null;
  if (window === "today") return new Date(`${istDate(now)}T00:00:00+05:30`);
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 6);
  return new Date(`${istDate(start)}T00:00:00+05:30`);
}

export function since(rows: EventRow[], from: Date | null): EventRow[] {
  if (!from) return rows;
  const bound = from.getTime();
  return rows.filter((row) => new Date(row.created_at).getTime() >= bound);
}

// ─────────────────────────────────────────────────────────────────────────────
// The counting rules — ANALYTICS.md §5
// ─────────────────────────────────────────────────────────────────────────────

export function rowsNamed(rows: EventRow[], name: EventName): EventRow[] {
  return rows.filter((row) => row.name === name);
}

/** Raw row count. Use for VOLUME — how much happened. */
export function volume(rows: EventRow[], name: EventName): number {
  return rowsNamed(rows, name).length;
}

/**
 * Distinct learners who did this at least once. Use for REACH — how many people.
 *
 * Null `student_id` rows are excluded rather than counted as one anonymous
 * person: they are the pre-account events, which have no person attached by
 * design (§4).
 */
export function learners(rows: EventRow[], name: EventName): Set<string> {
  const out = new Set<string>();
  for (const row of rowsNamed(rows, name)) {
    if (row.student_id) out.add(row.student_id);
  }
  return out;
}

/**
 * Collapse `dashboard_viewed` to one row per learner per minute.
 *
 * **This is not a nicety — the raw count is roughly double.** Two rows 354ms
 * apart were observed immediately after login: the auth redirect and the page
 * render both land, and a Next prefetch of `/learn` from another screen does
 * the same. Both inflate the denominator of Recommendation Acceptance, so the
 * uncorrected rate reads LOW.
 *
 * A minute is the bucket because it is comfortably longer than any redirect
 * chain and comfortably shorter than a learner genuinely returning to their
 * dashboard between two pieces of work.
 */
export function dedupePerLearnerMinute(rows: EventRow[]): EventRow[] {
  const seen = new Set<string>();
  const out: EventRow[] = [];
  for (const row of rows) {
    // Truncate the ISO timestamp to the minute: "2026-08-04T14:23".
    const minute = row.created_at.slice(0, 16);
    const key = `${row.student_id ?? "anon"}|${minute}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

/** Deduped dashboard views — the honest Recommendation Acceptance denominator. */
export function dashboardViews(rows: EventRow[]): number {
  return dedupePerLearnerMinute(rowsNamed(rows, "dashboard_viewed")).length;
}

/** Distinct values of a string prop. `quiz_started` counts sessions, not rows. */
export function distinctProp(rows: EventRow[], name: EventName, key: string): Set<string> {
  const out = new Set<string>();
  for (const row of rowsNamed(rows, name)) {
    const value = row.props?.[key];
    if (typeof value === "string" && value.length > 0) out.add(value);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Days and returning
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Every IST date on which each learner did anything at all.
 *
 * IST, never UTC (D7). A learner active at 11:50pm and again at 12:10am has
 * been active on two days, and a UTC boundary would silently merge them —
 * understating the one metric the whole product is judged on.
 */
export function activeDaysByLearner(rows: EventRow[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!row.student_id) continue;
    const day = istDate(new Date(row.created_at));
    const days = out.get(row.student_id) ?? new Set<string>();
    days.add(day);
    out.set(row.student_id, days);
  }
  return out;
}

/** Learners active on at least `n` distinct IST days. */
export function learnersActiveOnDays(rows: EventRow[], n: number): Set<string> {
  const out = new Set<string>();
  for (const [student, days] of activeDaysByLearner(rows)) {
    if (days.size >= n) out.add(student);
  }
  return out;
}

/** Active learners per IST day, oldest first — the one chart above the fold. */
export function dailyActive(
  rows: EventRow[],
  days = 14,
  now: Date = new Date(),
): { date: string; learners: number }[] {
  const byDay = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!row.student_id) continue;
    const day = istDate(new Date(row.created_at));
    const set = byDay.get(day) ?? new Set<string>();
    set.add(row.student_id);
    byDay.set(day, set);
  }

  // Every day in the range appears, including the empty ones. A chart that
  // silently drops quiet days draws a flat line over a gap, which is the
  // opposite of what a quiet day means.
  const out: { date: string; learners: number }[] = [];
  for (let back = days - 1; back >= 0; back--) {
    const at = new Date(now);
    at.setUTCDate(at.getUTCDate() - back);
    const day = istDate(at);
    out.push({ date: day, learners: byDay.get(day)?.size ?? 0 });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cohorts — the honest way to window a funnel
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The learners who REGISTERED inside the window.
 *
 * ── WHY A COHORT AND NOT A DATE FILTER ──────────────────────────────────────
 * The obvious implementation of "this week" is to filter every event by date
 * and count what is left. It produces nonsense on a funnel: a learner who
 * registered last week and finished a lesson today lands in the numerator and
 * not the denominator, so completion can exceed 100%.
 *
 * So the window picks a COHORT — who joined in it — and every stage then asks
 * whether those people ever reached it. That is the standard funnel and it
 * cannot exceed 100%. For "all time" the cohort is everybody, and this is a
 * no-op.
 */
export function cohort(rows: EventRow[], from: Date | null): Set<string> {
  return learners(since(rows, from), "learner_registered");
}

/** Keep only events belonging to the cohort. Anonymous rows never survive. */
export function forCohort(rows: EventRow[], members: Set<string>): EventRow[] {
  return rows.filter((row) => row.student_id !== null && members.has(row.student_id));
}

// ─────────────────────────────────────────────────────────────────────────────
// The funnel — ANALYTICS.md §7A
// ─────────────────────────────────────────────────────────────────────────────

export type FunnelStage = {
  key: string;
  /** People, or screen opens? The boundary is drawn on the chart. */
  unit: "people" | "visits";
  count: number;
  /** Share of the stage above. Null on the first stage and across the boundary. */
  ofPrevious: number | null;
};

/**
 * The seven stages, top to bottom.
 *
 * The first two are VISITS and the rest are PEOPLE, and they are not divisible
 * into one another — see §4. `ofPrevious` is deliberately null on the first
 * people stage so no headline percentage is ever computed across that boundary.
 *
 * `windowed` supplies the anonymous stages (they have no cohort to belong to);
 * `cohortRows` supplies the rest.
 */
export function funnel(windowed: EventRow[], cohortRows: EventRow[]): FunnelStage[] {
  const visits = [
    { key: "opened_app", count: volume(windowed, "welcome_viewed") },
    { key: "reached_signin", count: volume(windowed, "login_viewed") },
  ];

  /**
   * ── EACH STAGE INCLUDES EVERYONE BELOW IT ─────────────────────────────────
   * A learner who picked a class necessarily reached the grade picker; one who
   * finished a lesson necessarily opened it. So each stage counts its own
   * learners UNION everyone at a later stage.
   *
   * This is inference, not invention, and it fixes a real hole. The first run
   * of this funnel against live data showed "Got an account: 0 → Picked a
   * class: 3", because `onboarding_started` only began existing on 4 Aug 2026
   * and everyone who registered before that has no row for it. Reading the
   * events literally would print a funnel that grows downward — which looks
   * like a bug in the product rather than a gap in the history.
   *
   * It also makes the funnel monotonic by construction, so any future event
   * that ships late, fails, or gets dropped degrades into "same as the stage
   * below" rather than into a number that cannot be true.
   *
   * The cost: a stage can be inferred rather than observed, so it is a CEILING
   * on the drop-off above it, never a floor. Where the two differ the funnel is
   * generous to the earlier stage — which is the safe direction, because it
   * makes the drop-off we report smaller than the real one rather than larger.
   */
  const stageEvents: [string, EventName][] = [
    ["got_account", "onboarding_started"],
    ["picked_class", "learner_registered"],
    ["opened_lesson", "lesson_started"],
    ["finished_lesson", "lesson_completed"],
    ["finished_chapter", "chapter_completed"],
  ];

  const reached = stageEvents.map(([, event]) => learners(cohortRows, event));
  for (let i = reached.length - 2; i >= 0; i--) {
    for (const student of reached[i + 1]) reached[i].add(student);
  }

  const people = stageEvents.map(([key], i) => ({ key, count: reached[i].size }));

  const stages: FunnelStage[] = [];

  visits.forEach((stage, i) => {
    stages.push({
      ...stage,
      unit: "visits",
      ofPrevious: i === 0 ? null : share(stage.count, visits[i - 1].count),
    });
  });

  people.forEach((stage, i) => {
    stages.push({
      ...stage,
      unit: "people",
      // Null on the first people stage: dividing it by a visit count would be
      // dividing people by page loads.
      ofPrevious: i === 0 ? null : share(stage.count, people[i - 1].count),
    });
  });

  return stages;
}

/**
 * `numerator / denominator`, or null when the denominator is zero.
 *
 * Null rather than 0. An empty cohort has no rate — printing "0%" for it says
 * something false about a product nobody has used yet, and on a page that gets
 * read the week of launch that distinction matters.
 */
export function share(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return numerator / denominator;
}

// ─────────────────────────────────────────────────────────────────────────────
// The CEO view — ANALYTICS.md §6
// ─────────────────────────────────────────────────────────────────────────────

export type Headline = {
  learners: number;
  activated: number;
  activatedShare: number | null;
  returning: number;
  returningShare: number | null;
  lessonsFinished: number;
  chaptersFinished: number;
  chaptersFinishedBy: number;
  mentorAsked: number;
  mentorOffered: number;
  mentorShare: number | null;
};

export function headline(cohortRows: EventRow[], members: Set<string>): Headline {
  const activated = learners(cohortRows, "lesson_completed").size;
  const returning = learnersActiveOnDays(cohortRows, 2).size;
  const mentorAsked = volume(cohortRows, "mentor_request_submitted");
  const mentorOffered = volume(cohortRows, "mentor_cta_shown");

  return {
    learners: members.size,
    activated,
    activatedShare: share(activated, members.size),
    returning,
    returningShare: share(returning, members.size),
    lessonsFinished: volume(cohortRows, "lesson_completed"),
    chaptersFinished: volume(cohortRows, "chapter_completed"),
    chaptersFinishedBy: learners(cohortRows, "chapter_completed").size,
    mentorAsked,
    mentorOffered,
    mentorShare: share(mentorAsked, mentorOffered),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Against the PRD targets — ANALYTICS.md §6
// ─────────────────────────────────────────────────────────────────────────────

export type TargetRow = { key: string; value: number | null; target: number };

/** PRD §12. `value` is a share in 0..1, or null when nothing can be divided. */
export function againstTargets(cohortRows: EventRow[], members: Set<string>): TargetRow[] {
  const activeLearners = new Set<string>();
  for (const row of cohortRows) if (row.student_id) activeLearners.add(row.student_id);

  return [
    {
      key: "first_lesson",
      value: share(learners(cohortRows, "lesson_completed").size, members.size),
      target: 0.6,
    },
    {
      key: "lesson_completion",
      value: share(volume(cohortRows, "lesson_completed"), volume(cohortRows, "lesson_started")),
      target: 0.5,
    },
    {
      key: "tutor_adoption",
      value: share(learners(cohortRows, "ai_question_asked").size, activeLearners.size),
      target: 0.5,
    },
    {
      key: "practice_completion",
      value: share(volume(cohortRows, "practice_completed"), volume(cohortRows, "practice_started")),
      target: 0.6,
    },
    {
      // The deduped denominator. Quoting the raw one understates it — see §5.
      key: "recommendation_acceptance",
      value: share(volume(cohortRows, "recommendation_clicked"), dashboardViews(cohortRows)),
      target: 0.3,
    },
    { key: "day7_retention", value: day7Retention(cohortRows, members), target: 0.25 },
    {
      key: "parent_summary_open",
      value: share(
        volume(cohortRows, "parent_summary_viewed"),
        volume(cohortRows, "parent_summary_sent"),
      ),
      target: 0.4,
    },
  ];
}

/**
 * Share of the cohort active on a day at least 7 days after they registered.
 *
 * Only counts learners who have HAD seven days — someone who registered
 * yesterday cannot have retained for a week, and including them in the
 * denominator would drag the number down purely because the product is new.
 * That is the difference between a retention rate and an age-of-cohort rate.
 */
export function day7Retention(
  rows: EventRow[],
  members: Set<string>,
  now: Date = new Date(),
): number | null {
  return retentionAtDay(rows, members, 7, now);
}

export function retentionAtDay(
  rows: EventRow[],
  members: Set<string>,
  day: number,
  now: Date = new Date(),
): number | null {
  const registeredAt = new Map<string, number>();
  for (const row of rowsNamed(rows, "learner_registered")) {
    if (!row.student_id || !members.has(row.student_id)) continue;
    const at = new Date(row.created_at).getTime();
    const seen = registeredAt.get(row.student_id);
    if (seen === undefined || at < seen) registeredAt.set(row.student_id, at);
  }

  const MS_PER_DAY = 86_400_000;
  const eligible = new Set<string>();
  for (const [student, at] of registeredAt) {
    if (now.getTime() - at >= day * MS_PER_DAY) eligible.add(student);
  }
  if (eligible.size === 0) return null;

  const retained = new Set<string>();
  for (const row of rows) {
    if (!row.student_id || !eligible.has(row.student_id)) continue;
    const at = new Date(row.created_at).getTime();
    if (at - registeredAt.get(row.student_id)! >= day * MS_PER_DAY) {
      retained.add(row.student_id);
    }
  }
  return share(retained.size, eligible.size);
}

// ─────────────────────────────────────────────────────────────────────────────
// Splits — ANALYTICS.md §7B and §7F
// ─────────────────────────────────────────────────────────────────────────────

/** How each learner signed up, from `learner_registered` props. */
export function registrationSplit(
  rows: EventRow[],
  key: "grade" | "locale",
): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const row of rowsNamed(rows, "learner_registered")) {
    if (!row.student_id) continue;
    const raw = row.props?.[key];
    const value = raw === null || raw === undefined ? "unknown" : String(raw);
    const set = out.get(value) ?? new Set<string>();
    set.add(row.student_id);
    out.set(value, set);
  }
  return out;
}

/**
 * The funnel again, split by the language each learner registered in.
 *
 * The direct test of D16, and the single most important thing this dashboard
 * can find: a Hindi learner dropping out one stage earlier than an English one
 * is invisible in every aggregate number on the page.
 *
 * The anonymous stages are dropped from the split — they have no learner, so
 * they cannot be attributed to a language.
 */
export function funnelByLocale(
  cohortRows: EventRow[],
  members: Set<string>,
): Map<string, FunnelStage[]> {
  const byLocale = registrationSplit(cohortRows, "locale");
  const out = new Map<string, FunnelStage[]>();

  for (const [locale, group] of byLocale) {
    const scoped = new Set([...group].filter((id) => members.has(id)));
    out.set(locale, funnel([], forCohort(cohortRows, scoped)).filter((s) => s.unit === "people"));
  }
  return out;
}

/** Learners who changed their language after signing up, and which way. */
export function localeSwitches(rows: EventRow[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const row of rowsNamed(rows, "settings_changed")) {
    if (!row.student_id) continue;
    const locale = row.props?.locale;
    if (typeof locale !== "string") continue; // a grade change, not a language one
    const set = out.get(locale) ?? new Set<string>();
    set.add(row.student_id);
    out.set(locale, set);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Content — ANALYTICS.md §7C
// ─────────────────────────────────────────────────────────────────────────────

export type LessonTally = {
  lessonId: string;
  title: string;
  order: number;
  completed: number;
};

/**
 * Where a chapter loses people: the lesson after which the most learners stop.
 *
 * Returns the lesson at the TOP of the steepest fall between two consecutive
 * lessons — "everyone gets through lesson 3 and then stops" points at lesson 3,
 * because that is the one to go and read.
 *
 * Ties go to the earlier lesson: the first place a chapter loses people is the
 * one worth fixing, and fixing it changes everything downstream anyway.
 *
 * A fall that is not a fall (the next lesson has as many or more completions)
 * is never reported, so a healthy chapter returns null rather than naming its
 * least-bad step as a problem.
 */
export function steepestDrop(lessons: LessonTally[]): { lesson: LessonTally; drop: number } | null {
  const ordered = [...lessons].sort((a, b) => a.order - b.order);
  let worst: { lesson: LessonTally; drop: number } | null = null;

  for (let i = 0; i < ordered.length - 1; i++) {
    const drop = ordered[i].completed - ordered[i + 1].completed;
    if (drop <= 0) continue;
    if (!worst || drop > worst.drop) worst = { lesson: ordered[i], drop };
  }
  return worst;
}

// ─────────────────────────────────────────────────────────────────────────────
// Signals — ANALYTICS.md §7H
// ─────────────────────────────────────────────────────────────────────────────

export type TwoStage = { shown: number; acted: number; rate: number | null };

export function conversion(
  rows: EventRow[],
  shownEvent: EventName,
  actedEvent: EventName,
): TwoStage {
  const shown = volume(rows, shownEvent);
  const acted = volume(rows, actedEvent);
  return { shown, acted, rate: share(acted, shown) };
}

/** Mentor requests broken down by which of the three D6 rules fired. */
export function byProp(rows: EventRow[], name: EventName, key: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const row of rowsNamed(rows, name)) {
    const raw = row.props?.[key];
    const value = raw === null || raw === undefined ? "unknown" : String(raw);
    out.set(value, (out.get(value) ?? 0) + 1);
  }
  return out;
}
