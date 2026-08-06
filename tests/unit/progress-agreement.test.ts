import { describe, expect, it } from "vitest";
import { buildDiary, entryDate, DIARY_LIMIT, DIARY_PER_DAY } from "@/lib/learning/diary";
import { weekOfActivity, daysMet } from "@/lib/learning/week";
import { weekdayFormatter } from "@/lib/i18n/weekday";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE PROGRESS SCREEN MUST AGREE WITH ITSELF.
 *
 * Every progress bug reported so far was the same kind, and no test caught any
 * of them, because every test asserted a FLOW — can the learner reach the
 * screen, is the element on it, does the route return 200. The learner could
 * always reach the screen. What was wrong was the relationship between two
 * numbers on it:
 *
 *   "2 days this week" above "1 day streak"
 *   a square filled on a day the list below never mentions
 *   a square she read as Tuesday over a line that said Wed
 *
 * The cause is structural and worth stating plainly: this one screen is built
 * from THREE sources that never consult each other. The strip counts
 * `lesson_progress.completed_at`, the list reads `events`, and the streak is a
 * stored counter written by a database function. Three writers, one fact.
 * Nothing in the product notices when they diverge — a learner does, and then
 * stops trusting the number, which is the whole asset.
 *
 * So these tests do not walk a journey. They feed ONE activity log to every
 * element and assert the elements say the same thing about it. That is the
 * class of test that was missing.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const NOW = new Date("2026-08-06T12:00:00Z"); // Thursday, IST

/** `05` is the 5th of August; full ISO dates for anything crossing a month. */
const at = (day: string, hour: number) =>
  `${day.length === 2 ? `2026-08-${day}` : day}T${String(hour).padStart(2, "0")}:00:00Z`;

/** The seven days of the strip on `NOW`, oldest first — July into August. */
const THE_WEEK = [
  "2026-07-31",
  "2026-08-01",
  "2026-08-02",
  "2026-08-03",
  "2026-08-04",
  "2026-08-05",
  "2026-08-06",
];

/** One act of finishing a lesson, as BOTH tables record it. */
function lessonFinished(day: string, hour: number, id: string) {
  return {
    completedAt: at(day, hour),
    event: { name: "lesson_completed", props: { lesson_id: id }, created_at: at(day, hour) },
  };
}

describe("the week strip and What moved describe the same days", () => {
  it("never lists work on a day the strip left blank", () => {
    // The direction she asked about: "if things moved on Wednesday, why is
    // Wednesday not ticked?" There must be no such day, ever.
    const acts = [
      lessonFinished("02", 10, "a"),
      lessonFinished("05", 14, "b"),
      lessonFinished("05", 15, "c"),
    ];

    const week = weekOfActivity(acts.map((a) => a.completedAt), [], NOW);
    const diary = buildDiary(acts.map((a) => a.event), NOW);

    const ticked = new Set(week.filter((d) => d.met).map((d) => d.date));
    for (const entry of diary) {
      expect(ticked, `${entryDate(entry)} has a line but no tick`).toContain(entryDate(entry));
    }
  });

  it("names every worked day in the list, even a seven-day week", () => {
    // The other direction, and the one that was actually broken. Four worked
    // days at three lines each is twelve, and the old global slice to eight
    // dropped the oldest day entirely — four ticks over a list covering three.
    const acts = THE_WEEK.flatMap((day) =>
      [0, 1, 2, 3].map((i) => lessonFinished(day, 8 + i, `${day}-${i}`)),
    );

    const week = weekOfActivity(acts.map((a) => a.completedAt), [], NOW);
    const diary = buildDiary(acts.map((a) => a.event), NOW);

    const listed = new Set(diary.map(entryDate));
    for (const day of week.filter((d) => d.met)) {
      expect(listed, `${day.date} is ticked but appears nowhere in the list`).toContain(day.date);
    }
    expect(daysMet(week)).toBe(7);
    expect(diary.length).toBeLessThanOrEqual(DIARY_LIMIT);
  });

  it("spends its spare slots on the newest days, not the oldest", () => {
    // Seven days, eight slots: every day gets its headline and Thursday — the
    // day the learner just finished, and the one they opened the screen to see
    // — gets the extra.
    const acts = THE_WEEK.flatMap((day) =>
      [0, 1].map((i) => lessonFinished(day, 8 + i, `${day}-${i}`)),
    );
    const diary = buildDiary(acts.map((a) => a.event), NOW);

    const perDay = new Map<string, number>();
    for (const e of diary) perDay.set(entryDate(e), (perDay.get(entryDate(e)) ?? 0) + 1);

    expect(diary).toHaveLength(DIARY_LIMIT);
    expect(perDay.get("2026-08-06")).toBe(2);
    expect(perDay.get("2026-07-31")).toBe(1);
  });

  it("still shows a busy day in proportion when the week is quiet", () => {
    // The cap is per-day, not a flattening. One real evening's work should look
    // like one real evening's work.
    const acts = [0, 1, 2, 3, 4].map((i) => lessonFinished("05", 10 + i, `l${i}`));
    const diary = buildDiary(acts.map((a) => a.event), NOW);
    expect(diary).toHaveLength(DIARY_PER_DAY);
  });

  it("does not tick a day whose only activity was four practice questions", () => {
    // The strip's rule is D7's rule — one lesson OR five practice — and the
    // list only ever carries finished things. Four questions is neither, and
    // both elements must agree that nothing happened.
    const practice = [0, 1, 2, 3].map((i) => at("05", 10 + i));
    const week = weekOfActivity([], practice, NOW);
    expect(daysMet(week)).toBe(0);
    expect(buildDiary([], NOW)).toEqual([]);
  });

  it("ticks a day of five practice questions, and that day has no list line", () => {
    // The one legitimate asymmetry, asserted so nobody later 'fixes' it into
    // agreement: practice fills a square without finishing anything nameable.
    const practice = [0, 1, 2, 3, 4].map((i) => at("05", 10 + i));
    const week = weekOfActivity([], practice, NOW);
    expect(daysMet(week)).toBe(1);
    expect(buildDiary([], NOW)).toEqual([]);
  });
});

describe("the two sections spell a day the same way", () => {
  // `We` in a square over `Wed` in the list meant cross-checking them was a
  // translation exercise. One formatter now serves both; this is what stops a
  // second one appearing.
  it.each([
    ["en", "2026-08-05", "Wed"],
    ["en", "2026-08-06", "Thu"],
    ["en", "2026-08-04", "Tue"],
  ] as const)("%s: %s reads as %s in both", (locale, date, expected) => {
    const label = weekdayFormatter(locale as "en")(date);
    expect(label).toBe(expected);
  });

  it("is unambiguous — no two weekdays share a label, in either language", () => {
    // `M T W T F S S` had four ambiguous characters, and a learner reading her
    // own week off it got Tuesday for Wednesday twice. Nothing was wrong with
    // the data either time.
    for (const locale of ["en", "hi"] as const) {
      const week = ["2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06", "2026-08-07", "2026-08-08", "2026-08-09"];
      const labels = week.map(weekdayFormatter(locale));
      expect(new Set(labels).size, `${locale}: ${labels.join(" ")}`).toBe(7);
    }
  });
});
