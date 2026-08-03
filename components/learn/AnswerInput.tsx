"use client";

import { useId, useRef } from "react";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { Input } from "@/components/ui/Input";
import type { Choice } from "@/lib/i18n/content";
import { parseInput } from "@/lib/learning/questionInput";
import { spokenMath } from "@/lib/mathText";
import { MarkdownBody } from "./MarkdownBody";
import { ChoiceVizInput } from "./answer/ChoiceVizInput";
import { PlaceInput } from "./answer/PlaceInput";
import { BuildBarsInput } from "./answer/BuildBarsInput";
import { ShadeInput } from "./answer/ShadeInput";
import { TilesInput } from "./answer/TilesInput";

/**
 * The answer control, chosen by `answer_type`.
 *
 * Two things here are not cosmetic:
 *
 * 1. **`inputMode="decimal"` for numeric answers.** On a shared Android phone,
 *    a full QWERTY keyboard for a question whose answer is `-7` means hunting for
 *    the number row every single time. The decimal pad also carries `-` and `.`,
 *    which the `numeric` pad does not — and `-7` and `2.5` are both real answers
 *    here.
 *
 * 2. **MCQ options are radios, not buttons.** A radio group is one tab stop with
 *    arrow-key movement between options, which is how a keyboard or switch user
 *    expects to answer a multiple-choice question. Four buttons would be four tab
 *    stops and no group semantics.
 *
 * The choice **id** is what gets submitted and graded. Labels are translated
 * (D16); ids never are.
 */
export function AnswerInput({
  answerType,
  choices,
  input,
  value,
  onChange,
  onSubmit,
  disabled,
}: {
  answerType: string;
  choices: Choice[];
  /**
   * The authored pictorial control (D18 slice 5.2), as raw jsonb. Validated
   * here rather than trusted — see `parseInput`.
   */
  input?: unknown;
  value: string;
  onChange: (value: string) => void;
  /** Enter submits, so the whole question is answerable from the keyboard. */
  onSubmit: () => void;
  disabled: boolean;
}) {
  const t = useTranslations();
  const groupId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  /*
    ── PICTORIAL FIRST, TEXT AS THE FALLBACK ────────────────────────────────
    A question with a valid `input` renders its control; everything else falls
    through to exactly what shipped before this slice.

    The fallthrough is deliberately generous. `parseInput` returns null for a
    malformed blob, AND this switch has no case for a kind whose component has
    not been built yet — both land on the text field, which works. A question
    that loses its pictures is a worse question; a question that renders nothing
    is a dead end, and a learner cannot get past a dead end.
  */
  const spec = parseInput(input);

  if (spec?.kind === "tiles") {
    return <TilesInput spec={spec} value={value} onChange={onChange} disabled={disabled} />;
  }

  if (spec?.kind === "choiceViz") {
    return <ChoiceVizInput spec={spec} value={value} onChange={onChange} disabled={disabled} />;
  }

  if (spec?.kind === "shade") {
    return <ShadeInput spec={spec} value={value} onChange={onChange} disabled={disabled} />;
  }

  if (spec?.kind === "place") {
    return <PlaceInput spec={spec} value={value} onChange={onChange} disabled={disabled} />;
  }

  if (spec?.kind === "buildBars") {
    return <BuildBarsInput spec={spec} value={value} onChange={onChange} disabled={disabled} />;
  }

  if (answerType === "mcq") {
    return (
      <fieldset disabled={disabled} className="flex flex-col gap-md border-0 p-0 m-0">
        <legend className="text-label font-medium text-ink mb-sm">
          {t("practice.answerLabel")}
        </legend>

        {choices.map((choice) => {
          const id = `${groupId}-${choice.id}`;
          const selected = value === choice.id;

          return (
            <label
              key={choice.id}
              htmlFor={id}
              className={cn(
                "flex items-center gap-md min-h-12 px-lg py-md cursor-pointer",
                "rounded-(--radius-control) border transition-colors duration-150 ease-out",
                "has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-primary-soft",
                selected
                  ? "bg-primary-soft border-primary"
                  : "bg-background border-border-strong hover:bg-surface",
              )}
            >
              <input
                type="radio"
                id={id}
                name={groupId}
                value={choice.id}
                checked={selected}
                onChange={() => onChange(choice.id)}
                // Without this the accessible name falls back to `value` and a
                // screen-reader user hears "a", "b", "c", "d" — four options with
                // the maths stripped out. See lib/mathText.ts.
                aria-label={spokenMath(choice.label) || choice.id}
                className="sr-only"
              />
              {/* Selection is carried by a tick AND a fill, never by colour
                  alone (design rule 10). */}
              <span
                aria-hidden
                className={cn(
                  "inline-flex items-center justify-center size-6 shrink-0 rounded-full border-2",
                  selected ? "bg-primary border-primary text-white" : "border-border-strong",
                )}
              >
                {selected && <Check size={14} strokeWidth={3} />}
              </span>
              {/* Labels are maths, not plain text — `$\frac{2}{4}$` must reach
                  the learner as a fraction. The choice ID is what gets submitted
                  and graded; the label is only ever read. */}
              <span className="text-body text-ink">
                <MarkdownBody markdown={choice.label} inline />
              </span>
            </label>
          );
        })}
      </fieldset>
    );
  }

  const isNumeric =
    answerType === "integer" || answerType === "decimal" || answerType === "fraction";

  const hint =
    answerType === "fraction"
      ? t("practice.answerHintFraction")
      : answerType === "integer"
        ? t("practice.answerHintInteger")
        : undefined;

  return (
    <div className="flex flex-col gap-sm">
      <Input
        ref={inputRef}
        label={t("practice.answerLabel")}
        hint={hint}
        numeric={isNumeric}
        value={value}
        disabled={disabled}
        // Off for all four: a maths answer is not a name or an address, and an
        // autocomplete dropdown over the answer box on a shared phone can suggest
        // whatever the last person typed.
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onSubmit();
          }
        }}
      />

      {/*
        A "/" KEY, BECAUSE ANDROID'S NUMBER PAD DOES NOT HAVE ONE.

        Fractions were grouped with the other numeric types, so they opened
        `inputMode="decimal"` — digits, minus, dot, comma. No slash. The hint
        underneath said "Write it like 1/2" while the keyboard on the learner's
        own phone made that impossible to type. Reported from a real device; a
        360px browser shows a desktop keyboard and hides this completely.

        The obvious fix — switch fractions to a full QWERTY — is worse. On
        Android the slash sits behind the ?123 page, so it costs two taps AND
        the digits stop being one tap. This keeps the number pad and gives the
        slash a key of its own.

        `onMouseDown` preventDefault so the field never loses focus: if it blurs,
        the keypad closes and reopening it is another tap.
      */}
      {answerType === "fraction" && (
        <button
          type="button"
          disabled={disabled || value.includes("/")}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            onChange(`${value}/`);
            inputRef.current?.focus();
          }}
          aria-label={t("practice.insertSlash")}
          className="self-start min-h-11 min-w-11 px-lg inline-flex items-center justify-center
                     rounded-(--radius-control) border border-border-strong bg-surface
                     text-h3 text-ink disabled:opacity-40
                     focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        >
          /
        </button>
      )}
    </div>
  );
}
