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

  // ── Added 4 Aug 2026, from an end-to-end audit of the journey ─────────────
  // The list above measures what a learner does once they are INSIDE. It could
  // not answer the three questions the first real cohort will actually raise:
  // how many people who opened the link never got an account, how many got an
  // account and never started, and how many finished the thing they came for.
  //
  // Names are grouped by the question they answer, not by where they fire.

  // Before an account exists. Written with NO student_id and no identifier of
  // any kind — see `trackAnonymous` below for why that is the whole design.
  "welcome_viewed",
  "login_viewed",

  // Has an account, has not finished signing up. The gap between this and
  // `learner_registered` is the onboarding drop-off, which was previously
  // invisible: someone who authenticated and closed the tab at the grade picker
  // left no trace at all.
  "onboarding_started",

  // The outcome the product exists for. Derivable from counting
  // `lesson_completed` against the curriculum, but derived metrics drift when
  // chapters gain lessons — and this one goes in front of judges.
  "chapter_completed",

  // Pedagogy. "Hints before answers" is a claim the product makes (D3, the AI
  // skill) and nothing measured whether learners take them.
  "hint_requested",

  // Added 4 Aug 2026 with the chapter picker. Choosing a chapter is a new step
  // between the dashboard and a lesson, so it is a new place to lose people —
  // "opened a chapter and started nothing" was not a state that could exist
  // before. Shipped with the screen rather than after it, so its history starts
  // when the screen's does.
  "chapter_opened",

  // ── The diary's only source, added 5 Aug 2026 ────────────────────────────
  // `concept_mastery` stores the CURRENT state and nothing else, so there was
  // no way to know a learner moved from "Getting there" to "Mastered" on
  // Tuesday — the fact existed for one instant inside a database function and
  // was overwritten. This records it.
  //
  // Carries `from` and `to`, and fires in BOTH directions. Mastery genuinely
  // falls, and analytics should see the real picture; the progress screen shows
  // only upward moves, which is a presentation choice made where it belongs.
  //
  // It cannot be backdated: nothing before this event existed is recoverable.
  "concept_level_changed",

  // `quiz_submitted` had no denominator, so quiz abandonment read as zero.
  "quiz_started",

  // The DENOMINATOR for mentor demand (D8a). "Six people asked for a human" is
  // a different story out of eight offers than out of two hundred, and the deck
  // makes a claim about demand. Being *offered* help is not the same as
  // declining it: dismissal is still deliberately unrecorded (mentor-request
  // spec §7) — a learner turning down help is not a failed conversion.
  "mentor_cta_shown",

  // Feedback conversion. The submission quotes real users; this is how we know
  // whether nine responses came from twelve asks or from two hundred.
  "feedback_shown",
  "feedback_submitted",

  // Did anyone switch language or class after onboarding? A learner who moves
  // to Hindi on day two is evidence about D16 that the signup locale hides.
  "settings_changed",

  // The parent funnel's first step. Only `parent_linked` existed, so a link
  // nobody redeemed was indistinguishable from a link nobody created.
  "parent_invite_created",
] as const;

export type EventName = (typeof EVENT_NAMES)[number];

/**
 * The events that may be recorded with no learner attached.
 *
 * ── WHY THIS IS A SEPARATE, TINY LIST ───────────────────────────────────────
 * These fire before an account exists, so they are written with the service
 * role and `student_id: null`. That combination is exactly the shape of an
 * impersonation surface, so it is fenced by its own type: `trackAnonymous`
 * cannot be called with `lesson_completed`, and `track` cannot be called with
 * `welcome_viewed`.
 * ────────────────────────────────────────────────────────────────────────────
 */
export const ANONYMOUS_EVENTS = ["welcome_viewed", "login_viewed"] as const;

export type AnonymousEventName = (typeof ANONYMOUS_EVENTS)[number];

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
 * Record that a screen was opened by somebody who has no account.
 *
 * ── THE TOP OF THE FUNNEL, AND THE ONLY HONEST WAY TO MEASURE IT ────────────
 * Without this, the first two steps of the funnel are unmeasurable: `track()`
 * returns early when there is no session, so a person who opened the link and
 * never signed up was indistinguishable from a person who never opened it.
 *
 * The row it writes carries a name, a locale and a timestamp. That is all.
 *
 *   - No `student_id` — the column is left null.
 *   - No session id, no cookie, no IP, no user agent, no fingerprint.
 *   - Nothing that could be joined to anything, now or later.
 *
 * That is the difference between a TALLY and TRACKING, and it is the reason
 * this is acceptable for a product used by children. DPDP §9(3) prohibits
 * behavioural monitoring of a child even with parental consent; a counter that
 * cannot distinguish two visitors from one visitor twice does not monitor
 * anybody. The cost of that choice is real and is stated where the number is
 * shown: these count SCREEN OPENS, not people, and a reload counts twice.
 *
 * Called directly from server components rather than through an API route, on
 * purpose. An unauthenticated endpoint that writes rows with the service role
 * would be an abuse surface; a server render is not reachable that way.
 * ────────────────────────────────────────────────────────────────────────────
 */
export async function trackAnonymous(
  name: AnonymousEventName,
  props: EventProps = {},
): Promise<void> {
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const { error } = await admin
      .from("events")
      .insert({ student_id: null, name, props: scrub(props) });

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
