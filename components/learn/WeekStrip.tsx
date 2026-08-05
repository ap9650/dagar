import { getTranslations } from "next-intl/server";
import { Check } from "lucide-react";
import { daysMet, type WeekDay } from "@/lib/learning/week";

/**
 * Seven squares — the last seven days, oldest first.
 *
 * The smallest element on the progress screen that changes daily, and the whole
 * reason it earns space: everything else there reports a state, so a learner
 * who worked hard on Tuesday saw the same words on Wednesday.
 *
 * ── A MISSED DAY IS NOT DRAWN AS A FAILURE ──────────────────────────────────
 * An unfilled square is empty, not red, not crossed. The learner already knows
 * they missed it; the app's job is to show the shape of the week, not to mark
 * it. Amber and red are both wrong here — a quiet gap says the true thing.
 *
 * Colour is never the only signal (D10): filled squares carry a tick as well as
 * the fill, and the row has a text summary beneath it.
 */
const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export async function WeekStrip({ week }: { week: WeekDay[] }) {
  const t = await getTranslations();

  return (
    <section aria-labelledby="week-heading" className="flex flex-col gap-sm">
      <h2 id="week-heading" className="text-label text-muted">
        {t("week.title")}
      </h2>

      <ol className="flex gap-xs list-none m-0 p-0">
        {week.map((day) => {
          // `getUTCDay` on an IST date string would drift for anyone west of
          // UTC; parsing it AS an IST midnight keeps the letter matching the
          // square everywhere.
          const weekday = WEEKDAY_KEYS[new Date(`${day.date}T00:00:00+05:30`).getDay()];

          return (
            <li key={day.date} className="flex-1">
              <div
                // The date is the accessible label; the letter alone would read
                // as "T T" for Tuesday and Thursday to a screen reader.
                aria-label={`${day.date}${day.met ? "" : " —"}`}
                className={`aspect-square rounded-(--radius-control) grid place-items-center
                            text-caption font-medium border
                            ${
                              day.met
                                ? "bg-primary border-primary text-background"
                                : day.isToday
                                  ? "bg-background border-primary text-primary"
                                  : "bg-surface border-transparent text-muted"
                            }`}
              >
                {day.met ? (
                  <Check size={14} strokeWidth={3} aria-hidden />
                ) : (
                  t(`week.${weekday}` as never)
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <p className="text-body-sm text-muted">{t("week.summary", { days: daysMet(week) })}</p>
    </section>
  );
}
