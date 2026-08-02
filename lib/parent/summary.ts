import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { istDate, istDayStart } from "@/lib/learning/dates";
import { fromRow, streakStatus, type StreakStatus } from "@/lib/learning/streaks";
import { t as tContent } from "@/lib/i18n/content";
import type { Locale } from "@/i18n/config";

/**
 * One learner's week, assembled once and rendered on two surfaces (D4):
 *
 *   /parent      the account path — a supporting adult who signed in
 *   /s/[token]   the link path — a supporting adult who did not
 *
 * ── WHY ONE FUNCTION AND NOT TWO ────────────────────────────────────────────
 * Two surfaces showing "the same" summary is exactly how one of them quietly
 * ends up exposing a field the other does not. Everything either surface can
 * show is chosen here, once. If a field is not in `WeeklySummary`, no parent
 * screen can render it — not by discipline, but because it never arrives.
 *
 * What is deliberately absent, and must stay absent: `given_answer`, anything
 * from `tutor_messages`, and `mentor_requests.learner_note`. Those are the
 * learner's own, they are what the child was promised stays private, and this
 * type is the enforcement.
 * ────────────────────────────────────────────────────────────────────────────
 */

export type ConceptStanding = {
  conceptId: string;
  name: string;
  band: "mastered" | "developing" | "needs_revision";
};

export type WeeklySummary = {
  learnerName: string | null;
  grade: number | null;
  lessonsThisWeek: number;
  practiceThisWeek: number;
  streak: StreakStatus;
  concepts: ConceptStanding[];
  milestoneCodes: string[];
  /** True when there is nothing to report — drives the "quiet week" state. */
  quiet: boolean;
  /**
   * The concept worth sitting with, if there is one. Drives the single
   * actionable line — see `pickFocus` for why it is the weakest and not the
   * newest.
   */
  focus: ConceptStanding | null;
};

/** How far back "this week" reaches. */
const WEEK_DAYS = 7;

/**
 * The concept a supporting adult should spend ten minutes on.
 *
 * The weakest one, not the most recent: an adult reading this has limited time
 * and no subject expertise, and "here is the one thing" is the only shape of
 * advice that survives that. Ties break toward the earlier concept in the
 * chapter, because the later ones are built on it.
 */
function pickFocus(concepts: readonly ConceptStanding[]): ConceptStanding | null {
  const weak = concepts.filter((c) => c.band === "needs_revision");
  if (weak.length > 0) return weak[0];
  const developing = concepts.filter((c) => c.band === "developing");
  return developing[0] ?? null;
}

export async function fetchWeeklySummary({
  supabase,
  studentId,
  locale,
}: {
  /**
   * Either the parent's RLS-scoped client (account path, where `parent_links`
   * policies do the scoping) or the service role (link path, where the token
   * has already been resolved and there is no session to scope by).
   */
  supabase: SupabaseClient<Database>;
  studentId: string;
  locale: Locale;
}): Promise<WeeklySummary> {
  const today = istDate();
  const weekStart = new Date(istDayStart(today));
  weekStart.setUTCDate(weekStart.getUTCDate() - WEEK_DAYS);
  const since = weekStart.toISOString();

  const [
    { data: learner },
    { count: lessons },
    { count: practice },
    { data: streakRow },
    { data: mastery },
    { data: milestones },
  ] = await Promise.all([
    supabase.from("profiles").select("display_name, grade").eq("id", studentId).maybeSingle(),
    supabase
      .from("lesson_progress")
      .select("*", { count: "exact", head: true })
      .eq("student_id", studentId)
      .eq("status", "completed")
      .gte("completed_at", since),
    supabase
      .from("attempts")
      .select("*", { count: "exact", head: true })
      .eq("student_id", studentId)
      // PRACTICE only. Without this the count swept up quiz answers too, so an
      // 8-question quiz added 8 to a number labelled "practice questions" — and
      // that number is handed to the model that writes the parent's message, so
      // it was stated to a parent as fact, in a sentence they cannot check.
      //
      // Retries ARE still counted, deliberately. "Try again" writes a second
      // row, so answering one question wrong then right counts twice. That is
      // effort, which is the honest thing to show a parent, and the alternative
      // — counting distinct questions — would make a learner who worked hard on
      // three questions look like they did less than one who breezed through
      // three. The retry signal a parent can actually act on is the mastery
      // band, not a tally of second attempts.
      .eq("session_kind", "practice")
      .gte("created_at", since),
    supabase
      .from("streaks")
      .select("current, longest, last_active_date, grace_used_on")
      .eq("student_id", studentId)
      .maybeSingle(),
    supabase
      .from("concept_mastery")
      .select("concept_id, score, is_mastered, attempts_count, concepts(name, i18n, order_index)")
      .eq("student_id", studentId)
      .gt("attempts_count", 0),
    supabase
      .from("milestones")
      .select("code, earned_at")
      .eq("student_id", studentId)
      .gte("earned_at", since)
      .order("earned_at", { ascending: false }),
  ]);

  const concepts: ConceptStanding[] = (mastery ?? [])
    .filter((row) => row.concepts)
    .sort((a, b) => (a.concepts!.order_index ?? 0) - (b.concepts!.order_index ?? 0))
    .map((row) => ({
      conceptId: row.concept_id,
      name: tContent(row.concepts!, "name", locale),
      band: row.is_mastered
        ? ("mastered" as const)
        : row.score >= 0.5
          ? ("developing" as const)
          : ("needs_revision" as const),
    }));

  const lessonsThisWeek = lessons ?? 0;
  const practiceThisWeek = practice ?? 0;

  return {
    learnerName: learner?.display_name?.trim() || null,
    grade: learner?.grade ?? null,
    lessonsThisWeek,
    practiceThisWeek,
    streak: streakStatus(fromRow(streakRow), today),
    concepts,
    milestoneCodes: (milestones ?? []).map((m) => m.code),
    quiet: lessonsThisWeek === 0 && practiceThisWeek === 0,
    focus: pickFocus(concepts),
  };
}
