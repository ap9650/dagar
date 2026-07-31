/**
 * Tokens for the no-account summary link (migration 0014).
 *
 * A parent link CODE is six characters because a child reads it out loud. This
 * token is the opposite: it is never typed, only tapped, so it is sized for the
 * one property that matters — **it must not be guessable**.
 *
 * 32 characters from a 64-character alphabet is 192 bits. There is no rate limit
 * standing behind this the way there is behind the 6-character code, because
 * there is no account to key one to — the token has to carry the whole burden,
 * and at 192 bits it comfortably does.
 */

/** URL-safe, and no padding to strip. */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export const SHARE_TOKEN_LENGTH = 32;

/** Matches the check constraint on `summary_links.token` (24–64 chars). */
export const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{24,64}$/;

export function generateShareToken(): string {
  const bytes = new Uint8Array(SHARE_TOKEN_LENGTH);
  crypto.getRandomValues(bytes);

  let token = "";
  // 256 / 64 = 4 exactly, so the modulo is unbiased. Keep the alphabet at 64 if
  // you change it, or switch to rejection sampling.
  for (const byte of bytes) token += ALPHABET[byte % ALPHABET.length];
  return token;
}

/**
 * Is this a token shape at all?
 *
 * Checked before the database is touched: a token arrives in a URL path, and a
 * path segment can contain anything. This turns "someone pasted a novel into the
 * URL" into a 404 rather than a query.
 */
export function isShareTokenShape(value: unknown): value is string {
  return typeof value === "string" && SHARE_TOKEN_PATTERN.test(value);
}

/** 90 days, per migration 0014. */
export function isShareLinkExpired(expiresAt: string, now: Date = new Date()): boolean {
  const expires = new Date(expiresAt).getTime();
  if (Number.isNaN(expires)) return true; // unparseable is expired — fail closed
  return now.getTime() > expires;
}
