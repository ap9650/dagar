import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * Runs as the SIGNED-IN USER, so every query is subject to RLS. That is the
 * point: this client is what makes the policies in supabase/migrations load
 * bearing. If a query returns nothing you did not expect, the answer is almost
 * always a policy — do not "fix" it by switching to the admin client.
 *
 * Never import this into a Client Component.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components cannot write cookies. This throw is expected and
            // safe to swallow *because* proxy.ts refreshes the session on every
            // request — see proxy.ts. If you ever remove that, sessions will
            // stop refreshing here silently.
          }
        },
      },
    },
  );
}

/**
 * The signed-in user, or null — **once per request, however many callers ask.**
 *
 * ── WHY THIS IS CACHED ──────────────────────────────────────────────────────
 * `auth.getUser()` is not a cookie read. It revalidates the token against
 * Supabase's auth server, which is a network round trip, and that is exactly
 * why it is the right function to call rather than `getSession()`.
 *
 * But it was being called TWICE on the way to every learner screen: once by the
 * route-group layout, which is the auth boundary, and again by the page itself.
 * Two identical round trips, one after the other, before any content query had
 * started. Measured on production: 1.4–2.8s of server time per navigation.
 *
 * React's `cache()` dedupes within a single request, so the layout and the page
 * now share one call. The security property is untouched — the token is still
 * revalidated, just not twice for the same request.
 *
 * The client itself is deliberately NOT cached: constructing it is local work
 * with no network in it, and route handlers create one outside a React render.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Prefer this over calling `auth.getUser()` ad hoc. A direct call is a second
 * round trip that this cache cannot help with.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * The signed-in learner's profile row, or null — **once per request.**
 *
 * Same defect as `getCurrentUser` had, one layer up. The route-group layout
 * reads `profiles` to enforce role, and then `/learn`, `/progress` and
 * `/settings` each read the SAME row again for `grade` and `display_name`.
 * Two queries for one row, one after the other, on every learner screen.
 *
 * That costs more here than it looks: this project's database is in
 * `ap-northeast-1` (Tokyo) while the Vercel functions run in `bom1` (Mumbai).
 * Measured Mumbai→Tokyo is ~115ms per round trip against ~2ms same-region, so
 * a duplicated query is not a rounding error — it is a tenth of a second on
 * every navigation, spent fetching a row we already had.
 *
 * Selecting the union of the columns the four callers want (`role`,
 * `display_name`, `grade`) is what lets one row serve all of them. If you add
 * a caller that needs another column, add it here rather than writing a second
 * query — a second query is the thing this exists to remove.
 *
 * Returns null for "authenticated but no profile row", which is a real state
 * (onboarding interrupted), not an error. The layout redirects on it.
 */
export const getCurrentProfile = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("role, display_name, grade")
    .eq("id", user.id)
    .maybeSingle();

  return data;
});
