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
 * The order a NEW quiz attempt is served in.
 *
 * ── why this exists ─────────────────────────────────────────────────────────
 * The chapter bank is 8 questions and the quiz is all 8 of them, so a retake
 * cannot contain anything new. Served in a fixed order, the third attempt stops
 * measuring understanding and starts measuring whether you remember that the
 * answer to question 3 was 12 — and the mastery band quietly stops meaning
 * anything.
 *
 * Reported from real use: "the questions were repetitive, there was no new
 * question." Correct, and the honest fix is a bigger bank (backlogged). This is
 * the cheap half: the same questions, never in the same order.
 *
 * ── why not a plain shuffle ─────────────────────────────────────────────────
 * The fixed order was not arbitrary — ordering by slug groups a concept's
 * questions together, so a learner is not thrown between four topics and back.
 * That matters most for exactly the learner this product is for.
 *
 * So the grouping survives: questions shuffle WITHIN their concept, and the
 * concepts shuffle as blocks. Every attempt is a different sequence; no attempt
 * ping-pongs between topics.
 *
 * `random` is injected so tests can be deterministic. Math.random is right here
 * — this is presentation order, not a token, and nothing is guessable that
 * matters. (Contrast `lib/parent/shareToken.ts`, which is CSPRNG because there
 * the value IS the authorisation.)
 */
export function orderQuizQuestions<T extends { id: string; concept_id: string }>(
  bank: readonly T[],
  random: () => number = Math.random,
): T[] {
  const shuffle = <U,>(items: U[]): U[] => {
    // Fisher–Yates, unbiased.
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };

  // Insertion order preserves the bank's concept sequence before it is shuffled,
  // so the grouping is taken from the data rather than assumed.
  const byConcept = new Map<string, T[]>();
  for (const question of bank) {
    const group = byConcept.get(question.concept_id);
    if (group) group.push(question);
    else byConcept.set(question.concept_id, [question]);
  }

  return shuffle([...byConcept.values()]).flatMap((group) => shuffle(group));
}

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
