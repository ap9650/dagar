/**
 * Where a learner goes when they finish a lesson.
 *
 * ── WHY THIS IS ITS OWN FUNCTION ────────────────────────────────────────────
 * It used to be two lines inside the lesson page, and it was wrong in a way
 * nobody could see from the code: the destination was "next lesson, unless this
 * is the last one", while the button said **"Practise this"** the entire time.
 * Reported from a phone — it promised practice and opened a lesson.
 *
 * A rule the UI has to describe accurately is a rule that should be one value
 * the caller can read, not a ternary the caller has to reproduce.
 * ────────────────────────────────────────────────────────────────────────────
 */

export type NextStep =
  | { kind: "practice"; conceptId: string }
  | { kind: "lesson"; lessonId: string };

/**
 * Practice at a CONCEPT BOUNDARY, not after every lesson.
 *
 * Two lessons often teach one concept — Class 6's first two are both fraction
 * basics — and practising after the first tests a learner on half an idea. The
 * boundary is also the first moment mastery can mean anything: it is scored per
 * concept over the last five attempts (D5), so attempts collected before the
 * concept is taught are noise in the number that drives adaptivity.
 *
 * There is never a dead end. The end of a chapter has no next lesson, so it
 * practises — which is also the right thing to do there.
 */
export function nextAfterLesson(
  current: { concept_id: string },
  next: { id: string; concept_id: string } | undefined,
): NextStep {
  if (next && next.concept_id === current.concept_id) {
    return { kind: "lesson", lessonId: next.id };
  }
  return { kind: "practice", conceptId: current.concept_id };
}

/** The href for a next step, given the chapter it sits in. */
export function nextStepHref(step: NextStep, chapterId: string): string {
  return step.kind === "practice"
    ? `/practice/${step.conceptId}`
    : `/learn/${chapterId}/${step.lessonId}`;
}
