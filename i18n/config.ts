/**
 * Locale constants — the only place the list of languages is written down.
 *
 * Adding Marathi in Phase 2 is one entry here plus one `messages/mr.json`
 * (D16: a new jsonb key, not a migration).
 *
 * This module is imported by client components, so it must stay free of any
 * server-only import (`next/headers`, Supabase, node builtins).
 */

export const LOCALES = ["en", "hi"] as const;

export type Locale = (typeof LOCALES)[number];

/**
 * English is the fallback everywhere: base columns in the DB, base keys in the
 * dictionary. A missing Hindi string renders English, never a blank.
 */
export const DEFAULT_LOCALE: Locale = "en";

/**
 * Each language is labelled in its own script (saathi-design § Language picker).
 * Never "Hindi" written in English — a learner who cannot read English must still
 * recognise their option instantly.
 */
export const LOCALE_LABEL: Record<Locale, string> = {
  en: "English",
  hi: "हिंदी",
};

/**
 * The render-time carrier of the locale.
 *
 * `profiles.locale` is the durable record, but it cannot be the render source:
 * the language picker runs BEFORE a profile exists (SCREENS.md Flow 1), and
 * reading the profile on every server render would put a database round-trip in
 * front of every page.
 *
 * So the cookie is what `i18n/request.ts` reads, and it is kept in step with the
 * profile at the two moments the two can diverge — sign-in and a language change
 * in Settings. See `i18n/actions.ts`.
 *
 * A cookie, not `localStorage`: localStorage is invisible to a Server Component,
 * so a Hindi learner would get an English server render followed by a flash to
 * Hindi on hydration. Functional preference only — no tracking, no consent gate.
 */
export const LOCALE_COOKIE = "saathi_locale";

/** One year. A learner should never have to pick their language twice. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
