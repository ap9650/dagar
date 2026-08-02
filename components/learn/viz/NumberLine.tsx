"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { minorTicks, minus, numberLineBox, PAD, round, ticks, W } from "./geometry";
import type { NumberLineSpec, Tone } from "./types";

/**
 * A number line, with optional marks and jumps.
 *
 * Second most-used shape, and the one that carries the most weight in Class 7:
 * integer addition is *taught* as a jump along a line, and Dagar has been
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

export function NumberLine({
  spec,
  className,
  onPick,
  picked,
}: {
  spec: NumberLineSpec;
  className?: string;
  /**
   * Turns the line into a control the learner points at, for PRACTICE (D18 5.2a).
   *
   * Additive: without it this renders exactly as it always has, and the fifteen
   * lessons that use it are untouched.
   *
   * ── why the WHOLE line is the target, not one button per tick ─────────────
   * A line from −5 to 5 has eleven positions across 320px — 29px each, well
   * under the 44px minimum. Discrete buttons would either break design rule 6
   * or force every question onto a shorter line.
   *
   * So a tap anywhere is valid and snaps to the nearest mark (`placedValue`).
   * There is no gap between targets and therefore nothing to miss, which serves
   * the rule better than eleven small buttons would. The learner is answering a
   * maths question, not being tested on their aim.
   */
  onPick?: (value: number) => void;
  /** The value currently chosen, drawn as the learner's own mark. */
  picked?: number | null;
}) {
  const t = useTranslations("viz");

  const { from, to } = spec;
  const span = to - from || 1;
  const x = (value: number) => PAD + ((value - from) / span) * (W - PAD * 2);

  /** Screen x → a value on the line. Uses the rendered box, so scaling is free. */
  function valueAt(clientX: number, box: DOMRect): number {
    const ratio = (clientX - box.left) / box.width;      // 0…1 across the SVG
    const inner = (ratio * W - PAD) / (W - PAD * 2);     // 0…1 across the AXIS
    return from + Math.min(Math.max(inner, 0), 1) * span;
  }

  function nudge(direction: 1 | -1) {
    // With nothing chosen yet, an arrow key starts from the MIDDLE of the line,
    // not from `from`. Starting at the left end makes the first ArrowLeft do
    // nothing — the control looks broken to the one user who most needs it to
    // work, since a keyboard or switch user has no other way in. On an integer
    // line the midpoint is also the natural place to start: zero.
    const current = picked ?? from + Math.round(span / 2 / spec.step) * spec.step;
    onPick?.(Math.min(Math.max(current + direction * spec.step, from), to));
  }

  const jumps = spec.jumps ?? [];
  const { H, AXIS_Y } = numberLineBox(jumps.length > 0);
  const majors = ticks(from, to, spec.step);
  const minors = spec.divisions && spec.divisions > 1 ? minorTicks(majors, spec.divisions) : [];

  return (
    <figure className={cn("m-0 flex justify-center", className)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        // `slider` is the native pattern for "choose a value along a line", and
        // it brings arrow keys and a spoken value with it. Without `onPick` this
        // stays a plain image, exactly as the lessons expect.
        role={onPick ? "slider" : "img"}
        aria-label={t("numberLine", { from, to })}
        {...(onPick && {
          tabIndex: 0,
          "aria-valuemin": from,
          "aria-valuemax": to,
          "aria-valuenow": picked ?? undefined,
          onClick: (event: React.MouseEvent<SVGSVGElement>) =>
            onPick(valueAt(event.clientX, event.currentTarget.getBoundingClientRect())),
          onKeyDown: (event: React.KeyboardEvent<SVGSVGElement>) => {
            if (event.key === "ArrowRight" || event.key === "ArrowUp") {
              event.preventDefault();
              nudge(1);
            } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
              event.preventDefault();
              nudge(-1);
            }
          },
        })}
        className={cn("w-full max-w-[320px] h-auto", onPick && "cursor-pointer touch-none")}
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

        {/* The learner's own choice, drawn like an authored mark so the line
            reads the same whether the dot was placed by us or by them. */}
        {onPick && picked !== null && picked !== undefined && (
          <g>
            <circle cx={round(x(picked))} cy={AXIS_Y} r="9" fill="var(--color-primary)" />
            <text
              x={round(x(picked))}
              y={AXIS_Y - 18}
              textAnchor="middle"
              fontSize="15"
              fontWeight="600"
              fill="var(--color-primary)"
              className="tabular-nums"
            >
              {minus(picked)}
            </text>
          </g>
        )}

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
