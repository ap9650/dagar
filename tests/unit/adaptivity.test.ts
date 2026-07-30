import { describe, expect, it } from "vitest";
import { selectNextAction } from "@/lib/learning/adaptivity";

/**
 * The dashboard's one job is telling the learner what to do next. Every branch of
 * that decision is tested here, including the ones that only happen at the ends —
 * the brand-new learner (the demo's first minute) and the finished learner (which
 * must never be a dead end).
 */

const lessons = [
  { id: "l1", order_index: 1 },
  { id: "l2", order_index: 2 },
  { id: "l3", order_index: 3 },
];
const concepts = ["c1", "c2"];

describe("selectNextAction", () => {
  it("sends a brand-new learner to lesson 1 with reason startHere", () => {
    expect(
      selectNextAction({ lessons, progress: [], mastery: [], concepts }),
    ).toEqual({ kind: "lesson", lessonId: "l1", reason: "startHere" });
  });

  it("uses order_index, not array order", () => {
    const shuffled = [
      { id: "l3", order_index: 3 },
      { id: "l1", order_index: 1 },
      { id: "l2", order_index: 2 },
    ];
    const action = selectNextAction({
      lessons: shuffled,
      progress: [],
      mastery: [],
      concepts,
    });
    expect(action).toMatchObject({ lessonId: "l1" });
  });

  it("returns the first INCOMPLETE lesson, with reason continue", () => {
    const action = selectNextAction({
      lessons,
      progress: [{ lesson_id: "l1", status: "completed" }],
      mastery: [],
      concepts,
    });
    expect(action).toEqual({ kind: "lesson", lessonId: "l2", reason: "continue" });
  });

  it("does not treat a merely STARTED lesson as done", () => {
    // Opening a lesson and closing it is not completing it — otherwise a learner
    // who taps in and out is silently skipped past the content.
    const action = selectNextAction({
      lessons,
      progress: [{ lesson_id: "l1", status: "started" }],
      mastery: [],
      concepts,
    });
    expect(action).toMatchObject({ lessonId: "l1", reason: "startHere" });
  });

  it("skips a gap — completing lesson 2 first still points at lesson 1", () => {
    const action = selectNextAction({
      lessons,
      progress: [{ lesson_id: "l2", status: "completed" }],
      mastery: [],
      concepts,
    });
    expect(action).toMatchObject({ lessonId: "l1", reason: "continue" });
  });

  describe("all lessons complete", () => {
    const allDone = lessons.map((l) => ({
      lesson_id: l.id,
      status: "completed" as const,
    }));

    it("recommends practice on the WEAKEST unmastered concept", () => {
      const action = selectNextAction({
        lessons,
        progress: allDone,
        mastery: [
          { concept_id: "c1", score: 0.6, is_mastered: false },
          { concept_id: "c2", score: 0.2, is_mastered: false },
        ],
        concepts,
      });
      expect(action).toEqual({
        kind: "practice",
        conceptId: "c2",
        reason: "strengthen",
      });
    });

    it("treats a concept with NO mastery row as score 0, so it is picked first", () => {
      // A never-attempted concept has no row at all. If absence dropped it from
      // consideration, the learner would be sent to revise a concept they have
      // practised while an untouched one stayed untouched.
      const action = selectNextAction({
        lessons,
        progress: allDone,
        mastery: [{ concept_id: "c1", score: 0.5, is_mastered: false }],
        concepts,
      });
      expect(action).toMatchObject({ kind: "practice", conceptId: "c2" });
    });

    it("ignores score when is_mastered is true", () => {
      const action = selectNextAction({
        lessons,
        progress: allDone,
        mastery: [
          { concept_id: "c1", score: 0.8, is_mastered: true },
          { concept_id: "c2", score: 0.9, is_mastered: false },
        ],
        concepts,
      });
      expect(action).toMatchObject({ kind: "practice", conceptId: "c2" });
    });

    it("recommends revision when everything is mastered — never a dead end", () => {
      const action = selectNextAction({
        lessons,
        progress: allDone,
        mastery: [
          { concept_id: "c1", score: 1, is_mastered: true },
          { concept_id: "c2", score: 0.9, is_mastered: true },
        ],
        concepts,
      });
      expect(action).toEqual({ kind: "revise", reason: "revise" });
    });
  });

  it("reports noContent when the grade has no lessons seeded", () => {
    // Class 7 and 8 are seeded in slice 1.5. Until then this branch is live, and
    // an empty dashboard is the worst possible failure for a demo.
    expect(
      selectNextAction({ lessons: [], progress: [], mastery: [], concepts: [] }),
    ).toEqual({ kind: "none", reason: "noContent" });
  });
});
