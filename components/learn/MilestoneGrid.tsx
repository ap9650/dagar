import { Award, Lock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/cn";
import type { MilestoneState } from "@/lib/learning/milestones";

/**
 * The badge grid (D7b) — earned **and** unearned, always both.
 *
 * A learner on day one opens Progress and sees seven greyed badges with their
 * names readable. That is a roadmap. The alternative — showing only what they
 * have earned — greets them with an empty screen on the one page whose job is to
 * tell them they are getting somewhere.
 *
 * Locked and earned differ by icon, by copy and by weight, not only by colour
 * (design rule 10), and a locked badge is muted rather than crossed out. There
 * is no lock you can never open here; every one of these is reachable.
 */
export async function MilestoneGrid({ milestones }: { milestones: MilestoneState[] }) {
  const t = await getTranslations();

  return (
    <ul className="grid grid-cols-2 gap-md">
      {milestones.map((milestone) => (
        <li
          key={milestone.code}
          className={cn(
            "flex flex-col gap-sm rounded-(--radius-card) border px-lg py-md min-h-24",
            milestone.earned
              ? "border-celebrate bg-celebrate-bg"
              : "border-border bg-background",
          )}
        >
          {milestone.earned ? (
            <Award
              size={20}
              strokeWidth={1.75}
              aria-hidden
              className="text-celebrate shrink-0"
            />
          ) : (
            <Lock size={20} strokeWidth={1.75} aria-hidden className="text-muted shrink-0" />
          )}

          <span
            className={cn(
              "text-body-sm",
              milestone.earned ? "text-ink font-medium" : "text-muted",
            )}
          >
            {t(`milestone.${milestone.code}` as never)}
          </span>

          {/* The state in words, so it is never carried by the grey alone. */}
          {!milestone.earned && (
            <span className="text-caption text-muted">{t("progress.milestoneLocked")}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
