"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import {
  CHART_H,
  CHART_LEFT,
  CHART_W,
  chartMax,
  chartTicks,
  chartY,
  layoutBars,
  layoutIcons,
  tallyGroups,
} from "./geometry";
import type { ChartSpec } from "./types";

/**
 * Tally marks, a pictograph and a bar graph — one component, because they are
 * one idea (Class 6 Ch 4, Ganita Prakash).
 *
 * ── WHAT THIS HAS TO GET RIGHT ──────────────────────────────────────────────
 * A chart in a maths lesson is not an illustration, it is the question. A bar
 * drawn 4% too tall is a wrong answer waiting to happen, so every height comes
 * from `geometry.ts` and is unit-tested there rather than being nudged by eye.
 *
 * Three specifics the chapter turns on:
 *
 *   - **The axis reads in numbers a child counts in.** Scaling exactly to the
 *     tallest bar gives gridlines at 1.75 and teaches nothing. See `chartMax`.
 *   - **The pictograph key is arithmetic, not a caption.** It is stated above
 *     the icons, and a part-icon is drawn as a real fraction of one.
 *   - **A tally bundle is always five.** Groups come from `tallyGroups` so a
 *     six-bar bundle cannot be drawn by accident.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Colour is never the only signal (design rule 10): every bar carries its value
 * as a number above it, and every category its own written label beneath.
 */
export function Chart({ spec, className }: { spec: ChartSpec; className?: string }) {
  const t = useTranslations("viz");
  const categories = spec.categories.slice(0, 6);

  const described = t("chart", {
    count: categories.length,
    labels: categories.map((c) => `${c.label} ${c.value}`).join(", "),
  });

  return (
    <figure className={cn("m-0 flex flex-col items-center gap-sm", className)}>
      {spec.variant === "pictograph" && spec.each ? (
        // Above the picture, not below it. A key read after the icons is a key
        // read too late — the learner has already counted them as ones.
        <p className="text-body-sm text-body self-start ps-xs">
          {t("chartKey", { each: spec.each })}
        </p>
      ) : null}

      {spec.variant === "bar" ? (
        <BarChart spec={spec} categories={categories} label={described} />
      ) : spec.variant === "pictograph" ? (
        <Pictograph spec={spec} categories={categories} label={described} />
      ) : (
        <Tally categories={categories} label={described} />
      )}

      {spec.label && (
        <figcaption className="text-h3 text-ink tabular-nums">{spec.label}</figcaption>
      )}
    </figure>
  );
}

type Cats = ChartSpec["categories"];

function toneFill(tone: Cats[number]["tone"]): string {
  switch (tone) {
    case "correct":
      return "var(--color-correct)";
    case "notquite":
      return "var(--color-not-quite)";
    case "hint":
      return "var(--color-hint)";
    default:
      return "var(--color-primary)";
  }
}

