import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/siteUrl";

/**
 * GET /api/auth/google — starts the Google OAuth dance (D2, the primary path).
 *
 * Server-side rather than a browser `signInWithOAuth()` call, for two reasons:
 *   - it keeps every auth entry point on a route handler, so there is one place
 *     to rate-limit and log
 *   - the PKCE code verifier is written as an httpOnly cookie by the SSR client
 *     here, instead of living in browser storage
 *
 * `skipBrowserRedirect` gets us the URL to redirect to ourselves.
 */
export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      // MUST be an absolute URL on the deployed origin and MUST be in Supabase's
      // redirect allow-list. A wrong value here fails silently — the learner is
      // bounced to localhost and just sees nothing happen.
      redirectTo: `${siteUrl()}/auth/callback`,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    console.error("[auth/google]", error?.message);
    return NextResponse.redirect(`${siteUrl()}/login?error=oauth`);
  }

  return NextResponse.redirect(data.url);
}
