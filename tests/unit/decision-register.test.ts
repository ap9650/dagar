import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The PRD's decision register lists every decision.
 *
 * ── WHY THIS IS A TEST ──────────────────────────────────────────────────────
 * An index nobody maintains is worse than no index, because it looks complete.
 * The register exists because D20 — practice fires at a concept boundary, not
 * after every lesson — was live from the first week and written down ONLY in a
 * comment in `lib/learning/nextStep.ts`.
 *
 * The product behaved correctly and consistently. But on screen, one lesson
 * ended with "Next lesson" and the next with "Practise this", and there was no
 * document anywhere that could tell those two cases apart from a bug. It was
 * reported as one, twice.
 *
 * **A decision that exists only in code is indistinguishable from an accident.**
 * So the moment someone adds a decision to DECISIONS.md and forgets the
 * register, this fails and names the missing number.
 */
const ROOT = join(__dirname, "..", "..");
const decisions = readFileSync(join(ROOT, "docs/DECISIONS.md"), "utf8");
const prd = readFileSync(join(ROOT, "docs/PRD.md"), "utf8");

/** `## D7b — Milestones…` → `D7b`. Letter suffixes are real (D7b, D17b). */
function decisionIds(markdown: string): string[] {
  return [...markdown.matchAll(/^## (D\d+[a-z]?)\s*—/gm)].map((m) => m[1]);
}

/** `| D7b | Milestones | … |` → `D7b`. */
function registerIds(markdown: string): string[] {
  const start = markdown.indexOf("### The register");
  if (start === -1) return [];
  const section = markdown.slice(start, markdown.indexOf("### What this register is for", start));
  return [...section.matchAll(/^\|\s*(D\d+[a-z]?)\s*\|/gm)].map((m) => m[1]);
}

describe("the PRD decision register", () => {
  const inDecisions = decisionIds(decisions);
  const inRegister = registerIds(prd);

  it("finds decisions in both documents at all", () => {
    // Guards the parsers themselves: a heading style change that broke the
    // regex would otherwise make every assertion below pass on empty arrays.
    expect(inDecisions.length).toBeGreaterThan(15);
    expect(inRegister.length).toBeGreaterThan(15);
  });

  it("lists every decision that exists", () => {
    const missing = inDecisions.filter((id) => !inRegister.includes(id));
    expect(missing, `absent from the PRD register: ${missing.join(", ")}`).toEqual([]);
  });

  it("invents none that do not", () => {
    const phantom = inRegister.filter((id) => !inDecisions.includes(id));
    expect(phantom, `in the register with no decision behind it: ${phantom.join(", ")}`).toEqual([]);
  });

  it("keeps DECISIONS.md as the place the reasoning lives", () => {
    // The split is the point — see the register's own preamble. If the PRD ever
    // becomes the source of truth this line has to be revisited deliberately,
    // not drifted into.
    expect(prd).toMatch(/`DECISIONS\.md` wins/);
  });
});
