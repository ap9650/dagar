"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { GRID_CELL, GRID_GAP, GRID_SUM, gridSums, layoutGrid } from "./geometry";
import type { NumberGridSpec, Tone } from "./types";

/**
 * A small grid of numbers — magic squares and the grid puzzles of Class 7 Ch 6.
 *
 * ── WHAT MAKES IT TEACHABLE ─────────────────────────────────────────────────
 * The totals. A magic square's claim is that every row and every column adds to
 * the same thing, and a learner cannot check a claim whose evidence is not on
 * screen. So `showSums` prints each row and column total beside the row and
 * column it came from.
 *
 * A row containing a blank has **no total yet**, and is drawn "?" rather than a
 * number. Printing the sum of the filled cells would hand the learner a wrong
 * number to reason from, and printing 0 would be worse — see `gridSums`.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * A blank cell is the question. It is drawn with a dashed border so it reads as
 * "something goes here" rather than as a cell whose value happens to be nothing.
 */
export function NumberGrid({
  spec,
  className,
}: {
  spec: NumberGridSpec;
  className?: string;
}) {
  const t = useTranslations("viz");
  const rows = Math.max(2, Math.min(4, spec.rows));
  const cols = Math.max(2, Math.min(4, spec.cols));
  const showSums = spec.showSums ?? false;

  const { width, height, cell } = layoutGrid(rows, cols, showSums);
  const { rowSums, colSums } = gridSums(spec.cells, rows, cols);

  const filled = spec.cells.filter((c) => c.value !== undefined).length;

  return (
    <figure className={cn("m-0 flex flex-col items-center gap-sm", className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={t("grid", { rows, cols, filled })}
        className="w-full h-auto"
        style={{ maxWidth: `${Math.min(width * 1.4, 300)}px` }}
      >
        {Array.from({ length: rows }, (_, r) =>
          Array.from({ length: cols }, (_, c) => {
            const index = r * cols + c;
            const item = spec.cells[index] ?? {};
            const { x, y } = cell(r, c);
            const blank = item.value === undefined;

            return (
              <g key={index}>
                <rect
                  x={x}
                  y={y}
                  width={GRID_CELL}
                  height={GRID_CELL}
                  rx="6"
                  fill={fillFor(item.tone, blank)}
                  stroke={strokeFor(item.tone, blank)}
                  strokeWidth="2"
                  // Dashed says "something goes here". A solid empty cell reads
                  // as a cell whose value is nothing, which is a different claim.
                  strokeDasharray={blank ? "5 4" : undefined}
                />
                {!blank && (
                  <text
                    x={x + GRID_CELL / 2}
                    y={y + GRID_CELL / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="19"
                    fontWeight="600"
                    fill={textFor(item.tone)}
                  >
                    {item.value}
                  </text>
                )}
              </g>
            );
          }),
        )}

        {showSums && (
          <>
            {rowSums.map((sum, r) => (
              <text
                key={`r${r}`}
                x={cols * (GRID_CELL + GRID_GAP) + GRID_SUM / 2}
                y={cell(r, 0).y + GRID_CELL / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="15"
                fontWeight="600"
                fill="var(--color-primary)"
              >
                {sum ?? "?"}
              </text>
            ))}
            {colSums.map((sum, c) => (
              <text
                key={`c${c}`}
                x={cell(0, c).x + GRID_CELL / 2}
                y={rows * (GRID_CELL + GRID_GAP) + GRID_SUM / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="15"
                fontWeight="600"
                fill="var(--color-primary)"
              >
                {sum ?? "?"}
              </text>
            ))}
          </>
        )}
      </svg>

      {spec.label && (
        <figcaption className="text-h3 text-ink tabular-nums">{spec.label}</figcaption>
      )}
    </figure>
  );
}

function fillFor(tone: Tone | undefined, blank: boolean): string {
  if (blank) return "var(--color-background)";
  switch (tone) {
    case "correct":
      return "var(--color-correct-soft)";
    case "notquite":
      return "var(--color-not-quite-soft)";
    case "hint":
      return "var(--color-primary-soft)";
    default:
      return "var(--color-surface)";
  }
}

function strokeFor(tone: Tone | undefined, blank: boolean): string {
  if (blank) return "var(--color-primary)";
  switch (tone) {
    case "correct":
      return "var(--color-correct)";
    case "notquite":
      return "var(--color-not-quite)";
    case "hint":
      return "var(--color-primary)";
    default:
      return "var(--color-border-strong)";
  }
}

function textFor(tone: Tone | undefined): string {
  switch (tone) {
    case "correct":
      return "var(--color-correct)";
    case "notquite":
      return "var(--color-not-quite)";
    default:
      return "var(--color-ink)";
  }
}
