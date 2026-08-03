"use client";

import { Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Chart } from "@/components/learn/viz";
import {
  barsFromValue,
  barsValue,
  type BuildBarsInput as BuildBarsSpec,
} from "@/lib/learning/questionInput";

/**
 * Draw the bar graph — the learner sets each bar until it matches the data.
 *
 * ── WHY STEPPERS AND NOT DRAGGING ───────────────────────────────────────────
 * Dragging a bar to a height is the obvious design and it is the wrong one
 * here. The target device is a shared, often old Android; a drag that fights
 * the page's own scroll is the single most frustrating control you can put on
 * such a phone, and a learner who cannot set the bar cannot answer the
 * question at all.
 *
 * A stepper is boring and it works: two 44px targets, keyboard reachable,
 * screen-reader announceable, and unambiguous about what one tap does. The bar
 * still grows under the learner's thumb, which is the part that matters — the
 * chart above is live, so pressing `+` visibly raises the bar being pressed.
 *
 * Revisit if a real learner asks to drag it. Not before.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * The client never learns the answer (D3). It knows the categories and the axis
 * top — both are the QUESTION — and nothing about the target heights. The server
 * grades the joined string, exactly as it grades a typed one.
 */
export function BuildBarsInput({
  spec,
  value,
  onChange,
  disabled,
}: {
  spec: BuildBarsSpec;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const t = useTranslations();
  const step = spec.step ?? 1;

  // The submitted value IS the state. No second copy to drift.
  const heights = barsFromValue(value, spec.categories.length);

  function setBar(index: number, next: number) {
    const clamped = Math.min(Math.max(next, 0), spec.max);
    onChange(barsValue(heights.map((h, i) => (i === index ? clamped : h))));
  }

  return (
    <div className="flex flex-col gap-md">
      <span className="text-label font-medium text-ink">{t("practice.answerLabel")}</span>

      {/* Live. The whole point is that the picture answers back. */}
      <Chart
        spec={{
          kind: "chart",
          variant: "bar",
          max: spec.max,
          categories: spec.categories.map((label, i) => ({ label, value: heights[i] })),
        }}
      />

      <div
        className={disabled ? "pointer-events-none opacity-60" : undefined}
        aria-disabled={disabled}
      >
        <ul className="flex flex-col gap-sm list-none m-0 p-0">
          {spec.categories.map((label, i) => (
            <li key={label} className="flex items-center gap-md">
              <span className="text-body-sm text-body flex-1 min-w-0 truncate">{label}</span>

              <button
                type="button"
                disabled={disabled || heights[i] <= 0}
                onClick={() => setBar(i, heights[i] - step)}
                // Named for the BAR, not "minus". A screen-reader user hearing
                // four identical "decrease" buttons cannot tell which is which.
                aria-label={t("practice.barDown", { label })}
                className="inline-flex items-center justify-center size-11 shrink-0
                           rounded-(--radius-control) border border-border-strong
                           text-ink disabled:opacity-40
                           active:bg-primary-soft active:scale-90
                           [-webkit-tap-highlight-color:transparent]"
              >
                <Minus size={20} strokeWidth={1.75} aria-hidden />
              </button>

              {/* aria-live so the value is announced as it changes, rather than
                  only being discoverable by re-reading the button labels. */}
              <output
                aria-live="polite"
                className="text-h3 text-ink tabular-nums w-10 text-center"
              >
                {heights[i]}
              </output>

              <button
                type="button"
                disabled={disabled || heights[i] >= spec.max}
                onClick={() => setBar(i, heights[i] + step)}
                aria-label={t("practice.barUp", { label })}
                className="inline-flex items-center justify-center size-11 shrink-0
                           rounded-(--radius-control) border border-border-strong
                           text-ink disabled:opacity-40
                           active:bg-primary-soft active:scale-90
                           [-webkit-tap-highlight-color:transparent]"
              >
                <Plus size={20} strokeWidth={1.75} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
