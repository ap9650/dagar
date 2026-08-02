import { describe, expect, it, vi } from "vitest";
import { parseSteps, progressAt } from "@/lib/learning/lessonSteps";

/**
 * The parser's job is to be UNTRUSTING.
 *
 * `lessons.steps` is hand-authored in a seed file and stored as jsonb, so it
 * reaches the app as `unknown` — a typo is a runtime value, not a compile error.
 * And the failure that matters is not "wrong shape", it is "lesson renders
 * blank". So every test here is really asking one question: does a content
 * mistake cost the interactive version of a lesson, or the lesson?
 */

const see = (md = "Two rotis, four people.") => ({ kind: "see" as const, md });

const valid = [
  see(),
  {
    kind: "build",
    md: "Cut it into 4 equal pieces.",
    viz: { kind: "partWhole", shape: "circle", parts: 4, shaded: 0, target: 1 },
  },
  {
    kind: "tap",
    md: "Which one shows three eighths?",
    options: [
      { viz: { kind: "partWhole", shape: "bar", parts: 4, shaded: 2 } },
      { viz: { kind: "partWhole", shape: "bar", parts: 8, shaded: 3 } },
    ],
    answer: 1,
    why: "Eight equal parts, three of them taken.",
  },
];

describe("parseSteps", () => {
  it("accepts a well-formed lesson", () => {
    expect(parseSteps(valid)).toHaveLength(3);
  });

  it("returns null for null and undefined — the no-steps lesson", () => {
    expect(parseSteps(null)).toBeNull();
    expect(parseSteps(undefined)).toBeNull();
  });

  it("returns null for too few steps rather than rendering a stub", () => {
    expect(parseSteps([see(), see()])).toBeNull();
  });

  it("rejects the WHOLE lesson when one step is bad, never a partial one", () => {
    // Partial rendering is the worse failure: a lesson quietly missing its third
    // screen teaches a gap, and nobody notices because it still looks finished.
    const withOneBad = [...valid, { kind: "see" }];
    expect(parseSteps(withOneBad)).toBeNull();
  });

  it("rejects a tap whose answer index is not on screen", () => {
    // The nastiest content bug available here: every learner taps, every learner
    // is told they are wrong, and the lesson looks fine.
    const bad = [
      see(),
      see(),
      {
        kind: "tap",
        md: "Which one?",
        options: [{ label: "a" }, { label: "b" }],
        answer: 2,
      },
    ];
    expect(parseSteps(bad)).toBeNull();
  });

  it("accepts the last valid answer index", () => {
    const ok = [
      see(),
      see(),
      { kind: "tap", md: "Which one?", options: [{ label: "a" }, { label: "b" }], answer: 1 },
    ];
    expect(parseSteps(ok)).toHaveLength(3);
  });

  it("enforces the 25-word contract with a hard character cap", () => {
    // A rule that lives only in a document is a rule that drifts.
    const long = [see("word ".repeat(60)), see(), see()];
    expect(parseSteps(long)).toBeNull();
  });

  it("rejects a part count a circle cannot usefully show", () => {
    const bad = [
      see(),
      see(),
      { kind: "build", md: "Shade it.", viz: { kind: "partWhole", shape: "circle", parts: 40, shaded: 1 } },
    ];
    expect(parseSteps(bad)).toBeNull();
  });

  it("rejects an unknown viz kind rather than rendering nothing silently", () => {
    const bad = [
      see(),
      see(),
      { kind: "see", md: "Look.", viz: { kind: "piechart", parts: 4 } },
    ];
    expect(parseSteps(bad)).toBeNull();
  });

  it("rejects a tap with fewer than two options", () => {
    const bad = [see(), see(), { kind: "tap", md: "Which?", options: [{ label: "a" }], answer: 0 }];
    expect(parseSteps(bad)).toBeNull();
  });

  it("never throws, whatever it is handed", () => {
    for (const junk of [0, "", "steps", true, {}, [], [null], [{}], { kind: "see" }, NaN]) {
      expect(() => parseSteps(junk)).not.toThrow();
      expect(parseSteps(junk)).toBeNull();
    }
  });

  it("logs on the server when it rejects, so a silent revert to prose is noticed", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    parseSteps([{ kind: "see" }]);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("accepts a number line with jumps — the Class 7 shape", () => {
    const ok = [
      see(),
      see(),
      {
        kind: "see",
        md: "Start at −3 and jump forward 5.",
        viz: {
          kind: "numberLine",
          from: -5,
          to: 5,
          step: 1,
          jumps: [{ from: -3, to: 2, label: "+5" }],
        },
      },
    ];
    expect(parseSteps(ok)).toHaveLength(3);
  });
});

describe("progressAt", () => {
  it("is 100% on the last step", () => {
    expect(progressAt(6, 7)).toBe(100);
  });

  it("never exceeds 100, even if an index runs past the end", () => {
    expect(progressAt(99, 7)).toBe(100);
  });

  it("survives an empty lesson instead of dividing by zero", () => {
    expect(progressAt(0, 0)).toBe(0);
  });
});
