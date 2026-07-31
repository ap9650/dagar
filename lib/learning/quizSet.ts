import type { PracticeQuestion } from "./practiceSet";
import type { MasteryBand } from "./mastery";

/**
 * The quiz's wire types — everything that crosses to the browser (slice 2.4).
 *
 * Split out of `lib/learning/quiz.ts` for the same reason `practiceSet.ts` is
 * split out of `practice.ts`: that module is `server-only` because it reads the
 * database, and the quiz screen is a Client Component that needs these types.
 */

/**
 * A quiz question as the browser receives it.
 *
 * Structurally identical to `PracticeQuestion`, and deliberately the same type
 * rather than a copy: both are "a question with no answer key", both come out of
 * `questions_public`, and a second declaration is a second place for someone to
 * add `solution_md` to. The alias exists only so quiz code can say what it means.
 */
export type QuizQuestion = PracticeQuestion & { concept_id: string };

export type QuizStartResponse = {
  session_id: string;
  questions: QuizQuestion[];
};

/**
 * One question's outcome, returned **only from submit** (spec §3).
 *
 * This is the first and only point in a quiz where `solution_md` crosses to the
 * browser. At start it is absent from the payload because it is absent from the
 * view; here the learner has committed to every answer and the quiz is scored, so
 * the worked method is what they came for rather than something to copy.
 */
export type QuizAnswerResult = {
  question_id: string;
  is_correct: boolean;
  /** Empty string when the learner skipped it — see `answered`. */
  given_answer: string;
  answered: boolean;
  solution_md: string;
};

export type QuizSubmitResponse = {
  session_id: string;
  score: number;
  total: number;
  band: MasteryBand;
  perQuestion: QuizAnswerResult[];
  milestonesEarned: string[];
  /**
   * D6, evaluated after the quiz rather than during it (mentor-request.md §7).
   * A learner mid-quiz must not be interrupted to be told they are struggling —
   * the offer belongs on the results screen, where they have stopped anyway.
   */
  showMentorCta: boolean;
  mentorTrigger: string | null;
  mentorConceptId: string | null;
};
