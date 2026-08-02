/**
 * The day boundary. **Asia/Kolkata, always** (D7).
 *
 * This is small and load-bearing. A learner who finishes a lesson at 11:50pm IST
 * and another at 12:10am IST has been active on two different days — and if the
 * boundary is UTC instead, both land on the same UTC date and the streak silently
 * fails to increment. The learner sees their streak stall while doing everything
 * right, and nothing anywhere logs an error.
 *
 * Every date in the learning engine goes through here.
 */

export const APP_TIME_ZONE = "Asia/Kolkata";

/**
 * The IST calendar date of an instant, as `YYYY-MM-DD`.
 *
 * `en-CA` is not a stylistic choice — it is the locale whose short date format is
 * already ISO order, so this needs no manual month/day assembly.
 */
export function istDate(at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/**
 * The instant IST midnight began for the given date — i.e. the lower bound for
 * "today" in a `created_at >= ?` query.
 *
 * IST is UTC+5:30 with no daylight saving, so the offset is a constant. If Dagar
 * ever serves a zone that observes DST, this must be rewritten to derive the
 * offset per-date rather than assuming one.
 */
export function istDayStart(dateString: string = istDate()): Date {
  return new Date(`${dateString}T00:00:00+05:30`);
}

/** Whole days between two IST date strings. Negative if `b` is earlier than `a`. */
export function daysBetween(a: string, b: string): number {
  const MS_PER_DAY = 86_400_000;
  const from = new Date(`${a}T00:00:00+05:30`).getTime();
  const to = new Date(`${b}T00:00:00+05:30`).getTime();
  return Math.round((to - from) / MS_PER_DAY);
}
