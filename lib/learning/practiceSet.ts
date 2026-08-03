/**
 * The shape of a practice question as it crosses to the browser, and how many
 * make a set.
 *
 * Split out of `lib/learning/practice.ts` because that module is `server-only`
 * — it holds the database reads — and the practice screen is a Client Component
 * that needs this type and this constant. Importing them from there would pull a
 * `server-only` module into the client graph.
 */

/**
 * Exactly what is safe to send to a browser.
 *
 * `answer_value` and `solution_md` are absent, and not by omission: the
 * `questions_public` view this is read from has no such columns. If you find
 * yourself adding either field here, stop — that is the security boundary.
 */
export type PracticeQuestion = {
  id: string;
  slug: string | null;
  difficulty: number;
  stem_md: string;
  answer_type: string;
  choices: unknown;
  /**
   * How the answer is ENTERED (D18 slice 5.2) — tiles, diagrams, shading. Null
   * for every question not yet converted, which renders today's control.
   *
   * `unknown` on purpose: it is authored jsonb and is validated by
   * `parseInput` at the point of use, never trusted on the way in.
   */
  input: unknown;
  /**
   * A diagram shown WITH the stem (slice 5.2c) — a balance, a number line.
   * Null for every question that does not need one. Validated at the point of
   * use by `parseStemViz`, never trusted on the way in.
   */
  stem_viz: unknown;
  i18n: unknown;
};

/**
 * Questions per practice set.
 *
 * Five, matching `PRACTICE_QUESTIONS_FOR_GOAL` (D17/D7) — so finishing one set
 * closes the daily goal ring and extends the streak. If these two numbers ever
 * disagreed, a learner could complete practice and watch the ring stay open,
 * which is the app contradicting itself about whether they showed up today.
 */
export const PRACTICE_SET_SIZE = 5;
