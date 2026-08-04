import { describe, expect, it } from "vitest";
import {
  activeDaysByLearner,
  againstTargets,
  byProp,
  cohort,
  conversion,
  dailyActive,
  dashboardViews,
  dedupePerLearnerMinute,
  forCohort,
  funnel,
  funnelByLocale,
  headline,
  learners,
  learnersActiveOnDays,
  localeSwitches,
  registrationSplit,
  retentionAtDay,
  share,
  since,
  steepestDrop,
  volume,
  windowStart,
  type EventRow,
} from "@/lib/analytics/metrics";

/**
 * The counting rules.
 *
 * This is the file that stops the dashboard lying. A miscounted metric does not
 * throw and does not look broken — it produces a plausible number that somebody
 * puts in a deck. Every rule in ANALYTICS.md §5 has a case here, and the cases
 * that matter most are the ones where the naive count is wrong.
 */

/** IST is UTC+5:30, so 18:30Z is midnight IST — the day boundary. */
function ev(
  name: string,
  student: string | null,
  createdAt: string,
  props: Record<string, unknown> = {},
): EventRow {
  return { name, student_id: student, props, created_at: createdAt };
}

describe("share", () => {
  it("divides", () => {
    expect(share(3, 4)).toBe(0.75);
  });

  it("returns null rather than zero when there is nothing to divide", () => {
    // "0%" for an empty cohort says something false about a product nobody has
    // used yet, and this page gets read the week of launch.
    expect(share(0, 0)).toBeNull();
    expect(share(5, 0)).toBeNull();
  });
});

describe("dedupePerLearnerMinute — the rule that halves dashboard_viewed", () => {
  it("collapses the auth-redirect double-fire", () => {
    // The observed case: two rows 354ms apart, the redirect and the render.
    const rows = [
      ev("dashboard_viewed", "a", "2026-08-04T10:00:00.100Z"),
      ev("dashboard_viewed", "a", "2026-08-04T10:00:00.454Z"),
    ];
    expect(dashboardViews(rows)).toBe(1);
  });

  it("keeps two genuine visits a minute apart", () => {
    const rows = [
      ev("dashboard_viewed", "a", "2026-08-04T10:00:10.000Z"),
      ev("dashboard_viewed", "a", "2026-08-04T10:01:10.000Z"),
    ];
    expect(dashboardViews(rows)).toBe(2);
  });

  it("never merges two different learners in the same minute", () => {
    const rows = [
      ev("dashboard_viewed", "a", "2026-08-04T10:00:10.000Z"),
      ev("dashboard_viewed", "b", "2026-08-04T10:00:11.000Z"),
    ];
    expect(dashboardViews(rows)).toBe(2);
  });

  it("leaves other events alone", () => {
    const rows = [
      ev("lesson_completed", "a", "2026-08-04T10:00:00.100Z"),
      ev("lesson_completed", "a", "2026-08-04T10:00:00.400Z"),
    ];
    expect(dedupePerLearnerMinute(rows)).toHaveLength(1); // the helper dedupes
    expect(volume(rows, "lesson_completed")).toBe(2); // but volume() does not
  });
});

describe("volume vs learners — how much, versus how many people", () => {
  const rows = [
    ev("lesson_completed", "a", "2026-08-04T10:00:00Z"),
    ev("lesson_completed", "a", "2026-08-04T11:00:00Z"),
    ev("lesson_completed", "b", "2026-08-04T12:00:00Z"),
  ];

  it("counts rows for volume", () => {
    expect(volume(rows, "lesson_completed")).toBe(3);
  });

  it("counts people for reach", () => {
    expect(learners(rows, "lesson_completed").size).toBe(2);
  });

  it("excludes anonymous rows from reach", () => {
    // They have no person attached, by design. Counting them as one shared
    // anonymous learner would be inventing a person.
    const anon = [...rows, ev("welcome_viewed", null, "2026-08-04T13:00:00Z")];
    expect(learners(anon, "welcome_viewed").size).toBe(0);
    expect(volume(anon, "welcome_viewed")).toBe(1);
  });
});

