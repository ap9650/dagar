import { getTranslations } from "next-intl/server";
import { Check } from "lucide-react";
import type { DailyGoal } from "@/lib/learning/dailyGoal";

/**
 * The daily goal ring (D17) — "the strongest daily-return mechanic, and cheap".
 *
 * 72px, primary on a surface track, with the count inside. Inline SVG rather than a
 * chart library: it is two circles, and a library would cost the learner more data
 * than the entire rest of the page.
 *
 * When the goal is complete it says so and **stops asking**. No second goal, no
 * "keep going" — an app that moves the goalpost the moment you reach it teaches a
 * struggling learner that the target is never actually reachable.
 */
export async function DailyGoalRing({ goal }: { goal: DailyGoal }) {
  const t = await getTranslations("dashboard");

  const SIZE = 72;
  const STROKE = 8;
  const radius = (SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = circumference * goal.fraction;

  return (
    <div className="flex items-center gap-lg">
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={
          goal.complete
            ? t("dailyGoalComplete")
            : t("dailyGoalProgress", { done: goal.done, total: goal.total })
        }
        className="shrink-0"
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={radius}
          fill="none"
          stroke="var(--color-surface)"
          strokeWidth={STROKE}
        />
        {/* Omitted entirely at zero. A round line cap on a zero-length dash still
            paints a dot, which reads as "you have already started" to a learner who
            has not — the one impression this ring must never give. */}
        {goal.fraction > 0 && (
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={radius}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference}`}
            // Start at 12 o'clock rather than 3 — a ring that fills from the side
            // reads as a broken chart.
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            className="transition-[stroke-dasharray] duration-150 ease-out motion-reduce:transition-none"
          />
        )}
        {goal.complete ? (
          <g transform={`translate(${SIZE / 2 - 10} ${SIZE / 2 - 10})`}>
            <Check size={20} strokeWidth={2.5} color="var(--color-primary)" />
          </g>
        ) : (
          <text
            x="50%"
            y="50%"
            textAnchor="middle"
            dominantBaseline="central"
            className="text-label fill-ink"
          >
            {goal.done}/{goal.total}
          </text>
        )}
      </svg>

      <div className="flex flex-col gap-xs min-w-0">
        <h2 className="text-h3 text-ink">
          {goal.complete ? t("dailyGoalComplete") : t("dailyGoalTitle")}
        </h2>
        {/* Pair the ring with words, always: a ring alone is not readable to
            everyone (dagar-design § Progress). */}
        <p className="text-body-sm text-muted">
          {goal.complete
            ? t("dailyGoalDoneHelp")
            : goal.track === "practice"
              ? t("dailyGoalProgress", { done: goal.done, total: goal.total })
              : t("dailyGoalHint")}
        </p>
      </div>
    </div>
  );
}
