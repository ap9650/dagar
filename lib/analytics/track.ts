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
  // Added 31 Jul 2026 for the Recommendation Acceptance metric (PRD §12,
  // target ≥30%), which is `recommendation_clicked ÷ dashboard views`. The
  // numerator was on the canonical list from the start; the denominator was
  // written into the metric definition but never made an event, so the metric
  // could never have been computed. Adding it here and to DATA_MODEL.md.
  "dashboard_viewed",
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
/**
 * Record an event for a learner when there is NO session to read it from.
 *
 * Two callers, and both are legitimately session-less:
 *   - the weekly cron, which runs as nobody
 *   - `/s/[token]`, opened by a supporting adult who has no account at all
 *
 * It takes the student id explicitly and writes with the service role, so it
 * bypasses the `auth.uid() = student_id` policy that `track()` relies on. That
 * makes it a small impersonation surface by construction — **never call it with
 * an id taken from a request**. Both callers derive the id from a row they
 * already resolved (a share link, a summary), never from user input.
 *
 * Same scrubbing as `track()`: no PII, no free text. In particular the viewer's
 * identity is not recorded, because we do not have it and do not want it — this
 * counts that a summary was opened, not who opened it.
 */
export async function trackForStudent(
  studentId: string,
  name: EventName,
  props: EventProps = {},
): Promise<void> {
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const { error } = await admin
      .from("events")
      .insert({ student_id: studentId, name, props: scrub(props) });

    if (error) console.error(`[track] ${name} failed:`, error.message);
  } catch (error) {
    console.error(`[track] ${name} threw:`, error);
  }
}

/**
 * The marker `NextLessonCard` puts on its link, and the three destinations read
 * back. One constant so the writer and the readers cannot drift apart — a typo
 * on either side would silently zero the Recommendation Acceptance metric, which
 * is the exact failure this file exists to prevent.
 */
export const RECOMMENDATION_MARKER = "rec";

/**
 * Emit `recommendation_clicked` if the learner arrived here from the next-action
 * card.
 *
 * Fires at the DESTINATION, not on the click. A click handler would measure
 * intent — a tap that never finished loading on a 4G connection still counts.
 * Arriving measures what actually happened, and it keeps the emit server-side
 * where the rest of the tracking lives.
 */
export async function trackRecommendationArrival(
  searchParams: Promise<Record<string, string | string[] | undefined>> | undefined,
  props: EventProps = {},
): Promise<void> {
  if (!searchParams) return;
  const resolved = await searchParams;
  const from = resolved?.from;
  const value = Array.isArray(from) ? from[0] : from;
  if (value !== RECOMMENDATION_MARKER) return;
  await track("recommendation_clicked", props);
}

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
