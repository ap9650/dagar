"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { layoutPan, PAN_HALF, PAN_ITEM } from "./geometry";
import type { BalanceScaleSpec } from "./types";

/**
 * A pan balance — the mental model the whole of Class 8 rests on.
 *
 * Lesson 1 says it in words: *"An equation is a balance. Whatever is on the left
 * weighs exactly the same as whatever is on the right."* Every rule in the
 * chapter falls out of that, including the one learners recite without believing
 * — whatever you do to one side, do to the other.
 *
 * **Level by default**, because a written equation IS level; that is the claim
 * the `=` sign makes. The tilt exists for exactly one teaching moment: what
 * happens if you take from one side alone.
 */

const W = 320;
/** Beam reach. Pans hang here, and must not run off the canvas. */
const ARM = 88;
const H = 180;
const BEAM_Y = 52;
const PAN_Y = 118;
const TILT = 10;

export function BalanceScale({ spec, className }: { spec: BalanceScaleSpec; className?: string }) {
  const t = useTranslations("viz");
  const drop = spec.tilt === "left" ? TILT : spec.tilt === "right" ? -TILT : 0;

  return (
    <figure className={cn("m-0 flex flex-col items-center gap-sm", className)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={t("balance", {
          leftX: spec.left.xs,
          leftOne: spec.left.n ?? 0,
          rightX: spec.right.xs,
          rightOne: spec.right.n ?? 0,
        })}
        className="w-full max-w-[320px] h-auto"
      >
        {/* Beam — tilts about the pivot, so the two pans move oppositely. */}
        <line
          x1={W / 2 - ARM}
          y1={BEAM_Y + drop}
          x2={W / 2 + ARM}
          y2={BEAM_Y - drop}
          stroke="var(--color-body)"
          strokeWidth="5"
          strokeLinecap="round"
        />
        {/* Pillar and pivot */}
        <path
          d={`M ${W / 2} ${BEAM_Y} V ${H - 22} M ${W / 2 - 26} ${H - 22} H ${W / 2 + 26}`}
          stroke="var(--color-body)"
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx={W / 2} cy={BEAM_Y} r="6" fill="var(--color-body)" />

        <Pan
          cx={W / 2 - ARM}
          top={BEAM_Y + drop}
          y={PAN_Y + drop}
          xs={spec.left.xs}
          n={spec.left.n}
        />
        <Pan
          cx={W / 2 + ARM}
          top={BEAM_Y - drop}
          y={PAN_Y - drop}
          xs={spec.right.xs}
          n={spec.right.n}
        />
      </svg>

      {spec.label && (
        <figcaption className="text-h3 text-ink tabular-nums">{spec.label}</figcaption>
      )}
    </figure>
  );
}

/**
 * One pan, with its contents sitting ON it rather than floating.
 *
 * `x` boxes are drawn larger than the unit weights on purpose: an unknown that
 * looks the same size as a 1 invites the reading that x is 1, which is the exact
 * confusion this picture exists to prevent.
 */
function Pan({
  cx,
  top,
  y,
  xs,
  n,
}: {
  cx: number;
  top: number;
  y: number;
  xs: number;
  n?: number;
}) {
  const items = layoutPan(xs, n, cx);
  const { boxH, weightH } = PAN_ITEM;

  return (
    <g>
      <line x1={cx} y1={top} x2={cx} y2={y} stroke="var(--color-border-strong)" strokeWidth="2" />
      <path
        d={`M ${cx - PAN_HALF} ${y} H ${cx + PAN_HALF}`}
        stroke="var(--color-body)"
        strokeWidth="4"
        strokeLinecap="round"
      />

      {items.map((item, i) =>
        item.kind === "x" ? (
          <g key={i}>
            <rect x={item.x} y={y - boxH - 2} width={item.w} height={boxH} rx="3" fill="var(--color-primary)" />
            <text
              x={item.x + item.w / 2}
              y={y - boxH / 2 - 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="15"
              fontWeight="600"
              fontStyle="italic"
              fill="var(--color-background)"
            >
              x
            </text>
          </g>
        ) : (
          <g key={i}>
            <rect
              x={item.x}
              y={y - weightH - 2}
              width={item.w}
              height={weightH}
              rx="3"
              fill="var(--color-surface)"
              stroke="var(--color-border-strong)"
              strokeWidth="2"
            />
            <text
              x={item.x + item.w / 2}
              y={y - weightH / 2 - 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="15"
              fontWeight="600"
              fill="var(--color-ink)"
              className="tabular-nums"
            >
              {item.value}
            </text>
          </g>
        ),
      )}
    </g>
  );
}
