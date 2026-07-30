/**
 * The hint ladder.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHERE THIS SITS RIGHT NOW (slice 2.2)
 *
 * One deterministic rung, taken from the seeded `solution_md`. Slice 2.3 replaces
 * it with three AI-generated tiers from `POST /api/hints` (see `ai-tutor.md`), at
 * which point `HINT_TIERS` becomes 3 and `methodHint` becomes the offline
 * fallback. Nothing else has to change: `hints_used` is already plumbed through
 * the attempt contract and already feeds D6 rule 2.
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
 * D6 rule 2 ("all hints exhausted") compares `hints_used` against this, so it is
 * exported rather than written as a literal anywhere else. Slice 2.3 raises it to
 * 3 and the struggle trigger follows automatically.
 */
export const HINT_TIERS = 1;

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
