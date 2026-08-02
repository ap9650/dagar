import { describe, expect, it } from "vitest";
import { stepSpeech, toSpeakable } from "@/lib/learning/speakable";

/**
 * A bad reading is only audible if someone happens to be listening, which makes
 * this the easiest thing in the slice to ship broken. Every case below is a
 * string that actually appears in the Class 6 curriculum.
 */

describe("toSpeakable — maths is spoken, not read", () => {
  it("says a fraction the way a classroom says it", () => {
    expect(toSpeakable("We write that as $1/4$.", "en")).toContain("1 by 4");
    expect(toSpeakable("इसे हम $1/4$ लिखते हैं।", "hi")).toContain("1 बटा 4");
  });

  it("never leaves a dollar sign to be read aloud", () => {
    // The whole reason this module exists: "dollar 1 slash 4 dollar".
    for (const lang of ["en", "hi"] as const) {
      expect(toSpeakable("So $1/5 + 2/5$ is what?", lang)).not.toContain("$");
    }
  });

  it("unpacks a stacked \\frac", () => {
    expect(toSpeakable("$\\frac{3}{8}$ of the roti", "en")).toContain("3 by 8");
  });

  it("handles display maths, which is two spans if you are careless", () => {
    const spoken = toSpeakable("$$\n\\frac{2}{5} = \\frac{3}{5}\n$$", "en");
    expect(spoken).toContain("2 by 5");
    expect(spoken).toContain("equals");
    expect(spoken).toContain("3 by 5");
  });

  it("reads the comparison symbols", () => {
    expect(toSpeakable("$5/7 > 3/7$", "en")).toContain("is greater than");
    expect(toSpeakable("$5/7 > 3/7$", "hi")).toContain("से बड़ा");
  });

  it("reads a unicode minus, which Class 7 is full of", () => {
    expect(toSpeakable("$9/12 − 4/12$", "en")).toContain("minus");
  });

  it("reads the fill-in-the-box placeholder as a question, not a shape", () => {
    expect(toSpeakable("$2/5 = \\square/15$", "en")).toContain("what");
    expect(toSpeakable("$2/5 = \\square/15$", "hi")).toContain("कितना");
  });
});

describe("toSpeakable — prose stays prose", () => {
  it("does NOT turn ordinary hyphens and dashes into the word minus", () => {
    // The trap: applying the symbol table globally. This sentence is from the
    // real curriculum and contains an em-dash.
    const spoken = toSpeakable("Not easily — the pieces are different sizes.", "en");
    expect(spoken).not.toContain("minus");
    expect(spoken).toContain("the pieces are different sizes");
  });

  it("strips bold and italic rather than spelling out asterisks", () => {
    const spoken = toSpeakable("The parts have to be **equal**, or it is *not* a fraction.", "en");
    expect(spoken).not.toContain("*");
    expect(spoken).toContain("equal");
    expect(spoken).toContain("not");
  });

  it("keeps Devanagari untouched", () => {
    const spoken = toSpeakable("हिस्से **बराबर** होने चाहिए।", "hi");
    expect(spoken).toBe("हिस्से बराबर होने चाहिए।");
  });

  it("collapses the whitespace a substitution leaves behind", () => {
    expect(toSpeakable("$1/2$   and   $1/4$", "en")).not.toMatch(/ {2}/);
  });

  it("does not leave a gap before punctuation", () => {
    // "We write that as 1 by 4 ." — a reader ignores it; a speech engine puts a
    // beat there and the sentence ends hanging.
    expect(toSpeakable("We write that as $1/4$.", "en")).toMatch(/1 by 4\.$/);
    expect(toSpeakable("इसे $1/4$ लिखते हैं।", "hi")).not.toMatch(/ ।/);
  });

  it("leaves plain text completely alone", () => {
    const plain = "One roti. Four people. Nobody gets a whole one.";
    expect(toSpeakable(plain, "en")).toBe(plain);
  });
});

describe("stepSpeech", () => {
  it("prefers an authored speak string", () => {
    expect(stepSpeech({ md: "$1/4$", speak: "one quarter" }, "en")).toBe("one quarter");
  });

  it("withholds a reveal's answer until it has been revealed", () => {
    const step = { md: "How much is left?", answer: "3 parts out of 5." };
    expect(stepSpeech(step, "en")).not.toContain("3 parts");
    expect(stepSpeech(step, "en", { includeAnswer: true })).toContain("3 parts");
  });

  it("never returns something empty for a real step", () => {
    expect(stepSpeech({ md: "One roti. Four people." }, "en").length).toBeGreaterThan(0);
  });
});
