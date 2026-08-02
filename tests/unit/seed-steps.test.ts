import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { chapters } from "@/supabase/seed";
import { mergeStepText, parseSteps, type StepText } from "@/lib/learning/lessonSteps";

/**
 * The authored curriculum, checked at test time rather than seed time.
 *
 * `parseSteps` already protects the learner — a bad blob falls back to prose.
 * But that fallback is silent by design, so without this the failure mode is:
 * an author makes a typo, the lesson quietly reverts to the wall of text D18
 * exists to remove, and nobody finds out until someone reads it on a phone.
 *
 * This turns that into a red test.
 */

const hi = JSON.parse(
  readFileSync(new URL("../../supabase/seed/translations/hi.json", import.meta.url), "utf8"),
) as Record<string, { steps?: StepText[] }>;

const stepped = chapters.flatMap((chapter) =>
  chapter.lessons.filter((lesson) => lesson.steps).map((lesson) => [lesson.slug, lesson] as const),
);

describe("authored lesson steps", () => {
  it("has at least one stepped lesson — otherwise this file is asleep", () => {
    expect(stepped.length).toBeGreaterThan(0);
  });

  it.each(stepped)("%s passes validation", (_slug, lesson) => {
    expect(parseSteps(lesson.steps)).not.toBeNull();
  });

  it.each(stepped)("%s keeps body_md as the fallback", (_slug, lesson) => {
    // Steps are additive. A lesson that dropped its prose has no safe state to
    // fall back to when a step fails to validate.
    expect(lesson.body_md.trim().length).toBeGreaterThan(0);
  });

  it.each(stepped)("%s respects the ≤25-word contract", (_slug, lesson) => {
    for (const step of lesson.steps!) {
      expect(step.md.split(/\s+/).length, `"${step.md}"`).toBeLessThanOrEqual(25);
    }
  });

  it.each(stepped)("%s never runs three passive steps in a row", (_slug, lesson) => {
    // Contract C4. The whole point is that a learner does something; three
    // read-only screens together is the old lesson wearing a progress bar.
    const passive = lesson.steps!.map((s) => s.kind === "see");
    for (let i = 0; i + 2 < passive.length; i++) {
      expect(passive[i] && passive[i + 1] && passive[i + 2], `steps ${i + 1}–${i + 3}`).toBe(false);
    }
  });

  it.each(stepped)("%s shows a diagram before it writes the notation", (_slug, lesson) => {
    // Concrete → Pictorial → Abstract. The first step that contains fraction
    // notation must not come before the first step that draws something.
    const firstViz = lesson.steps!.findIndex((s) => "viz" in s && s.viz);
    const firstNotation = lesson.steps!.findIndex((s) => /\$[^$]*\/[^$]*\$/.test(s.md));
    if (firstNotation !== -1) {
      expect(firstViz, "a diagram must come first").not.toBe(-1);
      expect(firstViz).toBeLessThanOrEqual(firstNotation);
    }
  });

  it.each(stepped)("%s has Hindi for every step, or none", (_slug, lesson) => {
    const text = hi[lesson.slug]?.steps;
    if (!text) return; // not translated yet is a valid state
    expect(
      mergeStepText(lesson.steps!, text),
      `Hindi has ${text.length} step texts for ${lesson.steps!.length} steps`,
    ).not.toBeNull();
  });

  it.each(stepped)("%s Hindi still validates after the merge", (_slug, lesson) => {
    const text = hi[lesson.slug]?.steps;
    if (!text) return;
    const merged = mergeStepText(lesson.steps!, text);
    expect(parseSteps(merged)).not.toBeNull();
  });

  it.each(stepped)("%s Hindi uses Arabic numerals, never Devanagari (D16)", (_slug, lesson) => {
    const text = hi[lesson.slug]?.steps ?? [];
    for (const step of text) {
      for (const value of [step.md, step.answer, step.why, ...(step.lines ?? [])]) {
        if (value) expect(value, value).not.toMatch(/[०-९]/);
      }
    }
  });
});
