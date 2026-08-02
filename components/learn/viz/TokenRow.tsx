"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { layoutTokens, TOKEN_R } from "./geometry";
import type { TokenRowSpec } from "./types";

/**
 * `+1` and `−1` counters.
 *
 * ── THE ONE IDEA ────────────────────────────────────────────────────────────
 * A `+1` beside a `−1` makes nothing. That is the **zero pair**, and it is why
 * subtracting a negative leaves you better off — a fact learners are told and
 * do not believe, because in words it is a rule and only in pictures is it
 * obvious.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Positive is a filled chip, negative an outlined one, and each carries its own
 * sign — told apart by fill AND by glyph, never by hue alone (design rule 10).
 *
 * Negative is deliberately NOT amber. Amber means "not quite" everywhere else in
 * this product, and a negative number is not a mistake.
 */
export function TokenRow({ spec, className }: { spec: TokenRowSpec; className?: string }) {
  const t = useTranslations("viz");
  const { tokens, width, height, pairs } = layoutTokens(spec);

  return (
    <figure className={cn("m-0 flex flex-col items-center gap-sm", className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={t("tokens", { positive: spec.positive, negative: spec.negative })}
        className="w-full max-w-[280px] h-auto"
        style={{ maxHeight: `${height * 2}px` }}
      >
        {tokens.map((token, i) => (
          <g key={i} opacity={token.paired ? 0.45 : 1}>
            <circle
              cx={token.cx}
              cy={token.cy}
              r={TOKEN_R}
              fill={token.sign === 1 ? "var(--color-primary)" : "var(--color-background)"}
              stroke={token.sign === 1 ? "var(--color-primary)" : "var(--color-ink)"}
              strokeWidth="2.5"
            />
            <text
              x={token.cx}
              y={token.cy}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="20"
              fontWeight="600"
              fill={token.sign === 1 ? "var(--color-background)" : "var(--color-ink)"}
            >
              {token.sign === 1 ? "+" : "−"}
            </text>
          </g>
        ))}

        {/* One stroke through each cancelled column. Drawn last so it sits over
            both chips — a pair crossed out together reads as one thing gone,
            which is the point; two separate strikes read as two deletions. */}
        {Array.from({ length: pairs }, (_, i) => {
          const column = tokens.filter((tk) => tk.paired)[i * 2];
          if (!column) return null;
          return (
            <line
              key={`x${i}`}
              x1={column.cx - TOKEN_R - 3}
              y1={column.cy - TOKEN_R - 3}
              x2={column.cx + TOKEN_R + 3}
              y2={column.cy + TOKEN_R * 2 + 11}
              stroke="var(--color-muted)"
              strokeWidth="3"
              strokeLinecap="round"
            />
          );
        })}
      </svg>

      {spec.label && (
        <figcaption className="text-h3 text-ink tabular-nums">{spec.label}</figcaption>
      )}
    </figure>
  );
}
