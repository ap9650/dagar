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
    // Count completions among THESE lessons only. `progress` is the learner's
    // whole history, including other grades — a learner who switches grade in
    // Settings keeps their old progress, and counting it here told them to
    // "continue where you left off" in a chapter they had never opened.
    const completedHere = ordered.filter((lesson) => completed.has(lesson.id)).length;

    return {
      kind: "lesson",
      lessonId: nextLesson.id,
      // "Start here" vs "Continue where you left off" — a brand-new learner is
      // not "continuing" anything, and being told they are is disorienting.
      reason: completedHere === 0 ? "startHere" : "continue",
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

/* ═══════════════════════════════════════════════════════════════════════════
 * DIFFICULTY STEPPING (D3)
 *
 *   2 correct in a row → step up (max 3)
 *   2 wrong in a row   → step down (min 1), and the UI serves a worked example
 *
 * Adaptivity in Saathi is SELECTION FROM THE SEEDED BANK, never generation. Every
 * question a learner sees was authored by a person and had its answer key verified
 * (`npm run verify:answers`). A generated question is an unverified question, and
 * an unverified question can mark a correct learner wrong.
 * ═══════════════════════════════════════════════════════════════════════════ */

export type Difficulty = 1 | 2 | 3;

export const MIN_DIFFICULTY: Difficulty = 1;
export const MAX_DIFFICULTY: Difficulty = 3;
/** How many in a row it takes to move. D3 says 2, both ways. */
export const STEP_AFTER = 2;

/**
 * Where the learner is on the ladder, plus how far into a run they are.
 *
 * The runs are what stop a hot streak from rocketing someone to difficulty 3 in
 * three questions: **a step resets both counters**, so 2 correct steps up and then
 * it takes another 2 at the new level to step up again. Without the reset,
 * "correct, correct, correct" reads as two overlapping runs of two.
 */
export type Ladder = {
  difficulty: Difficulty;
  correctRun: number;
  wrongRun: number;
};

export function startLadder(difficulty: Difficulty = MIN_DIFFICULTY): Ladder {
  return { difficulty, correctRun: 0, wrongRun: 0 };
}

/** Fold one graded answer into the ladder. Pure — returns a new Ladder. */
export function applyResult(ladder: Ladder, isCorrect: boolean): Ladder {
  if (isCorrect) {
    const correctRun = ladder.correctRun + 1;

    if (correctRun >= STEP_AFTER && ladder.difficulty < MAX_DIFFICULTY) {
      return {
        difficulty: (ladder.difficulty + 1) as Difficulty,
        correctRun: 0,
        wrongRun: 0,
      };
    }
    // At the ceiling the run keeps counting rather than resetting — there is
    // nowhere to step, and clearing it would mean a learner acing difficulty 3 is
    // treated as having no momentum at all the moment they slip once.
    return { difficulty: ladder.difficulty, correctRun, wrongRun: 0 };
  }

  const wrongRun = ladder.wrongRun + 1;

  if (wrongRun >= STEP_AFTER && ladder.difficulty > MIN_DIFFICULTY) {
    return {
      difficulty: (ladder.difficulty - 1) as Difficulty,
      correctRun: 0,
      wrongRun: 0,
    };
  }
  return { difficulty: ladder.difficulty, correctRun: 0, wrongRun };
}

/**
 * How far back the ladder is rebuilt from history.
 *
 * The ladder is **recomputed from attempts, not stored**. That is a deliberate
 * trade: one fewer column that can disagree with the attempts table, and a
 * learner's level is always explainable from what they actually did. The cost is
 * that history beyond this window is forgotten — which is the same forgetting D5
 * builds into mastery, and for the same reason.
 */
export const LADDER_WINDOW = 10;

/** Rebuild the ladder by folding a concept's recent results, oldest first. */
export function ladderFrom(
  results: readonly boolean[],
  start: Difficulty = MIN_DIFFICULTY,
): Ladder {
  return results
    .slice(-LADDER_WINDOW)
    .reduce<Ladder>((ladder, isCorrect) => applyResult(ladder, isCorrect), startLadder(start));
}

export type QuestionRef = {
  id: string;
  difficulty: number;
};

/**
 * Pick the next question from the bank.
 *
 * Preference order, and the last two rungs are the ones that matter:
 *
 *   1. unseen, at the target difficulty
 *   2. unseen, at the nearest other difficulty — **ties break downward**, because
 *      a learner who has run out of questions at their level should drop to easier
 *      ground rather than be pushed up into harder
 *   3. seen, at the target difficulty
 *   4. anything at all
 *
 * Rungs 3 and 4 exist so the practice screen is **never empty** (spec §8). A
 * learner who has worked through every question on a concept and gets a blank
 * screen has been punished for finishing.
 *
 * Deterministic: no randomness, so the same state always yields the same question
 * and a test can assert it. Bank order decides ties.
 */
export function selectNextQuestion<T extends QuestionRef>({
  bank,
  difficulty,
  excludeIds = [],
}: {
  bank: readonly T[];
  difficulty: Difficulty;
  /** Questions already served in this session, or already answered correctly. */
  excludeIds?: readonly string[];
}): T | null {
  if (bank.length === 0) return null;

  const seen = new Set(excludeIds);
  const unseen = bank.filter((question) => !seen.has(question.id));

  const atTarget = unseen.find((question) => question.difficulty === difficulty);
  if (atTarget) return atTarget;

  const nearest = [...unseen].sort((a, b) => {
    const byDistance =
      Math.abs(a.difficulty - difficulty) - Math.abs(b.difficulty - difficulty);
    if (byDistance !== 0) return byDistance;
    return a.difficulty - b.difficulty; // tie → the easier one
  })[0];
  if (nearest) return nearest;

  return bank.find((question) => question.difficulty === difficulty) ?? bank[0];
}
