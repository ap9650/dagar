/**
 * Seed types — shared by every chapter file in this directory.
 *
 * Deliberately narrower than the database schema. `chapter_id` and `concept_id`
 * are UUIDs the seed runner resolves from slugs, so an author never writes an id
 * by hand and never has to seed in a particular order.
 */

import type { LessonStep } from "../../lib/learning/lessonSteps.ts";

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
  /** Chapter number in the textbook. See `ncert_ref` — the editions disagree (D1). */
  number: number;
  title: string;
  summary: string;
  /** MUST cite BOTH editions. Learners on old stock are the ones we serve (D1). */
  ncert_ref: string;
  order_index: number;
  concepts: SeedConcept[];
  lessons: SeedLesson[];
  questions: SeedQuestion[];
};
