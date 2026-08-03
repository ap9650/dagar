import { getTranslations } from "next-intl/server";
import { Skeleton, ScreenSkeleton } from "@/components/ui/Skeleton";

/**
 * The `/learn` segment, mid-load — the dashboard **and everything under it**.
 *
 * ── WHY THIS ONE IS DELIBERATELY GENERIC ────────────────────────────────────
 * A `loading.tsx` wraps its segment's children, not only its own page. Lessons
 * live at `/learn/[chapter]/[lesson]`, so this boundary is what suspends when a
 * learner taps a lesson from the dashboard — the lesson's own skeleton never
 * gets a chance, because this is the outer boundary and it suspends first.
 *
 * The first version of this file was dashboard-shaped: a goal ring, a
 * recommendation card, a journey path. Tapping a lesson therefore flashed a
 * picture of the dashboard the learner had just left. That is worse than a
 * plain placeholder — it says "you are going back", and then you arrive
 * somewhere else. Caught by screenshotting 200ms after a tap.
 *
 * So this is the shape both screens honestly share: a title, a band of content,
 * an action. The specific skeletons still earn their place on the routes
 * reached from elsewhere — practice, progress, settings, the quiz — which are
 * separate top-level segments with boundaries of their own.
 * ────────────────────────────────────────────────────────────────────────────
 */
export default async function LearnSegmentLoading() {
  const t = await getTranslations("common");
  return (
    <ScreenSkeleton label={t("loading")}>
      <div className="flex items-center justify-between gap-md">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-8 w-28 rounded-full" />
      </div>

      <div className="flex flex-col gap-md">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-4/5" />
      </div>

      <Skeleton className="h-48 w-full rounded-(--radius-card)" />

      <Skeleton className="h-12 w-full" />
    </ScreenSkeleton>
  );
}
