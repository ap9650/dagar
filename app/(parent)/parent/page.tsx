import { redirect } from "next/navigation";
import { Award, Flame } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { t as tContent } from "@/lib/i18n/content";
import { istDate, istDayStart } from "@/lib/learning/dates";
import { fromRow, streakStatus } from "@/lib/learning/streaks";
import { Badge } from "@/components/ui/Badge";
import { LanguagePicker } from "@/components/ui/LanguagePicker";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { cn } from "@/lib/cn";
import type { Locale } from "@/i18n/config";

/**
 * `/parent` — the read-only view of one child's week (D2, D4).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * READ-ONLY, AND THERE IS NO WRITE PATH TO REMOVE.
 *
 * Not "we chose not to add editing" — there is no parent write policy on any
 * table in the database (D2), so a write from this session would be refused by
 * Postgres even if someone added a button. The screen says so out loud too:
 * a parent who thinks they might break their child's progress by tapping
 * something will not explore, and a parent who does not explore does not come
 * back.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Every row below is fetched under the PARENT's own session, so the
 * `parent_links`-based RLS policies are what scope it to their child. Nothing
 * here uses the service role, and nothing here takes a student id from a URL —
 * the link is the only way in, which is why there is no `/parent/[studentId]`.
 *
 * Locale is the PARENT's own (D16). It defaulted to the learner's when they
 * claimed the code, and the picker below changes it independently — the adult
 * and the child in one household do not necessarily read the same language.
 */
