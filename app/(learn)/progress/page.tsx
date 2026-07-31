import Link from "next/link";
import { ArrowLeft, Flame } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { t as tContent } from "@/lib/i18n/content";
import { dailyGoal } from "@/lib/learning/dailyGoal";
import { istDate, istDayStart } from "@/lib/learning/dates";
import { fromRow, streakStatus } from "@/lib/learning/streaks";
import { earnedCount, milestoneGrid } from "@/lib/learning/milestones";
import { chapterMastery, type MasteryBand } from "@/lib/learning/mastery";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { DailyGoalRing } from "@/components/learn/DailyGoalRing";
import { MilestoneGrid } from "@/components/learn/MilestoneGrid";
import { cn } from "@/lib/cn";
import type { Locale } from "@/i18n/config";

/**
 * `/progress` — mastery, streak, milestones (slice 2.5).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THIS SCREEN COMPUTES NOTHING THAT MATTERS. It reads.
 *
 * The streak was extended by `extend_streak` on the write that earned it, mastery
 * by `recompute_concept_mastery`, badges by `award_milestones`. Every number here
 * already existed before the page was requested. That is the point of D7's
 * "server-side truth": a learner cannot manufacture a streak by opening a screen,
 * and two devices looking at the same account cannot disagree.
 *
 * The one thing computed here is `streakStatus` — whether the STORED streak is
 * still alive today — and that is display logic, not truth. See streaks.ts.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * One server component, one round of queries, same as the dashboard. Fetching
 * six things from the client would be six round trips on a phone.
 */
