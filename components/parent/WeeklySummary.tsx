import { Award, BookOpen, Flame, PencilLine } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import type { WeeklySummary as Summary } from "@/lib/parent/summary";

/**
 * The learner's week, as a supporting adult reads it.
 *
 * ── EVERY NUMBER CARRIES ITS OWN EXPLANATION ────────────────────────────────
 * The person reading this may never have used Saathi and may not be the parent
 * at all. In this demographic it is often the most literate person in the
 * household — frequently an older sibling — or a tutor the family asked to look.
 * None of them know what a "streak" is, what "mastery" means, or whether four
 * practice questions is a lot.
 *
 * So no figure appears alone. Each one is followed by a plain sentence saying
 * what it means and whether it is good. A dashboard that assumes context is a
 * dashboard this audience closes.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * It is also written to be READ ALOUD — short sentences, no jargon, no
 * abbreviations — because the common use is a tutor or older sibling going
 * through it with a parent who cannot navigate it themselves.
 *
 * Presentational only. It receives a `WeeklySummary` and cannot reach past it,
 * which is what stops either surface rendering a field the other does not.
 */
export async function WeeklySummary({ summary }: { summary: Summary }) {
  const t = await getTranslations();
  const name = summary.learnerName;

  if (summary.quiet) {
    return (
      <section className="flex flex-col gap-sm rounded-(--radius-card) border border-border bg-surface px-lg py-lg">
        <h2 className="text-h3 text-ink">{t("parent.empty")}</h2>
        {/* Never a reproach, and never blank. What WILL appear, so an adult
            opening this on day one knows the link is working. */}
        <p className="text-body-sm text-body">{t("parent.emptyHelp")}</p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-xl">
      {/* ── the week in numbers, each with its meaning ─────────────────── */}
      <section aria-labelledby="week-heading" className="flex flex-col gap-md">
        <h2 id="week-heading" className="text-h3 text-ink">
          {t("parent.weekTitle")}
        </h2>

        <ul className="flex flex-col gap-md">
          <li className="flex items-start gap-md rounded-(--radius-card) border border-border bg-surface px-lg py-md">
            <BookOpen size={20} strokeWidth={1.75} aria-hidden className="text-primary shrink-0 mt-0.5" />
            <div className="flex flex-col gap-xs min-w-0">
              <p className="text-body text-ink">
                {t("parent.lessonsDone", { count: summary.lessonsThisWeek })}
              </p>
              <p className="text-body-sm text-muted">{t("parent.lessonsMeaning")}</p>
            </div>
          </li>

          <li className="flex items-start gap-md rounded-(--radius-card) border border-border bg-surface px-lg py-md">
            <PencilLine size={20} strokeWidth={1.75} aria-hidden className="text-primary shrink-0 mt-0.5" />
            <div className="flex flex-col gap-xs min-w-0">
              <p className="text-body text-ink">
                {t("parent.practiceDone", { count: summary.practiceThisWeek })}
              </p>
              <p className="text-body-sm text-muted">{t("parent.practiceMeaning")}</p>
            </div>
          </li>

          {summary.streak.alive && summary.streak.days > 0 && (
            <li className="flex items-start gap-md rounded-(--radius-card) border border-border bg-surface px-lg py-md">
              <Flame
                size={20}
                strokeWidth={1.75}
                aria-hidden
                className={cn(
                  "shrink-0 mt-0.5",
                  summary.streak.graceActive ? "text-celebrate" : "text-streak-active",
                )}
              />
              <div className="flex flex-col gap-xs min-w-0">
                <p className="text-body text-ink">
                  {t("streak.days", { days: summary.streak.days })}
                </p>
                <p className="text-body-sm text-muted">{t("parent.streakMeaning")}</p>
              </div>
            </li>
          )}
        </ul>
      </section>

      {/* ── badges: the part that gets celebrated at home ───────────────── */}
      {summary.milestoneCodes.length > 0 && (
        <section aria-labelledby="badges-heading" className="flex flex-col gap-md">
          <h2 id="badges-heading" className="text-h3 text-ink">
            {t("parent.milestonesTitle")}
          </h2>
          <ul className="flex flex-col gap-sm">
            {summary.milestoneCodes.map((code) => (
              <li
                key={code}
                className="flex items-center gap-md rounded-(--radius-card) border border-celebrate bg-celebrate-bg px-lg py-md"
              >
                <Award size={20} strokeWidth={1.75} aria-hidden className="text-celebrate shrink-0" />
                <span className="text-body text-ink">{t(`milestone.${code}` as never)}</span>
              </li>
            ))}
          </ul>
          <p className="text-body-sm text-muted">{t("parent.milestonesMeaning")}</p>
        </section>
      )}

      {/* ── topics, with what the bands actually mean ───────────────────── */}
      {summary.concepts.length > 0 && (
        <section aria-labelledby="topics-heading" className="flex flex-col gap-md">
          <h2 id="topics-heading" className="text-h3 text-ink">
            {t("parent.conceptsTitle")}
          </h2>
          <p className="text-body-sm text-muted">{t("parent.conceptsMeaning")}</p>

          <ul className="flex flex-col gap-sm">
            {summary.concepts.map((concept) => (
              <li
                key={concept.conceptId}
                className="flex items-center justify-between gap-md min-h-11"
              >
                <span className="text-body text-body min-w-0">{concept.name}</span>
                <Badge tone={concept.band} className="shrink-0">
                  {t(`mastery.${concept.band}`)}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── what to do about it ─────────────────────────────────────────── */}
      {/* The line that turns a status screen into something an adult can act on
          tonight. One thing, not a list — the reader has ten minutes and no
          subject expertise, and a list of five is a list nobody starts. */}
      <section
        aria-labelledby="help-heading"
        className="flex flex-col gap-sm rounded-(--radius-card) border border-primary bg-primary-wash px-lg py-lg"
      >
        <h2 id="help-heading" className="text-h3 text-primary-strong">
          {t("parent.helpTitle")}
        </h2>

        {summary.focus ? (
          <p className="text-body text-ink">
            {t("parent.helpFocus", { concept: summary.focus.name, name: name ?? "" })}
          </p>
        ) : (
          <p className="text-body text-ink">{t("parent.helpAllWell")}</p>
        )}

        {/* True whatever the numbers say, and the most useful thing an adult
            without the maths can actually do. */}
        <p className="text-body-sm text-body">{t("parent.helpEncourage")}</p>
      </section>
    </div>
  );
}
