import { getTranslations } from "next-intl/server";
import { Skeleton, ScreenSkeleton, HeaderSkeleton } from "@/components/ui/Skeleton";

/** The quiz, mid-load. Same shape as practice — one question at a time. */
export default async function QuizLoading() {
  const t = await getTranslations("common");
  return (
    <ScreenSkeleton label={t("loading")}>
      <HeaderSkeleton />
      <div className="flex flex-col gap-sm">
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-4 w-28" />
      </div>
      <div className="flex flex-col gap-md">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-3/5" />
      </div>
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-12 w-full" />
    </ScreenSkeleton>
  );
}
