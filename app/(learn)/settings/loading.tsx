import { getTranslations } from "next-intl/server";
import { Skeleton, ScreenSkeleton, HeaderSkeleton } from "@/components/ui/Skeleton";

/** Settings, mid-load: a stack of labelled cards. */
export default async function SettingsLoading() {
  const t = await getTranslations("common");
  return (
    <ScreenSkeleton label={t("loading")}>
      <HeaderSkeleton />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex flex-col gap-sm">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-14 w-full rounded-(--radius-card)" />
        </div>
      ))}
    </ScreenSkeleton>
  );
}
