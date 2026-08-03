import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/database.types";
import { LOCALE_COOKIE } from "@/i18n/config";

/**
 * Next.js 16 renamed `middleware` to `proxy`. Same file location, same job.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THIS IS NOT THE AUTH BOUNDARY.
 *
 * Next 16's own docs: proxy "should not be used as a full session management or
 * authorization solution." It does two things here:
 *
 *   1. Refreshes the Supabase session cookie so Server Components and Route
 *      Handlers always see a valid session. (lib/supabase/server.ts cannot write
 *      cookies from an RSC — this is what keeps sessions alive.)
 *   2. Redirects signed-out users away from app routes, for UX only.
 *
 * The ENFORCING checks are:
 *   - the (learn) / (parent) layout server components, which read the session
 *     and redirect before rendering anything
 *   - requireAuth() in every route handler
 *
 * If you ever find yourself relying on this file to keep one learner out of
 * another learner's data, stop: RLS plus the layout guard is what does that.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const PROTECTED = [
  "/learn",
  "/practice",
  "/quiz",
  "/progress",
  "/settings",
  "/parent",
  "/admin",
];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          // Required, not optional: a response that sets auth cookies must not be
          // cached. Without these headers a CDN or reverse proxy can serve one
          // user's session token to a different user.
          for (const [key, val] of Object.entries(headers)) {
            response.headers.set(key, val);
          }
        },
      },
    },
  );

  /*
    getClaims(), NOT getUser() — and NOT getSession().

    All three answer "is this request signed in?", and the difference is what
    they cost and what they trust:

      getSession()  reads the cookie and believes it.        0 round trips. Unsafe.
      getUser()     asks Supabase's auth server.             1 round trip.
      getClaims()   verifies the JWT signature locally.      0 round trips.

    getClaims is the right one here on both counts. This project signs its
    tokens with **asymmetric** keys (ES256 — confirmed at
    /auth/v1/.well-known/jwks.json), so the signature is checked in-process via
    WebCrypto against a JWKS that Cloudflare serves from its Delhi edge with a
    10-minute TTL. A forged or tampered cookie fails that check exactly as it
    would have failed at the auth server. This is nothing like getSession().

    The caveat worth knowing if you ever change projects: on a project still
    using a legacy SYMMETRIC signing secret, getClaims silently falls back to a
    server round trip and this optimisation quietly buys nothing.

    Why it matters that this is zero round trips: the database is in
    `ap-northeast-1` (Tokyo) and the functions run in `bom1` (Mumbai). Measured
    Mumbai→Tokyo is ~115ms. The proxy runs on EVERY request, so getUser() was
    ~115ms added to every screen and every tap — the lag on the back button was
    partly this.

    Session refresh is unaffected: getClaims calls getSession() internally,
    which refreshes an expiring token before validating it, so the cookie
    rotation that lib/supabase/server.ts depends on still happens here.

    And none of this is the auth boundary regardless — see the header. The
    layout still calls getUser() and revalidates against Supabase before any
    protected content renders.
  */
  const { data: claimsData } = await supabase.auth.getClaims();
  const user = claimsData?.claims?.sub ? claimsData.claims : null;

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (!user && isProtected) {
    const url = request.nextUrl.clone();

    /*
      LANGUAGE FIRST, ALWAYS — for someone who has never chosen one.

      This matters because the PWA's `start_url` is now `/learn`, so a launch
      from the home-screen icon arrives here rather than at `/`, and `/` was
      what used to send a brand-new learner to the picker.

      The locale cookie is the signal: anyone who has used this app has one, so
      a signed-out returning learner still gets `/login` and their place back.
      Someone arriving with no cookie at all — a second child on a shared phone,
      or a cleared browser — meets the language picker instead of an English
      login form. That is the wall at the front door D16 exists to remove, and
      it costs a cookie read here.
    */
    if (!request.cookies.get(LOCALE_COOKIE)?.value) {
      url.pathname = "/welcome";
      url.search = "";
      return NextResponse.redirect(url);
    }

    url.pathname = "/login";
    url.searchParams.set("next", pathname); // return them where they were headed
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Skip static assets and image optimisation — running auth on a favicon request
  // is wasted latency on every page load.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
