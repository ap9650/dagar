import { Flame } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/cn";

/**
 * The streak flame — **always visible in the header** (dagar-design § Streak).
 *
 * Duolingo is right that constant visibility is what makes a streak matter. What
 * Dagar does differently is the broken state: it reads "Start again today", never
 * a loss message, and the dead flame is **grey, never red**. A learner who is
 * already behind does not need the colour of danger for missing a day.
 *
 * Three states, and grace is a real one (D7): one missed day per rolling 7 does not
 * break the streak, and it shows as a lighter flame rather than a gap — the learner
 * should be able to see that the streak survived.
 */
export async function StreakBadge({
  days,
  graceActive = false,
}: {
  days: number;
  graceActive?: boolean;
}) {
  const t = await getTranslations("streak");
  const alive = days > 0;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-xs min-h-11 px-md rounded-full",
        alive ? "bg-celebrate-bg" : "bg-surface",
      )}
    >
      <Flame
        size={20}
        strokeWidth={1.75}
        aria-hidden
        className={cn(
          "shrink-0",
          !alive && "text-streak-rest",
          alive && graceActive && "text-celebrate",
          alive && !graceActive && "text-streak-active",
        )}
      />
      {/* Colour is never the only signal (design rule 10) — the count and the
          copy carry the state on their own. */}
      <span className={cn("text-label", alive ? "text-celebrate" : "text-muted")}>
        {alive ? t("days", { days }) : t("broken")}
      </span>
    </div>
  );
}
