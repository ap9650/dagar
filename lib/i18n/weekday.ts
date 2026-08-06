import type { Locale } from "@/i18n/config";

/**
 * The name of a weekday — ONE source, for every element that names one.
 *
 * ── WHY THIS IS A MODULE AND NOT TWO INLINE CALLS ───────────────────────────
 * The progress screen names the same day twice: once in a week-strip square and
 * once beside a "What moved" line. They were built a week apart and drifted —
 * the strip took its label from `messages/*.json` (`We`) and the diary from
 * `Intl` (`Wed`).
 *
 * Both were readable alone. Together they were not usable for the one thing a
 * learner actually does with that screen, which is look at a filled square and
 * then look down the list for what filled it. Two spellings of Wednesday means
 * matching them by eye is a translation exercise, and the honest conclusion
 * from failing it is that the app is contradicting itself.
 *
 * It was reported exactly that way, twice, and the second report was the one
 * that mattered: told the square said Wednesday, the answer came back "I still
 * feel it's buggy". A screen a careful person cannot verify IS buggy, whatever
 * the database says.
 *
 * So: one formatter, one string per date, no message keys to drift against it.
 *
 * ── IST, AND MIDDAY ─────────────────────────────────────────────────────────
 * The date arriving here is already an IST calendar date (D7). Parsing it at
 * IST midday rather than midnight keeps it on its own day under any host
 * timezone — a midnight parse lands within a rounding error of the boundary the
 * whole product turns on.
 */
export function weekdayFormatter(locale: Locale) {
  const format = new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    weekday: "short",
    timeZone: "Asia/Kolkata",
  });

  /** `2026-08-05` → `Wed` / `बुध`. */
  return (istDate: string) => format.format(new Date(`${istDate}T12:00:00+05:30`));
}
