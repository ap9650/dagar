/**
 * Seed types — shared by every chapter file in this directory.
 *
 * Deliberately narrower than the database schema. `chapter_id` and `concept_id`
 * are UUIDs the seed runner resolves from slugs, so an author never writes an id
 * by hand and never has to seed in a particular order.
 */

import type { LessonStep } from "../../lib/learning/lessonSteps.ts";
import type { QuestionInput } from "../../lib/learning/questionInput.ts";
import type { VizSpec } from "../../components/learn/viz/types.ts";

export type Choice = { id: string; label: string };

/** Grading (D3) reads this. The grader normalises, so write ONE canonical form. */
export type AnswerType = "mcq" | "integer" | "fraction" | "decimal" | "expression";

export type SeedQuestion = {
  /** Stable key for idempotent upsert, e.g. `c6-eqf-d1-q1`. Unique across all chapters. */
  slug: string;
  concept_slug: string;
  kind: "practice" | "quiz";
  /** 1 recognise · 2 apply · 3 reverse or multi-step. Adaptivity (D3) steps between these. */
  difficulty: 1 | 2 | 3;
  stem_md: string;
  answer_type: AnswerType;
  /**
   * Canonical answer. Never localised (D16) and never sent to the client (D3).
   * For `mcq` this is the choice **id**, never the label.
   */
  answer_value: string;
  /** MCQ only. Wrong options must encode mistakes learners actually make. */
  choices?: Choice[];
  /**
   * How the answer is ENTERED (D18 slice 5.2). Optional and additive, exactly
   * like `SeedLesson.steps`: a question with `input` renders tiles or diagrams,
   * one without renders today's text field or radios.
   *
   * It never changes how the answer is JUDGED. Whatever the learner assembles is
   * handed to the same grader, through the same route (D3).
   *
   * **Practice only.** The quiz is the assessment surface and stays plain — see
   * the spec, and `toQuizQuestion`, which hard-codes null so authoring one here
   * by mistake cannot change the quiz.
   */
  input?: QuestionInput;
  /**
   * A diagram shown WITH the stem (slice 5.2c). For questions where the picture
   * IS the question — "the balance is level, what is x?" — which no input kind
   * can express, because they all put diagrams among the answers.
   */
  stem_viz?: VizSpec;
  /** A worked METHOD, not just the answer — the tutor uses it to ground hints. */
  solution_md: string;
};

export type SeedLesson = {
  slug: string;
  concept_slug: string;
  order_index: number;
  title: string;
  body_md: string;
  /**
   * The interactive version (D18). Optional and additive: a lesson with steps
   * renders the step player, one without renders `body_md` exactly as before.
   * `body_md` stays authored either way — it is the fallback when a steps blob
   * fails validation, and a lesson must never be able to render blank.
   */
  steps?: LessonStep[];
  est_minutes: number;
};

export type SeedConcept = {
  slug: string;
  name: string;
  order_index: number;
};

export type SeedChapter = {
  slug: string;
  grade: 6 | 7 | 8;
  /** Chapter number in Ganita Prakash. */
  number: number;
  title: string;
  summary: string;
  /** Ganita Prakash only. The old edition is no longer cited anywhere (D1a). */
  ncert_ref: string;
  order_index: number;
  concepts: SeedConcept[];
  lessons: SeedLesson[];
  questions: SeedQuestion[];
};
