import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Event tracking.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE CANONICAL LIST. These exact strings are what the MVP success metrics in
 * PRD §12 are keyed to. Inventing an off-list name does not break a test — it
 * silently produces a metric that reads zero. So the list is a TYPE: an unknown
 * name is a compile error, not a Sunday-night mystery.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const EVENT_NAMES = [
  "learner_registered",
  "lesson_started",
  "lesson_completed",
  "ai_question_asked",
  "practice_started",
  "practice_completed",
  "quiz_submitted",
  "recommendation_clicked",
  "parent_linked",
  "parent_summary_sent",
  "parent_summary_viewed",
  "mentor_request_submitted",
  "streak_extended",
  "milestone_earned",
  "tutor_feedback_given",
] as const;

export type EventName = (typeof EVENT_NAMES)[number];

/**
 * Event properties.
 *
 * **No PII and no free text a learner typed** (saathi-security §5). A learner's
 * question can contain anything — their name, their school, their WhatsApp
 * number — and none of it belongs in a table we aggregate and read. So props are
 * restricted at the type level to scalars, and there is a runtime scrub below
 * for the keys that history says people reach for anyway.
 */
export type EventProps = Record<string, string | number | boolean | null>;

/** Keys that must never carry a value, whatever the caller intended. */
const FORBIDDEN_KEYS = new Set([
  "message",
  "question",
  "answer",
  "given_answer",
  "display_name",
  "name",
  "email",
  "phone",
  "whatsapp",
  "whatsapp_e164",
  "body_md",
  "stem_md",
  "transcript",
  "text",
]);

/** Belt and braces: a long string is free text however it was labelled. */
const MAX_VALUE_LENGTH = 64;

function scrub(props: EventProps): EventProps {
  const clean: EventProps = {};
  for (const [key, value] of Object.entries(props)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) continue;
    if (typeof value === "string" && value.length > MAX_VALUE_LENGTH) continue;
    clean[key] = value;
  }
  return clean;
}

/**
 * Record an event for the signed-in learner.
 *
 * **Fails open, always.** Analytics is never allowed to break the thing the
 * learner was doing: if the insert fails, the lesson still completes. The error
 * is logged server-side and swallowed.
 *
 * `student_id` comes from the session, never from an argument — the events RLS
 * policy (`auth.uid() = student_id`) would reject anything else anyway, and
 * accepting an id here would make this an impersonation surface.
 */
export async function track(
  name: EventName,
  props: EventProps = {},
): Promise<void> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return; // Anonymous events are not in scope for the MVP.

    const { error } = await supabase
      .from("events")
      .insert({ student_id: user.id, name, props: scrub(props) });

    if (error) console.error(`[track] ${name} failed:`, error.message);
  } catch (error) {
    console.error(`[track] ${name} threw:`, error);
  }
}
