"use client";

import { Delete } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import type { TilesInput as TilesSpec } from "@/lib/learning/questionInput";

/**
 * Assemble the answer from a bank of tiles, so the keyboard never opens.
 *
 * ── the two defects this closes, both reported from a real phone ────────────
 * Android's number pad has no `/`. A fraction answer needed a bespoke slash key
 * bolted onto the text field, because the hint said "write it like 1/2" while
 * the learner's own keyboard made that impossible. And `5/12` typed as `0.42`
 * grades wrong, because nothing tells a learner how many decimal places to give.
 *
 * A learner tapping `5`, `/`, `1`, `2` meets neither. There is no keyboard, and
 * there is no rounding decision to get wrong.
 *
 * ── the answer stays visible and stays editable ─────────────────────────────
 * The assembled string sits above the bank at maths size, and backspace removes
 * one tile. Not "clear everything": a learner who mistyped the last digit of a
 * two-digit answer should not be made to start again.
 *
 * Tiles are never disabled for being "used up" — the same digit can appear twice
 * in an answer (`22`, `11/12`), and a bank that greys out after one tap teaches
 * the wrong thing about numbers.
 */
export function TilesInput({
  spec,
  value,
  onChange,
  disabled,
}: {
  spec: TilesSpec;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const t = useTranslations();

  return (
    <div className="flex flex-col gap-md">
      <span className="text-label font-medium text-ink">{t("practice.answerLabel")}</span>

      {/*
        The assembled answer. `aria-live` so a screen-reader user hears it grow —
        without it, tapping a tile is silent and the only feedback is visual.

        Min-height reserves the row before anything is picked, so the bank does
        not jump down the screen on the first tap.
      */}
      <output
        aria-live="polite"
        className={cn(
          "flex items-center justify-center min-h-14 px-lg",
          "rounded-(--radius-control) border-2 border-dashed",
          value ? "border-primary bg-primary-wash" : "border-border-strong bg-surface",
        )}
      >
        <span className="text-math text-ink tabular-nums tracking-wide">
          {value || <span className="text-body-sm text-muted">{t("practice.tilesEmpty")}</span>}
        </span>
      </output>

      <div className="flex flex-wrap gap-sm" role="group" aria-label={t("practice.tilesLabel")}>
        {spec.bank.map((tile, index) => (
          <button
            // Index, not the tile: a bank may legitimately hold the same
            // character twice, and two identical keys would collapse into one.
            key={index}
            type="button"
            disabled={disabled}
            onClick={() => onChange(value + tile)}
            className="min-h-12 min-w-12 px-md inline-flex items-center justify-center
                       rounded-(--radius-control) border border-border-strong bg-background
                       text-h3 text-ink tabular-nums
                       transition-colors duration-150 ease-out
                       hover:bg-surface active:bg-primary-soft disabled:opacity-40
                       focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
          >
            {tile}
          </button>
        ))}

        <button
          type="button"
          disabled={disabled || value.length === 0}
          onClick={() => onChange(value.slice(0, -1))}
          aria-label={t("practice.tilesBackspace")}
          className="min-h-12 min-w-12 px-md inline-flex items-center justify-center
                     rounded-(--radius-control) border border-border-strong bg-surface
                     text-body transition-colors duration-150 ease-out
                     hover:bg-background disabled:opacity-40
                     focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        >
          <Delete size={20} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
    </div>
  );
}
