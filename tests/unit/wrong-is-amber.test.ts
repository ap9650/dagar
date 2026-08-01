import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Design rule 3, which the design system calls non-negotiable:
 *
 *     A wrong answer is amber, never red. Red is reserved exclusively for
 *     genuine system errors — a failed request, a lost connection.
 *
 * The reason is not aesthetic. A learner who is already behind, studying in a
 * second language, must never see the colour of danger because they mixed up a
 * sign. Amber says "not yet"; red says "you failed".
 *
 * This is asserted against the SOURCE rather than a rendered screenshot on
 * purpose. It is a rule about which token a future edit is allowed to reach for,
 * and the failure mode it guards against is somebody "improving" the wrong-answer
 * state by making it look more like an error — which is the intuitive change to
 * make and the wrong one. A screenshot test would catch that too, but would not
 * say why it was wrong.
 *
 * The E2E demo path cannot cover this: practice serves multiple-choice questions
 * whose correct answer the browser is never allowed to know (D3), so whether a
 * given run lands on the wrong-answer state is not deterministic.
 */

const FEEDBACK = readFileSync("components/learn/FeedbackPanel.tsx", "utf8");
const TOKENS = readFileSync("app/globals.css", "utf8");

describe("wrong answers are amber, never red", () => {
  it("defines amber and red as different, contrast-checked tokens", () => {
    expect(TOKENS).toMatch(/--color-notquite:\s*#b45309/i);
    expect(TOKENS).toMatch(/--color-error:\s*#b91c1c/i);
  });

  it("marks the error token as system-failures-only where it is defined", () => {
    // The comment is load-bearing: it is what a future reader sees at the moment
    // they are choosing between the two.
    const errorLine = TOKENS.split("\n").find((l) => l.includes("--color-error:"));
    expect(errorLine).toMatch(/system failures only/i);
  });

  it("the feedback panel never reaches for the error token", () => {
    // The panel is the ONLY place a wrong answer is rendered. If `error` ever
    // appears here, a learner is being shown the colour of danger for a sign
    // mistake.
    expect(FEEDBACK).not.toMatch(/\berror\b/);
    expect(FEEDBACK).not.toMatch(/text-red|bg-red|#b91c1c/i);
  });

  it("the feedback panel styles the wrong state with the amber tokens", () => {
    expect(FEEDBACK).toMatch(/notquite/);
  });

  it("never leaves a wrong answer without a next step", () => {
    // Design system: "Never leave an incorrect state without a next step on
    // screen." The panel must render hints or a solution, not just a verdict.
    expect(FEEDBACK).toMatch(/hints/);
  });
});
