import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/cn";

/**
 * In-lesson progress (D17) — "Duolingo's most under-copied idea: a visible finish
 * line is why people finish."
 *
 * Dots plus the words, at the top, from the moment the lesson opens. The position
 * is real — it is where this lesson sits in the chapter — not an animation that
 * creeps along while you read. A fake progress bar is worse than none: it teaches
 * the learner that the app's signals mean nothing.
 */
export async function LessonProgress({
  step,
  total,
  completedSteps,
}: {
  /** 1-based position of this lesson in the chapter. */
  step: number;
  total: number;
  /** Which lessons the learner has already finished, for the filled dots. */
  completedSteps: number[];
}) {
  const t = await getTranslations("lesson");
  const done = new Set(completedSteps);

  return (
    <div className="flex flex-col gap-sm">
      <ol className="flex items-center gap-xs" aria-hidden>
        {Array.from({ length: total }, (_, index) => {
          const position = index + 1;
          return (
            <li
              key={position}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors duration-150 ease-out",
                position === step
                  ? "bg-primary"
                  : done.has(position)
                    ? "bg-primary-soft"
                    : "bg-surface",
              )}
            />
          );
        })}
      </ol>
      {/* The number is not decoration. A bar alone is not readable to everyone
          (saathi-design § Progress), and it is the only part a screen reader gets. */}
      <p className="text-caption text-muted">{t("stepOf", { step, total })}</p>
    </div>
  );
}
