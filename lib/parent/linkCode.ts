/**
 * Parent link codes (D2).
 *
 * A learner reads this code out loud to a parent, or sends it over WhatsApp. It
 * is the only thing standing between a stranger and a child's learning data, so
 * two properties matter more than elegance:
 *
 *   1. it must be **hard to guess** — see the alphabet and the rate limit
 *   2. it must be **easy to say and retype** — see what is missing from it
 *
 * Those pull against each other, and (2) wins on the character set while (1) is
 * carried by the rate limit on redemption. A code nobody can dictate over a noisy
 * phone line is a feature that does not get used.
 */

/**
 * 32 characters: A–Z and 2–9, minus the pairs people confuse when reading aloud
 * or copying from a screen.
 *
 * Dropped: **O** and **0**, **I**, **1** and **L**. On a cheap LCD at low
 * brightness these are genuinely ambiguous, and the failure mode is a parent
 * typing a code that "does not work" with no idea why — which reads as the app
 * being broken rather than as a typo.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export const LINK_CODE_LENGTH = 6;

/**
 * How long a code stays claimable. **72 hours.**
 *
 * D2 requires codes to expire. The number is a judgement: long enough that a
 * learner can show a parent who gets home late tomorrow, short enough that a code
 * written on a shared notebook page is not a permanent key to a child's account.
 */
export const LINK_CODE_TTL_HOURS = 72;

/**
 * A fresh code.
 *
 * `crypto.getRandomValues`, not `Math.random()`. `Math.random()` is seeded from
 * observable state and is predictable to anyone who cares to work at it — which
 * for a 6-character code guarding a child's data is not a theoretical objection.
 *
 * The modulo is unbiased here because 256 is divisible by 32: every byte maps to
 * exactly 8 of the alphabet's characters. Change the alphabet length away from a
 * power of two and this needs rejection sampling instead.
 */
export function generateLinkCode(): string {
  const bytes = new Uint8Array(LINK_CODE_LENGTH);
  crypto.getRandomValues(bytes);

  let code = "";
  for (const byte of bytes) code += ALPHABET[byte % ALPHABET.length];
  return code;
}

/**
 * Normalise what a parent typed: uppercase, and drop spaces and hyphens.
 *
 * ── WHAT THIS DELIBERATELY DOES NOT DO ──────────────────────────────────────
 * It does not "helpfully" fold ambiguous characters — `0`→`O`, `1`→`J` and so on.
 * That was the first version and it is a bad idea twice over.
 *
 * Those characters are not in the alphabet, so any of them is certainly a
 * misread — but *which* character was misread is a guess. Guessing maps the
 * parent's typo onto a **different valid code**, which could be another family's.
 * A normalisation that can turn one household's typo into another household's
 * link is not a convenience.
 *
 * And it buys nothing: the parent sees "that code did not work", looks again,
 * and retypes. The unambiguous alphabet above is what prevents the misread in
 * the first place; this function's job is only to forgive formatting.
 * ────────────────────────────────────────────────────────────────────────────
 */
export function normaliseLinkCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[\s-]+/g, "")
    .slice(0, LINK_CODE_LENGTH);
}

/** Has this code passed its 72 hours? */
export function isLinkCodeExpired(createdAt: string, now: Date = new Date()): boolean {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return true; // unparseable is expired — fail closed
  return now.getTime() - created > LINK_CODE_TTL_HOURS * 60 * 60 * 1000;
}

/** Hours left on a code, floored at 0. For the "expires in N hours" line. */
export function linkCodeHoursLeft(createdAt: string, now: Date = new Date()): number {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return 0;
  const msLeft = LINK_CODE_TTL_HOURS * 60 * 60 * 1000 - (now.getTime() - created);
  return Math.max(0, Math.ceil(msLeft / (60 * 60 * 1000)));
}
