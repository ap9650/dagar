import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

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
      <Link href={href} className={buttonClasses()}>
        {actionLabel}
        <ArrowRight size={20} strokeWidth={1.75} aria-hidden />
      </Link>
    </Card>
  );
}
