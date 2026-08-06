import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/security/authGuard";
import { track } from "@/lib/analytics/track";
import { istDate } from "@/lib/learning/dates";

/**
 * POST /api/lessons/[id]/complete
 *
 * The order matters and is fixed by the spec: mark complete → recompute the
 * streak (D7) → award milestones (D7b) → tell the client what happened.
 *
 * **The client never tells the server what its streak is.** It asks the server to
 * record a completion, and the server replies with the truth. A client-supplied
 * streak is a number a learner can edit in devtools.
 *
 * Idempotent throughout: `unique(student_id, lesson_id)` on the progress row,
 * `extend_streak` returns early when today is already counted, and
 * `unique(student_id, code)` makes a re-award a no-op.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json(
      { error: "Invalid lesson id", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  // Was this already complete? Decides whether the event fires, so it is read
  // before the write rather than inferred after it.
  const { data: before } = await supabase
    .from("lesson_progress")
    .select("status")
    .eq("student_id", auth.userId)
    .eq("lesson_id", id)
    .maybeSingle();

  const alreadyComplete = before?.status === "completed";

  if (alreadyComplete) {
    /*
      ── `completed_at` IS THE DAY THE LEARNER FINISHED IT, FOR EVER ─────────
      Nothing is written here. The upsert used to run BEFORE this check and
      stamped `completed_at` with the current time, so rereading a lesson moved
      the date it was finished to today — and then returned early, skipping the
      streak, the event and the milestones.

      That is not a tidy no-op. `completed_at` is what four separate things read
      to mean "work done today":

        · the week strip          → lit a square on a day with no new work
        · the daily goal ring     → closed a goal nobody had earned
        · the reminder cron       → suppressed both nudges for that day
        · the parent summary      → counted a reread as a lesson

      while the streak, which is a stored counter and was correctly left alone,
      did not move. Reported from a phone as "2 days this week, 1 day streak",
      which is exactly what it looks like from the outside: the app disagreeing
      with itself.

      Revisiting is not a lesser kind of completion — it is not a completion at
      all. It is reading something you already know, which is a good thing to do
      and not today's work. The row already says what it needs to.
    */
    const { data: streak } = await supabase
      .from("streaks")
      .select("current")
      .eq("student_id", auth.userId)
      .maybeSingle();
    return NextResponse.json({
      ok: true,
      alreadyComplete: true,
      streak: streak?.current ?? 0,
      // Nothing new happened, so there is nothing to celebrate. Re-opening a
      // finished lesson must not replay its confetti.
      dayCounted: false,
      milestonesEarned: [],
    });
  }

  // A genuine first completion, and the ONLY path that writes `completed_at`.
  const { error: writeError } = await supabase.from("lesson_progress").upsert(
    {
      student_id: auth.userId,
      lesson_id: id,
      status: "completed",
      completed_at: new Date().toISOString(),
    },
    { onConflict: "student_id,lesson_id" },
  );

  if (writeError) {
    console.error("[lessons/complete]", writeError.message);
    return NextResponse.json(
      { error: "Could not save your progress", code: "COMPLETE_FAILED" },
      { status: 500 },
    );
  }

  await track("lesson_completed", { lesson_id: id });

  // ── did that finish the whole chapter? ───────────────────────────────────
  // The outcome the product exists for, and the number a judge asks for first.
  //
  // Computed here rather than counted later from `lesson_completed`, because a
  // derived count silently goes wrong the moment a chapter gains a lesson: an
  // old cohort's five completions would keep reading as "finished" against a
  // six-lesson chapter, or stop reading as finished depending which way you
  // wrote the comparison. Recording the fact at the moment it becomes true
  // survives the curriculum changing underneath it.
  //
  // Wrapped like the streak block below, and for the same reason: the lesson is
  // already complete and stays complete whatever happens in here.
  try {
    const { data: lesson } = await supabase
      .from("lessons")
      .select("chapter_id")
      .eq("id", id)
      .maybeSingle();

    if (lesson?.chapter_id) {
      const { data: siblings } = await supabase
        .from("lessons")
        .select("id")
        .eq("chapter_id", lesson.chapter_id);

      const lessonIds = (siblings ?? []).map((row) => row.id);

      if (lessonIds.length > 0) {
        // RLS scopes this to the learner's own rows, so the count is theirs.
        const { count } = await supabase
          .from("lesson_progress")
          .select("lesson_id", { count: "exact", head: true })
          .eq("student_id", auth.userId)
          .eq("status", "completed")
          .in("lesson_id", lessonIds);

        // Exactly equal, never `>=`. This route already returned early when the
        // lesson was previously complete, so the count can only reach the total
        // on the call that completed the last one — which makes the event fire
        // once per learner per chapter without needing a uniqueness check.
        if (count === lessonIds.length) {
          await track("chapter_completed", {
            chapter_id: lesson.chapter_id,
            lessons: lessonIds.length,
          });
        }
      }
    }
  } catch (error) {
    console.error("[lessons/complete] chapter check failed:", error);
  }

  // ── streak + milestones ──────────────────────────────────────────────────
  // Both are SECURITY DEFINER functions, so they run through the admin client.
  // Wrapped in try/catch on purpose: **completion is the source of truth and
  // stays** even if these fail (spec §7). Rolling back a finished lesson because
  // a streak query timed out would be the worse bug by a distance — it takes work
  // the learner actually did.
  const admin = createAdminClient();
  let streakDays = 0;
  let milestonesEarned: string[] = [];
  /**
   * Did THIS call turn today into a counted day?
   *
   * Declared out here so it survives the try below. It is the fact behind the
   * daily-goal celebration, and it was already being computed and thrown away —
   * the client had no way to tell "you closed your goal just now" apart from
   * "your goal was already closed", so the strongest daily-return mechanic in
   * D17 was closing silently on a screen the learner had navigated away from.
   */
  let dayCounted = false;

  try {
    const today = istDate(); // the IST calendar date, never a UTC timestamp (D7)

    // Read BEFORE the RPC. Afterwards `last_active_date` is today either way —
    // whether this call extended the streak or the day was already counted — so
    // comparing after the fact cannot tell the two apart.
    const { data: streakBefore } = await admin
      .from("streaks")
      .select("last_active_date")
      .eq("student_id", auth.userId)
      .maybeSingle();
    const dayAlreadyCounted = streakBefore?.last_active_date === today;

    const { data: streak } = await admin.rpc("extend_streak", {
      p_student_id: auth.userId,
      p_date: today,
    });
    streakDays = streak?.current ?? 0;

    // Fires only when the streak ACTUALLY moved. A second lesson on the same day
    // keeps the streak alive but does not extend it, and emitting the event
    // anyway would inflate the Day-7 retention metric with repeat activity.
    if (!dayAlreadyCounted && streakDays > 0) {
      dayCounted = true;
      await track("streak_extended", { days: streakDays });
    }

    const { data: awarded } = await admin.rpc("award_milestones", {
      p_student_id: auth.userId,
      p_context: { lesson_id: id },
    });
    milestonesEarned = awarded ?? [];

    for (const code of milestonesEarned) {
      await track("milestone_earned", { code });
    }
  } catch (error) {
    console.error("[lessons/complete] streak/milestones failed:", error);
    // Deliberately swallowed. The lesson is complete; these recompute on the
    // next write.
  }

  return NextResponse.json({
    ok: true,
    alreadyComplete: false,
    streak: streakDays,
    dayCounted,
    milestonesEarned,
  });
}
