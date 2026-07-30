import { describe, expect, it } from "vitest";
import {
  applyResult,
  ladderFrom,
  selectNextAction,
  selectNextQuestion,
  startLadder,
  MAX_DIFFICULTY,
  MIN_DIFFICULTY,
  type Difficulty,
} from "@/lib/learning/adaptivity";

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

  it("says startHere when the completed lessons belong to ANOTHER chapter", () => {
    // A learner who changes grade in Settings keeps their old progress. If that
    // history counted here, a chapter they had never opened would greet them
    // with "Continue where you left off".
    const action = selectNextAction({
      lessons,
      progress: [
        { lesson_id: "other-chapter-l1", status: "completed" },
        { lesson_id: "other-chapter-l2", status: "completed" },
      ],
      mastery: [],
      concepts,
    });
    expect(action).toEqual({ kind: "lesson", lessonId: "l1", reason: "startHere" });
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

/**
 * ── Difficulty stepping (D3) and question selection — slice 2.2 ──────────────
 *
 * The bugs here are the quiet kind. A ladder that climbs too fast puts a learner
 * in front of reverse-and-multi-step questions after two lucky guesses; a
 * selection that returns nothing puts them in front of a blank screen.
 */

/** Fold a run of results written as a string: "TTF" = right, right, wrong. */
function fold(pattern: string, start: Difficulty = MIN_DIFFICULTY) {
  return ladderFrom(
    [...pattern].map((c) => c === "T"),
    start,
  );
}

describe("difficulty stepping — 2 right up, 2 wrong down", () => {
  it("starts at 1", () => {
    expect(startLadder().difficulty).toBe(1);
  });

  it("does not move on a single correct answer", () => {
    expect(fold("T").difficulty).toBe(1);
  });

  it("steps up after two correct in a row", () => {
    expect(fold("TT").difficulty).toBe(2);
  });

  it("steps down after two wrong in a row", () => {
    expect(fold("TTFF").difficulty).toBe(1);
  });

  it("needs two MORE at the new level before stepping again", () => {
    // The reset is the whole point. Without it, "TTT" reads as two overlapping
    // runs of two and a learner rockets to difficulty 3 in three questions.
    expect(fold("TTT").difficulty).toBe(2);
    expect(fold("TTTT").difficulty).toBe(3);
  });

  it("breaks a run with one wrong answer in the middle", () => {
    expect(fold("TFT").difficulty).toBe(1);
    expect(fold("FTF").difficulty).toBe(1);
  });

  it("never exceeds 3", () => {
    expect(fold("TTTTTTTTTT").difficulty).toBe(MAX_DIFFICULTY);
  });

  it("never drops below 1", () => {
    expect(fold("FFFFFFFFFF").difficulty).toBe(MIN_DIFFICULTY);
  });

  it("climbs and falls back symmetrically", () => {
    expect(fold("TTTT").difficulty).toBe(3);
    expect(fold("TTTTFF").difficulty).toBe(2);
    expect(fold("TTTTFFFF").difficulty).toBe(1);
  });

  it("keeps momentum at the ceiling rather than resetting it", () => {
    // At difficulty 3 there is nowhere to step. A learner acing it must not be
    // treated as having no run at all the moment they slip once.
    const atCeiling = fold("TTTTTT");
    expect(atCeiling.difficulty).toBe(3);
    expect(applyResult(atCeiling, false).difficulty).toBe(3);
    expect(applyResult(applyResult(atCeiling, false), false).difficulty).toBe(2);
  });

  it("only looks at recent history", () => {
    // Twenty wrong answers a month ago must not hold a learner at difficulty 1
    // today — the same forgetting D5 builds into mastery, for the same reason.
    expect(fold("FFFFFFFFFFFFFFFFFFFFTTTT").difficulty).toBe(3);
  });

  it("is pure — the input ladder is never mutated", () => {
    const ladder = startLadder();
    applyResult(ladder, true);
    expect(ladder).toEqual({ difficulty: 1, correctRun: 0, wrongRun: 0 });
  });
});

describe("selecting the next question", () => {
  const bank = [
    { id: "e1", difficulty: 1 },
    { id: "e2", difficulty: 1 },
    { id: "m1", difficulty: 2 },
    { id: "m2", difficulty: 2 },
    { id: "h1", difficulty: 3 },
  ];

  it("serves an unseen question at the target difficulty", () => {
    expect(selectNextQuestion({ bank, difficulty: 2 })?.id).toBe("m1");
    expect(selectNextQuestion({ bank, difficulty: 2, excludeIds: ["m1"] })?.id).toBe("m2");
  });

  it("falls to an adjacent difficulty when the level is exhausted", () => {
    const next = selectNextQuestion({ bank, difficulty: 2, excludeIds: ["m1", "m2"] });
    expect(next).not.toBeNull();
    expect(next!.difficulty).not.toBe(2);
  });

  it("breaks a distance tie DOWNWARD", () => {
    // Difficulty 1 and 3 are equally far from 2. A learner who has run out of
    // questions at their level gets the easier one — being pushed up because the
    // bank ran dry is the opposite of adaptive.
    expect(
      selectNextQuestion({ bank, difficulty: 2, excludeIds: ["m1", "m2"] })?.difficulty,
    ).toBe(1);
  });

  it("NEVER returns null while the bank has questions", () => {
    // The practice screen must not be empty (spec §8). A learner who has worked
    // through every question has not earned a blank screen for finishing.
    const everything = bank.map((q) => q.id);
    expect(selectNextQuestion({ bank, difficulty: 2, excludeIds: everything })).not.toBeNull();
    expect(selectNextQuestion({ bank, difficulty: 1, excludeIds: everything })).not.toBeNull();
  });

  it("prefers the target difficulty when it has to repeat", () => {
    const everything = bank.map((q) => q.id);
    expect(selectNextQuestion({ bank, difficulty: 3, excludeIds: everything })?.id).toBe("h1");
  });

  it("returns null only for an empty bank", () => {
    expect(selectNextQuestion({ bank: [], difficulty: 1 })).toBeNull();
  });

  it("is deterministic", () => {
    // No randomness anywhere, so a demo walkthrough and a test see the same
    // question for the same state.
    for (let i = 0; i < 20; i++) {
      expect(selectNextQuestion({ bank, difficulty: 1, excludeIds: ["e1"] })?.id).toBe("e2");
    }
  });
});
