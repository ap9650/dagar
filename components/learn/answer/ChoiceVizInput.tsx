"use client";

import { useId } from "react";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { Viz } from "@/components/learn/viz";
import type { ChoiceVizInput as ChoiceVizSpec } from "@/lib/learning/questionInput";

/**
 * Pick between diagrams — "which one shows 3/8?".
 *
 * ── the client still does not know the answer (D3) ──────────────────────────
 * Unlike the lesson's `tap` step, nothing here marks anything right or wrong.
 * Each option carries a value, exactly as today's MCQ choices carry labels; the
 * learner submits the one they picked and the SERVER grades it. The feedback
 * panel that follows belongs to PracticeSession and is unchanged.
 *
 * ── one column, always ──────────────────────────────────────────────────────
 * Fraction bars are compared by stacking them: same width, same left edge, and
 * the difference is the shaded run. Side by side they end up at different scales
 * and the comparison — which IS the question — stops working. That was found on
 * screen in the lesson step and applies identically here.
 *
 * Real radios, not buttons: one tab stop with arrow-key movement between options
 * is how a keyboard or switch user expects to answer a multiple choice.
 */
export function ChoiceVizInput({
  spec,
  value,
  onChange,
  disabled,
}: {
  spec: ChoiceVizSpec;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const t = useTranslations();
  const groupId = useId();

  return (
    <fieldset disabled={disabled} className="flex flex-col gap-md border-0 p-0 m-0">
      <legend className="text-label font-medium text-ink mb-sm">
        {t("practice.answerLabel")}
      </legend>

      <div className="grid grid-cols-1 gap-md">
        {spec.options.map((option, index) => {
          const id = `${groupId}-${index}`;
          const selected = value === option.value;

          return (
            <label
              key={index}
              htmlFor={id}
              className={cn(
                "flex items-center gap-md min-h-[92px] px-lg py-md cursor-pointer",
                "rounded-(--radius-card) border-2 transition-colors duration-150 ease-out",
                "has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-primary-soft",
                selected
                  ? "bg-primary-soft border-primary"
                  : "bg-background border-border hover:bg-surface",
              )}
            >
              <input
                type="radio"
                id={id}
                name={groupId}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                // The diagram carries its own aria-label stating the maths, but
                // that sits inside the label element and is not the radio's
                // accessible NAME. Without this a screen-reader user hears the
                // raw value and nothing about the picture.
                aria-label={t("practice.optionShowing", { value: option.value })}
                className="sr-only"
              />

              {/* Selection is a tick AND a fill, never colour alone (rule 10). */}
              <span
                aria-hidden
                className={cn(
                  "inline-flex items-center justify-center size-6 shrink-0 rounded-full border-2",
                  selected ? "bg-primary border-primary text-white" : "border-border-strong",
                )}
              >
                {selected && <Check size={14} strokeWidth={3} />}
              </span>

              <span className="min-w-0 flex-1">
                <Viz spec={option.viz} />
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
