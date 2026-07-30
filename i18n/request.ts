import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "./config";

/**
 * next-intl request configuration. The plugin in `next.config.ts` finds this file
 * by convention (`./i18n/request.ts`) — do not move or rename it.
 *
 * Saathi has NO `[locale]` segment in its routes: `/learn`, not `/hi/learn`
 * (SCREENS.md route map). The locale therefore comes from the cookie rather than
 * the URL, which is next-intl's "without i18n routing" setup.
 *
 * Deliberately no `navigator.language` sniffing — on a shared phone the device
 * language is usually the parent's, not the learner's (i18n spec §3).
 */
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const stored = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(stored) ? stored : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    // Streaks, "today", and every date the learner sees are IST (D7).
    timeZone: "Asia/Kolkata",
  };
});
