import { getTranslations } from "next-intl/server";
import { Skeleton, ScreenSkeleton, HeaderSkeleton } from "@/components/ui/Skeleton";

/** Progress, mid-load: streak, then a mastery row per concept. */
export default async function ProgressLoading() {
  const t = await getTranslations("common");
  return (
    <ScreenSkeleton label={t("loading")}>
      <HeaderSkeleton />
      <Skeleton className="h-24 w-full rounded-(--radius-card)" />
      <div className="flex flex-col gap-md">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-(--radius-card)" />
        ))}
      </div>
    </ScreenSkeleton>
  );
}
