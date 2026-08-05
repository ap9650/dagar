import { describe, expect, it } from "vitest";
import { buildDiary, DIARY_EVENTS, DIARY_LIMIT, entryDate } from "@/lib/learning/diary";
import { EVENT_NAMES } from "@/lib/analytics/track";

/**
 * "What moved this week".
 *
 * Two failures worth guarding. One is loud: a malformed jsonb row crashing the
 * progress screen. The other is quiet and worse — the diary narrating a fall
 * back to a learner who is already behind, because a filter was dropped.
 */

const NOW = new Date("2026-08-05T12:00:00Z");

const ev = (name: string, props: unknown, created_at: string) => ({ name, props, created_at });

describe("the events it reads", () => {
  it("are all on the canonical list", () => {
    // A name here that no longer exists would silently narrow the query to
    // nothing and the diary would go permanently empty.
    for (const name of DIARY_EVENTS) {
      expect(EVENT_NAMES).toContain(name);
    }
  });
});

describe("buildDiary", () => {
  it("is empty for a learner with no events", () => {
    expect(buildDiary([], NOW)).toEqual([]);
  });

  it("records a level going up", () => {
    const diary = buildDiary(
      [
        ev(
          "concept_level_changed",
          { concept_id: "c1", from: "getting_there", to: "mastered" },
          "2026-08-04T09:00:00Z",
        ),
      ],
      NOW,
    );
    expect(diary).toEqual([
      { kind: "level", at: "2026-08-04T09:00:00Z", conceptId: "c1", to: "mastered" },
    ]);
  });

  it("NEVER records a level going down", () => {
    // The event records both directions for analytics. This list does not:
    // "Fractions went backwards on Thursday" is not a sentence this product
    // says to a child. The concept badge shows the truth immediately anyway.
    const diary = buildDiary(
      [
        ev(
          "concept_level_changed",
          { concept_id: "c1", from: "mastered", to: "practising" },
          "2026-08-04T09:00:00Z",
        ),
      ],
      NOW,
    );
    expect(diary).toEqual([]);
  });

  it("keeps only the newest move per concept", () => {
    // A five-attempt window makes a wobbling concept emit repeatedly. Four
    // lines about one idea would crowd out the rest of the week, and the
    // learner cares that it is Mastered now, not about the road there.
    const diary = buildDiary(
      [
        ev("concept_level_changed", { concept_id: "c1", from: "practising", to: "getting_there" }, "2026-08-02T09:00:00Z"),
        ev("concept_level_changed", { concept_id: "c1", from: "getting_there", to: "mastered" }, "2026-08-04T09:00:00Z"),
      ],
      NOW,
    );
    expect(diary).toHaveLength(1);
    expect(diary[0]).toMatchObject({ kind: "level", to: "mastered" });
  });

  it("is newest first", () => {
    const diary = buildDiary(
      [
        ev("lesson_completed", { lesson_id: "l1" }, "2026-08-01T09:00:00Z"),
        ev("lesson_completed", { lesson_id: "l2" }, "2026-08-04T09:00:00Z"),
      ],
      NOW,
    );
    expect(diary.map((e) => (e.kind === "lesson" ? e.lessonId : null))).toEqual(["l2", "l1"]);
  });

  it("drops anything older than seven days", () => {
    expect(buildDiary([ev("lesson_completed", { lesson_id: "l1" }, "2026-07-20T09:00:00Z")], NOW))
      .toEqual([]);
  });

  it("caps the week so it stays readable", () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      ev("lesson_completed", { lesson_id: `l${i}` }, "2026-08-04T09:00:00Z"),
    );
    expect(buildDiary(many, NOW)).toHaveLength(DIARY_LIMIT);
  });

  it("ignores events it has no line for", () => {
    // `dashboard_viewed` fires on every visit. A diary of everything is a diary
    // of nothing.
    expect(buildDiary([ev("dashboard_viewed", {}, "2026-08-04T09:00:00Z")], NOW)).toEqual([]);
  });

  it("survives malformed props rather than crashing the screen", () => {
    // `props` is jsonb: Postgres may hand back a string, a number, an array or
    // null just as legally as an object. None of those may take down /progress.
    const junk = [
      ev("lesson_completed", null, "2026-08-04T09:00:00Z"),
      ev("lesson_completed", "not an object", "2026-08-04T09:00:00Z"),
      ev("lesson_completed", 42, "2026-08-04T09:00:00Z"),
      ev("lesson_completed", ["a"], "2026-08-04T09:00:00Z"),
      ev("lesson_completed", {}, "2026-08-04T09:00:00Z"),
      ev("concept_level_changed", { concept_id: "c1" }, "2026-08-04T09:00:00Z"),
      ev("concept_level_changed", { concept_id: "c1", from: "x", to: "y" }, "2026-08-04T09:00:00Z"),
      ev("lesson_completed", { lesson_id: "l1" }, "not a date"),
    ];
    expect(() => buildDiary(junk, NOW)).not.toThrow();
    expect(buildDiary(junk, NOW)).toEqual([]);
  });

  it("carries badges and chapters too", () => {
    const diary = buildDiary(
      [
        ev("milestone_earned", { code: "streak_3" }, "2026-08-03T09:00:00Z"),
        ev("chapter_completed", { chapter_id: "ch1" }, "2026-08-04T09:00:00Z"),
      ],
      NOW,
    );
    expect(diary.map((e) => e.kind)).toEqual(["chapter", "badge"]);
  });
});

describe("entryDate", () => {
  it("is the IST day, not the UTC one", () => {
    // 18:40Z is 00:10 IST the next morning — the learner's Tuesday-night work
    // belongs on Wednesday's line, which is where they will look for it.
    expect(
      entryDate({ kind: "lesson", at: "2026-08-04T18:40:00Z", lessonId: "l1" }),
    ).toBe("2026-08-05");
  });
});
