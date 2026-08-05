/**
 * Milestones (D7b).
 *
 * The awarding lives in Postgres — `award_milestones` in `0009` — because a
 * milestone must be granted inside the same write that earned it, and because
 * `unique(student_id, code)` is what makes re-running it a no-op rather than a
 * double award. This file is the CATALOGUE: which badges exist, and in what
 * order a learner sees them.
 *
 * ── WHY UNEARNED BADGES ARE RENDERED TOO ────────────────────────────────────
 * The progress screen shows all seven, earned and locked (spec §4). A learner on
 * their first day would otherwise open Progress and find an empty page — the one
 * screen whose job is to say "here is what you have done" telling them they have
 * done nothing. Greyed badges turn that into a roadmap.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Deliberately absent, and it should stay that way: points, levels, XP, hearts,
 * lives, leaderboards, and anything comparing one learner to another (D17). The
 * audience is learners who are already behind; ranking them against peers works
 * against the reason this product exists.
 */

/**
 * All seven codes, in the order they are shown.
 *
 * Roughly the order a learner meets them — the first two are reachable on day
 * one, the streaks take a week, and chapter mastery is the far end. A learner
 * scanning the grid should be able to see where they are on it.
 *
 * These strings must match the `milestones.code` check constraint in migration
 * 0003 exactly, and each needs a `milestone.<code>` message in both locales.
 */
export const MILESTONE_CODES = [
  "first_lesson",
  "first_practice",
  "concept_mastered",
  "streak_3",
  "chapter_complete",
  "streak_7",
  "chapter_mastered",

  // ── The streak ladder, added 5 Aug 2026 ───────────────────────────────────
  // `streak_7` used to be the last habit milestone a learner could ever earn:
  // from day 8 onward the streak counted up toward nothing. These are the rest
  // of the rungs — see `streakLadder.ts` for why these numbers and why the
  // ladder stops at a year rather than running forever.
  "streak_14",
  "streak_30",
  "streak_100",
  "streak_180",
  "streak_365",

  // ── The counting ladders, added 5 Aug 2026 ───────────────────────────────
  // `concept_mastered` fired on the first concept ever and never again, however
  // many followed; `chapter_complete` the same. These give both somewhere to
  // go. Rung 1 of each keeps its original name so no earned badge is orphaned
  // — see `badgeLadders.ts` for the shape and the reasoning on the top rungs.
  "concepts_5",
  "concepts_15",
  "concepts_40",
  "chapters_3",
  "chapters_10",
] as const;

export type MilestoneCode = (typeof MILESTONE_CODES)[number];

export type MilestoneState = {
  code: MilestoneCode;
  earned: boolean;
  /** IST date the badge was earned, for the caption. Null while locked. */
  earnedAt: string | null;
};

/**
 * The full grid, earned state resolved.
 *
 * Unknown codes in `earned` are ignored rather than rendered: a badge awarded by
 * a future migration should not appear on this screen before it has a name and a
 * translation, and an untranslated code would render as a raw enum.
 */
export function milestoneGrid(
  earned: readonly { code: string; earned_at: string }[],
): MilestoneState[] {
  const earnedByCode = new Map(earned.map((row) => [row.code, row.earned_at]));

  return MILESTONE_CODES.map((code) => ({
    code,
    earned: earnedByCode.has(code),
    earnedAt: earnedByCode.get(code) ?? null,
  }));
}

/** How many of the seven a learner holds — the "3 of 7" beside the grid. */
export function earnedCount(grid: readonly MilestoneState[]): number {
  return grid.filter((m) => m.earned).length;
}
