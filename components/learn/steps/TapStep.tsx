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
  const hasPictures = step.options.some((option) => option.viz);

  return (
    <StepShell md={step.md}>
      {/* ── ONE COLUMN WHENEVER THERE ARE PICTURES ───────────────────────────
          Fraction bars are compared by stacking them: same width, same left
          edge, and the difference is the shaded run. Side by side in a
          two-column grid they end up at different scales and the comparison —
          which IS the question — stops working. Two columns is only for short
          text options. */}
      <div
        role="radiogroup"
        aria-label={step.md}
        className={cn("grid gap-md", hasPictures ? "grid-cols-1" : "grid-cols-2")}
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
              {/* A tick, not a sentence: the panel below already says "That's
                  it" and gives the reason. Saying it twice on one screen makes
                  the answer feel like an announcement rather than a fact. */}
              {state === "correct" && (
                <Check size={20} strokeWidth={3} aria-hidden className="text-correct" />
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
