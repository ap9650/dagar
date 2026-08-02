"use client";

import { useTranslations } from "next-intl";
import { NumberLine } from "@/components/learn/viz";
import { minus } from "@/components/learn/viz/geometry";
import { placedValue, type PlaceInput as PlaceSpec } from "@/lib/learning/questionInput";

/**
 * Point at where a number lives — "where is −3?", "where is 3/5?".
 *
 * The one input kind where the ANSWER IS A POSITION rather than a symbol, which
 * is exactly how the number line is taught: a fraction is not a piece of
 * something, it is a place between two whole numbers, and a negative number is a
 * place to the left of zero.
 *
 * ── snapping is not a convenience, it is the grading contract ───────────────
 * A thumb landing at 2.03 submits `2`. Without that the learner would be graded
 * on their aim, and `-2.9998` would be marked wrong for a correct answer of
 * `-3`. `placedValue` also rounds to the line's own precision, so a step of 0.1
 * never submits `0.30000000000000004`.
 *
 * The server still grades it. Nothing here knows the right answer (D3).
 */
export function PlaceInput({
  spec,
  value,
  onChange,
  disabled,
}: {
  spec: PlaceSpec;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const t = useTranslations();

  // Read back out of the assembled value, so there is no second copy of the
  // truth to drift. An unanswered question has no dot at all — a dot sitting at
  // zero by default would read as "you have already answered".
  const picked = value === "" ? null : Number(value);

  return (
    <div className="flex flex-col gap-md">
      <span className="text-label font-medium text-ink">{t("practice.answerLabel")}</span>

      <div className={disabled ? "pointer-events-none opacity-60" : undefined}>
        <NumberLine
          spec={{ kind: "numberLine", from: spec.from, to: spec.to, step: spec.step }}
          picked={picked}
          onPick={(at) => onChange(placedValue(spec, at))}
        />
      </div>

      <p role="status" aria-live="polite" className="text-body-sm text-muted text-center tabular-nums">
        {picked === null
          ? t("practice.placeHint")
          : // A real minus sign, matching the labels on the line itself. The
            // submitted value keeps its plain hyphen — only the reading changes.
            t("practice.placePicked", { value: minus(picked) })}
      </p>
    </div>
  );
}
