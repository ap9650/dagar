import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, isLocale } from "@/i18n/config";

/**
 * GET /auth/callback — where Google sends the learner back.
 *
 * Exchanges the code for a session, then routes on what we find:
 *
 *   no profile          → /onboarding/grade   (finish signing up)
 *   role = "parent"     → /parent             (never assume student)
 *   role = "student"    → /learn
 *
 * The no-profile branch is the important one. A learner can end up with an
 * `auth.users` row and no `profiles` row — they authenticated, then closed the
 * tab before picking a grade. Sending them to /learn would dead-end them in an
 * empty dashboard forever (auth-onboarding spec §7).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=oauth", url.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth/callback]", error.message);
    return NextResponse.redirect(new URL("/login?error=oauth", url.origin));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login?error=oauth", url.origin));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, locale")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.redirect(new URL("/onboarding/grade", url.origin));
  }

  const destination =
    next && next.startsWith("/")
      ? next // only ever a relative path — an absolute one is an open redirect
      : profile.role === "parent"
        ? "/parent"
        : "/learn";

  const response = NextResponse.redirect(new URL(destination, url.origin));

  // Returning learner on a new device: the profile is the authority, so the
  // locale cookie is (re)written from it here rather than leaving them in
  // whatever language this handset last used.
  if (isLocale(profile.locale)) {
    response.cookies.set(LOCALE_COOKIE, profile.locale, {
      path: "/",
      maxAge: LOCALE_COOKIE_MAX_AGE,
      sameSite: "lax",
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
    });
  }

  return response;
}
