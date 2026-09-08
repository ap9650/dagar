import type { FunnelStage } from "@/lib/analytics/metrics";

/**
 * Charts for `/admin/metrics`. Inline SVG, no charting library.
 *
 * ── WHY NO LIBRARY ──────────────────────────────────────────────────────────
 * The data is tiny — fourteen points, seven bars, five chapters — and a
 * dependency that ships tens of kilobytes to draw six rectangles is not a trade
 * worth making. The lesson viz primitives in `components/learn/viz/` already
 * establish that hand-rolled SVG is how this codebase draws things.
 *
 * ── EVERY CHART IS PAIRED WITH ITS NUMBER ───────────────────────────────────
 * A design-system rule (`dagar-design`, Progress) and an accessibility one.
 * The bar is the shape of the answer; the number IS the answer. Nothing here
 * relies on a reader estimating a length, and nothing relies on colour alone.
 */

/** `0.421` → `42%`. Null is an em dash — a rate with no denominator, not zero. */
export function percent(value: number | null): string {
  if (value === null) return "—";
  return `${Math.round(value * 100)}%`;
}

// ─────────────────────────────────────────────────────────────────────────────

export function Stat({
  label,
  value,
  note,
  tone = "plain",
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "plain" | "primary";
}) {
  return (
    <div
      className={`flex flex-col gap-xs rounded-(--radius-card) border px-lg py-md ${
        tone === "primary" ? "border-primary bg-primary-wash" : "border-border bg-background"
      }`}
    >
      <p className="text-caption text-muted uppercase tracking-wide">{label}</p>
      <p className="text-h1 text-ink tabular-nums">{value}</p>
      {note && <p className="text-body-sm text-body">{note}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Active learners per day, last 14 days.
 *
 * The one chart above the fold. It answers "is this alive right now" faster
 * than any number can, which is the only reason it earns the space.
 *
 * Empty days are drawn as empty, never skipped. A chart that drops quiet days
 * draws a straight line across a gap and reports the opposite of what happened.
 */
export function DailyLine({ series }: { series: { date: string; learners: number }[] }) {
  const W = 320;
  const H = 72;
  const PAD = 4;
  const peak = Math.max(1, ...series.map((day) => day.learners));

  const x = (i: number) => PAD + (i * (W - PAD * 2)) / Math.max(1, series.length - 1);
  const y = (n: number) => H - PAD - (n / peak) * (H - PAD * 2);

  const line = series.map((day, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(day.learners)}`).join(" ");
  const area = `${line} L${x(series.length - 1)},${H - PAD} L${x(0)},${H - PAD} Z`;

  const total = series.reduce((sum, day) => sum + day.learners, 0);

  return (
    <figure className="flex flex-col gap-sm m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Active learners over the last ${series.length} days. Peak ${peak} in a day.`}
      >
        {total > 0 && <path d={area} fill="var(--color-primary-soft)" />}
        <path
          d={line}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {series.map((day, i) =>
          day.learners > 0 ? (
            <circle key={day.date} cx={x(i)} cy={y(day.learners)} r={2.5} fill="var(--color-primary)" />
          ) : null,
        )}
      </svg>

      <figcaption className="flex justify-between text-caption text-muted">
        <span>{series[0]?.date}</span>
        <span>peak {peak} in a day</span>
        <span>{series[series.length - 1]?.date}</span>
      </figcaption>
    </figure>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * The acquisition funnel.
 *
 * Bar width is a share of the TOP stage, so the shape of the loss is visible at
 * a glance; the percentage on the right is of the stage ABOVE, which is where
 * the actionable step change shows.
 *
 * The visits/people boundary is drawn as a real line with a real explanation.
 * The first two stages count screen opens and the rest count people, and the
 * two are not divisible into one another (ANALYTICS.md §4). Without the rule
 * somebody eventually divides one by the other.
 */
export function FunnelBars({
  stages,
  labels,
  boundaryNote,
}: {
  stages: FunnelStage[];
  labels: Record<string, string>;
  boundaryNote?: string;
}) {
  /**
   * Each unit block is scaled to ITS OWN top stage, never to the whole chart.
   *
   * Found by looking at it: with 132 visits above and 4 learners below, every
   * people bar rendered as a two-pixel dot and the half of the funnel that
   * matters was unreadable. Scaling across the boundary is also the same
   * category error the boundary exists to prevent — it draws people as a
   * fraction of page loads.
   */
  const topOf: Record<string, number> = {};
  for (const stage of stages) {
    topOf[stage.unit] = Math.max(topOf[stage.unit] ?? 1, stage.count);
  }

  // Where the unit changes, found before the map rather than tracked with a
  // flag inside it — mutating during render is what `react-hooks/immutability`
  // exists to stop, and the index is a plain fact about the array anyway.
  const boundaryAt = boundaryNote
    ? stages.findIndex((stage, i) => i > 0 && stage.unit !== stages[i - 1].unit)
    : -1;

  return (
    <ol className="flex flex-col gap-sm list-none m-0 p-0">
      {stages.map((stage, i) => {
        const crossesBoundary = i === boundaryAt;

        return (
          <li key={stage.key} className="flex flex-col gap-sm">
            {crossesBoundary && (
              <p className="text-caption text-muted border-t border-border pt-sm">
                {boundaryNote}
              </p>
            )}

            <div className="flex flex-col gap-xs">
              <div className="flex items-baseline justify-between gap-md">
                <span className="text-body-sm text-ink">{labels[stage.key] ?? stage.key}</span>
                <span className="text-body-sm text-body tabular-nums shrink-0">
                  {stage.count}
                  {stage.ofPrevious !== null && (
                    <span className="text-muted"> · {percent(stage.ofPrevious)}</span>
                  )}
                </span>
              </div>

              <div className="h-2 rounded-full bg-surface overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(stage.count / topOf[stage.unit]) * 100}%` }}
                />
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * A short row of labelled bars — lessons in a chapter, a retention histogram,
 * a class split. Horizontal because the labels are words, and words set
 * sideways under a vertical bar are unreadable at 360px.
 */
export function BarList({
  rows,
  emptyLabel = "Nothing yet",
  tone = "primary",
}: {
  rows: { key: string; label: string; value: number; note?: string }[];
  emptyLabel?: string;
  tone?: "primary" | "amber";
}) {
  if (rows.length === 0) {
    return <p className="text-body-sm text-muted">{emptyLabel}</p>;
  }

  const top = Math.max(1, ...rows.map((row) => row.value));
  const fill = tone === "amber" ? "bg-notquite" : "bg-primary";

  return (
    <ul className="flex flex-col gap-sm list-none m-0 p-0">
      {rows.map((row) => (
        <li key={row.key} className="flex flex-col gap-xs">
          <div className="flex items-baseline justify-between gap-md">
            <span className="text-body-sm text-ink min-w-0 break-words">{row.label}</span>
            <span className="text-body-sm text-body tabular-nums shrink-0">
              {row.value}
              {row.note && <span className="text-muted"> · {row.note}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-surface overflow-hidden">
            <div className={`h-full rounded-full ${fill}`} style={{ width: `${(row.value / top) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Two funnels side by side, one per language.
 *
 * The direct test of D16 and the most important thing this page can find: a
 * Hindi learner dropping out one stage earlier than an English one is invisible
 * in every aggregate number above it.
 *
 * Each language is scaled to ITS OWN top stage, not to the larger cohort. The
 * question is "where does each group fall away", not "which group is bigger" —
 * a shared scale would answer the second question while looking like it
 * answered the first.
 */
export function LocaleFunnel({
  byLocale,
  labels,
  localeNames,
}: {
  byLocale: Record<string, FunnelStage[]>;
  labels: Record<string, string>;
  localeNames: Record<string, string>;
}) {
  const locales = Object.keys(byLocale).sort();
  if (locales.length === 0) {
    return <p className="text-body-sm text-muted">Nobody has registered yet.</p>;
  }

  const stageKeys = byLocale[locales[0]].map((stage) => stage.key);

  return (
    <div className="flex flex-col gap-md">
      {stageKeys.map((key) => (
        <div key={key} className="flex flex-col gap-xs">
          <span className="text-body-sm text-ink">{labels[key] ?? key}</span>
          {locales.map((locale) => {
            const stages = byLocale[locale];
            const stage = stages.find((s) => s.key === key);
            const top = Math.max(1, ...stages.map((s) => s.count));
            return (
              <div key={locale} className="flex items-center gap-sm">
                <span className="text-caption text-muted w-14 shrink-0">
                  {localeNames[locale] ?? locale}
                </span>
                <div className="h-2 flex-1 rounded-full bg-surface overflow-hidden">
                  <div
                    className={`h-full rounded-full ${locale === "hi" ? "bg-hint" : "bg-primary"}`}
                    style={{ width: `${((stage?.count ?? 0) / top) * 100}%` }}
                  />
                </div>
                <span className="text-caption text-body tabular-nums w-6 text-end shrink-0">
                  {stage?.count ?? 0}
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
