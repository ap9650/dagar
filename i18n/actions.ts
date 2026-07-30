"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  type Locale,
  isLocale,
} from "./config";

/**
 * The ONE write path for locale. Both the language picker (`/welcome`, no account
 * yet) and the Settings toggle (account exists) call this.
 *
 * Two stores, kept in step here so nothing else has to think about it:
 *   - the cookie   → what every server render reads (`i18n/request.ts`)
 *   - profiles.locale → the durable record; survives a cleared cookie or a new
 *                        device, and is what the parent summary and tutor read
 *
 * Signed out, only the cookie is written. The profile catches up at profile
 * creation (SCREENS.md Flow 1: grade screen writes role, grade AND locale).
 */
export async function setLocale(next: unknown): Promise<{ locale: Locale }> {
  // Validate before writing. This value arrives from a client component.
  const locale: Locale = isLocale(next) ? next : DEFAULT_LOCALE;

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
    // Readable by JS: harmless preference, and the client picker reads it to
    // show its selected state before hydration completes.
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // RLS restricts this to the caller's own row — a learner cannot flip
    // somebody else's language.
    await supabase.from("profiles").update({ locale }).eq("id", user.id);
  }

  // Changing language re-renders in place. It never signs the learner out and
  // never resets progress (SCREENS.md Flow 4).
  revalidatePath("/", "layout");

  return { locale };
}

/**
 * Called after sign-in, when the profile is the authority and the cookie on this
 * device may be stale (new phone, cleared cookies, or a shared handset where the
 * previous user picked the other language).
 */
export async function syncLocaleFromProfile(): Promise<Locale> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return DEFAULT_LOCALE;

  const { data: profile } = await supabase
    .from("profiles")
    .select("locale")
    .eq("id", user.id)
    .single();

  const locale: Locale = isLocale(profile?.locale) ? profile.locale : DEFAULT_LOCALE;

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  });

  return locale;
}
