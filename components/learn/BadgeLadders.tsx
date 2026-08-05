import { Award, Check, Lock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/cn";
import type { LadderKey, LadderState } from "@/lib/learning/badgeLadders";
import type { MilestoneState } from "@/lib/learning/milestones";

/**
 * Badges as ladders — earned **and** unearned, always both.
 *
 * ── WHAT CHANGED, AND WHY ───────────────────────────────────────────────────
 * This was a flat grid of seven squares. A learner two weeks in had earned
 * most of them and the screen became a wall of gold that quietly said "you are
 * finished here" — while a learner on day one saw seven greys in no order, with
 * no way to tell which was nearest.
 *
 * A ladder answers the question a grid cannot: *what is the closest thing I
 * could achieve, and how far away is it?* That question has an answer at rung 1
 * and at rung 6, which is the whole difference.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Locked and earned differ by icon, by weight and by copy, never by colour
 * alone (D10). A locked rung is muted, never crossed out — there is no lock
 * here you cannot open.
 */
export async function BadgeLadders({
  ladders,
  firsts,
}: {
  ladders: LadderState[];
  firsts: MilestoneState[];
}) {
  const t = await getTranslations();

  /** "5 ideas" / "7 days" / "3 chapters" — the unit belongs to the ladder. */
  const rungLabel = (key: LadderKey, at: number) =>
    key === "coming_back"
      ? t("ladder.rungDays", { days: at })
      : key === "ideas"
        ? t("ladder.rungIdeas", { count: at })
        : t("ladder.rungChapters", { count: at });

  return (
    <div className="flex flex-col gap-xl">
      {ladders.map((ladder) => (
        <section key={ladder.key} aria-labelledby={`ladder-${ladder.key}`} className="flex flex-col gap-sm">
          <div className="flex items-baseline justify-between gap-md">
            <h3 id={`ladder-${ladder.key}`} className="text-h3 text-ink">
              {t(`ladder.${ladder.key}` as never)}
            </h3>
            <span className="text-body-sm text-muted tabular-nums shrink-0">
              {ladder.reached}/{ladder.rungs.length}
            </span>
          </div>

          {/* The rungs. A row rather than a grid so the ORDER is the meaning —
              left to right is easier to harder, which is the fact a flat grid
              of squares could not express. Scrolls inside itself at 360px with
              seven streak rungs rather than pushing the page sideways. */}
          {/* The fade is the affordance. Seven streak rungs do not fit 360px, so
              the row scrolls — and without it the last rung is clipped mid-digit,
              which reads as a rendering fault rather than as "there is more this
              way". Where a ladder does fit, the fade lands on empty space and
              nothing shows. */}
          <ol
            className="flex gap-xs list-none m-0 p-0 overflow-x-auto pb-xs
                       [mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)]"
          >
            {ladder.rungs.map((rung) => (
              <li key={rung.code} className="shrink-0">
                <div
                  aria-label={rungLabel(ladder.key, rung.at)}
                  className={cn(
                    "min-w-14 h-11 px-sm rounded-(--radius-control) border",
                    "flex flex-col items-center justify-center gap-0.5",
                    rung.earned
                      ? "border-celebrate bg-celebrate-bg"
                      : "border-border bg-background",
                  )}
                >
                  <span
                    className={cn(
                      "text-label tabular-nums leading-none",
                      rung.earned ? "text-celebrate font-medium" : "text-muted",
                    )}
                  >
                    {rung.at}
                  </span>
                  {rung.earned ? (
                    <Check size={11} strokeWidth={3} aria-hidden className="text-celebrate" />
                  ) : (
                    <Lock size={11} strokeWidth={2} aria-hidden className="text-muted" />
                  )}
                </div>
              </li>
            ))}
          </ol>

          {/*
            The line that makes this a ladder rather than a nicer grid: what is
            next, and how far. Absent at the top — a learner who has finished a
            ladder gets a plain statement, never an invented target. Inventing
            one would be the dead end this replaced, moved upward.
          */}
          <p className="text-body-sm text-body">
            {ladder.next
              ? `${t("ladder.next", { label: rungLabel(ladder.key, ladder.next.at) })} · ${t(
                  "ladder.away",
                  { count: ladder.next.remaining },
                )}`
              : t("ladder.done")}
          </p>
        </section>
      ))}

      {/* ── the one-shots ──────────────────────────────────────────────────
          A first lesson happens once and cannot ladder, so these keep the card
          shape they always had. `chapter_mastered` is here rather than atop the
          chapters ladder because it measures depth, not count — putting it
          there would say mastering one chapter equals finishing ten. */}
      <section aria-labelledby="ladder-firsts" className="flex flex-col gap-sm">
        <h3 id="ladder-firsts" className="text-h3 text-ink">
          {t("ladder.firsts")}
        </h3>
        <ul className="grid grid-cols-2 gap-md list-none m-0 p-0">
          {firsts.map((milestone) => (
            <li
              key={milestone.code}
              className={cn(
                "flex flex-col gap-sm rounded-(--radius-card) border px-lg py-md min-h-24",
                milestone.earned
                  ? "border-celebrate bg-celebrate-bg"
                  : "border-border bg-background",
              )}
            >
              {milestone.earned ? (
                <Award size={20} strokeWidth={1.75} aria-hidden className="text-celebrate shrink-0" />
              ) : (
                <Lock size={20} strokeWidth={1.75} aria-hidden className="text-muted shrink-0" />
              )}

              <span
                className={cn(
                  "text-body-sm",
                  milestone.earned ? "text-ink font-medium" : "text-muted",
                )}
              >
                {t(`milestone.${milestone.code}` as never)}
              </span>

              {/* The state in words, so it is never carried by the grey alone. */}
              {!milestone.earned && (
                <span className="text-caption text-muted">{t("progress.milestoneLocked")}</span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
