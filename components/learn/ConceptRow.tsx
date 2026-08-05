import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/Badge";
import type { Level } from "@/lib/learning/levels";

/**
 * One concept, with where it stands — **and a way to act on it.**
 *
 * ── THE BUG THIS EXISTS TO END ──────────────────────────────────────────────
 * The chapter screen listed every concept with its mastery badge and made none
 * of them tappable. So a learner who had finished all five Fractions lessons
 * saw "Fraction Basics · Keep practising" and had nowhere to go: the concept
 * spans lessons 1–2, and practice is offered at a concept BOUNDARY, so the only
 * routes to it were the foot of lesson 2 or the progress screen. Reported from
 * a phone, and the reporter was right to call it weird — the app named a
 * weakness and withheld the fix.
 *
 * The principle, stated so it outlives this component: **wherever Dagar shows a
 * diagnosis it offers the treatment in the same place.** A badge reading "Keep
 * practising" that cannot be tapped is worse than no badge at all — it tells a
 * learner who is already behind that they are behind, and gives them nothing to
 * do about it.
 *
 * ── AND WHY IT IS SHARED ────────────────────────────────────────────────────
 * `/progress` had this row as a link and `/learn/[chapter]` had it as plain
 * text: the same information, rendered twice, with the affordance in only one
 * of them. That is precisely how the gap got in. One component now, used by
 * both, so the two cannot disagree again.
 *
 * Server component — a link needs no client JavaScript.
 */
export async function ConceptRow({
  conceptId,
  name,
  level,
  showNotStarted = false,
}: {
  conceptId: string;
  name: string;
  level: Level;
  /**
   * Say "Not started" out loud, or stay quiet until there is something to say?
   *
   * The one thing the two screens legitimately differ on, and it is content
   * rather than affordance — which is the difference that is safe to have.
   * `/progress` is a progress report, where "not started" is the answer to the
   * question being asked. A chapter screen is somewhere a learner has just
   * arrived: four identical grey badges there say "you have done nothing" four
   * times, to someone who opened the chapter about ten seconds ago. Checked on
   * a 360px screen in both languages before choosing.
   */
  showNotStarted?: boolean;
}) {
  const t = await getTranslations();

  const tone =
    level === "mastered"
      ? "mastered"
      : level === "getting_there"
        ? "developing"
        : level === "practising"
          ? "needs_revision"
          : "neutral";

  const label =
    level === "not_started" ? t("progress.notStarted") : t(`mastery.${tone}` as never);

  return (
    <li>
      <Link
        href={`/practice/${conceptId}`}
        /*
          The WHOLE row is the target, not the name inside it — the design system
          says so for chapter cards ("tapping anywhere on the card opens it, not
          a small Open link") and the reasoning is identical here. `min-h-11`
          keeps it at 44px even when the name is short (rule 6).
        */
        className="flex items-center justify-between gap-md min-h-11 -mx-sm px-sm rounded-(--radius-control)
                   hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary
                   focus-visible:outline-offset-2"
        /*
          The visible text reads "Fraction Basics Keep practising", which is a
          state, not an action. A screen-reader user needs to know what the link
          DOES before deciding to follow it.
        */
        aria-label={t("practice.practiseConcept", { concept: name })}
      >
        <span className="text-body text-body min-w-0">{name}</span>

        <span className="flex items-center gap-sm shrink-0">
          {(level !== "not_started" || showNotStarted) && <Badge tone={tone}>{label}</Badge>}
          {/*
            Touch screens have no hover, so the underline that marked this as a
            link on `/progress` was invisible on the device every learner
            actually uses. The chevron is the affordance that survives — and it
            keeps colour from being the only signal (rule 10).
          */}
          <ChevronRight size={20} strokeWidth={1.75} aria-hidden className="text-muted" />
        </span>
      </Link>
    </li>
  );
}
