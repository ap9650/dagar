import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import { STRUGGLE_WINDOW, type StruggleTrigger } from "./struggle";

/**
 * The context a mentor request carries (D6/D8, `docs/specs/mentor-request.md` §3).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THIS IS THE FEATURE. The detection is a heuristic and the CTA is a button; what
 * makes the escalation worth anything is that a human opens the request and can
 * help **without asking the learner to re-explain anything**.
 *
 * So: which concept, in which chapter, the last few attempts INCLUDING WHAT THE
 * LEARNER ACTUALLY WROTE, how much help they had already taken, and what they
 * were asking the tutor. A request saying "student struggling with fractions" is
 * a notification. This is a handover.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Assembled SERVER-SIDE, always. The route's zod schema has no `context` field,
 * so a forged payload cannot poison the record a person is going to read and act
 * on — that is the one place in the product where bad data reaches a human
 * directly rather than through a screen.
 *
 * Read through the learner's own RLS-scoped client, not the service role: every
 * row here belongs to the learner making the request, so nothing needs the
 * ability to cross a user boundary.
 */

/** Attempts a mentor sees. Matches the struggle window — the same span that fired. */
const ATTEMPTS_IN_CONTEXT = STRUGGLE_WINDOW;

/** Tutor turns quoted. Enough to show what they were asking, not the whole session. */
const TUTOR_TURNS_IN_CONTEXT = 6;

/**
 * Per-message cap on the excerpt.
 *
 * ── A RETENTION NOTE, DELIBERATELY LEFT VISIBLE ─────────────────────────────
 * D11 retains tutor transcripts for 90 days and then aggregates them. Text
 * copied in here lives in `mentor_requests.context` and would outlive that
 * unless the purge covers this column too. It is capped and truncated to keep
 * the copy small, and the Day 3 retention job must include it.
 * ────────────────────────────────────────────────────────────────────────────
 */
const MAX_EXCERPT_CHARS = 300;

export type MentorContext = {
  trigger: StruggleTrigger;
  concept: { id: string; slug: string | null; name: string } | null;
  chapter: { id: string; title: string; grade: number | null } | null;
  recent_attempts: {
    question_slug: string | null;
    given_answer: string;
    /** The choice text for MCQ answers. Null for typed answers, which speak for themselves. */
    given_answer_label: string | null;
    is_correct: boolean;
    hints_used: number;
    at: string;
  }[];
  tutor_excerpt: { role: string; text: string; at: string }[];
  captured_at: string;
};

/**
 * The label behind a multiple-choice id, in the base (English) text.
 *
 * English deliberately, even for a Hindi learner: the mentor reading this is an
 * adult volunteer who may not read Devanagari, and `choices` carries the English
 * labels on the row itself. The learner's own language is still visible in their
 * note, which is theirs and is never translated.
 */
function choiceLabel(choices: unknown, given: string): string | null {
  if (!Array.isArray(choices)) return null;
  for (const choice of choices) {
    if (
      typeof choice === "object" &&
      choice !== null &&
      "id" in choice &&
      "label" in choice &&
      (choice as { id: unknown }).id === given
    ) {
      const label = (choice as { label: unknown }).label;
      return typeof label === "string" ? label : null;
    }
  }
  return null;
}

