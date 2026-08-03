import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * `/` — the splash. Renders nothing; it decides where you belong.
 *
 *   no session  → /welcome   language first, always
 *   session     → /learn     which sorts out role and onboarding itself
 *
 * ── WHY THIS TOUCHES NO NETWORK ─────────────────────────────────────────────
 * This is the PWA's `start_url`, so it runs on **every cold launch** — the
 * moment a learner taps the home-screen icon. It used to call `getUser()` and
 * then query `profiles` to choose between four destinations, and only then
 * issue a redirect. Three Supabase round trips, on a page that draws nothing,
 * before the real screen had even been requested.
 *
 * Measured: a launch through `/` took 1589–1906 ms against 1189–1343 ms
 * straight to `/learn`, and the difference was spent on a **blank screen** —
 * `/` has no UI to show while it thinks. That gap is what a cold start felt
 * like.
 *
 * So the decision is made from the cookie alone, with no I/O. It is allowed to
 * be wrong: this is an optimistic redirect, exactly like `proxy.ts`, and the
 * enforcing checks are unchanged. A forged or expired cookie sends you to
 * `/learn`, where the route-group layout revalidates the token properly and
 * bounces you to `/login`. A parent lands on `/learn` and is redirected to
 * `/parent`; a half-finished signup goes to `/onboarding/grade`. Every outcome
 * the four-way branch used to produce still happens — one screen later, and
 * without paying for it on every launch.
 *
 * `start_url` stays `/` rather than becoming `/learn`: a signed-out learner
 * must still meet the language picker first (D16), and that is the one thing
 * pointing the icon straight at `/learn` would take away.
 * ────────────────────────────────────────────────────────────────────────────
 */
export default async function RootPage() {
  const store = await cookies();

  // Supabase SSR writes `sb-<project-ref>-auth-token`, and chunks it across
  // `.0`, `.1`… when it outgrows a single cookie. Match the family, not an
  // exact name, so a chunked session is not read as "signed out".
  const signedIn = store
    .getAll()
    .some((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name) && c.value.length > 0);

  redirect(signedIn ? "/learn" : "/welcome");
}
