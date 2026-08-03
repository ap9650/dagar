import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { chapters } from "@/supabase/seed";
import {
  mergeStepText,
  parseSteps,
  type LessonStep,
  type StepText,
} from "@/lib/learning/lessonSteps";

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


/**
 * A LaTeX command in a TypeScript string literal needs a DOUBLE backslash.
 *
 * Written with one, `\\times` is not a command: `\\t` is a TAB, so it becomes a
 * tab followed by "imes" and the lesson renders `(-4)imes2 = -8`. `\\div` fares
 * no better — an unknown escape drops its backslash and the reader gets "div".
 *
 * Found by looking at a screenshot, which is a slow way to catch what a string
 * check catches instantly. Nothing throws either way; the maths is just quietly
 * wrong on screen.
 *
 * The check runs INSIDE `$…$` spans only. English prose says "three times a
 * number" perfectly legitimately, and a guard that fails on real copy is a guard
 * someone deletes.
 */
describe("authored step text survives TypeScript escaping", () => {
  const COMMANDS = /(?<!\\)\b(times|div|frac|square|neq|ldots|checkmark)\b/;

  function everyString(lesson: { steps?: LessonStep[] }): string[] {
    return (lesson.steps ?? []).flatMap((step) => [
      step.md,
      // `tap` also has an `answer`, but there it is an option INDEX.
      ...("answer" in step && typeof step.answer === "string" ? [step.answer] : []),
      ...("why" in step && step.why ? [step.why] : []),
      ...("lines" in step ? step.lines : []),
      ...("options" in step ? step.options.flatMap((o) => (o.label ? [o.label] : [])) : []),
    ]);
  }

  it.each(stepped)("%s has no control character in any step", (_slug, lesson) => {
    for (const text of everyString(lesson)) {
      const control = [...text].filter((ch) => ch.charCodeAt(0) < 32);
      expect(control, JSON.stringify(text)).toEqual([]);
    }
  });

  it.each(stepped)("%s keeps the backslash on every LaTeX command", (_slug, lesson) => {
    for (const text of everyString(lesson)) {
      for (const [, math] of text.matchAll(/\$([^$]+)\$/g)) {
        expect(COMMANDS.test(math), `${JSON.stringify(text)} → ${math}`).toBe(false);
      }
    }
  });

  it.each(stepped)("%s has no DOUBLE backslash inside inline maths", (_slug, lesson) => {
    // The other half of the same mistake, and the half that slipped past the
    // check above: over-escaping gives the value `\\\\times`, whose backslash
    // satisfies "has a backslash" while LaTeX reads `\\\\` as a LINE BREAK and
    // renders the word "times" as italic text. There is no line break inside
    // `$…$` anywhere in this curriculum, so any is a mistake.
    for (const text of everyString(lesson)) {
      for (const [, math] of text.matchAll(/\$([^$]+)\$/g)) {
        expect(math.includes("\\\\"), `${JSON.stringify(text)} → ${math}`).toBe(false);
      }
    }
  });
});

/**
 * A QUESTION MARK IS A PROMISE.
 *
 * Only three step kinds can keep it. `reveal` hides the answer behind "Show me",
 * `tap` marks a choice, and `worked` walks the solution line by line. A `see`
 * step has no answer, no input and no reveal — it renders prose and a diagram,
 * and Continue moves on.
 *
 * So a `see` step ending in a question mark asks a learner something and then
 * changes the subject. Class 8 opened with exactly that: "3 pens and a ₹5 eraser
 * cost ₹35. What does one pen cost?" — and nothing in the lesson ever said ₹10.
 * A learner who worked it out was never told they were right; one who could not
 * was never told anything at all. Reported from a phone, on the very first
 * screen of the chapter.
 *
 * This is a CONTENT rule, not a schema one: the parser cannot know that prose
 * ends in a question, and a lesson that trips it is still valid and still
 * renders. It just quietly fails the learner.
 */
describe("no step asks a question it cannot answer", () => {
  const ANSWERING = new Set(["reveal", "tap", "worked"]);

  const steps = chapters.flatMap((chapter) =>
    chapter.lessons.flatMap((lesson) =>
      (lesson.steps ?? []).map(
        (step, i) => [`${lesson.slug} step ${i + 1}`, step] as const,
      ),
    ),
  );

  it("has stepped lessons to check", () => {
    expect(steps.length).toBeGreaterThan(0);
  });

  it.each(steps)("%s resolves its own question", (_where, step) => {
    if (!/\?\s*$/.test(step.md.trim())) return;
    expect(
      ANSWERING.has(step.kind),
      `a "${step.kind}" step cannot answer: ${JSON.stringify(step.md)}`,
    ).toBe(true);
  });
});
