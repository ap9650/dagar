import { redirect } from "next/navigation";
import { getCurrentProfile, getCurrentUser } from "@/lib/supabase/server";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * THIS IS THE AUTH BOUNDARY for every learner route.
 *
 * `proxy.ts` also redirects signed-out users away from /learn, but that is an
 * optimistic UX shortcut and Next 16's own docs say proxy "should not be used as
 * a full session management or authorization solution". This layout is the check
 * that actually holds:
 *
 *   - it runs on the server, before any child renders, so there is no flash of
 *     protected content
 *   - it uses getUser(), which revalidates the token with Supabase, not
 *     getSession(), which trusts the cookie
 *   - it enforces role, so a parent cannot wander into the learner app
 *
 * And behind even this: RLS. If this layout were deleted tomorrow, a learner
 * still could not read another learner's rows.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export default async function LearnLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) redirect("/login");

  // Cached for the request, so the page below re-reads this row for free.
  const profile = await getCurrentProfile();

  // Authenticated with no profile: onboarding was interrupted. A real state, not
  // an error — finish it rather than dead-ending them in an empty dashboard.
  if (!profile) redirect("/onboarding/grade");
  if (profile.role === "parent") redirect("/parent");

  return <>{children}</>;
}
