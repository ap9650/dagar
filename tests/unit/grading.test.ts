import { describe, expect, it } from "vitest";
import { grade, gradeDetailed } from "@/lib/learning/grading";

/**
 * Slice 2.1b. The build plan says "do not skip this one", and the reason is that
 * every bug this file catches is INVISIBLE from inside the app: nothing throws,
 * nothing logs, and a learner who was right is simply told they were wrong.
 *
 * Organised by the failure it prevents, not by function.
 */

describe("the spec's worked examples (guided-practice §7)", () => {
  it("accepts an unreduced fraction", () => {
    expect(grade("1/2", "fraction", "2/4")).toBe(true);
  });

  it("accepts the decimal form of a fraction", () => {
    expect(grade("1/2", "fraction", "0.5")).toBe(true);
  });

  it("ignores surrounding whitespace", () => {
    expect(grade("1/2", "fraction", " 1/2 ")).toBe(true);
  });

  it("accepts a space between the sign and the digits", () => {
    expect(grade("-7", "integer", "- 7")).toBe(true);
  });

  it("keeps sign errors wrong", () => {
    expect(grade("-7", "integer", "7")).toBe(false);
    expect(grade("7", "integer", "-7")).toBe(false);
  });

  it("ignores whitespace in an expression", () => {
    expect(grade("x=4", "expression", "x = 4")).toBe(true);
  });
});

describe("Number() traps — none of these may be treated as numbers", () => {
  // Number("") and Number(" ") are BOTH 0 in JavaScript. Without a guard, a
  // learner who submits nothing would be marked correct on any question whose
  // answer is 0.
  it("does not let a blank answer match an expected 0", () => {
    expect(grade("0", "integer", "")).toBe(false);
    expect(grade("0", "integer", "   ")).toBe(false);
    expect(grade("0", "decimal", "")).toBe(false);
    expect(grade("0", "fraction", "")).toBe(false);
  });

  it("reports a blank as `empty`, not as a wrong answer", () => {
    // The caller uses this to avoid writing an attempt row — a blank submission
    // must never count against mastery.
    expect(gradeDetailed("0", "integer", "").reason).toBe("empty");
    expect(gradeDetailed("0", "integer", "   ").reason).toBe("empty");
  });

  it("does not accept hexadecimal", () => {
    expect(grade("16", "integer", "0x10")).toBe(false);
  });

  it("does not accept exponent notation", () => {
    expect(grade("1000", "integer", "1e3")).toBe(false);
  });

  it("does not accept Infinity", () => {
    expect(grade("999", "decimal", "Infinity")).toBe(false);
    expect(grade("999", "decimal", "-Infinity")).toBe(false);
  });
});

describe("non-Arabic digits are rejected, never mis-graded (i18n.md)", () => {
  it("rejects Devanagari digits", () => {
    expect(grade("1/2", "fraction", "१/२")).toBe(false);
    expect(gradeDetailed("1/2", "fraction", "१/२").reason).toBe("unparseable");
    expect(grade("12", "integer", "१२")).toBe(false);
  });

  it("rejects Arabic-Indic digits", () => {
    expect(grade("12", "integer", "١٢")).toBe(false);
  });

  it("still accepts ordinary Arabic numerals", () => {
    expect(grade("12", "integer", "12")).toBe(true);
  });

  it("rejects them even on the string-compare paths", () => {
    // The numeric parsers reject Devanagari on their own, but `mcq` and
    // `expression` compare strings — so a Devanagari answer_value (which would
    // itself be a content bug, since answer_value is never translated) could
    // otherwise "match". Fail closed: unparseable, not correct.
    expect(grade("१", "mcq", "१")).toBe(false);
    expect(gradeDetailed("१", "mcq", "१").reason).toBe("unparseable");
    expect(grade("x=१", "expression", "x=१")).toBe(false);
  });
});

