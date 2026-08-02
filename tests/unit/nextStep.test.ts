import { describe, expect, it } from "vitest";
import { nextAfterLesson, nextStepHref } from "@/lib/learning/nextStep";

/**
 * The rule that used to be two lines in a page, and was wrong in a way the code
 * could not show you: the destination was "next lesson", while the button said
 * "Practise this" the whole time. A learner tapped practice and got a lesson.
 */

const basics = { concept_id: "fraction-basics" };

describe("nextAfterLesson", () => {
  it("continues to the next lesson while the concept is unfinished", () => {
    // Class 6 lessons 1 and 2 are both fraction basics. Practising after the
    // first would test a learner on half an idea.
    expect(nextAfterLesson(basics, { id: "l2", concept_id: "fraction-basics" })).toEqual({
      kind: "lesson",
      lessonId: "l2",
    });
  });

  it("practises when the next lesson starts a NEW concept", () => {
    expect(nextAfterLesson(basics, { id: "l3", concept_id: "equivalent-fractions" })).toEqual({
      kind: "practice",
      conceptId: "fraction-basics",
    });
  });

  it("practises at the end of a chapter — never a dead end", () => {
    expect(nextAfterLesson(basics, undefined)).toEqual({
      kind: "practice",
      conceptId: "fraction-basics",
    });
  });

  it("practises the concept just FINISHED, not the one coming next", () => {
    const step = nextAfterLesson(basics, { id: "l3", concept_id: "equivalent-fractions" });
    expect(step).toMatchObject({ conceptId: "fraction-basics" });
  });
});

describe("nextStepHref", () => {
  it("routes practice by concept", () => {
    expect(nextStepHref({ kind: "practice", conceptId: "c1" }, "ch")).toBe("/practice/c1");
  });

  it("routes a lesson within its chapter", () => {
    expect(nextStepHref({ kind: "lesson", lessonId: "l2" }, "ch")).toBe("/learn/ch/l2");
  });
});
