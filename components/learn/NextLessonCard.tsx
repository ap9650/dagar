import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { RECOMMENDATION_MARKER } from "@/lib/analytics/track";

/**
 * The single primary CTA. **One obvious next action, not a menu** (D17).
 *
 * It always carries a REASON. "Continue" on its own tells a learner nothing about
 * why this is the thing to do; "Let's strengthen Fractions" tells them the app is
 * paying attention, which is the entire promise of an adaptive product.
 *
 * The reason arrives as a translation key from `lib/learning/adaptivity.ts`, never
 * as a string — a string built in the learning engine would be English on a Hindi
 * learner's screen.
 */
export async function NextLessonCard({
  reason,
  title,
  href,
  conceptName,
}: {
  reason: "startHere" | "continue" | "strengthen" | "revise";
  /** Lesson title, or the concept name for a practice recommendation. */
  title: string;
  href: string;
  conceptName?: string;
}) {
  const t = await getTranslations();

  // Marks the link as "this came from the recommendation". The destination
  // reads it back and emits `recommendation_clicked`, which is the numerator of
  // Recommendation Acceptance (PRD §12). Tagged here rather than at the three
  // destinations because THIS component is the recommendation — if the card
  // stops being the next-action surface, the marker leaves with it.
  const markedHref = `${href}${href.includes("?") ? "&" : "?"}from=${RECOMMENDATION_MARKER}`;

  const reasonText =
    reason === "strengthen"
      ? t("nextAction.strengthen", { concept: conceptName ?? title })
      : t(`nextAction.${reason}`);

  const actionLabel =
    reason === "strengthen"
      ? t("lesson.practiceNext")
      : reason === "revise"
        ? t("quiz.retake")
        : reason === "startHere"
          ? t("dashboard.startHere")
          : t("dashboard.continueLesson");

  return (
    <Card className="flex flex-col gap-md bg-primary-wash border-primary-soft">
      <p className="text-body-sm text-primary-strong">{reasonText}</p>
      <h2 className="text-h3 text-ink">{title}</h2>
      {/*
        prefetch={false} is REQUIRED here, and it is not a performance opinion.

        Next prefetches a `<Link>` as soon as it enters the viewport, and
        prefetching a dynamic route EXECUTES its server component. The
        destination emits `recommendation_clicked` on render — so with prefetch
        on, that event fired for every learner who merely saw this card, without
        touching it. Verified in the dev server log: two GETs of the lesson page
        against a single `POST /api/lessons/[id]/start`, which only a real mount
        can produce.

        Left alone it would have pinned Recommendation Acceptance (PRD §12) near
        100% forever — a metric that looks like triumphant validation of the
        adaptive engine and actually measures nothing. A fake number is worse
        than a missing one, because you act on it.

        The cost is one link losing its pre-warm. The page is dynamic and
        auth-gated, so the prefetch was buying little anyway — the real
        navigation still took 914ms with a completed prefetch sitting in cache.
      */}
      <Link href={markedHref} prefetch={false} className={buttonClasses()}>
        {actionLabel}
        <ArrowRight size={20} strokeWidth={1.75} aria-hidden />
      </Link>
    </Card>
  );
}
