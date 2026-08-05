/**
 * Levels — the mastery score with a name on it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THIS IS NOT A SECOND SCORE, AND THE DISTINCTION IS THE WHOLE ARGUMENT.
 *
 * D17 refuses XP, points and levels-as-currency because a second scoring system
 * competes with concept mastery, which is the score that actually means
 * something. A level here is not a parallel currency: it IS the D5 mastery
 * score, rendered as a word instead of a hidden number. Nothing is earned in
 * level-points, nothing accumulates, and nothing can be ground out.
 *
 * If a future change makes a level something you collect rather than something
 * you are, it has become the thing D17 rejects.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ── WHY IT IS A MODULE AND NOT THREE COPIES ─────────────────────────────────
 * These thresholds were written inline on `/progress`, on the dashboard and on
 * the chapter page — the same ternary three times. That was survivable while
 * nothing else read them, and stopped being so the moment the diary needed to
 * detect a level *change*: a fourth copy would decide when a learner is told
 * they moved up, and a threshold that disagreed by 0.01 would announce moves
 * that no screen showed.
 *
 * The four names deliberately match Khan Academy's ladder (Attempted, Familiar,
 * Proficient, Mastered) in shape, because that ladder is well-tested on exactly
 * this audience — and Dagar already had all four, unnamed and unrolled-up.
 */

/** Ordered weakest to strongest. The order is meaningful — see `movedUp`. */
export const LEVELS = ["not_started", "practising", "getting_there", "mastered"] as const;

export type Level = (typeof LEVELS)[number];

/** The D5 thresholds, in one place. */
export const GETTING_THERE_SCORE = 0.5;

export type MasteryRow = {
  score: number;
  attempts_count: number;
  is_mastered: boolean;
};

/**
 * A learner's level on one concept.
 *
 * `not_started` covers both "no row" and "a row with no attempts". A concept
 * never attempted must NOT render as 0% — that reads as failure rather than as
 * untouched, and this learner does not need that on day one.
 */
export function conceptLevel(row: MasteryRow | null | undefined): Level {
  if (!row || row.attempts_count === 0) return "not_started";
  if (row.is_mastered) return "mastered";
  return row.score >= GETTING_THERE_SCORE ? "getting_there" : "practising";
}

export type ChapterStanding = {
  /** How many concepts the chapter has. */
  total: number;
  /** How many the learner has mastered. */
  mastered: number;
  /** Has the learner touched this chapter at all — a lesson opened or a question attempted. */
  started: boolean;
  /**
   * Has the chapter quiz been passed at the Mastered band?
   *
   * ── KHAN ACADEMY'S RULE, AND WHY IT IS WORTH COPYING ──────────────────────
   * Khan makes their top level unreachable by repetition: it can only be earned
   * on a MIXED assessment, never by drilling one skill's exercise. Without that,
   * a learner here could reach the top by answering one concept's practice
   * questions until the last five happened to be right — five questions is a
   * small window, and the top level was the cheapest thing on the screen.
   *
   * Requiring the quiz does two jobs at once: it makes Mastered mean something,
   * and it gives the chapter quiz a purpose it did not previously have.
   */
  quizPassed: boolean;
};

/**
 * The chapter's level, rolled up from its concepts.
 *
 * The roll-up is the thing that was missing. Mastery was computed per concept
 * and stopped there, so neither a learner nor a parent could answer "how is
 * Fractions going?" without reading four rows and doing the arithmetic.
 *
 * A chapter with every concept mastered but no quiz passed stays at
 * `getting_there` — and the chapter screen says exactly what is left, so the
 * learner is never left guessing why the last step has not happened.
 */
export function chapterLevel(standing: ChapterStanding): Level {
  if (standing.total === 0 || !standing.started) return "not_started";

  const allMastered = standing.mastered >= standing.total;
  if (allMastered && standing.quizPassed) return "mastered";
  if (allMastered) return "getting_there";

  return standing.mastered / standing.total >= 0.5 ? "getting_there" : "practising";
}

/** Did the learner move UP the ladder? */
export function movedUp(from: Level, to: Level): boolean {
  return LEVELS.indexOf(to) > LEVELS.indexOf(from);
}

/**
 * Is this a change worth telling the learner about?
 *
 * ── ONLY UPWARD REACHES THE DIARY ───────────────────────────────────────────
 * Mastery can fall — the score is the last five attempts, so two wrong answers
 * after a good run genuinely lowers it, and the badge on the concept list shows
 * that truth immediately. But *"Fractions went backwards on Thursday"* is not a
 * sentence this product says to a child who is already behind.
 *
 * So the badge tells the truth about where you are, and the diary records what
 * you achieved. The EVENT records both directions, because analytics should see
 * the real picture — the filtering is presentation, not data.
 */
export function worthCelebrating(from: Level, to: Level): boolean {
  return movedUp(from, to) && to !== "not_started";
}
