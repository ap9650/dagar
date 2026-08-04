/**
 * Leaving Dagar — the shared vocabulary for the delete flow.
 *
 * Kept in its own file because three places need it and none of them should
 * import from the others: the DELETE route sets the cookie, `/welcome` reads it
 * to decide whether to say goodbye, and the reason route checks it before
 * writing a row.
 */

/**
 * Set when an account is deleted; cleared when a reason is given or after 30
 * minutes. Proves "this browser just deleted an account" and nothing else — no
 * identity, and nothing that could reconnect a reason to a person.
 */
export const EXIT_COOKIE = "dagar_exit";

/**
 * The reasons a learner can pick, in the order they are shown.
 *
 * ── WHY THESE, AND WHY A FIXED LIST ─────────────────────────────────────────
 * A fixed enum rather than a text box. A learner leaving in frustration is
 * exactly the person who might type their name, their school or their teacher
 * into a box, and a box we then keep would undo the anonymity the whole flow is
 * built for.
 *
 * The wording is about the PRODUCT, never about the learner. "It was too hard"
 * — not "I found it too hard". Someone who is leaving because they could not
 * follow it should not have to describe themselves as the problem on the way
 * out; that is the same instinct as amber-not-red.
 *
 * `too_easy` earns its place beside `too_hard`: without it every difficulty
 * complaint collapses into one direction, and "this is beneath me" is a real
 * reason a Class 8 learner leaves.
 * ────────────────────────────────────────────────────────────────────────────
 */
export const EXIT_REASONS = [
  "too_hard",
  "too_easy",
  "confusing",
  "not_useful",
  "duplicate",
  "other",
] as const;

export type ExitReason = (typeof EXIT_REASONS)[number];

export function isExitReason(value: unknown): value is ExitReason {
  return typeof value === "string" && (EXIT_REASONS as readonly string[]).includes(value);
}
