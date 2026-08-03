"use client";

import { LessonActions } from "./LessonActions";
import { useLessonCompletion } from "./useLessonCompletion";

/**
 * The finishing action for a PROSE lesson — one button under the text.
 *
 * A stepped lesson uses `SteppedLesson` instead, where the last step's button
 * finishes the lesson. Both end at the same `LessonActions` footer, so the two
 * shapes cannot drift apart in what they record or what they offer next.
 */
export function LessonCompleteButton({
  lessonId,
  nextHref,
  nextIsPractice,
  alreadyComplete,
}: {
  lessonId: string;
  nextHref: string;
  nextIsPractice: boolean;
  alreadyComplete: boolean;
}) {
  const state = useLessonCompletion({ lessonId, alreadyComplete });
  return (
    <LessonActions state={state} nextHref={nextHref} nextIsPractice={nextIsPractice} />
  );
}
