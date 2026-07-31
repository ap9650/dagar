import { describe, expect, it } from "vitest";
import {
  parentSummaryFacts,
  parentSummarySystemPrompt,
} from "@/lib/ai/prompts/parentSummary";
import type { WeeklySummary } from "@/lib/parent/summary";

/**
 * The weekly summary prompt (D4).
 *
 * The model writes the sentences; it does not produce the facts. These tests
 * guard the half we control — that every figure the model is given is labelled
 * unambiguously, and that nothing the learner is entitled to keep private is in
 * the prompt at all.
 *
 * The generated prose itself is checked by `npm run eval`, not here: asserting
 * on model output in a unit test buys flakiness, not confidence.
 */

const base: WeeklySummary = {
  learnerName: "Riya",
  grade: 6,
  lessonsThisWeek: 2,
  practiceThisWeek: 7,
  streak: { days: 2, alive: true, graceActive: false, longest: 5 },
  concepts: [
    { conceptId: "c1", name: "Fraction Basics", band: "mastered" },
    { conceptId: "c2", name: "Equivalent Fractions", band: "developing" },
  ],
  milestoneCodes: ["first_practice"],
  quiet: false,
  focus: { conceptId: "c2", name: "Equivalent Fractions", band: "developing" },
};

describe("the facts block", () => {
  it("carries every real figure", () => {
    const facts = parentSummaryFacts(base);
    expect(facts).toContain("Riya");
    expect(facts).toContain("Lessons finished this week: 2");
    expect(facts).toContain("Practice questions answered this week: 7");
    expect(facts).toContain("Fraction Basics");
    expect(facts).toContain("Equivalent Fractions");
  });

  it("labels the streak so it cannot be attached to the other counts", () => {
    // The bug this exists for: labelled "Days in a row with some learning: 2"
    // and sitting under the practice count, Haiku wrote "answered 7 practice
    // questions over 2 days" — binding two unrelated figures. A prompt rule did
    // not stop it; a self-describing label did.
    const facts = parentSummaryFacts(base);
    expect(facts).toContain("HABIT measure");
    expect(facts).toMatch(/must not be attached/i);
  });

  it("says so when there is no streak, rather than omitting it", () => {
    const noStreak = {
      ...base,
      streak: { days: 0, alive: false, graceActive: false, longest: 3 },
    };
    expect(parentSummaryFacts(noStreak)).toContain("Streak: none");
  });

  it("flags a quiet week explicitly", () => {
    const quiet: WeeklySummary = {
      ...base,
      lessonsThisWeek: 0,
      practiceThisWeek: 0,
      quiet: true,
    };
    expect(parentSummaryFacts(quiet)).toContain("QUIET WEEK");
  });

  it("tells the model what to say when there is no name", () => {
    // Left to itself it wrote "Your learner", which is not how anyone speaks.
    const anon = { ...base, learnerName: null };
    const facts = parentSummaryFacts(anon);
    expect(facts).toContain("NOT GIVEN");
    expect(facts).toContain("your child");
    expect(facts).not.toContain("Riya");
  });

  it("contains nothing the learner was promised stays private", () => {
    // The child is told a supporting adult sees counts and topics, never their
    // answers, their tutor questions, or anything they typed. The prompt is
    // where that promise would leak first — a prompt is a place data goes to be
    // logged by somebody eventually.
    //
    // Checked against FIELD NAMES, not bare words: the first version banned
    // "answer" and failed on the label "Practice questions answered this week",
    // which is the innocent use. A security test that cries wolf is one people
    // learn to skip.
    const facts = parentSummaryFacts(base);
    for (const field of [
      "given_answer",
      "answer_value",
      "solution_md",
      "learner_note",
      "tutor_excerpt",
      "tutor_messages",
    ]) {
      expect(facts).not.toContain(field);
    }
  });

  it("cannot leak private fields even if someone adds them to the summary", () => {
    // The real guarantee is structural: `parentSummaryFacts` reads named fields
    // off `WeeklySummary`, so anything smuggled onto the object is ignored
    // rather than forwarded. This proves the prompt is a whitelist, not a dump.
    const contaminated = {
      ...base,
      givenAnswers: ["3/9", "4/9"],
      tutorExcerpt: "I don't understand any of this",
      learnerNote: "please help me",
    } as unknown as WeeklySummary;

    const facts = parentSummaryFacts(contaminated);
    expect(facts).not.toContain("3/9");
    expect(facts).not.toContain("I don't understand");
    expect(facts).not.toContain("please help me");
  });
});

describe("the system prompt", () => {
  it("forbids inventing figures, in both languages", () => {
    for (const locale of ["en", "hi"] as const) {
      const prompt = parentSummarySystemPrompt(locale);
      expect(prompt).toMatch(/NEVER invent/);
      expect(prompt).toMatch(/re-frame a number/i);
    }
  });

  it("uses आप for the adult reader, not the tutor's तुम", () => {
    // HINDI_STYLE: the learner-facing tutor uses तुम; a message to a grown-up
    // uses आप. Getting this backwards is the most visible register error there
    // is in Hindi.
    const hindi = parentSummarySystemPrompt("hi");
    expect(hindi).toContain("आप");
    expect(hindi).not.toMatch(/Use \*\*तुम\*\*/);
  });

  it("pins the ergative, which the model got wrong unprompted", () => {
    const hindi = parentSummarySystemPrompt("hi");
    expect(hindi).toContain("आपके बच्चे ने");
    expect(hindi).toContain("ने");
  });

  it("keeps the message short enough to be read on a phone", () => {
    expect(parentSummarySystemPrompt("en")).toMatch(/Three sentences/);
  });
});
