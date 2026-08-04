import { describe, expect, it } from "vitest";
import { loadMetrics } from "@/lib/analytics/dashboard";

/**
 * The aggregation layer against the real database.
 *
 * `tests/unit/metrics.test.ts` proves the arithmetic on synthetic rows. This
 * proves the part synthetic rows cannot: that the queries actually return what
 * the folds expect, that the shapes line up, and — most importantly — that no
 * learner identifier survives the journey out of this module.
 *
 * It asserts INVARIANTS, never specific counts. Real data changes every time
 * somebody uses the app, and a test that hard-codes "41 learners" is a test
 * that fails on Thursday for being right.
 */

const hasEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const d = hasEnv ? describe : describe.skip;

d("loadMetrics against the real project", () => {
  it("reads every window without throwing", async () => {
    for (const window of ["all", "week", "today"] as const) {
      const metrics = await loadMetrics(window);
      expect(metrics.window).toBe(window);
      expect(metrics.truncated).toBe(false);
    }
  }, 30_000);

  it("NEVER returns a learner identifier", async () => {
    // ── THE PRIVACY GUARANTEE, AS A TEST ──────────────────────────────────
    // /admin/metrics claims it cannot see an individual learner (ANALYTICS.md
    // §9). That claim is only as good as this assertion: the aggregation runs
    // with the service role and touches every learner's rows, so an id added
    // to a return value later would leak silently and look like a feature.
    const metrics = await loadMetrics("all");
    const serialised = JSON.stringify(metrics);

    // Any UUID at all. Chapter and lesson ids are curriculum, not learners —
    // they are allowed, and are excluded by name below.
    const uuids = serialised.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi);
    const curriculum = new Set([
      ...metrics.chapters.map((chapter) => chapter.chapterId.toLowerCase()),
      ...metrics.chapters.flatMap((chapter) =>
        chapter.lessons.map((lesson) => lesson.lessonId.toLowerCase()),
      ),
    ]);

    const unexplained = (uuids ?? []).filter((id) => !curriculum.has(id.toLowerCase()));
    expect(unexplained).toEqual([]);

    // And no email address, from any table this touches.
    expect(serialised).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
  }, 30_000);

  it("keeps the funnel monotonic within each unit", async () => {
    const stages = (await loadMetrics("all")).funnel;
    const visits = stages.filter((stage) => stage.unit === "visits");
    const people = stages.filter((stage) => stage.unit === "people");

    // Nobody finishes a chapter without picking a class. A rise here means a
    // counting rule is wrong, not that learners time-travelled.
    for (const group of [visits, people]) {
      for (let i = 1; i < group.length; i++) {
        expect(group[i].count).toBeLessThanOrEqual(group[i - 1].count);
      }
    }
  }, 30_000);

  it("never reports a share above 100%", async () => {
    const metrics = await loadMetrics("all");
    const shares = [
      metrics.headline.activatedShare,
      metrics.headline.returningShare,
      metrics.headline.mentorShare,
      metrics.mentor.rate,
      metrics.feedback.rate,
      ...metrics.funnel.map((stage) => stage.ofPrevious),
      ...metrics.targets.map((target) => target.value),
    ];

    for (const value of shares) {
      if (value === null) continue;
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  }, 30_000);

  it("keeps chapter tallies internally consistent", async () => {
    for (const chapter of (await loadMetrics("all")).chapters) {
      const summed = chapter.lessons.reduce((total, lesson) => total + lesson.completed, 0);
      expect(chapter.lessonsCompleted).toBe(summed);

      // Nobody completes a lesson in a chapter they never reached.
      for (const lesson of chapter.lessons) {
        expect(lesson.completed).toBeLessThanOrEqual(chapter.reached);
      }
    }
  }, 30_000);

  it("returns a full 14-day series with no gaps", async () => {
    const daily = (await loadMetrics("all")).daily;
    expect(daily).toHaveLength(14);
    for (let i = 1; i < daily.length; i++) {
      const previous = new Date(`${daily[i - 1].date}T00:00:00+05:30`).getTime();
      const current = new Date(`${daily[i].date}T00:00:00+05:30`).getTime();
      expect(current - previous).toBe(86_400_000);
    }
  }, 30_000);
});
