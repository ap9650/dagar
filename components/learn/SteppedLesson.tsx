"use client";

import { LessonSteps } from "./LessonSteps";
import { LessonActions } from "./LessonActions";
import { useLessonCompletion } from "./useLessonCompletion";
import type { LessonStep } from "@/lib/learning/lessonSteps";

/**
 * A stepped lesson (D18), from the first idea to the next thing to do.
 *
 * The player and the finishing action have to be in the same client component,
 * because the last step's button IS the finishing action — and a server
 * component cannot hand a callback across that boundary. Composing them through
 * a `children` slot was the previous shape, and it forced the player to render a
 * second, identical button on a screen of its own.
 *
 * Once the lesson is complete the player steps aside: what a learner wants at
 * that moment is the celebration and the next thing, not step 8 again. Reopening
 * the lesson starts it from the top, as it always has.
 */
export function SteppedLesson({
  lessonId,
  steps,
  speech,
  nextHref,
  nextIsPractice,
  alreadyComplete,
}: {
  lessonId: string;
  steps: LessonStep[];
  speech: { en: string; hi: string | null }[];
  nextHref: string;
  nextIsPractice: boolean;
  alreadyComplete: boolean;
}) {
  const state = useLessonCompletion({ lessonId, alreadyComplete });

  return (
    <>
      {!state.complete && (
        <LessonSteps
          steps={steps}
          speech={speech}
          onFinish={state.markComplete}
          finishing={state.busy}
        />
      )}
      <LessonActions
        state={state}
        nextHref={nextHref}
        nextIsPractice={nextIsPractice}
        // The last step's button already says "Got it". A second one here is the
        // duplicate screen this whole change exists to delete.
        primary={false}
      />
    </>
  );
}
