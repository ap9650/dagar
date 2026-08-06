import { getLocale, getTranslations } from "next-intl/server";
import { Check } from "lucide-react";
import { daysMet, type WeekDay } from "@/lib/learning/week";
import { weekdayFormatter } from "@/lib/i18n/weekday";
import type { Locale } from "@/i18n/config";

/**
 * Seven squares — the last seven days, oldest first.
 *
 * The smallest element on the progress screen that changes daily, and the whole
 * reason it earns space: everything else there reports a state, so a learner
 * who worked hard on Tuesday saw the same words on Wednesday.
 *
 * ── EVERY SQUARE KEEPS ITS NAME ─────────────────────────────────────────────
 * A completed day used to REPLACE its weekday label with the tick, so the only
 * days a learner could not identify were the days they had actually worked —
 * and with labels missing from the middle, the row stopped reading as a
 * sequence of days at all. Reported from a phone as simply "very confusing",
 * which was the right word: `W T F S ✓ M ✓` is not a week.
 *
 * The name and the tick now stack, the same way a badge rung stacks its number
 * over its icon, and for the same reason: the label is the identity of the
 * thing and the icon is its state. Neither can stand in for the other.
 *
 * ── AND IT IS THE SAME NAME "WHAT MOVED" USES ───────────────────────────────
 * Single letters came next, and were worse: `M T W T F S S` has four ambiguous
 * characters, so nobody could say which square was Tuesday. Two letters fixed
 * the ambiguity but not the actual task — the diary below spells the same day
 * `Wed` while the square said `We`, and reading a filled square and then
 * hunting the list for what filled it meant translating between two spellings.
 *
 * `weekdayFormatter` is now the only thing in the product that names a day, so
 * the square and the line are the same string by construction rather than by
 * two message files agreeing. `tests/unit/progress-agreement.test.ts` holds it.
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
export async function WeekStrip({ week }: { week: WeekDay[] }) {
  const t = await getTranslations();
  // The SAME formatter "What moved" uses on its lines. The two sections name the
  // same days, and a learner reads them together: filled square, then down the
  // list for what filled it. They must spell Wednesday the same way.
  const weekday = weekdayFormatter((await getLocale()) as Locale);

  return (
    <section aria-labelledby="week-heading" className="flex flex-col gap-sm">
      <h2 id="week-heading" className="text-label text-muted">
        {t("week.title")}
      </h2>

      <ol className="flex gap-xs list-none m-0 p-0">
        {week.map((day) => (
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
                <span className="leading-none">{weekday(day.date)}</span>

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
        ))}
      </ol>

      <p className="text-body-sm text-muted">{t("week.summary", { days: daysMet(week) })}</p>
    </section>
  );
}