describe("activeDays — IST, never UTC", () => {
  it("splits a learner across the IST midnight boundary", () => {
    // 18:20Z is 23:50 IST on the 4th; 18:40Z is 00:10 IST on the 5th. A UTC
    // boundary would merge these and understate returning learners.
    const rows = [
      ev("lesson_completed", "a", "2026-08-04T18:20:00Z"),
      ev("lesson_completed", "a", "2026-08-04T18:40:00Z"),
    ];
    expect(activeDaysByLearner(rows).get("a")?.size).toBe(2);
    expect(learnersActiveOnDays(rows, 2).size).toBe(1);
  });

  it("does not split a learner within one IST day", () => {
    const rows = [
      ev("lesson_completed", "a", "2026-08-04T04:00:00Z"),
      ev("lesson_completed", "a", "2026-08-04T17:00:00Z"),
    ];
    expect(activeDaysByLearner(rows).get("a")?.size).toBe(1);
    expect(learnersActiveOnDays(rows, 2).size).toBe(0);
  });
});

describe("dailyActive", () => {
  const now = new Date("2026-08-04T12:00:00Z");

  it("returns one entry per day including empty ones", () => {
    const series = dailyActive([], 14, now);
    expect(series).toHaveLength(14);
    expect(series.every((d) => d.learners === 0)).toBe(true);
  });

  it("is oldest first and ends on today", () => {
    const series = dailyActive([], 3, now);
    expect(series.map((d) => d.date)).toEqual(["2026-08-02", "2026-08-03", "2026-08-04"]);
  });

  it("counts distinct learners, not events", () => {
    const rows = [
      ev("lesson_completed", "a", "2026-08-04T06:00:00Z"),
      ev("lesson_completed", "a", "2026-08-04T07:00:00Z"),
      ev("lesson_completed", "b", "2026-08-04T08:00:00Z"),
    ];
    expect(dailyActive(rows, 1, now)[0].learners).toBe(2);
  });
});

describe("cohorts — why the window is not a date filter", () => {
  const now = new Date("2026-08-10T12:00:00Z");
  const rows = [
    ev("learner_registered", "old", "2026-08-01T06:00:00Z", { locale: "en", grade: 6 }),
    ev("learner_registered", "new", "2026-08-09T06:00:00Z", { locale: "hi", grade: 7 }),
    ev("lesson_completed", "old", "2026-08-10T06:00:00Z"),
    ev("lesson_completed", "new", "2026-08-10T07:00:00Z"),
  ];

  it("all time includes everybody", () => {
    expect(cohort(rows, null).size).toBe(2);
  });

  it("a week picks only those who joined in it", () => {
    const week = cohort(rows, windowStart("week", now));
    expect([...week]).toEqual(["new"]);
  });

  it("keeps completion at or below 100% for a windowed view", () => {
    // THE bug this design prevents. A plain date filter on "this week" would
    // count both completions but only one registration — 2/1 = 200%.
    const week = cohort(rows, windowStart("week", now));
    const scoped = forCohort(rows, week);
    expect(volume(scoped, "lesson_completed")).toBe(1);
    expect(share(learners(scoped, "lesson_completed").size, week.size)).toBe(1);
  });

  it("drops anonymous rows from a cohort", () => {
    const withAnon = [...rows, ev("welcome_viewed", null, "2026-08-10T06:00:00Z")];
    const scoped = forCohort(withAnon, cohort(withAnon, null));
    expect(volume(scoped, "welcome_viewed")).toBe(0);
  });
});

describe("windowStart", () => {
  const now = new Date("2026-08-04T12:00:00Z");

  it("is null for all time", () => {
    expect(windowStart("all", now)).toBeNull();
  });

  it("starts today at IST midnight, not UTC midnight", () => {
    expect(windowStart("today", now)?.toISOString()).toBe("2026-08-03T18:30:00.000Z");
  });

  it("covers seven days including today", () => {
    expect(windowStart("week", now)?.toISOString()).toBe("2026-07-28T18:30:00.000Z");
  });

  it("filters on the boundary inclusively", () => {
    const start = windowStart("today", now)!;
    const rows = [
      ev("lesson_completed", "a", start.toISOString()),
      ev("lesson_completed", "b", new Date(start.getTime() - 1).toISOString()),
    ];
    expect(since(rows, start)).toHaveLength(1);
  });
});

