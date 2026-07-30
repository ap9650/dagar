import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { t as tContent } from "@/lib/i18n/content";
import type { Locale } from "@/i18n/config";
import { anthropic, TUTOR_MODEL } from "./client";
import {
  lessonGrounding,
  tutorSystemPrompt,
  type MasterySummary,
} from "./prompts/tutor";

/**
 * The tutor call: assemble grounding, stream a reply.
 *
 * "Grounded" is the product claim, and it is this function's whole job. Every
 * call carries the current lesson's `body_md` **in the learner's locale** plus
 * their concept mastery — nothing less, and deliberately nothing more. Dumping
 * the whole curriculum in would cost more, cache worse, and answer no better.
 */

/** How many past turns travel with each call. Bounded on purpose (D11). */
export const HISTORY_TURNS = 6;

export type TutorContext = {
  lessonId: string;
  grade: number | null;
  chapterTitle: string;
  lessonTitle: string;
  body: string;
  mastery: MasterySummary[];
  history: { role: "user" | "assistant"; content: string }[];
  /** Turns the learner has taken on this lesson, for D6 rule 3. */
  turnCount: number;
};

export async function loadTutorContext({
  supabase,
  studentId,
  lessonId,
  locale,
}: {
  supabase: SupabaseClient<Database>;
  studentId: string;
  lessonId: string;
  locale: Locale;
}): Promise<TutorContext | null> {
  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, title, body_md, chapter_id, concept_id, i18n")
    .eq("id", lessonId)
    .maybeSingle();

  if (!lesson) return null;

  const [{ data: chapter }, { data: profile }, { data: concepts }, { data: turns }] =
    await Promise.all([
      supabase
        .from("chapters")
        .select("title, i18n")
        .eq("id", lesson.chapter_id)
        .maybeSingle(),
      supabase.from("profiles").select("grade").eq("id", studentId).maybeSingle(),
      supabase
        .from("concepts")
        .select("id, name, i18n")
        .eq("chapter_id", lesson.chapter_id)
        .order("order_index"),
      supabase
        .from("tutor_messages")
        .select("role, content, created_at")
        .eq("student_id", studentId)
        .eq("lesson_id", lessonId)
        .order("created_at", { ascending: false })
        // Two messages per exchange, so this is HISTORY_TURNS exchanges.
        .limit(HISTORY_TURNS * 2),
    ]);

  const conceptIds = (concepts ?? []).map((c) => c.id);
  const { data: masteryRows } = conceptIds.length
    ? await supabase
        .from("concept_mastery")
        .select("concept_id, score, is_mastered, attempts_count")
        .eq("student_id", studentId)
        .in("concept_id", conceptIds)
    : { data: [] };

  const masteryByConcept = new Map((masteryRows ?? []).map((m) => [m.concept_id, m]));

  const mastery: MasterySummary[] = (concepts ?? []).map((concept) => {
    const row = masteryByConcept.get(concept.id);
    return {
      conceptName: tContent(concept, "name", locale),
      score: Number(row?.score ?? 0),
      isMastered: row?.is_mastered ?? false,
      attempts: row?.attempts_count ?? 0,
    };
  });

  // Oldest first — the API wants chronological, the query returned newest first
  // so that `limit` takes the most RECENT turns rather than the first six ever.
  const history = (turns ?? [])
    .slice()
    .reverse()
    .map((turn) => ({
      role: turn.role as "user" | "assistant",
      content: turn.content,
    }));

  return {
    lessonId,
    grade: profile?.grade ?? null,
    chapterTitle: chapter ? tContent(chapter, "title", locale) : "",
    lessonTitle: tContent(lesson, "title", locale),
    // D16: the Hindi body for a Hindi learner. Grounding in English and letting
    // the model translate on the fly puts the translation outside review, which
    // is how wrong mathematics reaches a child (i18n.md).
    body: tContent(lesson, "body_md", locale),
    mastery,
    history,
    turnCount: history.filter((turn) => turn.role === "user").length,
  };
}

/**
 * Start the streamed reply.
 *
 * ── CACHE LAYOUT (D11) ──────────────────────────────────────────────────────
 * Two breakpoints, ordered most-stable first, because caching is a prefix match
 * and any byte that changes invalidates everything after it:
 *
 *   [0] system prompt   — identical for every learner in this locale
 *   [1] lesson grounding — per lesson + learner, stable across the conversation
 *       ...then the turns, uncached, which is correct: they change every time.
 *
 * Mastery sits in block [1] and does change when the learner practises. That
 * invalidation is honest — the grounding genuinely differs — and it happens
 * between sessions, not within one.
 *
 * **Verify this actually works.** Sonnet 5 will not cache a prefix under 1024
 * tokens and says nothing when it declines: no error, no discount, ~40% more
 * cost. `usage.cache_read_input_tokens` on the second turn is the only proof.
 * ────────────────────────────────────────────────────────────────────────────
 */
export function streamTutorReply({
  context,
  message,
  locale,
}: {
  context: TutorContext;
  message: string;
  locale: Locale;
}) {
  const messages: Anthropic.MessageParam[] = [
    ...context.history.map((turn) => ({
      role: turn.role,
      content: turn.content,
    })),
    { role: "user" as const, content: message },
  ];

  return anthropic().messages.stream({
    model: TUTOR_MODEL,
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: tutorSystemPrompt(locale),
        cache_control: { type: "ephemeral" },
      },
      {
        type: "text",
        text: lessonGrounding({
          grade: context.grade,
          chapterTitle: context.chapterTitle,
          lessonTitle: context.lessonTitle,
          body: context.body,
          mastery: context.mastery,
        }),
        cache_control: { type: "ephemeral" },
      },
    ],
    // Thinking OFF, effort LOW — both for the D11 latency target of a first
    // token under 2s at p75. Adaptive thinking is ON by default on Sonnet 5, and
    // leaving it on would put a silent multi-second pause in front of every
    // reply: a learner on 4G watching an unchanged screen concludes the app is
    // broken. Explaining one step of a Class 6 fractions lesson does not need
    // extended reasoning, and this is the single biggest lever on how the tutor
    // *feels*.
    thinking: { type: "disabled" },
    output_config: { effort: "low" },
    messages,
  });
}
