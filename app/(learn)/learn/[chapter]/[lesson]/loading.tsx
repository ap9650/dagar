import { getTranslations } from "next-intl/server";
import { Skeleton, ScreenSkeleton, HeaderSkeleton } from "@/components/ui/Skeleton";

/** A lesson, mid-load: header, step bar, a block of prose, a diagram. */
export default async function LessonLoading() {
  const t = await getTranslations("common");
  return (
    <ScreenSkeleton label={t("loading")}>
      <HeaderSkeleton />
      <div className="flex flex-col gap-sm">
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="flex flex-col gap-md">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-4/5" />
      </div>
      {/* Most steps carry a diagram, and it is the tallest thing on the screen.
          Leaving it out would make the page lurch when the real step arrives. */}
      <Skeleton className="h-44 w-full rounded-(--radius-card)" />
      <Skeleton className="h-12 w-full" />
    </ScreenSkeleton>
  );
}
