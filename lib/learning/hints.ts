/**
 * The hint ladder.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE LADDER, as of slice 2.3
 *
 *   tier 1  nudge        — name the idea they need, or ask what they tried
 *   tier 2  method       — one step of the working, not all of it
 *   tier 3  worked step  — that step actually done, arithmetic shown
 *   then    the full solution from `solution_md`
 *
 * Tiers 1–3 are AI-generated and grounded in the question (`POST /api/hints`).
 * `methodHint` below is the DETERMINISTIC FALLBACK for when that call fails: a
 * learner on a dropped connection still gets a next step instead of a dead end.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * THE RULE THAT DECIDES *WHEN* A HINT IS OFFERED, and it is not cosmetic:
 *
 * A hint is shown **only after a wrong answer**, never before the first attempt.
 *
 * The tier-1 hint is the opening line of the worked solution, and in real seeded
 * content that line sometimes carries the answer inside it — "the bottom went from
 * 3 to 9, so it was multiplied by 3" is a method sentence *and* a giveaway for the
 * question whose answer is 3. Offering that before the learner has tried costs
 * them the thinking the question exists to provoke, and quietly inflates the
 * correctness rate that mastery is computed from.
 *
 * After a wrong answer the same sentence is exactly what a good tutor says next.
 * Same text, different moment, opposite value.
 */

/**
 * How many hint rungs exist before the full worked solution.
 *
 * D6 rule 2 ("all hints exhausted") compares `hints_used` against this, and the
 * attempts route uses it to decide when the worked solution is released. It is
 * exported rather than written as a literal anywhere else, which is why raising
 * it from 1 to 3 in this slice moved both of those behaviours in step.
 */
export const HINT_TIERS = 3;

/**
 * The first rung: the opening move of the worked solution, without the rest of it.
 *
 * Takes the first paragraph of `solution_md`. Seeded solutions are authored as a
 * METHOD (`saathi-content`), so the first paragraph is reliably the approach —
 * "first find 1/3 of ₹60", "this one runs backwards" — rather than the answer.
 *
 * Returns an empty string when there is nothing usable, and the caller falls
 * straight through to the full solution. A blank hint panel would be a dead end,
 * and a learner who has just answered wrongly is the last person to leave with one.
 */
export function methodHint(solutionMd: string): string {
  if (typeof solutionMd !== "string") return "";

  const paragraphs = solutionMd
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);

  const first = paragraphs[0] ?? "";

  // A display-maths block on its own is a result, not a method — "$$12 ÷ 4 = 3$$"
  // as an opening hint just hands over the working. Fall through to the solution.
  if (/^\$\$[\s\S]*\$\$$/.test(first)) return "";

  return first;
}