describe("the funnel", () => {
  const rows = [
    ev("welcome_viewed", null, "2026-08-04T06:00:00Z"),
    ev("welcome_viewed", null, "2026-08-04T06:01:00Z"),
    ev("login_viewed", null, "2026-08-04T06:02:00Z"),
    ev("onboarding_started", "a", "2026-08-04T06:03:00Z"),
    ev("onboarding_started", "a", "2026-08-04T06:04:00Z"), // reload
    ev("learner_registered", "a", "2026-08-04T06:05:00Z", { locale: "en", grade: 6 }),
    ev("lesson_started", "a", "2026-08-04T06:06:00Z"),
    ev("lesson_completed", "a", "2026-08-04T06:07:00Z"),
  ];
  const members = cohort(rows, null);
  const stages = funnel(rows, forCohort(rows, members));

  it("has seven stages", () => {
    expect(stages).toHaveLength(7);
  });

  it("counts a reloaded grade picker as one person", () => {
    expect(stages.find((s) => s.key === "got_account")?.count).toBe(1);
  });

  it("marks the first two stages as visits and the rest as people", () => {
    expect(stages.slice(0, 2).every((s) => s.unit === "visits")).toBe(true);
    expect(stages.slice(2).every((s) => s.unit === "people")).toBe(true);
  });

  it("never computes a percentage across the visits/people boundary", () => {
    // Dividing people by page loads is not a conversion rate, and printing one
    // would put a fake number at the top of the funnel.
    expect(stages.find((s) => s.key === "got_account")?.ofPrevious).toBeNull();
  });

  it("computes each people stage as a share of the one above", () => {
    expect(stages.find((s) => s.key === "picked_class")?.ofPrevious).toBe(1);
    expect(stages.find((s) => s.key === "finished_chapter")?.ofPrevious).toBe(0);
  });

  it("survives an empty database without dividing by zero", () => {
    for (const stage of funnel([], [])) {
      expect(stage.count).toBe(0);
      expect(stage.ofPrevious).toBeNull();
    }
  });

  it("infers an earlier stage from a later one when the event predates it", () => {
    // The live failure this was written for: `onboarding_started` shipped on
    // 4 Aug 2026, so a learner who registered in July has no row for it. Read
    // literally the funnel GROWS downward — 0 accounts, 1 class picked — which
    // reads as a broken product rather than a gap in the history.
    const legacy = [
      ev("learner_registered", "old", "2026-07-01T06:00:00Z", { locale: "en", grade: 6 }),
      ev("lesson_completed", "old", "2026-07-01T07:00:00Z"),
    ];
    const members = cohort(legacy, null);
    const stages = funnel([], forCohort(legacy, members));

    expect(stages.find((s) => s.key === "got_account")?.count).toBe(1);
    expect(stages.find((s) => s.key === "opened_lesson")?.count).toBe(1);
  });

  it("is monotonic within the people stages, always", () => {
    // The property that makes a late, failed or dropped event degrade into
    // "same as the stage below" rather than into a number that cannot be true.
    const messy = [
      ev("learner_registered", "a", "2026-08-01T06:00:00Z", { locale: "en", grade: 6 }),
      ev("learner_registered", "b", "2026-08-01T06:00:00Z", { locale: "en", grade: 6 }),
      ev("chapter_completed", "a", "2026-08-01T09:00:00Z", { chapter_id: "c1" }),
      ev("chapter_completed", "b", "2026-08-01T09:00:00Z", { chapter_id: "c1" }),
    ];
    const members = cohort(messy, null);
    const people = funnel([], forCohort(messy, members)).filter((s) => s.unit === "people");

    for (let i = 1; i < people.length; i++) {
      expect(people[i].count).toBeLessThanOrEqual(people[i - 1].count);
    }
    expect(people.every((s) => s.count === 2)).toBe(true);
  });
});