describe("garbage in, false out — never a throw", () => {
  const junk = [
    "",
    "   ",
    "abc",
    "??",
    "1/",
    "/2",
    "--5",
    "1.2.3",
    "1/2/3",
    null,
    undefined,
    42,
    {},
    [],
    "x".repeat(5000),
  ];

  for (const answerType of ["mcq", "integer", "fraction", "decimal", "expression"] as const) {
    it(`survives every junk input for ${answerType}`, () => {
      for (const value of junk) {
        expect(() => grade("1/2", answerType, value)).not.toThrow();
        expect(grade("1/2", answerType, value)).toBe(false);
      }
    });
  }

  it("never divides by zero", () => {
    expect(grade("1/2", "fraction", "1/0")).toBe(false);
    expect(gradeDetailed("1/2", "fraction", "1/0").reason).toBe("unparseable");
  });

  it("treats a missing answer key as unparseable, not as a correct answer", () => {
    // A question with no answer_value is a content bug. The learner must not be
    // marked right OR wrong on the strength of it.
    expect(gradeDetailed("", "integer", "5").reason).toBe("unparseable");
    expect(grade("", "integer", "5")).toBe(false);
    expect(grade(null, "integer", "5")).toBe(false);
  });
});

describe("mcq", () => {
  it("matches on the choice id", () => {
    expect(grade("b", "mcq", "b")).toBe(true);
    expect(grade("b", "mcq", "a")).toBe(false);
  });

  it("is case-insensitive on the id", () => {
    expect(grade("b", "mcq", "B")).toBe(true);
  });

  it("never grades on the label", () => {
    // Labels are translated (D16). Grading a label would make a Hindi learner's
    // correct answer wrong, which is the exact failure D16 is designed to prevent.
    expect(grade("b", "mcq", "$\\frac{2}{4}$")).toBe(false);
    expect(grade("b", "mcq", "समतुल्य")).toBe(false);
  });
});

describe("integer", () => {
  it("accepts an exact match", () => {
    expect(grade("12", "integer", "12")).toBe(true);
    expect(grade("-7", "integer", "-7")).toBe(true);
    expect(grade("0", "integer", "0")).toBe(true);
  });

  it("accepts an explicit plus sign", () => {
    expect(grade("7", "integer", "+7")).toBe(true);
  });

  it("normalises a unicode minus pasted from a document", () => {
    expect(grade("-7", "integer", "−7")).toBe(true); // U+2212 MINUS SIGN
    expect(grade("-7", "integer", "–7")).toBe(true); // en dash
  });

  it("rejects a decimal for an integer question", () => {
    expect(grade("7", "integer", "7.5")).toBe(false);
  });

  it("accepts a whole-number decimal only if written as an integer", () => {
    // "7.0" is not an integer literal. Rejecting it is the safer failure: the
    // question asked for a whole number.
    expect(grade("7", "integer", "7.0")).toBe(false);
  });

  it("rejects a mismatch", () => {
    expect(grade("12", "integer", "13")).toBe(false);
  });
});

