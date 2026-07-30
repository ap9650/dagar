import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { gradeDetailed, type AnswerType } from "./grading";
import { quizBand } from "./mastery";
import { stripSolutions } from "./questionPayload";
import type { QuizAnswerResult, QuizQuestion } from "./quizSet";
import type { MasteryBand } from "./mastery";

/**
 * The chapter quiz (slice 2.4, spec `docs/specs/chapter-quiz.md`).
 *
 * A quiz is the same grading engine as practice under deliberately different
 * rules: a **fixed** set, **no hints**, **no feedback until submit**, and no
 * mid-quiz adaptation. Adapting difficulty as a learner answers would make the
 * score meaningless — it would track the learner instead of measuring them.
 *
 * The two halves below sit on opposite sides of the answer-key boundary and use
 * different clients on purpose:
 *
 *   startOrResumeQuiz  — the learner's OWN client, reading `questions_public`.
 *                        Structurally cannot see an answer key.
 *   gradeQuizSubmission — the service role, reading the base `questions` table,
 *                        after the learner has committed to every answer.
 */

/** Client-safe shape, straight off the view. */
type BankRow = {
  id: string | null;
  slug: string | null;
  concept_id: string | null;
  difficulty: number | null;
  stem_md: string | null;
  answer_type: string | null;
  choices: unknown;
  i18n: unknown;
};

function toQuizQuestion(row: BankRow): QuizQuestion | null {
  // The view types every column as nullable (Postgres views always do). Drop a
  // row missing something load-bearing rather than serving half a question.
  if (!row.id || !row.concept_id || !row.stem_md || !row.answer_type) return null;
  return {
    id: row.id,
    slug: row.slug,
    concept_id: row.concept_id,
    difficulty: row.difficulty ?? 1,
    stem_md: row.stem_md,
    answer_type: row.answer_type,
    choices: row.choices,
    i18n: stripSolutions(row.i18n),
  };
}

export type QuizStart = {
  sessionId: string;
  questions: QuizQuestion[];
  /** True when this call joined an abandoned session rather than opening one. */
  resumed: boolean;
};

/**
 * Open a quiz, or rejoin the one the learner walked away from.
 *
 * Returns `null` when the chapter has no quiz questions seeded. That is a real
 * state while Classes 7 and 8 fill in, and the screen shows "coming soon" — never
 * a quiz of zero questions (spec §6).
 *
 * ── ORDER ───────────────────────────────────────────────────────────────────
 * By slug, which groups a concept's questions together (`c6-quiz-cmp-1`,
 * `c6-quiz-cmp-2`, then `c6-quiz-eqf-1`…). Deterministic, so two requests never
 * disagree, and thematically grouped, so a learner is not thrown between four
 * topics and back. No shuffle: a quiz a learner can retake is more useful when
 * they can see which questions they got wrong last time.
 */