function BarChart({
  spec,
  categories,
  label,
}: {
  spec: ChartSpec;
  categories: Cats;
  label: string;
}) {
  const max = chartMax(
    categories.map((c) => c.value),
    spec.max,
  );
  const { bars, plotH } = layoutBars(categories, max);
  const ticks = chartTicks(max);

  return (
    <svg
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      role="img"
      aria-label={label}
      className="w-full max-w-[320px] h-auto"
    >
      {/* Gridlines first, so bars sit over them rather than being cut by them. */}
      {ticks.map((value) => {
        const y = chartY(value, max, plotH);
        return (
          <g key={value}>
            <line
              x1={CHART_LEFT}
              y1={y}
              x2={CHART_W - 6}
              y2={y}
              stroke="var(--color-border)"
              strokeWidth="1"
            />
            <text
              x={CHART_LEFT - 6}
              y={y}
              textAnchor="end"
              dominantBaseline="central"
              fontSize="11"
              fill="var(--color-muted)"
            >
              {value}
            </text>
          </g>
        );
      })}

      <line
        x1={CHART_LEFT}
        y1={plotH}
        x2={CHART_W - 6}
        y2={plotH}
        stroke="var(--color-ink)"
        strokeWidth="2"
      />

      {bars.map((bar, i) => (
        <g key={i}>
          <rect
            x={bar.x}
            y={bar.y}
            width={bar.w}
            height={bar.h}
            rx="3"
            fill={toneFill(categories[i]?.tone)}
          />
          {/* The value, always. Reading a height off an axis is the SKILL being
              taught, but a chart that only encodes it as height is unreadable
              to anyone who cannot see the axis — and that is rule 10. */}
          <text
            x={bar.x + bar.w / 2}
            y={bar.y - 5}
            textAnchor="middle"
            fontSize="12"
            fontWeight="600"
            fill="var(--color-ink)"
          >
            {bar.value}
          </text>
          <text
            x={bar.x + bar.w / 2}
            y={plotH + 15}
            textAnchor="middle"
            fontSize="11"
            fill="var(--color-body)"
          >
            {bar.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function Pictograph({
  spec,
  categories,
  label,
}: {
  spec: ChartSpec;
  categories: Cats;
  label: string;
}) {
  const each = Math.max(1, spec.each ?? 1);
  const rowH = 30;
  const iconR = 9;
  const left = 66;

  return (
    <svg
      viewBox={`0 0 ${CHART_W} ${categories.length * rowH + 8}`}
      role="img"
      aria-label={label}
      className="w-full max-w-[320px] h-auto"
    >
      {categories.map((category, row) => {
        const { full, part } = layoutIcons(category.value, each);
        const cy = row * rowH + rowH / 2;
        return (
          <g key={row}>
            <text
              x={left - 8}
              y={cy}
              textAnchor="end"
              dominantBaseline="central"
              fontSize="11"
              fill="var(--color-body)"
            >
              {category.label}
            </text>
            {Array.from({ length: Math.min(full, 10) }, (_, i) => (
              <circle
                key={i}
                cx={left + iconR + i * (iconR * 2 + 5)}
                cy={cy}
                r={iconR}
                fill={toneFill(category.tone)}
              />
            ))}
            {/* A part-icon is a real wedge of a circle, not a smaller one. A
                smaller circle says "a different thing"; half a circle says
                "half of one of those", which is what the key means. */}
            {part > 0 && full < 10 && (
              <path
                d={wedge(left + iconR + full * (iconR * 2 + 5), cy, iconR, part)}
                fill={toneFill(category.tone)}
              />
            )}
            <text
              x={CHART_W - 4}
              y={cy}
              textAnchor="end"
              dominantBaseline="central"
              fontSize="11"
              fontWeight="600"
              fill="var(--color-ink)"
            >
              {category.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** A pie wedge of `fraction` of a circle, starting at 12 o'clock. */
function wedge(cx: number, cy: number, r: number, fraction: number): string {
  const clamped = Math.min(0.999, Math.max(0, fraction));
  const angle = clamped * Math.PI * 2;
  const x = cx + r * Math.sin(angle);
  const y = cy - r * Math.cos(angle);
  return `M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 ${clamped > 0.5 ? 1 : 0} 1 ${x} ${y} Z`;
}

function Tally({ categories, label }: { categories: Cats; label: string }) {
  const rowH = 30;
  const left = 66;
  const barH = 16;
  const barGap = 5;
  const groupGap = 12;

  return (
    <svg
      viewBox={`0 0 ${CHART_W} ${categories.length * rowH + 8}`}
      role="img"
      aria-label={label}
      className="w-full max-w-[320px] h-auto"
    >
      {categories.map((category, row) => {
        const cy = row * rowH + rowH / 2;
        let x = left;
        const marks: React.ReactNode[] = [];

        tallyGroups(category.value).forEach((size, g) => {
          const start = x;
          // Four uprights, then the fifth struck across them.
          for (let i = 0; i < Math.min(size, 4); i++) {
            marks.push(
              <line
                key={`${g}-${i}`}
                x1={x}
                y1={cy - barH / 2}
                x2={x}
                y2={cy + barH / 2}
                stroke="var(--color-ink)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />,
            );
            x += barGap;
          }
          if (size === 5) {
            marks.push(
              <line
                key={`${g}-x`}
                x1={start - 3}
                y1={cy + barH / 2}
                x2={x - barGap + 3}
                y2={cy - barH / 2}
                stroke="var(--color-ink)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />,
            );
          }
          x += groupGap;
        });

        return (
          <g key={row}>
            <text
              x={left - 8}
              y={cy}
              textAnchor="end"
              dominantBaseline="central"
              fontSize="11"
              fill="var(--color-body)"
            >
              {category.label}
            </text>
            {marks}
            <text
              x={CHART_W - 4}
              y={cy}
              textAnchor="end"
              dominantBaseline="central"
              fontSize="11"
              fontWeight="600"
              fill="var(--color-ink)"
            >
              {category.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
