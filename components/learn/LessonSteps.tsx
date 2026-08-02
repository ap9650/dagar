"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Viz } from "@/components/learn/viz";
import { StepShell } from "@/components/learn/steps/StepShell";
import { TapStep } from "@/components/learn/steps/TapStep";
import { RevealStep } from "@/components/learn/steps/RevealStep";
import { WorkedStep } from "@/components/learn/steps/WorkedStep";
import type { LessonStep } from "@/lib/learning/lessonSteps";

/**
 * The step player (D18) — one idea per screen, with a visible finish line.
 *
 * ── WHAT THIS REPLACES ──────────────────────────────────────────────────────
 * A 215-word scroll ending in a button. A teacher of Classes 6–8 said her
 * students cannot hold two paragraphs, and the lessons proved her right: fifteen
 * of them, not one image between them.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * **Continue is never disabled.** Not on an unanswered `tap`, not on an unsolved
 * `build`. A lesson does not grade and does not gate (spec C7, D17) — a learner
 * who cannot get past screen four is a learner who stops opening the app, and
 * the concept they were stuck on is the one they now avoid entirely.
 *
 * Position is deliberately not persisted. Four minutes is short enough that
 * resume machinery costs more than it saves, and a learner returning to a lesson
 * usually wants the start of it.
 */
export function LessonSteps({
  steps,
  children,
}: {
  steps: LessonStep[];
  /** Rendered once the last step is passed — the lesson-complete action. */
  children: React.ReactNode;
}) {
  const t = useTranslations("lesson");
  const tCommon = useTranslations("common");

  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);
  const headingRef = useRef<HTMLDivElement>(null);

  // Move focus to the new step, or a keyboard and screen-reader user is left
  // where the old Continue button used to be, on content that no longer exists.
  useEffect(() => {
    headingRef.current?.focus();
  }, [index, done]);

  const total = steps.length;
  const step = steps[index];
  const last = index === total - 1;

  return (
    <section className="flex flex-col gap-xl">
      <div className="flex flex-col gap-sm">
        {/* Duolingo's most under-copied idea and one of the cheapest: a visible
            finish line is why people finish. */}
        <div
          className="h-2 w-full rounded-full bg-surface overflow-hidden"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={done ? total : index + 1}
          aria-label={t("stepOf", { step: done ? total : index + 1, total })}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
            style={{ width: `${((done ? total : index + 1) / total) * 100}%` }}
          />
        </div>
        <p className="text-caption text-muted">
          {t("stepOf", { step: done ? total : index + 1, total })}
        </p>
      </div>

      <div ref={headingRef} tabIndex={-1} className="outline-none">
        {done ? (
          <div className="flex flex-col gap-lg">{children}</div>
        ) : (
          <StepBody key={index} step={step} />
        )}
      </div>

      {!done && (
        <div className="flex items-center gap-md">
          {index > 0 && (
            <Button
              variant="ghost"
              onClick={() => setIndex((i) => i - 1)}
              aria-label={tCommon("back")}
              className="shrink-0 w-auto px-lg"
            >
              <ArrowLeft size={20} strokeWidth={1.75} aria-hidden />
            </Button>
          )}
          <Button
            className="flex-1"
            onClick={() => (last ? setDone(true) : setIndex((i) => i + 1))}
          >
            {last ? t("complete") : tCommon("continue")}
          </Button>
        </div>
      )}
    </section>
  );
}

/**
 * `key={index}` at the call site remounts this on every step, which is what
 * resets a `tap` selection or a half-revealed worked example. Without it, step 5
 * would open already answered because step 4's state is still there.
 */
function StepBody({ step }: { step: LessonStep }) {
  switch (step.kind) {
    case "tap":
      return <TapStep step={step} />;
    case "reveal":
      return <RevealStep step={step} />;
    case "worked":
      return <WorkedStep step={step} />;
    case "build":
      // The interactive flag lives on the viz, so `build` is `see` with a shape
      // the learner can touch. Kept as its own kind so an author declares intent
      // rather than remembering to set a boolean.
      return (
        <StepShell md={step.md}>
          <Viz spec={{ ...step.viz, interactive: true }} />
        </StepShell>
      );
    case "see":
      return (
        <StepShell md={step.md}>{step.viz && <Viz spec={step.viz} />}</StepShell>
      );
    default:
      return null;
  }
}