export async function startOrResumeQuiz({
  supabase,
  studentId,
  chapterId,
}: {
  /** RLS-scoped. The session row it writes is the learner's own by policy. */
  supabase: SupabaseClient<Database>;
  studentId: string;
  chapterId: string;
}): Promise<QuizStart | null> {
  const [{ data: bankRows }, { data: open }] = await Promise.all([
    supabase
      .from("questions_public")
      .select("id, slug, concept_id, difficulty, stem_md, answer_type, choices, i18n")
      .eq("chapter_id", chapterId)
      .eq("kind", "quiz")
      .order("slug"),
    supabase
      .from("quiz_sessions")
      .select("id, question_ids")
      .eq("student_id", studentId)
      .eq("chapter_id", chapterId)
      .is("submitted_at", null)
      .maybeSingle(),
  ]);

  const bank = (bankRows ?? []).flatMap((row) => {
    const question = toQuizQuestion(row);
    return question ? [question] : [];
  });

  if (bank.length === 0) return null;

  // ── resume ────────────────────────────────────────────────────────────────
  // Replay the STORED ids, in the stored order. Not "the current bank" — the
  // whole point of writing them down (migration 0013) is that a learner halfway
  // through a quiz keeps the quiz they started, whatever has been seeded since.
  if (open?.id && open.question_ids && open.question_ids.length > 0) {
    const byId = new Map(bank.map((q) => [q.id, q]));
    const questions = open.question_ids.flatMap((id) => {
      const question = byId.get(id);
      return question ? [question] : [];
    });

    // Every stored question still exists: a clean resume.
    if (questions.length === open.question_ids.length) {
      return { sessionId: open.id, questions, resumed: true };
    }

    // A question in the stored set has been deleted from the bank. Rather than
    // serve a short quiz whose score is out of a total the learner never saw,
    // rewrite the set to what is actually there. Rare, and honest about it.
    if (questions.length > 0) {
      await supabase
        .from("quiz_sessions")
        .update({ question_ids: questions.map((q) => q.id) })
        .eq("id", open.id)
        .eq("student_id", studentId);
      return { sessionId: open.id, questions, resumed: true };
    }
  }

  // ── an open session with no stored set (or nothing open at all) ────────────
  if (open?.id) {
    await supabase
      .from("quiz_sessions")
      .update({ question_ids: bank.map((q) => q.id) })
      .eq("id", open.id)
      .eq("student_id", studentId);
    return { sessionId: open.id, questions: bank, resumed: true };
  }

  const { data: created, error } = await supabase
    .from("quiz_sessions")
    .insert({
      student_id: studentId,
      chapter_id: chapterId,
      question_ids: bank.map((q) => q.id),
    })
    .select("id")
    .single();

  if (error || !created) {
    // 23505 — two taps raced and the partial unique index (0013) stopped the
    // second. The first one's session is the right one to hand back.
    const { data: existing } = await supabase
      .from("quiz_sessions")
      .select("id, question_ids")
      .eq("student_id", studentId)
      .eq("chapter_id", chapterId)
      .is("submitted_at", null)
      .maybeSingle();

    if (!existing?.id) throw error ?? new Error("quiz session could not be created");

    const byId = new Map(bank.map((q) => [q.id, q]));
    const questions = (existing.question_ids ?? []).flatMap((id) => {
      const question = byId.get(id);
      return question ? [question] : [];
    });
    return {
      sessionId: existing.id,
      questions: questions.length > 0 ? questions : bank,
      resumed: true,
    };
  }

  return { sessionId: created.id, questions: bank, resumed: false };
}

export type QuizGrade = {
  score: number;
  total: number;
  band: MasteryBand;
  perQuestion: QuizAnswerResult[];
  /** Concepts touched by an ANSWERED question — the ones to recompute. */
  conceptIds: string[];
  chapterId: string;
  /** True when this submission was a duplicate and nothing new was written. */
  alreadySubmitted: boolean;
};

/**
 * Grade a whole quiz, server-side, and close the session.
 *
 * ── THIS IS ONE OF THREE PLACES THAT READ AN ANSWER KEY ──────────────────────
 * The others are `POST /api/attempts` (practice grading) and `POST /api/hints`
 * (which needs the worked solution to keep a hint mathematically honest). All
 * three are server-side, all three use the service role, and none of them is
 * reachable from a browser. Every question read anywhere else in the product
 * goes through `questions_public`, which has no answer columns at all.
 *
 * A client-submitted score is not ignored so much as impossible: `quizSubmitSchema`
 * has no `score` field, zod strips unknown keys, and every answer is regraded
 * from `answer_value` here regardless of what arrived.
 * ────────────────────────────────────────────────────────────────────────────
 */
