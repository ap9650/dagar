import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "./config";

/**
 * next-intl request configuration. The plugin in `next.config.ts` finds this file
 * by convention (`./i18n/request.ts`) — do not move or rename it.
 *
 * Dagar has NO `[locale]` segment in its routes: `/learn`, not `/hi/learn`
 * (SCREENS.md route map). The locale therefore comes from the cookie rather than
 * the URL, which is next-intl's "without i18n routing" setup.
 *
 * Deliberately no `navigator.language` sniffing — on a shared phone the device
 * language is usually the parent's, not the learner's (i18n spec §3).
 */
export default getRequestConfig(async ({ locale: requested }) => {
  /*
    ── AN EXPLICIT LOCALE WINS OVER THE COOKIE ─────────────────────────────────
    This callback took NO arguments and always read the cookie, which quietly
    broke every server-side call that names a locale. next-intl's own types say
    it plainly: "If you provide an explicit locale to an async server-side
    function like `getTranslations({locale: 'en'})`, it will be passed via
    `locale` to `getRequestConfig` so you can use it instead of the segment
    value." We were throwing it away.

    The consequence was live and invisible. The reminder cron looks up each
    learner's locale and calls `getTranslations({locale, namespace: "push"})` —
    and a cron has no cookie, so every notification fell through to
    DEFAULT_LOCALE. **Every Hindi learner was being sent an English
    notification**, on the one surface that lands on a parent's phone rather
    than inside the app, where nobody would think to check the language.

    Nothing errored, and no test could see it: the code passes the right locale,
    the dictionary has the right Hindi, and the wrong one comes out anyway.
    Found by rendering the strings side by side on `/admin/notifications` and
    noticing the row labelled Hindi was in English.

    The cookie remains the source of truth for ordinary page renders, which have
    no explicit locale to offer.
  */
  const explicit = isLocale(requested) ? requested : null;

  // Only touch cookies when there is nothing better — a cron or a background
  // job has no request cookies to read, and asking for them there is at best
  // wasted work.
  let locale = explicit;
  if (!locale) {
    const cookieStore = await cookies();
    const stored = cookieStore.get(LOCALE_COOKIE)?.value;
    locale = isLocale(stored) ? stored : DEFAULT_LOCALE;
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    // Streaks, "today", and every date the learner sees are IST (D7).
    timeZone: "Asia/Kolkata",
  };
});
