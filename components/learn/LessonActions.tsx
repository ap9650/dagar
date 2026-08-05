"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Celebration } from "./Celebration";
import { FeedbackPrompt } from "./FeedbackPrompt";
import { ReminderPrompt } from "./ReminderPrompt";
import type { useLessonCompletion } from "./useLessonCompletion";

/**
 * The foot of a lesson: finish it, then go somewhere.
 *
 * Shared by both lesson shapes so a learner meets the same ending whichever one
 * they are reading, and so the finishing action exists exactly once on screen.
 *
 * `primary` is optional because a stepped lesson supplies its own finishing
 * button — the last step's — and rendering a second one here is the bug this
 * component was split out to remove.
 */
export function LessonActions({
  state,
  nextHref,
  nextIsPractice,
  primary = true,
}: {
  state: ReturnType<typeof useLessonCompletion>;
  /** Where "what next" goes — practice, or the next lesson. Never a dead end. */
  nextHref: string;
  /**
   * Which of the two it is, so the LABEL CAN TELL THE TRUTH.
   *
   * It could not before: the button said "Practise this" and opened the next
   * lesson, every time except at the end of a chapter. Reported from a phone.
   */
  nextIsPractice: boolean;
  /** False when the caller already renders the finishing button itself. */
  primary?: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const { complete, justCompleted, busy, failed, moment, markComplete, dismissMoment } =
    state;

  // Nothing to show yet: a stepped lesson mid-way has its own Continue, and this
  // would otherwise draw an empty sticky bar across the bottom of every step.
  //
  // `justCompleted`, not `complete`, so that REOPENING a finished stepped lesson
  // reads exactly like opening it the first time — steps, then this. Keyed off
  // the recorded fact instead, a learner revising step 1 would have "Practise
  // this" pinned across the bottom competing with the step's own Continue: two
  // primary buttons on a 360px screen, against design rule 11.
  if (!primary && !justCompleted && !failed) return null;

  return (
    /*
      STICKY, which the design system asked for and this did not do:
      "Sticky primary action at the bottom of the content area on lesson and
      practice screens."

      Reported from a real phone: after finishing a lesson, "Practise this" sat
      at the very bottom of a long scroll with nothing indicating it was there.
      That matters most at exactly the moment it failed — the learner has just
      finished something and is deciding whether to carry on. A next step they
      have to go hunting for is a next step many will not take.
    */
    <div
      className="sticky bottom-0 -mx-lg px-lg pt-md pb-lg flex flex-col gap-md
                 bg-background border-t border-border"
    >
      {!complete ? (
        primary && (
          <Button onClick={markComplete} loading={busy}>
            {t("lesson.complete")}
          </Button>
        )
      ) : (
        <>
          <p className="text-body-sm text-correct">{t("lesson.completed")}</p>
          <Button onClick={() => router.push(nextHref)}>
            {nextIsPractice ? t("lesson.practiceNext") : t("lesson.nextLesson")}
          </Button>
        </>
      )}

      {failed && (
        // Amber, not red: nothing the learner did went wrong, and their progress
        // is not lost — it just has not reached us yet.
        <div className="flex flex-col gap-sm">
          <p role="status" className="text-body-sm text-notquite">
            {t("errors.offline")}
          </p>
          <Button variant="secondary" onClick={markComplete} loading={busy}>
            {t("common.tryAgain")}
          </Button>
        </div>
      )}

      <Celebration moment={moment} onDismiss={dismissMoment} />

      {/* Both only after finishing SOMETHING JUST NOW, and BELOW the next action
          — so anyone carrying straight on to practice never has to read either.
          On `complete` they would also greet a learner who only reopened an old
          lesson to reread it, which is asking for a favour in return for nothing.

          The reminder offer comes FIRST because it is the one with a cost to
          getting wrong: a browser remembers a refused notification permission
          for good, and Dagar cannot ask again from inside the app. Feedback can
          be asked for again any time. */}
      {justCompleted && <ReminderPrompt />}
      {justCompleted && <FeedbackPrompt />}
    </div>
  );
}
