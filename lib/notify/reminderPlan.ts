import { getTranslations } from "next-intl/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { istDate, istDayStart } from "@/lib/learning/dates";
import { dayQualified } from "@/lib/learning/week";
import { fromRow, streakStatus } from "@/lib/learning/streaks";
import { oneDayFromRung } from "@/lib/learning/streakLadder";
import type { Locale } from "@/i18n/config";

/**
 * WHO gets a reminder, and WHAT it says — decided once, used twice.
 *
 * ── WHY THIS IS ITS OWN MODULE ──────────────────────────────────────────────
 * The cron decided all of this inline, which was fine until the question became
 * "how do I test it?". The only honest answer to that is a dry run — and a dry
 * run that reimplements the rules proves the reimplementation, not the job. It
 * would agree with the cron right up to the day somebody changed one of them.
 *
 * So the cron sends what this plans, and the dry run shows what this plans, and
 * there is no third copy of the rule that decides whether a child's phone buzzes.
 *
 * ── THE RULE ITSELF (D17b) ──────────────────────────────────────────────────
 * Neither slot fires once today's goal is met — the SAME `dayQualified` the
 * streak and the week strip use, so the three can never disagree about whether
 * a learner showed up. Which is what makes two a day safe:
 *
 *   studies after school     → ZERO notifications
 *   studies in the evening   → ONE
 *   has not shown up at all  → TWO
 *
 * The evening line changes when a learner is one day from a streak rung: the
 * only moment a reminder carries information they do not already have. Stated
 * as an opportunity — "one more day and you reach a 7-day streak" — never as a
 * countdown, because it lands on a parent's phone.
 */

export type Slot = "afternoon" | "evening";

export type PushTarget = {
  id: string;
  student_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type ReminderPlanItem = {
  subscription: PushTarget;
  /** False when today's goal is already met — the reason nothing is sent. */
  send: boolean;
  /** Why, in a word, for the dry run to display. */
  reason: "goal_met" | "due";
  locale: Locale;
  streakDays: number;
  /** The rung this learner is one day away from, if any. Drives the wording. */
  rung: number | null;
  message: { title: string; body: string; url: string };
};

/**
 * Plans one slot for every stored subscription.
 *
 * Batched: three queries for the whole cohort rather than three per learner.
 * Reads only — nothing here writes, sends, or has any side effect at all, which
 * is what makes it safe to call from a dry run.
 */
export async function planReminders(
  admin: SupabaseClient,
  slot: Slot,
): Promise<ReminderPlanItem[]> {
  const today = istDate();
  const dayStart = istDayStart(today).toISOString();

  const { data: subscriptions } = await admin
    .from("push_subscriptions")
    .select("id, student_id, endpoint, p256dh, auth");

  if (!subscriptions?.length) return [];

  const studentIds = [...new Set(subscriptions.map((row) => row.student_id))];

  const [{ data: lessonsToday }, { data: practiceToday }, { data: streaks }, { data: profiles }] =
    await Promise.all([
      admin
        .from("lesson_progress")
        .select("student_id")
        .in("student_id", studentIds)
        .eq("status", "completed")
        .gte("completed_at", dayStart),
      admin
        .from("attempts")
        .select("student_id, question_id")
        .in("student_id", studentIds)
        .eq("session_kind", "practice")
        .gte("created_at", dayStart),
      admin
        .from("streaks")
        .select("student_id, current, longest, last_active_date, grace_used_on")
        .in("student_id", studentIds),
      admin.from("profiles").select("id, locale").in("id", studentIds),
    ]);

  const lessonCount = new Map<string, number>();
  for (const row of lessonsToday ?? []) {
    lessonCount.set(row.student_id, (lessonCount.get(row.student_id) ?? 0) + 1);
  }

  // DISTINCT questions, matching the goal ring: answering one question five
  // times is not five questions of practice.
  const practiceCount = new Map<string, Set<string>>();
  for (const row of practiceToday ?? []) {
    const set = practiceCount.get(row.student_id) ?? new Set<string>();
    set.add(row.question_id);
    practiceCount.set(row.student_id, set);
  }

  const streakByStudent = new Map((streaks ?? []).map((row) => [row.student_id, row]));
  const localeByStudent = new Map((profiles ?? []).map((row) => [row.id, row.locale as Locale]));

  const done = new Set(
    studentIds.filter((id) =>
      dayQualified(lessonCount.get(id) ?? 0, practiceCount.get(id)?.size ?? 0),
    ),
  );

  const plan: ReminderPlanItem[] = [];

  for (const subscription of subscriptions) {
    const locale = localeByStudent.get(subscription.student_id) ?? "en";
    const t = await getTranslations({ locale, namespace: "push" });

    const streak = streakStatus(
      fromRow(streakByStudent.get(subscription.student_id) ?? null),
      today,
    );
    const rung = slot === "evening" && streak.alive ? oneDayFromRung(streak.days) : null;

    const body = rung
      ? t("rungBody", { days: rung })
      : slot === "evening"
        ? t("eveningBody")
        : t("afternoonBody");

    const met = done.has(subscription.student_id);

    plan.push({
      subscription,
      send: !met,
      reason: met ? "goal_met" : "due",
      locale,
      streakDays: streak.days,
      rung,
      message: {
        title: slot === "evening" ? t("eveningTitle") : t("afternoonTitle"),
        body,
        url: "/learn",
      },
    });
  }

  return plan;
}
