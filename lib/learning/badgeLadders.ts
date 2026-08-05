import { MILESTONE_CODES, type MilestoneCode } from "./milestones";
import { STREAK_RUNGS, rungCode } from "./streakLadder";

/**
 * Badges, as ladders.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SEVEN ONE-SHOT BADGES BECOME THREE LADDERS AND A SET OF FIRSTS.
 *
 * The old grid dead-ended: once earned, it was a wall of gold telling a learner
 * two weeks in that they were finished. `concept_mastered` fired on the first
 * concept ever and never again, however many followed.
 *
 * A ladder is not endless — these end too. What a ladder does that a grid does
 * not is answer *"what is the nearest thing I could achieve, and how far away
 * is it?"* at every point, instead of showing a field of grey squares in no
 * order.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ── AND WHEN A LADDER IS FINISHED ───────────────────────────────────────────
 * Nothing. Badges are scaffolding: they matter most in the first weeks, when a
 * learner has nothing else to show for the work. Someone who has mastered forty
 * ideas has a progress screen full of chapters reading "Mastered" — they can
 * see their progress without a badge announcing it. At the top rung the badge
 * becomes a RECORD rather than a goal, and the scaffolding comes down because
 * the building is standing.
 *
 * What is deliberately not here is repetition — a badge every ten ideas for
 * ever. That is points with extra steps, and D17 refuses points because a
 * second score competes with concept mastery, which is the score that means
 * something.
 */

export type LadderKey = "coming_back" | "ideas" | "chapters";

export type Rung = {
  /** The threshold — days, ideas or chapters. */
  at: number;
  code: MilestoneCode;
};

export type BadgeLadder = {
  key: LadderKey;
  rungs: Rung[];
};

/**
 * The three counting ladders.
 *
 * ── THE TOP RUNG SITS AT THE EDGE OF THE HORIZON, NEVER INSIDE IT ───────────
 * Our chapters carry four concepts and a full NCERT class runs to roughly ten
 * chapters — so about forty ideas is a class, ten chapters is a class, and 365
 * days is a year in Class 6 before promotion. Reaching a top rung should mean
 * "you finished the year", never "you are 40% of the way through it".
 *
 * Mirrors the arrays in `award_milestones` (migration 0027). A test parses them
 * out of the SQL and asserts the two agree — the same list written twice is
 * exactly the shape of a silent drift, where a badge is celebrated by the UI
 * and never actually awarded.
 */
export const BADGE_LADDERS: BadgeLadder[] = [
  {
    key: "coming_back",
    rungs: STREAK_RUNGS.map((at) => ({ at, code: rungCode(at) })),
  },
  {
    key: "ideas",
    rungs: [
      // Rung 1 keeps its original name. Renaming it to `concepts_1` would have
      // been tidier and would have orphaned every badge already earned.
      { at: 1, code: "concept_mastered" },
      { at: 5, code: "concepts_5" },
      { at: 15, code: "concepts_15" },
      { at: 40, code: "concepts_40" },
    ],
  },
  {
    key: "chapters",
    rungs: [
      { at: 1, code: "chapter_complete" },
      { at: 3, code: "chapters_3" },
      { at: 10, code: "chapters_10" },
    ],
  },
];

/**
 * The one-shots, which are correctly one-shots.
 *
 * A first lesson happens once and cannot ladder. `chapter_mastered` is here
 * rather than on the chapters ladder because it measures DEPTH, not count —
 * putting it at the top of "chapters finished" would say that mastering one
 * chapter is the same achievement as finishing ten, which it is not.
 */
export const FIRST_CODES: MilestoneCode[] = [
  "first_lesson",
  "first_practice",
  "chapter_mastered",
];

export type LadderRungState = Rung & { earned: boolean };

export type LadderState = {
  key: LadderKey;
  rungs: LadderRungState[];
  /** How many rungs are earned. */
  reached: number;
  /**
   * The next rung and the distance to it, or null once the ladder is finished.
   *
   * Null is a real answer that callers must handle: a learner at the top gets
   * their count and no further ask. Inventing a target beyond the ladder would
   * be the dead end this replaced, moved upward.
   */
  next: { at: number; code: MilestoneCode; remaining: number } | null;
};

/**
 * A ladder's state for one learner.
 *
 * `current` is the live count — streak days, ideas mastered, chapters finished
 * — which is what makes "you are 4 away" possible. It is read from the same
 * tables `award_milestones` counts, so the two cannot disagree about whether a
 * rung has been reached.
 */
export function ladderState(
  ladder: BadgeLadder,
  earned: ReadonlySet<string>,
  current: number,
): LadderState {
  const rungs = ladder.rungs.map((rung) => ({ ...rung, earned: earned.has(rung.code) }));
  const next = ladder.rungs.find((rung) => rung.at > current) ?? null;

  return {
    key: ladder.key,
    rungs,
    reached: rungs.filter((rung) => rung.earned).length,
    next: next ? { ...next, remaining: next.at - current } : null,
  };
}

/**
 * Guard: every rung's code must be on the canonical milestone list.
 *
 * A rung whose code is unknown would render a raw enum to a learner and could
 * never be awarded, because the database check constraint would reject it. The
 * test suite asserts this rather than trusting the two lists to stay in step.
 */
export function unknownRungCodes(): string[] {
  const known = new Set<string>(MILESTONE_CODES);
  return [
    ...BADGE_LADDERS.flatMap((ladder) => ladder.rungs.map((rung) => rung.code)),
    ...FIRST_CODES,
  ].filter((code) => !known.has(code));
}