describe("fraction", () => {
  it("accepts any equivalent form", () => {
    expect(grade("1/2", "fraction", "1/2")).toBe(true);
    expect(grade("1/2", "fraction", "2/4")).toBe(true);
    expect(grade("1/2", "fraction", "50/100")).toBe(true);
    expect(grade("1/2", "fraction", "0.5")).toBe(true);
    expect(grade("1/2", "fraction", ".5")).toBe(true);
  });

  it("accepts spaces around the slash", () => {
    expect(grade("3/4", "fraction", "3 / 4")).toBe(true);
  });

  it("handles negatives, including a negative denominator", () => {
    expect(grade("-3/4", "fraction", "-3/4")).toBe(true);
    expect(grade("-3/4", "fraction", "3/-4")).toBe(true);
    expect(grade("-3/4", "fraction", "-6/8")).toBe(true);
    expect(grade("3/4", "fraction", "-3/4")).toBe(false);
  });

  it("compares exactly, so a rounded decimal is not close enough", () => {
    expect(grade("1/3", "fraction", "0.33")).toBe(false);
    expect(grade("1/3", "fraction", "0.3333")).toBe(false);
  });

  it("compares two fractions EXACTLY, never by approximate value", () => {
    // 1/3 is 0.3333… and 33/100 is 0.33 — within a hundredth of each other, and
    // a different number. If fraction-to-fraction comparison ever drifted to a
    // tolerance, a wrong answer this close would be marked correct.
    expect(grade("1/3", "fraction", "33/100")).toBe(false);
    expect(grade("7/12", "fraction", "58/100")).toBe(false);
    expect(grade("2/3", "fraction", "66/100")).toBe(false);
  });

  it("rejects a different fraction", () => {
    expect(grade("1/2", "fraction", "1/3")).toBe(false);
    expect(grade("7/12", "fraction", "5/12")).toBe(false);
  });

  it("accepts a whole number written as a fraction", () => {
    expect(grade("2", "fraction", "4/2")).toBe(true);
    expect(grade("2", "fraction", "2")).toBe(true);
  });

  it("grades the real seeded answers correctly", () => {
    // Straight from supabase/seed — the exact values a learner will meet.
    expect(grade("3/5", "fraction", "3/5")).toBe(true);
    expect(grade("7/12", "fraction", "14/24")).toBe(true);
    expect(grade("11/15", "fraction", "11/15")).toBe(true);
    expect(grade("5/12", "fraction", "10/24")).toBe(true);
    expect(grade("5/4", "fraction", "1.25")).toBe(true);
  });
});

describe("decimal", () => {
  it("matches within 1e-6", () => {
    expect(grade("2.5", "decimal", "2.5")).toBe(true);
    expect(grade("2.5", "decimal", "2.5000001")).toBe(true);
    expect(grade("2.5", "decimal", "2.50001")).toBe(false);
  });

  it("accepts an equivalent fraction", () => {
    expect(grade("2.5", "decimal", "5/2")).toBe(true);
  });

  it("keeps sign errors wrong", () => {
    expect(grade("2.5", "decimal", "-2.5")).toBe(false);
  });
});

describe("expression", () => {
  it("ignores whitespace", () => {
    expect(grade("x=4", "expression", "x = 4")).toBe(true);
    expect(grade("x = 4", "expression", "x=4")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(grade("x=4", "expression", "X=4")).toBe(true);
  });

  it("treats 4 and 4.0 as the same value", () => {
    expect(grade("x=4", "expression", "x=4.0")).toBe(true);
  });

  it("rejects a different value", () => {
    expect(grade("x=4", "expression", "x=5")).toBe(false);
  });

  it("rejects a different variable", () => {
    expect(grade("x=4", "expression", "y=4")).toBe(false);
  });
});

describe("grading is language-independent (D16)", () => {
  it("gives identical results whatever the learner's locale", () => {
    // grade() takes no locale and imports nothing from i18n. This asserts the
    // consequence: the same keystrokes grade the same for every learner.
    const cases = [
      ["1/2", "fraction", "2/4"],
      ["-7", "integer", "- 7"],
      ["b", "mcq", "b"],
      ["5/12", "fraction", "5/12"],
    ] as const;

    for (const [expected, type, given] of cases) {
      expect(grade(expected, type, given)).toBe(true);
    }
  });

  it("is not affected by a Devanagari-shaped answer key", () => {
    // Defence in depth: even if a translation bug ever wrote Devanagari into an
    // answer_value, a learner typing the correct Arabic answer is not marked
    // wrong on the strength of it — it fails as unparseable, not as incorrect.
    expect(gradeDetailed("१/२", "fraction", "1/2").reason).toBe("unparseable");
  });
});

describe("determinism", () => {
  it("returns the same answer every time for the same input", () => {
    for (let i = 0; i < 100; i++) {
      expect(grade("1/2", "fraction", "2/4")).toBe(true);
      expect(grade("-7", "integer", "7")).toBe(false);
    }
  });
});
