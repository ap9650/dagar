import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/security/authGuard";
import {
  createProfileSchema,
  parseBody,
  updateProfileSchema,
} from "@/lib/security/validation";
import { track } from "@/lib/analytics/track";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from "@/i18n/config";

/**
 * POST /api/profile — creates the learner's profile. The end of onboarding.
 *
 * IDEMPOTENT. A learner who double-taps the grade button, or who comes back to
 * /onboarding/grade because a previous attempt half-failed, must not get an
 * error — they get their profile updated and sent on their way.
 *
 * `learner_registered` fires on CREATE ONLY. Firing it on the update path would
 * inflate the activation metric with the same learner twice.
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const parsed = await parseBody(request, createProfileSchema);
  if (!parsed.ok) return parsed.response;

  const { grade, locale, display_name } = parsed.data;
  const supabase = await createClient();

  // Does a profile already exist? This decides both the write and whether the
  // event fires, so it is one read before, not an upsert-and-guess after.
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", auth.userId)
    .maybeSingle();

  // `role` is fixed server-side. It is deliberately absent from the zod schema:
  // a client that could send `role: "parent"` could read another child's data
  // through the parent policy.
  const { error } = await supabase.from("profiles").upsert({
    id: auth.userId,
    role: "student",
    grade,
    locale,
    display_name: display_name ?? null,
  });

  if (error) {
    console.error("[api/profile POST]", error.message);
    return NextResponse.json(
      { error: "Could not save your profile", code: "PROFILE_WRITE_FAILED" },
      { status: 500 },
    );
  }

  const created = !existing;
  if (created) await track("learner_registered", { grade, locale });

  const response = NextResponse.json({ ok: true, created });
  setLocaleCookie(response, locale);
  return response;
}

/**
 * PATCH /api/profile — Settings (slice 1.1a).
 *
 * Changing locale re-renders in place. It never signs the learner out and never
 * resets progress (SCREENS.md Flow 4) — which is why this touches only the
 * profile row and the cookie, and nothing else.
 */
export async function PATCH(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const parsed = await parseBody(request, updateProfileSchema);
  if (!parsed.ok) return parsed.response;

  const updates = parsed.data;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true, changed: false });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", auth.userId); // RLS enforces this too — belt and braces

  if (error) {
    console.error("[api/profile PATCH]", error.message);
    return NextResponse.json(
      { error: "Could not save your changes", code: "PROFILE_WRITE_FAILED" },
      { status: 500 },
    );
  }

  // WHICH field moved, never what it moved to for anything free-text. Locale is
  // the one worth knowing by value: a learner who signs up in English and
  // switches to Hindi on day two is direct evidence for D16 that the signup
  // locale cannot show, because at signup nobody has read a lesson yet.
  await track("settings_changed", {
    field: Object.keys(updates).sort().join(","),
    locale: updates.locale ?? null,
  });

  const response = NextResponse.json({ ok: true, changed: true });
  if (updates.locale) setLocaleCookie(response, updates.locale);
  return response;
}

/**
 * Keep the render-time cookie in step with the durable record. Without this, a
 * learner changes their language and the very next server render still uses the
 * old one (D16, docs/specs/i18n.md §3).
 */
function setLocaleCookie(response: NextResponse, locale: "en" | "hi") {
  response.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  });
}
