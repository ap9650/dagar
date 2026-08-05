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
 * ── EVERY SQUARE KEEPS ITS LETTER ───────────────────────────────────────────
 * A completed day used to REPLACE its weekday letter with the tick, so the only
 * days a learner could not identify were the days they had actually worked —
 * and with letters missing from the middle, the row stopped reading as a
 * sequence of days at all. Reported from a phone as simply "very confusing",
 * which was the right word: `W T F S ✓ M ✓` is not a week.
 *
 * The letter and the tick now stack, the same way a badge rung stacks its
 * number over its icon, and for the same reason: the label is the identity of
 * the thing and the icon is its state. Neither can stand in for the other.
 *
 * ── A MISSED DAY IS NOT DRAWN AS A FAILURE ──────────────────────────────────
 * An unfilled square is empty, not red, not crossed. The learner already knows
 * they missed it; the app's job is to show the shape of the week, not to mark
 * it. Amber and red are both wrong here — a quiet gap says the true thing.
 *
 * A REST day is different from a gap, and now looks it. D7 forgives one missed
 * day a week, and while the streak card said so in words the strip drew the
 * forgiven day as an ordinary hole — so "3 day streak" sat above two ticks with
 * nothing to account for the third. It takes the `celebrate` colour the flame
 * already turns while grace is holding, so the two agree on sight.
 *
 * Colour is never the only signal (D10): met carries a tick, rested carries a
 * dot, and the row has a text summary beneath it.
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
                // as "T T" for Tuesday and Thursday to a screen reader. The
                // state is spelled out rather than left to the tick, which is
                // `aria-hidden`.
                aria-label={`${day.date}${
                  day.met ? "" : day.rested ? ` — ${t("week.restDay")}` : " —"
                }`}
                className={`aspect-square rounded-(--radius-control) border
                            flex flex-col items-center justify-center gap-0.5
                            text-caption font-medium
                            ${
                              day.met
                                ? "bg-primary border-primary text-background"
                                : day.rested
                                  ? "bg-celebrate-bg border-celebrate text-celebrate"
                                  : day.isToday
                                    ? "bg-background border-primary text-primary"
                                    : "bg-surface border-transparent text-muted"
                            }`}
              >
                {/* Always. This is which day it is, and it is never the thing
                    that gets swapped out for a status. */}
                <span className="leading-none">{t(`week.${weekday}` as never)}</span>

                {day.met ? (
                  <Check size={11} strokeWidth={3} aria-hidden />
                ) : day.rested ? (
                  // A dot, not a tick and not a cross: nothing was done and
                  // nothing was lost.
                  <span aria-hidden className="block size-1 rounded-full bg-celebrate" />
                ) : (
                  // Holds the same height so seven squares stay on one baseline
                  // whatever mix of states the week happens to be.
                  <span aria-hidden className="block size-1" />
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