export async function buildMentorContext({
  supabase,
  studentId,
  conceptId,
  lessonId,
  trigger,
}: {
  /** RLS-scoped. Everything read here is the learner's own. */
  supabase: SupabaseClient<Database>;
  studentId: string;
  conceptId?: string;
  /** Set when the offer came from the tutor sheet (D6 rule 3). */
  lessonId?: string;
  trigger: StruggleTrigger;
}): Promise<Json> {
  const context: MentorContext = {
    trigger,
    concept: null,
    chapter: null,
    recent_attempts: [],
    tutor_excerpt: [],
    captured_at: new Date().toISOString(),
  };

  // ── which concept, in which chapter ──────────────────────────────────────
  if (conceptId) {
    const { data: concept } = await supabase
      .from("concepts")
      .select("id, slug, name, chapter_id, chapters(id, title, grade)")
      .eq("id", conceptId)
      .maybeSingle();

    if (concept) {
      context.concept = { id: concept.id, slug: concept.slug, name: concept.name };
      if (concept.chapters) {
        context.chapter = {
          id: concept.chapters.id,
          title: concept.chapters.title,
          grade: concept.chapters.grade,
        };
      }
    }

    // ── what they tried, and what they wrote ───────────────────────────────
    //
    // `given_answer` is the diagnostic. "Three wrong on comparing fractions"
    // tells a mentor nothing they could act on; three answers of 3/9, 4/9, 5/9
    // tells them the learner is changing the numerator and never the
    // denominator, which is a thirty-second conversation.
    const { data: attempts } = await supabase
      .from("attempts")
      .select("question_id, given_answer, is_correct, hints_used, created_at")
      .eq("student_id", studentId)
      .eq("concept_id", conceptId)
      .order("created_at", { ascending: false })
      .limit(ATTEMPTS_IN_CONTEXT);

    // A SECOND query against `questions_public`, not an embedded join on
    // `questions`.
    //
    // The join was the obvious way to write this and it silently returned null
    // for every slug: the base table is unreadable to a learner by RLS — that is
    // the answer-key boundary doing its job — and PostgREST resolves an
    // unreadable embed to null rather than erroring. The request looked complete
    // and carried nothing identifying the questions.
    const questionIds = [...new Set((attempts ?? []).map((a) => a.question_id))];
    const { data: questionRows } = await supabase
      .from("questions_public")
      .select("id, slug, choices")
      .in("id", questionIds);

    const questionById = new Map((questionRows ?? []).map((q) => [q.id, q]));

    context.recent_attempts = (attempts ?? [])
      // Back to chronological. A mentor reads a sequence forwards — the order
      // IS the diagnosis when the same mistake repeats.
      .slice()
      .reverse()
      .map((attempt) => {
        const question = questionById.get(attempt.question_id);
        return {
          // The SLUG, not the stem: the stem is reproducible from the slug and
          // copying it would duplicate curriculum into every request.
          question_slug: question?.slug ?? null,
          given_answer: attempt.given_answer,
          // …but for multiple choice the raw value is a choice id, and a mentor
          // reading "b, b, b" learns nothing at all. The LABEL is the whole
          // signal: three answers of "because both its numbers are bigger" names
          // the misconception outright.
          given_answer_label: choiceLabel(question?.choices, attempt.given_answer),
          is_correct: attempt.is_correct,
          hints_used: attempt.hints_used,
          at: attempt.created_at,
        };
      });
  }

  // ── what they were asking the tutor ──────────────────────────────────────
  //
  // Scoped to the lesson when the offer came from the tutor sheet, and to the
  // concept's lessons otherwise. Never the learner's whole history: a mentor
  // needs the last few minutes, and everything beyond that is a transcript we
  // have copied out of its retention window for no benefit.
  let excerptLessonIds: string[] = [];

  if (lessonId) {
    excerptLessonIds = [lessonId];
  } else if (conceptId) {
    const { data: lessons } = await supabase
      .from("lessons")
      .select("id")
      .eq("concept_id", conceptId);
    excerptLessonIds = (lessons ?? []).map((lesson) => lesson.id);
  }

  if (excerptLessonIds.length > 0) {
    const { data: messages } = await supabase
      .from("tutor_messages")
      .select("role, content, created_at")
      .eq("student_id", studentId)
      .in("lesson_id", excerptLessonIds)
      .order("created_at", { ascending: false })
      .limit(TUTOR_TURNS_IN_CONTEXT);

    context.tutor_excerpt = (messages ?? [])
      .slice()
      .reverse()
      .map((message) => ({
        role: message.role,
        text:
          message.content.length > MAX_EXCERPT_CHARS
            ? `${message.content.slice(0, MAX_EXCERPT_CHARS)}…`
            : message.content,
        at: message.created_at,
      }));
  }

  // A missing excerpt never blocks a request (spec §7). A learner who never
  // opened the tutor still gets escalated — with attempts only, which is plenty.
  return context as unknown as Json;
}
