"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { Viz } from "@/components/learn/viz";
import { MarkdownBody } from "@/components/learn/MarkdownBody";
import type { TapStep as TapStepSpec } from "@/lib/learning/lessonSteps";
import { StepShell } from "./StepShell";

/**
 * Pick between two to four options, usually pictures.
 *
 * ── A LESSON NEVER GRADES (spec C7) ─────────────────────────────────────────
 * This looks like a question and is not one. Nothing is written to `attempts`,
 * no score is kept, no mastery moves, and **Continue is enabled the whole time**
 * — before answering, after answering right, and after answering wrong.
 *
 * A wrong tap marks the chosen option amber, marks the correct one, and shows
 * the one-line why. That is the entire consequence. A lesson that punishes is a
 * lesson a learner who is already behind stops opening, which is the same
 * reasoning as D17.
 * ────────────────────────────────────────────────────────────────────────────
 */
export function TapStep({ step }: { step: TapStepSpec }) {
  const t = useTranslations("lesson");
  const [chosen, setChosen] = useState<number | null>(null);
  const answered = chosen !== null;
  const right = chosen === step.answer;

  return (
    <StepShell md={step.md}>
      <div
        role="radiogroup"
        aria-label={step.md}
        className={cn("grid gap-md", step.options.length > 2 ? "grid-cols-2" : "grid-cols-1")}
      >
        {step.options.map((option, index) => {
          const isChosen = chosen === index;
          const isAnswer = index === step.answer;
          // After answering, the correct option is always marked — including
          // when it was not the one tapped. Being shown the right answer is the
          // point; hiding it to preserve a "score" would be for our benefit.
          const state = !answered
            ? "idle"
            : isAnswer
              ? "correct"
              : isChosen
                ? "notquite"
                : "idle";

          return (
            <button
              key={index}
              type="button"
              role="radio"
              aria-checked={isChosen}
              disabled={answered}
              onClick={() => setChosen(index)}
              className={cn(
                "flex flex-col items-center justify-center gap-sm min-h-[92px] p-md",
                "rounded-(--radius-card) border-2 transition-colors duration-150 ease-out",
                "focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2",
                state === "correct" && "border-correct bg-correct-soft",
                state === "notquite" && "border-notquite bg-notquite-soft",
                state === "idle" && (isChosen ? "border-primary bg-primary-soft" : "border-border bg-background"),
              )}
            >
              {option.viz && <Viz spec={option.viz} />}
              {option.label && (
                <span className="text-body text-ink">
                  <MarkdownBody markdown={option.label} inline />
                </span>
              )}
              {state === "correct" && (
                <span className="inline-flex items-center gap-xs text-label font-medium text-correct">
                  <Check size={16} strokeWidth={3} aria-hidden />
                  {t("gotIt")}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {answered && (
        <div
          role="status"
          className={cn(
            "flex flex-col gap-xs rounded-(--radius-card) px-lg py-md",
            right ? "bg-correct-soft" : "bg-notquite-soft",
          )}
        >
          <p className={cn("text-body-sm font-medium", right ? "text-correct" : "text-notquite")}>
            {right ? t("gotIt") : t("notQuiteHere")}
          </p>
          {step.why && (
            <div className="text-body-sm text-body">
              <MarkdownBody markdown={step.why} />
            </div>
          )}
        </div>
      )}
    </StepShell>
  );
}