export default async function ParentPage() {
  const supabase = await createClient();
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .maybeSingle();

  // A learner who reached this URL goes home. Roles are exclusive.
  if (profile?.role === "student") redirect("/learn");
  if (!profile) redirect("/parent/claim");

  const { data: link } = await supabase
    .from("parent_links")
    .select("id, student_id, claimed_at")
    .eq("parent_id", user!.id)
    .eq("status", "active")
    .order("claimed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // A parent account with no live link has nothing to show and one thing to do.
  if (!link) redirect("/parent/claim");

  const today = istDate();
  const weekStart = new Date(istDayStart(today));
  weekStart.setUTCDate(weekStart.getUTCDate() - 7);
  const weekStartIso = weekStart.toISOString();

  const [
    { data: child },
    { count: lessonsThisWeek },
    { count: practiceThisWeek },
    { data: streakRow },
    { data: mastery },
    { data: milestones },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, grade")
      .eq("id", link.student_id)
      .maybeSingle(),
    supabase
      .from("lesson_progress")
      .select("*", { count: "exact", head: true })
      .eq("student_id", link.student_id)
      .eq("status", "completed")
      .gte("completed_at", weekStartIso),
    supabase
      .from("attempts")
      .select("*", { count: "exact", head: true })
      .eq("student_id", link.student_id)
      .gte("created_at", weekStartIso),
    supabase
      .from("streaks")
      .select("current, longest, last_active_date, grace_used_on")
      .eq("student_id", link.student_id)
      .maybeSingle(),
    supabase
      .from("concept_mastery")
      .select("concept_id, score, attempts_count, is_mastered, concepts(name, i18n)")
      .eq("student_id", link.student_id)
      .gt("attempts_count", 0),
    supabase
      .from("milestones")
      .select("code, earned_at")
      .eq("student_id", link.student_id)
      .gte("earned_at", weekStartIso)
      .order("earned_at", { ascending: false }),
  ]);

  const streak = streakStatus(fromRow(streakRow), today);
  const lessons = lessonsThisWeek ?? 0;
  const practice = practiceThisWeek ?? 0;
  const quiet = lessons === 0 && practice === 0;

  // Names the parent can use in a conversation. "Getting there on comparing
  // fractions" is something an adult can act on; a percentage is not.
  const strong = (mastery ?? []).filter((m) => m.is_mastered);
  const working = (mastery ?? []).filter((m) => !m.is_mastered);

  const childName = child?.display_name?.trim();

  return (
    <main className="flex-1 w-full max-w-(--container-content) mx-auto px-lg py-lg flex flex-col gap-xl">
      <header className="flex flex-col gap-sm">
        <h1 className="text-h1 text-ink">
          {childName ? t("parent.title", { name: childName }) : t("parent.titleNoName")}
        </h1>
        {/* Said plainly, and early. A parent who is unsure whether they can break
            something will not tap anything. */}
        <p className="text-body-sm text-muted">{t("parent.readOnly")}</p>
      </header>

      {quiet ? (
        <section className="flex flex-col gap-sm rounded-(--radius-card) border border-border bg-surface px-lg py-lg">
          <h2 className="text-h3 text-ink">{t("parent.empty")}</h2>
          {/* Never a blank screen, and never a reproach. What WILL appear, so a
              parent who opens this on day one knows the app is working. */}
          <p className="text-body-sm text-body">{t("parent.emptyHelp")}</p>
        </section>
      ) : (
        <section
          aria-labelledby="week-heading"
          className="flex flex-col gap-md rounded-(--radius-card) border border-border bg-surface px-lg py-lg"
        >
          <h2 id="week-heading" className="text-h3 text-ink">
            {t("parent.weekTitle")}
          </h2>
          <p className="text-body text-body">{t("parent.lessonsDone", { count: lessons })}</p>
          <p className="text-body text-body">{t("parent.practiceDone", { count: practice })}</p>

          {streak.alive && streak.days > 0 && (
            <p className="flex items-center gap-sm text-body text-body">
              <Flame
                size={20}
                strokeWidth={1.75}
                aria-hidden
                className={cn(streak.graceActive ? "text-celebrate" : "text-streak-active")}
              />
              {t("streak.days", { days: streak.days })}
            </p>
          )}
        </section>
      )}

      {/* Milestones first among the details — D7b calls a milestone "the single
          most worthwhile thing to put in a parent message", and it is the part
          that gets celebrated at home rather than filed. */}
      {(milestones ?? []).length > 0 && (
        <section aria-labelledby="milestones-heading" className="flex flex-col gap-md">
          <h2 id="milestones-heading" className="text-h3 text-ink">
            {t("parent.milestonesTitle")}
          </h2>
          <ul className="flex flex-col gap-sm">
            {(milestones ?? []).map((milestone) => (
              <li
                key={milestone.code}
                className="flex items-center gap-md rounded-(--radius-card) border border-celebrate bg-celebrate-bg px-lg py-md"
              >
                <Award size={20} strokeWidth={1.75} aria-hidden className="text-celebrate shrink-0" />
                <span className="text-body text-ink">
                  {t(`milestone.${milestone.code}` as never)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(mastery ?? []).length > 0 && (
        <section aria-labelledby="concepts-heading" className="flex flex-col gap-md">
          <h2 id="concepts-heading" className="text-h3 text-ink">
            {t("parent.conceptsTitle")}
          </h2>

          <ul className="flex flex-col gap-sm">
            {[...strong, ...working].map((row) => (
              <li
                key={row.concept_id}
                className="flex items-center justify-between gap-md min-h-11"
              >
                <span className="text-body text-body min-w-0">
                  {row.concepts ? tContent(row.concepts, "name", locale) : ""}
                </span>
                <Badge
                  tone={
                    row.is_mastered
                      ? "mastered"
                      : row.score >= 0.5
                        ? "developing"
                        : "needs_revision"
                  }
                  className="shrink-0"
                >
                  {t(
                    `mastery.${
                      row.is_mastered
                        ? "mastered"
                        : row.score >= 0.5
                          ? "developing"
                          : "needs_revision"
                    }`,
                  )}
                </Badge>
              </li>
            ))}
          </ul>

          {/* The one sentence that turns a status screen into something a parent
              can act on tonight — and it never names a weakness as a failing. */}
          {working.length > 0 && (
            <p className="text-body-sm text-body">
              {t("parent.howToHelp", {
                concept: working[0].concepts
                  ? tContent(working[0].concepts, "name", locale)
                  : "",
              })}
            </p>
          )}
        </section>
      )}

      <section className="flex flex-col gap-md">
        <h2 className="text-label text-muted">{t("parent.languageTitle")}</h2>
        {/* The parent's own locale, independent of the child's (D16). */}
        <LanguagePicker current={locale} />
      </section>

      <SignOutButton className="mt-auto" />
    </main>
  );
}
