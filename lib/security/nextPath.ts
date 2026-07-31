/**
 * Where to send someone after they sign in.
 *
 * `proxy.ts` puts the path they were heading for in `?next=`, and both the login
 * page and the auth form read it back. That is ordinary, and it is also the
 * classic **open redirect**: an attacker sends a learner a link to
 * `/login?next=https://evil.example/looks-like-saathi`, the learner signs in
 * genuinely, and the app itself delivers them to a copy of the login screen that
 * captures whatever they type next.
 *
 * So the value is never trusted as given. Only a path within this app survives:
 * one leading slash, no scheme, no host, no protocol-relative `//evil.example`.
 * Anything else falls back to `/`, which routes by role and is always correct.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (typeof next !== "string" || next.length === 0) return fallback;

  // Must be a rooted path. `//host` is protocol-relative and would leave the
  // site, which is exactly what a reader skims past.
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;

  // `/\evil.example` is treated as protocol-relative by some browsers.
  if (next.startsWith("/\\")) return fallback;

  // A scheme anywhere means it is not the simple path it is pretending to be.
  if (/^\/[^/]*:/.test(next)) return fallback;

  return next;
}
