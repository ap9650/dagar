/**
 * The app's own origin, e.g. `https://saathi-ap19.vercel.app`.
 *
 * Needed for the OAuth `redirectTo` and the parent-summary deep link. A wrong
 * value here is the failure mode the auth spec calls out explicitly: Google
 * bounces the learner to the wrong host and nothing visibly happens.
 *
 * Resolution order, most explicit first:
 *
 *   1. NEXT_PUBLIC_SITE_URL           — what we set in the Vercel dashboard
 *   2. VERCEL_PROJECT_PRODUCTION_URL  — Vercel's own stable production domain
 *   3. VERCEL_URL                     — the per-deployment URL (preview builds)
 *   4. http://localhost:3000          — local dev
 *
 * Steps 2 and 3 exist so a preview deployment, or a production deploy where
 * somebody forgot the env var, still gets a working absolute URL rather than
 * silently sending users to localhost.
 */
export function siteUrl(): string {
  const candidate =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    "http://localhost:3000";

  // Vercel's variables carry a bare host with no scheme.
  const withScheme = /^https?:\/\//.test(candidate)
    ? candidate
    : `https://${candidate}`;

  return withScheme.replace(/\/+$/, "");
}
