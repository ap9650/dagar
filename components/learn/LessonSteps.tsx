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
import { SpeakButton } from "@/components/learn/SpeakButton";

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
 *
 * ── THE LAST STEP FINISHES THE LESSON ───────────────────────────────────────
 * It did not. This player had a `done` state that swapped the step body for the
 * completion button — and that button carried the SAME label as the last step's,
 * so finishing a lesson read as:
 *
 *     Step 8 of 8 · [Got it — continue]   →   Step 8 of 8 · (nothing at all)
 *                                              [Got it — continue]
 *
 * A blank screen, at full progress, asking again for something already given.
 * Reported from a phone, and only ever seen on a FIRST visit: a lesson opened
 * again arrives already complete, so the second screen showed "Practise this"
 * instead and the fault hid itself.
 *
 * The last step's button now IS the finishing action, through `onFinish`.
 * ────────────────────────────────────────────────────────────────────────────
 */
export function LessonSteps({
  steps,
  speech,
  onFinish,
  finishing = false,
}: {
  steps: LessonStep[];
  /**
   * What to say for each step, per language, built on the server from EACH
   * LANGUAGE'S OWN steps. `hi` is null when there is no Hindi text — the button
   * must not offer a language it would have to fake.
   */
  speech: { en: string; hi: string | null }[];
  /** Called by the last step's button. This is where the lesson ends. */
  onFinish: () => void;
  finishing?: boolean;
}) {
  const t = useTranslations("lesson");
  const tCommon = useTranslations("common");

  const [index, setIndex] = useState(0);
  const headingRef = useRef<HTMLDivElement>(null);

  // Move focus to the new step, or a keyboard and screen-reader user is left
  // where the old Continue button used to be, on content that no longer exists.
  useEffect(() => {
    headingRef.current?.focus();
  }, [index]);

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
          aria-valuenow={index + 1}
          aria-label={t("stepOf", { step: index + 1, total })}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>
        <div className="flex items-center justify-between gap-md">
          <p className="text-caption text-muted">
            {t("stepOf", { step: index + 1, total })}
          </p>
          {speech[index] && <SpeakButton text={speech[index]} />}
        </div>
      </div>

      <div ref={headingRef} tabIndex={-1} className="outline-none">
        <StepBody key={index} step={step} />
      </div>

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
          loading={last && finishing}
          onClick={() => (last ? onFinish() : setIndex((i) => i + 1))}
        >
          {last ? t("complete") : tCommon("continue")}
        </Button>
      </div>
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