export default async function ProgressPage() {
  const supabase = await createClient();
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const studentId = user!.id; // the (learn) layout guarantees this

  const { data: profile } = await supabase
    .from("profiles")
    .select("grade")
    .eq("id", studentId)
    .single();

  const grade = profile?.grade ?? 6;
  const today = istDate();
  const todayStart = istDayStart(today).toISOString();

  const [
    { data: chapters },
    { data: mastery },
    { data: streakRow },
    { data: earned },
    { count: lessonsToday },
    { count: practiceToday },
  ] = await Promise.all([
    supabase
      .from("chapters")
      .select("id, title, i18n, order_index, concepts(id, name, order_index, i18n)")
      .eq("grade", grade)
      .order("order_index"),
    supabase
      .from("concept_mastery")
      .select("concept_id, score, attempts_count, is_mastered")
      .eq("student_id", studentId),
    supabase
      .from("streaks")
      .select("current, longest, last_active_date, grace_used_on")
      .eq("student_id", studentId)
      .maybeSingle(),
    supabase
      .from("milestones")
      .select("code, earned_at")
      .eq("student_id", studentId)
      .order("earned_at"),
    supabase
      .from("lesson_progress")
      .select("*", { count: "exact", head: true })
      .eq("student_id", studentId)
      .eq("status", "completed")
      .gte("completed_at", todayStart),
    supabase
      .from("attempts")
      .select("*", { count: "exact", head: true })
      .eq("student_id", studentId)
      .eq("session_kind", "practice")
      .gte("created_at", todayStart),
  ]);

  const streak = streakStatus(fromRow(streakRow), today);
  const goal = dailyGoal(lessonsToday ?? 0, practiceToday ?? 0);
  const grid = milestoneGrid(earned ?? []);
  const badges = earnedCount(grid);

  const masteryByConcept = new Map((mastery ?? []).map((m) => [m.concept_id, m]));
  const masteredIds = new Set(
    (mastery ?? []).filter((m) => m.is_mastered).map((m) => m.concept_id),
  );

  return (
    <main className="flex-1 w-full max-w-(--container-content) mx-auto px-lg py-lg flex flex-col gap-xl">
      <header className="flex flex-col gap-lg">
        <div className="flex items-center gap-md">
          <Link
            href="/learn"
            aria-label={t("errors.backHome")}
            className="inline-flex items-center justify-center size-11 -ms-sm rounded-(--radius-control) text-body hover:bg-surface"
          >
            <ArrowLeft size={20} strokeWidth={1.75} aria-hidden />
          </Link>
        </div>
        <h1 className="text-h1 text-ink">{t("progress.title")}</h1>
      </header>

      {/* ── the streak (D7) ──────────────────────────────────────────────── */}
      <section
        aria-labelledby="streak-heading"
        className="flex items-center gap-lg rounded-(--radius-card) border border-border bg-surface px-lg py-lg"
      >
        <Flame
          size={32}
          strokeWidth={1.75}
          aria-hidden
          className={cn(
            "shrink-0",
            !streak.alive && "text-streak-rest",
            streak.alive && streak.graceActive && "text-celebrate",
            streak.alive && !streak.graceActive && "text-streak-active",
          )}
        />
        <div className="flex flex-col gap-xs min-w-0">
          <h2 id="streak-heading" className="text-h3 text-ink">
            {/* Never a loss message. A broken streak reads "Start again today" —
                the learner who missed a day is the one least helped by being
                told what they lost. */}
            {streak.alive ? t("streak.days", { days: streak.days }) : t("streak.broken")}
          </h2>
          {streak.graceActive && (
            <p className="text-body-sm text-celebrate">{t("streak.grace")}</p>
          )}
          {streak.longest > 0 && (
            <p className="text-body-sm text-muted">
              {t("progress.longestStreak", { days: streak.longest })}
            </p>
          )}
        </div>
      </section>

      {/* ── today's goal (D17) — the same rule as the streak ─────────────── */}
      <section aria-label={t("dashboard.dailyGoalTitle")}>
        <DailyGoalRing goal={goal} />
      </section>

      {/* ── mastery per concept (D5) ─────────────────────────────────────── */}
      <section aria-labelledby="concepts-heading" className="flex flex-col gap-lg">
        <h2 id="concepts-heading" className="text-h3 text-ink">
          {t("progress.conceptsTitle")}
        </h2>

        {(chapters ?? []).length === 0 ? (
          <p className="text-body-sm text-body">{t("nextAction.noContent")}</p>
        ) : (
          (chapters ?? []).map((chapter) => {
            const concepts = [...chapter.concepts].sort(
              (a, b) => a.order_index - b.order_index,
            );
            const chapterProgress = chapterMastery(
              concepts.map((c) => c.id),
              masteredIds,
            );

            return (
              <div key={chapter.id} className="flex flex-col gap-md">
                <ProgressBar
                  value={chapterProgress.mastered}
                  max={chapterProgress.total}
                  // A bar is always paired with a number (design rule: "a ring
                  // alone is not readable to everyone").
                  label={t("progress.chapterMastery", {
                    chapter: tContent(chapter, "title", locale),
                    mastered: chapterProgress.mastered,
                    total: chapterProgress.total,
                  })}
                />

                <ul className="flex flex-col gap-sm">
                  {concepts.map((concept) => {
                    const row = masteryByConcept.get(concept.id);
                    const attempts = row?.attempts_count ?? 0;

                    // A concept nobody has attempted shows "Not started", never
                    // 0% (spec §7). A learner who has not begun something is not
                    // failing at it, and 0% reads as failure.
                    const band: MasteryBand | null =
                      attempts === 0
                        ? null
                        : row!.is_mastered
                          ? "mastered"
                          : row!.score >= 0.5
                            ? "developing"
                            : "needs_revision";

                    return (
                      <li
                        key={concept.id}
                        className="flex items-center justify-between gap-md min-h-11"
                      >
                        {/* `min-h-11` on the LINK, not just on the row. The row
                            was already 44px tall and the anchor inside it was
                            32px, so the tappable area was smaller than the thing
                            that looked tappable — measured, not guessed (design
                            rule 6). */}
                        <Link
                          href={`/practice/${concept.id}`}
                          className="flex items-center min-h-11 text-body text-body min-w-0 hover:text-primary-strong underline-offset-4 hover:underline"
                        >
                          {tContent(concept, "name", locale)}
                        </Link>
                        {band ? (
                          <Badge tone={band} className="shrink-0">
                            {t(`mastery.${band}`)}
                          </Badge>
                        ) : (
                          <Badge tone="neutral" className="shrink-0">
                            {t("progress.notStarted")}
                          </Badge>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })
        )}
      </section>

      {/* ── badges (D7b) — earned and unearned ───────────────────────────── */}
      <section aria-labelledby="badges-heading" className="flex flex-col gap-lg">
        <div className="flex items-baseline justify-between gap-md">
          <h2 id="badges-heading" className="text-h3 text-ink">
            {t("progress.milestonesTitle")}
          </h2>
          <span className="text-body-sm text-muted">
            {t("progress.badgeCount", { earned: badges, total: grid.length })}
          </span>
        </div>

        {badges === 0 && <p className="text-body-sm text-body">{t("progress.empty")}</p>}

        <MilestoneGrid milestones={grid} />
      </section>
    </main>
  );
}
