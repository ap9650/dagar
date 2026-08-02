"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { MarkdownBody } from "@/components/learn/MarkdownBody";
import type { WorkedStep as WorkedStepSpec } from "@/lib/learning/lessonSteps";
import { StepShell } from "./StepShell";

/**
 * A worked example, one line at a time.
 *
 * The same lines the old prose lesson showed all at once. Revealed in sequence
 * they are read; shown as a block they are skimmed and then the learner arrives
 * at practice believing they followed it.
 *
 * Each line keeps the lesson-body left border, so a worked example still looks
 * like a worked example.
 */
export function WorkedStep({ step }: { step: WorkedStepSpec }) {
  const t = useTranslations("common");
  const [shown, setShown] = useState(1);
  const done = shown >= step.lines.length;

  return (
    <StepShell md={step.md}>
      <ol className="flex flex-col gap-md list-none p-0 m-0">
        {step.lines.slice(0, shown).map((line, index) => (
          <li
            key={index}
            className="border-s-[3px] border-primary bg-surface rounded-e-(--radius-card) ps-lg pe-md py-md text-body text-ink"
          >
            <MarkdownBody markdown={line} />
          </li>
        ))}
      </ol>

      {!done && (
        <Button variant="secondary" onClick={() => setShown((n) => n + 1)}>
          {t("next")}
        </Button>
      )}
    </StepShell>
  );
}
