"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { MarkdownBody } from "@/components/learn/MarkdownBody";
import { Viz } from "@/components/learn/viz";
import type { RevealStep as RevealStepSpec } from "@/lib/learning/lessonSteps";
import { StepShell } from "./StepShell";

/**
 * A question posed, and an answer the learner has to ask for.
 *
 * The cheapest interaction in the set and, per attention spent, the best value:
 * it converts a paragraph a learner's eye would slide over into a two-second
 * commitment. There is no wrong outcome and nothing is recorded — the whole
 * mechanism is the pause before the tap.
 */
export function RevealStep({ step }: { step: RevealStepSpec }) {
  const t = useTranslations("lesson");
  const [shown, setShown] = useState(false);

  return (
    <StepShell md={step.md}>
      {step.viz && <Viz spec={step.viz} />}

      {shown ? (
        <div
          role="status"
          className="rounded-(--radius-card) bg-primary-wash border border-primary-soft px-lg py-md text-body text-ink"
        >
          <MarkdownBody markdown={step.answer} />
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setShown(true)}>
          <Eye size={20} strokeWidth={1.75} aria-hidden />
          {t("reveal")}
        </Button>
      )}
    </StepShell>
  );
}
