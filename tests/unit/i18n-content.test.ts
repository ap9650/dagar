import { describe, expect, it } from "vitest";
import { t, tChoices } from "@/lib/i18n/content";

/**
 * docs/specs/i18n.md acceptance criteria:
 *   - t() returns English when the Hindi key is absent, for every localised table
 *   - a missing translation renders English, never an empty screen
 *
 * The fallback is the whole safety net for shipping Hindi content on a deadline:
 * if it works, an untranslated row is a cosmetic gap, not a blank lesson.
 */

const lesson = {
  title: "Equivalent Fractions",
  body_md: "Two fractions are equivalent when...",
  i18n: {
    hi: {
      title: "समतुल्य भिन्न",
      body_md: "दो भिन्न समतुल्य होती हैं जब...",
    },
  },
};

describe("t(row, field, locale)", () => {
  it("returns the base column for English", () => {
    expect(t(lesson, "title", "en")).toBe("Equivalent Fractions");
  });

  it("returns the Hindi translation when present", () => {
    expect(t(lesson, "title", "hi")).toBe("समतुल्य भिन्न");
    expect(t(lesson, "body_md", "hi")).toBe("दो भिन्न समतुल्य होती हैं जब...");
  });

  it("falls back to English when the field is missing from the Hindi object", () => {
    const partial = { ...lesson, i18n: { hi: { title: "समतुल्य भिन्न" } } };
    expect(t(partial, "body_md", "hi")).toBe(lesson.body_md);
  });

  it("falls back to English when there is no Hindi object at all", () => {
    const untranslated = { title: "Integers", body_md: "An integer is...", i18n: {} };
    expect(t(untranslated, "body_md", "hi")).toBe("An integer is...");
  });

  it("falls back to English when i18n is null, a string, or an array", () => {
    for (const junk of [null, undefined, "hi", ["hi"], 42]) {
      const row = { title: "Integers", i18n: junk };
      expect(t(row, "title", "hi")).toBe("Integers");
    }
  });

  it("treats a blank or whitespace-only translation as missing", () => {
    // A stale row like {"hi": {"title": ""}} must not blank the screen.
    expect(t({ title: "Integers", i18n: { hi: { title: "" } } }, "title", "hi")).toBe(
      "Integers",
    );
    expect(
      t({ title: "Integers", i18n: { hi: { title: "   " } } }, "title", "hi"),
    ).toBe("Integers");
  });

  it("ignores a non-string translation rather than rendering [object Object]", () => {
    expect(
      t({ title: "Integers", i18n: { hi: { title: { x: 1 } } } }, "title", "hi"),
    ).toBe("Integers");
  });

  it("never reads the wrong locale's bucket", () => {
    const row = { title: "Integers", i18n: { mr: { title: "पूर्णांक (मराठी)" } } };
    expect(t(row, "title", "hi")).toBe("Integers");
  });
});

describe("tChoices", () => {
  const question = {
    choices: [
      { id: "a", label: "$\\frac{2}{3}$" },
      { id: "b", label: "$\\frac{2}{4}$" },
    ],
    i18n: {
      hi: {
        choices: [
          { id: "a", label: "$\\frac{2}{3}$ (हिंदी)" },
          { id: "b", label: "$\\frac{2}{4}$ (हिंदी)" },
        ],
      },
    },
  };

  it("translates labels and leaves ids untouched", () => {
    const out = tChoices(question, "hi");
    // The id is what gets graded. If translation could change it, a Hindi
    // learner's correct answer would grade wrong.
    expect(out.map((c) => c.id)).toEqual(["a", "b"]);
    expect(out[0].label).toContain("हिंदी");
  });

  it("keeps the English label for any choice the Hindi set omits", () => {
    const partial = {
      ...question,
      i18n: { hi: { choices: [{ id: "a", label: "सिर्फ़ ये" }] } },
    };
    const out = tChoices(partial, "hi");
    expect(out[0].label).toBe("सिर्फ़ ये");
    expect(out[1].label).toBe("$\\frac{2}{4}$");
  });

  it("returns the full English set when the Hindi choices are malformed", () => {
    const broken = { ...question, i18n: { hi: { choices: "not an array" } } };
    expect(tChoices(broken, "hi")).toEqual(question.choices);
  });

  it("does not invent choices the English set does not have", () => {
    const extra = {
      ...question,
      i18n: { hi: { choices: [{ id: "z", label: "भूत विकल्प" }] } },
    };
    expect(tChoices(extra, "hi").map((c) => c.id)).toEqual(["a", "b"]);
  });
});