describe("headline", () => {
  const rows = [
    ev("learner_registered", "a", "2026-08-01T06:00:00Z", { locale: "en", grade: 6 }),
    ev("learner_registered", "b", "2026-08-01T06:00:00Z", { locale: "hi", grade: 7 }),
    ev("lesson_completed", "a", "2026-08-01T07:00:00Z"),
    ev("lesson_completed", "a", "2026-08-02T07:00:00Z"),
    ev("chapter_completed", "a", "2026-08-02T08:00:00Z", { chapter_id: "c1" }),
    ev("mentor_cta_shown", "b", "2026-08-01T09:00:00Z", { trigger: "three_consecutive_incorrect" }),
    ev("mentor_cta_shown", "b", "2026-08-01T09:30:00Z", { trigger: "hints_exhausted_twice" }),
    ev("mentor_request_submitted", "b", "2026-08-01T09:31:00Z", {
      trigger: "hints_exhausted_twice",
    }),
  ];
  const members = cohort(rows, null);
  const result = headline(forCohort(rows, members), members);

  it("counts learners as people who picked a class", () => {
    expect(result.learners).toBe(2);
  });

  it("separates lessons finished (volume) from activated (people)", () => {
    expect(result.lessonsFinished).toBe(2);
    expect(result.activated).toBe(1);
    expect(result.activatedShare).toBe(0.5);
  });

  it("counts returning as active on two or more IST days", () => {
    expect(result.returning).toBe(1);
  });

  it("reports mentor demand with its denominator", () => {
    expect(result.mentorAsked).toBe(1);
    expect(result.mentorOffered).toBe(2);
    expect(result.mentorShare).toBe(0.5);
  });
});

describe("retention", () => {
  const now = new Date("2026-08-20T12:00:00Z");

  it("excludes learners too new to have retained", () => {
    // Someone who registered yesterday cannot have retained for a week.
    // Counting them drags the rate down for being new, not for leaving.
    const rows = [ev("learner_registered", "fresh", "2026-08-19T06:00:00Z")];
    expect(retentionAtDay(rows, new Set(["fresh"]), 7, now)).toBeNull();
  });

  it("counts a learner who came back after the window", () => {
    const rows = [
      ev("learner_registered", "a", "2026-08-01T06:00:00Z"),
      ev("dashboard_viewed", "a", "2026-08-09T06:00:00Z"),
    ];
    expect(retentionAtDay(rows, new Set(["a"]), 7, now)).toBe(1);
  });

  it("does not count activity inside the window as retention", () => {
    const rows = [
      ev("learner_registered", "a", "2026-08-01T06:00:00Z"),
      ev("dashboard_viewed", "a", "2026-08-03T06:00:00Z"),
    ];
    expect(retentionAtDay(rows, new Set(["a"]), 7, now)).toBe(0);
  });
});

describe("splits", () => {
  const rows = [
    ev("learner_registered", "a", "2026-08-01T06:00:00Z", { locale: "en", grade: 6 }),
    ev("learner_registered", "b", "2026-08-01T06:00:00Z", { locale: "hi", grade: 6 }),
    ev("learner_registered", "c", "2026-08-01T06:00:00Z", { locale: "hi", grade: 7 }),
    ev("lesson_completed", "b", "2026-08-02T06:00:00Z"),
    ev("settings_changed", "a", "2026-08-03T06:00:00Z", { field: "locale", locale: "hi" }),
    ev("settings_changed", "c", "2026-08-03T06:00:00Z", { field: "grade", locale: null }),
  ];

  it("splits registrations by grade and locale", () => {
    expect(registrationSplit(rows, "grade").get("6")?.size).toBe(2);
    expect(registrationSplit(rows, "locale").get("hi")?.size).toBe(2);
  });

  it("splits the funnel by the language a learner registered in", () => {
    const members = cohort(rows, null);
    const split = funnelByLocale(forCohort(rows, members), members);
    expect(split.get("en")?.find((s) => s.key === "finished_lesson")?.count).toBe(0);
    expect(split.get("hi")?.find((s) => s.key === "finished_lesson")?.count).toBe(1);
  });

  it("drops the visit stages from a per-language funnel", () => {
    const members = cohort(rows, null);
    const split = funnelByLocale(forCohort(rows, members), members);
    expect(split.get("en")?.every((s) => s.unit === "people")).toBe(true);
  });

  it("counts only real language switches, not grade changes", () => {
    // A grade change also emits settings_changed, with a null locale.
    const switches = localeSwitches(rows);
    expect(switches.get("hi")?.size).toBe(1);
    expect([...switches.keys()]).toEqual(["hi"]);
  });
});

