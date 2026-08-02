"use client";

import { useTranslations } from "next-intl";
import { PartWhole } from "@/components/learn/viz";
import { shadedValue, type ShadeInput as ShadeSpec } from "@/lib/learning/questionInput";

/**
 * Fill in parts of a shape until it matches — "shade three quarters".
 *
 * The most direct of the four input kinds: the learner does not choose between
 * finished pictures, they **make** the fraction. That is the difference between
 * recognising `3/4` and knowing what it is.
 *
 * ── the client still does not know the answer (D3) ──────────────────────────
 * `PartWhole` has had an interactive mode since the lessons shipped, but there
 * it keeps the tapped set to itself and compares it against a `target` prop —
 * fine in a lesson, where the answer is allowed on the client. Here there is no
 * target. The shape reports how many parts are filled, this assembles
 * `shaded/parts`, and the SERVER decides whether that is right.
 *
 * The submitted value is deliberately NOT reduced: shading 2 of 4 submits `2/4`,
 * which D3 already grades correct against `1/2`. Reducing it here would hide
 * what the learner actually did from the attempt record and from the mentor
 * context — and it would mean writing a second piece of fraction arithmetic
 * outside `grading.ts`, which is the one file this slice must not duplicate.
 */
export function ShadeInput({
  spec,
  value,
  onChange,
  disabled,
}: {
  spec: ShadeSpec;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const t = useTranslations();

  // How many are filled right now, read back out of the assembled value so this
  // component holds no second copy of the truth.
  const shaded = Number(value.split("/")[0]) || 0;

  return (
    <div className="flex flex-col gap-md">
      <span className="text-label font-medium text-ink">{t("practice.answerLabel")}</span>

      <div
        className={disabled ? "pointer-events-none opacity-60" : undefined}
        // `PartWhole` renders its own live region announcing the count, so this
        // wrapper must not announce it a second time.
        aria-disabled={disabled}
      >
        <PartWhole
          spec={{
            kind: "partWhole",
            shape: spec.shape,
            parts: spec.parts,
            shaded: 0,
            interactive: true,
          }}
          onShadedChange={(count) => onChange(shadedValue(spec, count))}
        />
      </div>

      {/* The count in figures as well as in the picture. A learner who has
          shaded 5 of 8 should not have to re-count the diagram to check. */}
      <p className="text-body-sm text-muted text-center tabular-nums">
        {t("practice.shadeCount", { shaded, parts: spec.parts })}
      </p>
    </div>
  );
}