export async function gradeQuizSubmission({
  admin,
  studentId,
  sessionId,
  answers,
  localiseSolution,
}: {
  /** Service role. */
  admin: SupabaseClient<Database>;
  studentId: string;
  sessionId: string;
  answers: readonly { question_id: string; given_answer: string }[];
  /**
   * `lib/i18n/content`'s `t`, injected so this module stays free of i18n wiring —
   * and so it is obvious that locale reaches the SOLUTION only. Grading never
   * sees a locale: `answer_value` is not translated (D16), so a Hindi quiz grades
   * byte-identically to an English one.
   */
  localiseSolution: (question: { solution_md: string; i18n: unknown }) => string;
}): Promise<QuizGrade | null> {
  const { data: session } = await admin
    .from("quiz_sessions")
    .select("id, student_id, chapter_id, question_ids, submitted_at, score, total, mastery_band")
    .eq("id", sessionId)
    .maybeSingle();

  // Ownership is checked here, not by RLS: this is the service-role client, so
  // RLS is not the boundary on this read. A session belonging to someone else is
  // reported as missing rather than as forbidden — a learner has no business
  // learning that another learner's session id exists.
  if (!session || session.student_id !== studentId) return null;

  const questionIds = session.question_ids ?? [];
  if (questionIds.length === 0) return null;

  const { data: questionRows } = await admin
    .from("questions")
    .select("id, concept_id, answer_type, answer_value, solution_md, i18n")
    .in("id", questionIds);

  const questionById = new Map((questionRows ?? []).map((q) => [q.id, q]));

  // Only answers to questions IN THIS SESSION count. An answer for some other
  // question — a stale tab, or a forged payload — is dropped rather than graded
  // and written against a quiz it does not belong to.
  const givenById = new Map<string, string>();
  for (const answer of answers) {
    if (questionById.has(answer.question_id) && questionIds.includes(answer.question_id)) {
      givenById.set(answer.question_id, answer.given_answer);
    }
  }

  const graded = questionIds.flatMap((id) => {
    const question = questionById.get(id);
    if (!question) return [];

    const given = givenById.get(id) ?? "";
    const result = gradeDetailed(
      question.answer_value,
      question.answer_type as AnswerType,
      given,
    );

    // A skipped question is wrong for SCORING — the score is out of the whole
    // set — but it writes no attempt row below. A blank is not evidence about
    // what a learner knows, and mastery is what we help them with, not a grade.
    const answered = result.reason !== "empty";

    return [
      {
        question_id: id,
        concept_id: question.concept_id,
        is_correct: answered && result.correct,
        given_answer: answered ? given : "",
        answered,
        solution_md: localiseSolution({
          solution_md: question.solution_md,
          i18n: question.i18n,
        }),
      },
    ];
  });

  const total = graded.length;
  const score = graded.filter((g) => g.is_correct).length;
  const band = quizBand(score, total);

  const perQuestion: QuizAnswerResult[] = graded.map((g) => ({
    question_id: g.question_id,
    is_correct: g.is_correct,
    given_answer: g.given_answer,
    answered: g.answered,
    solution_md: g.solution_md,
  }));

  // ── claim the session ─────────────────────────────────────────────────────
  //
  // `is("submitted_at", null)` in the UPDATE is what makes a double submit
  // idempotent (spec §6), and it is atomic in a way a read-then-write check is
  // not: two submits racing on a bad connection both grade — harmless, no writes
  // — and exactly one claims. The loser writes nothing and reports the stored
  // result, so there is one score, one set of attempts, one `quiz_submitted`.
  const { data: claimed } = await admin
    .from("quiz_sessions")
    .update({
      score,
      total,
      mastery_band: band,
      submitted_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("student_id", studentId)
    .is("submitted_at", null)
    .select("id")
    .maybeSingle();

  if (!claimed) {
    return {
      score: session.score ?? score,
      total: session.total ?? total,
      band: (session.mastery_band as MasteryBand | null) ?? band,
      perQuestion,
      conceptIds: [],
      chapterId: session.chapter_id,
      alreadySubmitted: true,
    };
  }

  const answered = graded.filter((g) => g.answered);

  if (answered.length > 0) {
    const { error } = await admin.from("attempts").insert(
      answered.map((g) => ({
        student_id: studentId,
        question_id: g.question_id,
        concept_id: g.concept_id,
        given_answer: g.given_answer,
        is_correct: g.is_correct,
        hints_used: 0, // There are no hints in a quiz. Not "none taken" — none offered.
        session_kind: "quiz",
        quiz_session_id: sessionId,
      })),
    );
    if (error) console.error("[quiz] attempts insert failed:", error.message);
  }

  return {
    score,
    total,
    band,
    perQuestion,
    conceptIds: [...new Set(answered.map((g) => g.concept_id))],
    chapterId: session.chapter_id,
    alreadySubmitted: false,
  };
}

