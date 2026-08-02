"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { buildCells, VIEWBOX } from "./geometry";
import { sameSet, toIndexSet, type PartWholeSpec, type Tone } from "./types";

/**
 * A whole divided into equal parts, with some of them taken.
 *
 * The most-used shape in the curriculum, and the one Class 6 Lesson 1 was
 * missing when it said *"cut one roti into 4 equal pieces"* and showed nothing.
 *
 * ── THREE SHAPES, ONE MEANING ───────────────────────────────────────────────
 * `circle` is the roti — how a fraction is first met. `bar` is the fraction bar
 * — how fractions get compared, because two bars stack and two circles do not.
 * `grid` is for larger denominators, where twelve slices of a circle become
 * unreadable and unreachable by a thumb.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * **Interactive** means the learner taps parts to fill them ("shade three
 * quarters"). The target is checked on the FINAL state, never per tap, so
 * tapping quickly cannot produce a premature success or a flicker.
 *
 * Colour is never the only signal (design rule 10): the `compare` selection is
 * hatched as well as tinted, so the two selections are still distinguishable
 * with no colour perception at all.
 */

/**
 * Most parts that still leave a ≥44px touch target at the 280px the shape gets
 * on a 360px screen. A circle tolerates more because a wedge is wide at the rim
 * even when it is narrow at the centre; a bar segment is narrow everywhere.
 */
const INTERACTIVE_MAX: Record<PartWholeSpec["shape"], number> = {
  circle: 8,
  bar: 6,
  grid: 9,
};

const TONE_FILL: Record<Tone, string> = {
  neutral: "var(--color-primary)",
  correct: "var(--color-correct)",
  notquite: "var(--color-notquite)",
  hint: "var(--color-hint)",
};

export function PartWhole({ spec, className }: { spec: PartWholeSpec; className?: string }) {
  const t = useTranslations("viz");
  const hatchId = useId();

  const parts = Math.max(1, Math.min(spec.parts, 12));
  const authored = toIndexSet(spec.shaded, parts);
  const compare = toIndexSet(spec.compare, parts);

  const [tapped, setTapped] = useState<Set<number>>(new Set());
  const filled = spec.interactive ? tapped : authored;

  const target = toIndexSet(spec.target, parts);
  const solved = spec.interactive && target.size > 0 && sameSet(filled, target);

  function toggle(index: number) {
    setTapped((previous) => {
      const next = new Set(previous);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  // Composed from three keys rather than an ICU `select`, because a select's
  // branch names are Latin and the Hindi dictionary is checked for Latin script.
  // Three short nouns translate better than one clever string anyway.
  const shapeWord = t(
    spec.shape === "bar" ? "shapeBar" : spec.shape === "grid" ? "shapeGrid" : "shapeCircle",
  );
  const label = t("partWhole", { shape: shapeWord, parts, shaded: filled.size });

  const cells = buildCells(spec.shape, parts);

  // A touch target under 44px fails design rule 6, and the fix is NOT to quietly
  // draw a different number of parts — that would change the maths on screen to
  // suit the layout. It is an authoring constraint, so it is reported to the
  // author rather than corrected behind their back.
  if (process.env.NODE_ENV !== "production" && spec.interactive && parts > INTERACTIVE_MAX[spec.shape]) {
    console.warn(
      `[viz] interactive ${spec.shape} with ${parts} parts: targets fall below 44px. ` +
        `Max is ${INTERACTIVE_MAX[spec.shape]} — use a different shape, or make this step non-interactive.`,
    );
  }

  return (
    <figure className={cn("m-0 flex flex-col items-center gap-sm", className)}>
      <svg
        viewBox={`0 0 ${VIEWBOX} ${spec.shape === "bar" ? 88 : VIEWBOX}`}
        role="img"
        aria-label={label}
        className="w-full max-w-[280px] h-auto"
      >
        <defs>
          {/* The second selection is hatched, not merely a different colour. */}
          <pattern
            id={hatchId}
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="8" height="8" fill="var(--color-primary-soft)" />
            <line x1="0" y1="0" x2="0" y2="8" stroke="var(--color-hint)" strokeWidth="3" />
          </pattern>
        </defs>

        {cells.map((d, index) => {
          const isFilled = filled.has(index);
          const isCompare = compare.has(index);
          const fill = isCompare
            ? `url(#${hatchId})`
            : isFilled
              ? TONE_FILL[solved ? "correct" : "neutral"]
              : "var(--color-surface)";

          const shared = {
            d,
            fill,
            stroke: "var(--color-border-strong)",
            strokeWidth: 2,
            strokeLinejoin: "round" as const,
            className: "viz-fill",
          };

          if (!spec.interactive) return <path key={index} {...shared} />;

          return (
            <path
              key={index}
              {...shared}
              role="checkbox"
              aria-checked={isFilled}
              aria-label={t("partIndex", { index: index + 1, parts })}
              tabIndex={0}
              onClick={() => toggle(index)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  toggle(index);
                }
              }}
              className="viz-fill cursor-pointer focus-visible:outline-2 focus-visible:outline-primary"
            />
          );
        })}
      </svg>

      {spec.label && (
        <figcaption className="text-h3 text-ink tabular-nums">{spec.label}</figcaption>
      )}

      {/* Interactive state has to reach a screen reader too, and a live region is
          the only thing that announces a change the user made with a tap. */}
      {spec.interactive && (
        <p role="status" aria-live="polite" className="sr-only">
          {t("shadedCount", { shaded: filled.size, parts })}
        </p>
      )}
    </figure>
  );
}
