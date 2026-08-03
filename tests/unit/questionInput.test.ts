import { describe, expect, it } from "vitest";
import {
  parseInput,
  parseStemViz,
  placedValue,
  shadedValue,
  type PlaceInput,
  type ShadeInput,
} from "@/lib/learning/questionInput";

/**
 * The parser's job is to fail SAFELY. Every rejection below has a caller that
 * then renders today's text field — so these tests are really asserting "a
 * content typo costs the pictures, never the question".
 */

describe("parseInput", () => {
  it("accepts a tiles bank", () => {
    expect(parseInput({ kind: "tiles", bank: ["3", "8", "/", "5"] })).toEqual({
      kind: "tiles",
      bank: ["3", "8", "/", "5"],
    });
  });

  it("accepts choiceViz options", () => {
    const value = {
      kind: "choiceViz",
      options: [
        { value: "3/8", viz: { kind: "partWhole", shape: "bar", parts: 8, shaded: 3 } },
        { value: "3/4", viz: { kind: "partWhole", shape: "bar", parts: 4, shaded: 3 } },
      ],
    };
    expect(parseInput(value)).not.toBeNull();
  });

  it("accepts shade and place", () => {
    expect(parseInput({ kind: "shade", shape: "circle", parts: 4 })).not.toBeNull();
    expect(parseInput({ kind: "place", from: -5, to: 5, step: 1 })).not.toBeNull();
  });

  // ── the refusals ─────────────────────────────────────────────────────────

  it("returns null rather than throwing on rubbish", () => {
    for (const bad of [null, undefined, 42, "tiles", [], {}, { kind: "nope" }]) {
      expect(parseInput(bad), JSON.stringify(bad)).toBeNull();
    }
  });

  it("rejects a tiles bank too small to be an assembly", () => {
    expect(parseInput({ kind: "tiles", bank: ["3", "/"] })).toBeNull();
  });

  it("rejects a tiles bank that would wrap past two rows at 360px", () => {
    expect(parseInput({ kind: "tiles", bank: "0123456789A".split("") })).toBeNull();
  });

  it("rejects a single-option choice, which is not a choice", () => {
    expect(
      parseInput({
        kind: "choiceViz",
        options: [{ value: "1/2", viz: { kind: "partWhole", shape: "bar", parts: 2, shaded: 1 } }],
      }),
    ).toBeNull();
  });

  it("rejects a choiceViz option whose diagram is malformed", () => {
    // The viz schema is SHARED with lessons, so a diagram cannot be valid in one
    // surface and invalid in the other.
    expect(
      parseInput({
        kind: "choiceViz",
        options: [
          { value: "1/2", viz: { kind: "partWhole", shape: "hexagon", parts: 2, shaded: 1 } },
          { value: "1/4", viz: { kind: "partWhole", shape: "bar", parts: 4, shaded: 1 } },
        ],
      }),
    ).toBeNull();
  });

  it("rejects more shade parts than a 44px target allows", () => {
    expect(parseInput({ kind: "shade", shape: "circle", parts: 12 })).toBeNull();
  });

  it("rejects a place step of zero, which would divide by nothing", () => {
    expect(parseInput({ kind: "place", from: 0, to: 10, step: 0 })).toBeNull();
  });
});

describe("placedValue", () => {
  const line: PlaceInput = { kind: "place", from: -5, to: 5, step: 1 };

  it("snaps a thumb to the nearest mark", () => {
    // The learner is answering a maths question, not being tested on their aim.
    expect(placedValue(line, 2.03)).toBe("2");
    expect(placedValue(line, 1.6)).toBe("2");
    expect(placedValue(line, -2.4)).toBe("-2");
  });

  it("clamps to the ends of the line", () => {
    expect(placedValue(line, 99)).toBe("5");
    expect(placedValue(line, -99)).toBe("-5");
  });

  it("does not leak binary floating point into the answer", () => {
    // 0.1 + 0.2 is 0.30000000000000004. A learner must never be marked wrong
    // for our arithmetic.
    const tenths: PlaceInput = { kind: "place", from: 0, to: 1, step: 0.1 };
    expect(placedValue(tenths, 0.3)).toBe("0.3");
    expect(placedValue(tenths, 0.7000001)).toBe("0.7");
    expect(placedValue(tenths, 0)).toBe("0");
  });

  it("writes a whole number without a trailing .0", () => {
    const halves: PlaceInput = { kind: "place", from: 0, to: 3, step: 0.5 };
    expect(placedValue(halves, 2)).toBe("2");
    expect(placedValue(halves, 2.5)).toBe("2.5");
  });
});

describe("shadedValue", () => {
  const spec: ShadeInput = { kind: "shade", shape: "circle", parts: 4 };

  it("reports what the learner actually did, unreduced", () => {
    // `2/4` is the learner's answer. D3 already grades it correct against `1/2`,
    // and reducing it here would hide their working from the attempt record.
    expect(shadedValue(spec, 2)).toBe("2/4");
    expect(shadedValue(spec, 1)).toBe("1/4");
  });

  it("reports zero rather than an empty string", () => {
    // An empty answer is rejected before grading; "0/4" is a real wrong answer
    // and should be graded and recorded as one.
    expect(shadedValue(spec, 0)).toBe("0/4");
  });
});

/**
 * The diagram that IS the question (slice 5.2c).
 *
 * Class 8 had nothing pictorial because every input kind puts diagrams among
 * the ANSWERS, and an equation cannot work that way — you cannot offer four
 * balances and ask which is right. So the balance goes beside the stem.
 */
describe("parseStemViz", () => {
  it("accepts a balance", () => {
    const spec = parseStemViz({
      kind: "balanceScale",
      left: { xs: 2, n: 1 },
      right: { xs: 1, n: 5 },
    });
    expect(spec).not.toBeNull();
    expect(spec!.kind).toBe("balanceScale");
  });

  it("accepts the other primitives too — a stem diagram is not balance-only", () => {
    expect(parseStemViz({ kind: "numberLine", from: -5, to: 5, step: 1 })).not.toBeNull();
    expect(
      parseStemViz({ kind: "partWhole", shape: "bar", parts: 4, shaded: 3 }),
    ).not.toBeNull();
  });

  it("returns null rather than throwing on anything it cannot vouch for", () => {
    for (const bad of [null, undefined, 0, "balanceScale", [], {}, { kind: "teapot" }]) {
      expect(parseStemViz(bad), JSON.stringify(bad)).toBeNull();
    }
  });

  it("rejects a balance with more x-boxes than a pan can hold", () => {
    // Six boxes overflow the pan — the same overflow a test caught in the
    // BalanceScale geometry, which is why the cap lives in the schema.
    expect(
      parseStemViz({ kind: "balanceScale", left: { xs: 9 }, right: { xs: 0, n: 9 } }),
    ).toBeNull();
  });
});
