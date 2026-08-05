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
 * Once a learner FINISHES the lesson the player steps aside: what they want at
 * that moment is the celebration and the next thing, not step 8 again.
 *
 * "Finishes", not "is complete" — the difference is the whole of a bug reported
 * from a phone. This read `!state.complete`, and `complete` is true the instant a
 * finished lesson is REOPENED, so revising one showed its title, "Lesson
 * complete", and none of the lesson. The comment here used to claim reopening
 * "starts it from the top, as it always has". It did not. Nothing is gated in
 * Dagar and revision is the point, so a finished lesson must open like any other.
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
      {!state.justCompleted && (
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
