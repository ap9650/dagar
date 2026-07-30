/**
 * What the learner should do next.
 *
 * The dashboard's first job is to answer that with ONE action, not a menu (D17,
 * curriculum-dashboard spec §1). A learner who opens the app and has to choose has
 * already been given work to do.
 *
 * Rule (spec §3):
 *   1. the first incomplete lesson, in `order_index` order
 *   2. if every lesson is done but a concept is unmastered → practise the
 *      **weakest** concept (lowest mastery score)
 *   3. if everything is done and mastered → revision, never a dead end
 *
 * Pure. Takes rows, returns a decision — no database, no locale, no copy. The
 * `reason` is a KEY the UI translates, because a string here would be an English
 * string on a Hindi learner's screen.
 */

export type LessonRef = {
  id: string;
  order_index: number;
};

export type ProgressRef = {
  lesson_id: string;
  status: "started" | "completed";
};

export type MasteryRef = {
  concept_id: string;
  score: number;
  is_mastered: boolean;
};

export type NextAction =
  | { kind: "lesson"; lessonId: string; reason: "startHere" | "continue" }
  | { kind: "practice"; conceptId: string; reason: "strengthen" }
  | { kind: "revise"; reason: "revise" }
  | { kind: "none"; reason: "noContent" };

export function selectNextAction({
  lessons,
  progress,
  mastery,
  concepts,
}: {
  lessons: LessonRef[];
  progress: ProgressRef[];
  mastery: MasteryRef[];
  /** Every concept id in the chapter — needed because a never-attempted concept
   *  has NO mastery row at all, and "no row" must count as unmastered rather than
   *  disappearing from consideration. */
  concepts: string[];
}): NextAction {
  if (lessons.length === 0) return { kind: "none", reason: "noContent" };

  const completed = new Set(
    progress.filter((p) => p.status === "completed").map((p) => p.lesson_id),
  );

  const ordered = [...lessons].sort((a, b) => a.order_index - b.order_index);
  const nextLesson = ordered.find((lesson) => !completed.has(lesson.id));

  if (nextLesson) {
    return {
      kind: "lesson",
      lessonId: nextLesson.id,
      // "Start here" vs "Continue where you left off" — a brand-new learner is
      // not "continuing" anything, and being told they are is disorienting.
      reason: completed.size === 0 ? "startHere" : "continue",
    };
  }

  // Every lesson complete. Is anything still weak?
  const scoreByConcept = new Map(mastery.map((m) => [m.concept_id, m]));
  const unmastered = concepts
    .map((conceptId) => ({
      conceptId,
      // Absent row = never attempted = score 0. Not a crash, and not "0% mastered"
      // shown to the learner as if it were a failure (spec §7).
      score: scoreByConcept.get(conceptId)?.score ?? 0,
      isMastered: scoreByConcept.get(conceptId)?.is_mastered ?? false,
    }))
    .filter((c) => !c.isMastered);

  if (unmastered.length > 0) {
    const weakest = unmastered.reduce((a, b) => (b.score < a.score ? b : a));
    return { kind: "practice", conceptId: weakest.conceptId, reason: "strengthen" };
  }

  return { kind: "revise", reason: "revise" };
}
