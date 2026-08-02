"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { minorTicks, minus, numberLineBox, PAD, round, ticks, W } from "./geometry";
import type { NumberLineSpec, Tone } from "./types";

/**
 * A number line, with optional marks and jumps.
 *
 * Second most-used shape, and the one that carries the most weight in Class 7:
 * integer addition is *taught* as a jump along a line, and Saathi has been
 * describing that jump in words.
 *
 * `divisions` is what makes it work for fractions too — minor ticks between the
 * labelled whole numbers, so 3/4 has somewhere to actually sit.
 */

const TONE: Record<Tone, string> = {
  neutral: "var(--color-primary)",
  correct: "var(--color-correct)",
  notquite: "var(--color-notquite)",
  hint: "var(--color-hint)",
};

export function NumberLine({ spec, className }: { spec: NumberLineSpec; className?: string }) {
  const t = useTranslations("viz");

  const { from, to } = spec;
  const span = to - from || 1;
  const x = (value: number) => PAD + ((value - from) / span) * (W - PAD * 2);

  const jumps = spec.jumps ?? [];
  const { H, AXIS_Y } = numberLineBox(jumps.length > 0);
  const majors = ticks(from, to, spec.step);
  const minors = spec.divisions && spec.divisions > 1 ? minorTicks(majors, spec.divisions) : [];

  return (
    <figure className={cn("m-0 flex justify-center", className)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={t("numberLine", { from, to })}
        className="w-full max-w-[320px] h-auto"
      >
        <defs>
          <marker
            id="viz-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
          </marker>
        </defs>

        <line
          x1={PAD - 10}
          y1={AXIS_Y}
          x2={W - PAD + 10}
          y2={AXIS_Y}
          stroke="var(--color-border-strong)"
          strokeWidth="2"
        />

        {minors.map((value) => (
          <line
            key={`m${value}`}
            x1={round(x(value))}
            y1={AXIS_Y - 5}
            x2={round(x(value))}
            y2={AXIS_Y + 5}
            stroke="var(--color-body)"
            strokeWidth="2"
          />
        ))}

        {majors.map((value) => (
          <g key={`M${value}`}>
            <line
              x1={round(x(value))}
              y1={AXIS_Y - 9}
              x2={round(x(value))}
              y2={AXIS_Y + 9}
              stroke="var(--color-body)"
              strokeWidth="2"
            />
            <text
              x={round(x(value))}
              y={AXIS_Y + 28}
              textAnchor="middle"
              fontSize="14"
              fill="var(--color-body)"
              className="tabular-nums"
            >
              {minus(value)}
            </text>
          </g>
        ))}

        {/* Jumps arc ABOVE the line. Below would collide with the tick labels,
            and the arc is the part a learner traces with a finger. */}
        {jumps.map((jump, index) => {
          const colour = TONE[jump.tone ?? "neutral"];
          const x0 = x(jump.from);
          const x1 = x(jump.to);
          const peak = Math.min(48, 18 + Math.abs(x1 - x0) * 0.35);
          return (
            <g key={`j${index}`} style={{ color: colour }}>
              <path
                d={`M ${round(x0)} ${AXIS_Y - 10} Q ${round((x0 + x1) / 2)} ${round(AXIS_Y - 10 - peak)} ${round(x1)} ${AXIS_Y - 10}`}
                fill="none"
                stroke={colour}
                strokeWidth="2.5"
                strokeLinecap="round"
                markerEnd="url(#viz-arrow)"
              />
              {jump.label && (
                <text
                  x={round((x0 + x1) / 2)}
                  y={round(AXIS_Y - 16 - peak)}
                  textAnchor="middle"
                  fontSize="14"
                  fontWeight="600"
                  fill={colour}
                  className="tabular-nums"
                >
                  {jump.label}
                </text>
              )}
            </g>
          );
        })}

        {(spec.marks ?? []).map((mark, index) => {
          const colour = TONE[mark.tone ?? "neutral"];
          return (
            <g key={`k${index}`}>
              <circle cx={round(x(mark.at))} cy={AXIS_Y} r="7" fill={colour} />
              {mark.label && (
                <text
                  x={round(x(mark.at))}
                  y={AXIS_Y - 16}
                  textAnchor="middle"
                  fontSize="15"
                  fontWeight="600"
                  fill={colour}
                  className="tabular-nums"
                >
                  {mark.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
