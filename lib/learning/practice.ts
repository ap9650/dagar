import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  ladderFrom,
  selectNextQuestion,
  type Difficulty,
  type Ladder,
} from "./adaptivity";
import type { PracticeQuestion } from "./practiceSet";
import { stripSolutions } from "./questionPayload";

export type { PracticeQuestion } from "./practiceSet";

/**
 * Picking the next practice question.
 *
 * Shared by the practice PAGE (which renders question 1 during the server render,
 * so a learner never watches a spinner on entry) and by
 * `GET /api/practice/[conceptId]/next` (every question after that). One
 * implementation, so the first question can never be chosen by different rules
 * from the second.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * READS `questions_public`, NEVER `questions`.
 *
 * That view has no `answer_value` and no `solution_md` columns at all, so this
 * code path is structurally incapable of leaking an answer key — not "careful not
 * to select them", *unable* to. The base table is reached exactly once in this
 * product, by `POST /api/attempts`, with the service role, after the learner has
 * committed to an answer.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type PracticeSelection = {
  question: PracticeQuestion | null;
  ladder: Ladder;
  /** How many practice questions this concept has in total. */
  bankSize: number;
};

export async function selectPracticeQuestion({
  supabase,
  studentId,
  conceptId,
  excludeIds = [],
}: {
  /** RLS-scoped client. Attempts come back scoped to this learner by policy. */
  supabase: SupabaseClient<Database>;
  studentId: string;
  conceptId: string;
  excludeIds?: readonly string[];
}): Promise<PracticeSelection> {
  const [{ data: bankRows }, { data: attemptRows }] = await Promise.all([
    supabase
      .from("questions_public")
      .select("id, slug, difficulty, stem_md, answer_type, choices, input, i18n")
      .eq("concept_id", conceptId)
      .eq("kind", "practice")
      // Deterministic order, so ties in `selectNextQuestion` break the same way
      // on every request rather than following whatever Postgres felt like.
      .order("difficulty")
      .order("slug"),
    supabase
      .from("attempts")
      .select("question_id, is_correct, created_at")
      .eq("student_id", studentId)
      .eq("concept_id", conceptId)
      .order("created_at", { ascending: true }),
  ]);

  // The view types every column as nullable (Postgres views always do). Drop any
  // row missing something load-bearing rather than shipping a half-question.
  const bank = (bankRows ?? []).flatMap((row) =>
    row.id && row.stem_md && row.answer_type && row.difficulty !== null
      ? [
          {
            id: row.id,
            slug: row.slug,
            difficulty: row.difficulty,
            stem_md: row.stem_md,
            answer_type: row.answer_type,
            choices: row.choices,
            input: row.input,
            i18n: stripSolutions(row.i18n),
          } satisfies PracticeQuestion,
        ]
      : [],
  );

  const attempts = attemptRows ?? [];
  const ladder = ladderFrom(attempts.map((a) => a.is_correct));

  // Never re-serve a question the learner has already got right. Getting it wrong
  // is different — that one is worth meeting again, just not immediately, which is
  // what `excludeIds` (this session's questions) handles.
  const answeredCorrectly = attempts
    .filter((attempt) => attempt.is_correct)
    .map((attempt) => attempt.question_id);

  const question = selectNextQuestion({
    bank,
    difficulty: ladder.difficulty as Difficulty,
    excludeIds: [...new Set([...excludeIds, ...answeredCorrectly])],
  });

  return { question, ladder, bankSize: bank.length };
}