describe("conversions and breakdowns", () => {
  const rows = [
    ev("feedback_shown", "a", "2026-08-01T06:00:00Z"),
    ev("feedback_shown", "b", "2026-08-01T06:00:00Z"),
    ev("feedback_submitted", "a", "2026-08-01T07:00:00Z", { respondent_role: "student" }),
    ev("mentor_request_submitted", "a", "2026-08-01T08:00:00Z", { trigger: "hints_exhausted_twice" }),
    ev("mentor_request_submitted", "b", "2026-08-01T08:00:00Z", { trigger: "hints_exhausted_twice" }),
  ];

  it("pairs a numerator with its denominator", () => {
    expect(conversion(rows, "feedback_shown", "feedback_submitted")).toEqual({
      shown: 2,
      acted: 1,
      rate: 0.5,
    });
  });

  it("returns a null rate when nothing was shown", () => {
    expect(conversion([], "feedback_shown", "feedback_submitted").rate).toBeNull();
  });

  it("groups by a prop", () => {
    expect(byProp(rows, "mentor_request_submitted", "trigger")).toEqual(
      new Map([["hints_exhausted_twice", 2]]),
    );
  });

  it("buckets a missing prop as unknown rather than dropping the row", () => {
    const missing = [ev("mentor_request_submitted", "a", "2026-08-01T08:00:00Z")];
    expect(byProp(missing, "mentor_request_submitted", "trigger").get("unknown")).toBe(1);
  });
});

describe("steepestDrop — where a chapter loses people", () => {
  const lesson = (order: number, completed: number) => ({
    lessonId: `l${order}`,
    title: `Lesson ${order}`,
    order,
    completed,
  });

  it("names the lesson at the top of the steepest fall", () => {
    // Everyone gets through 3 and then stops — lesson 3 is the one to go read.
    const drop = steepestDrop([lesson(1, 10), lesson(2, 9), lesson(3, 9), lesson(4, 2)]);
    expect(drop?.lesson.title).toBe("Lesson 3");
    expect(drop?.drop).toBe(7);
  });

  it("returns null for a chapter that loses nobody", () => {
    // A healthy chapter must not have its least-bad step reported as a problem.
    expect(steepestDrop([lesson(1, 5), lesson(2, 5), lesson(3, 5)])).toBeNull();
  });

  it("ignores a rise", () => {
    expect(steepestDrop([lesson(1, 2), lesson(2, 5)])).toBeNull();
  });

  it("prefers the earlier lesson on a tie", () => {
    const drop = steepestDrop([lesson(1, 10), lesson(2, 5), lesson(3, 0)]);
    expect(drop?.lesson.title).toBe("Lesson 1");
  });

  it("sorts by order, not by array position", () => {
    const drop = steepestDrop([lesson(3, 1), lesson(1, 10), lesson(2, 9)]);
    expect(drop?.lesson.title).toBe("Lesson 2");
  });

  it("handles a chapter with one lesson or none", () => {
    expect(steepestDrop([])).toBeNull();
    expect(steepestDrop([lesson(1, 3)])).toBeNull();
  });
});

describe("againstTargets", () => {
  const rows = [
    ev("learner_registered", "a", "2026-08-01T06:00:00Z", { locale: "en", grade: 6 }),
    ev("lesson_started", "a", "2026-08-01T07:00:00Z"),
    ev("lesson_completed", "a", "2026-08-01T07:30:00Z"),
    ev("dashboard_viewed", "a", "2026-08-01T06:30:00.100Z"),
    ev("dashboard_viewed", "a", "2026-08-01T06:30:00.400Z"),
    ev("recommendation_clicked", "a", "2026-08-01T06:31:00Z"),
  ];
  const members = cohort(rows, null);
  const targets = againstTargets(forCohort(rows, members), members);

  it("returns every PRD §12 metric", () => {
    expect(targets.map((t) => t.key)).toEqual([
      "first_lesson",
      "lesson_completion",
      "tutor_adoption",
      "practice_completion",
      "recommendation_acceptance",
      "day7_retention",
      "parent_summary_open",
    ]);
  });

  it("uses the DEDUPED dashboard count for recommendation acceptance", () => {
    // Two rows 300ms apart are one view. Undeduped this reads 50%, which
    // understates it — and understating is still wrong.
    expect(targets.find((t) => t.key === "recommendation_acceptance")?.value).toBe(1);
  });

  it("reports null rather than zero for metrics with no denominator", () => {
    const empty = againstTargets([], new Set());
    expect(empty.every((t) => t.value === null)).toBe(true);
  });
});
