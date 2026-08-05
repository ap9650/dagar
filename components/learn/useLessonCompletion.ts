"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { haptic } from "@/lib/haptics";
import { celebrationFor, type Celebration as Moment } from "@/lib/learning/celebration";

/**
 * A lesson's lifecycle — opened, and finished — as one piece of state.
 *
 * Extracted so the two lesson shapes share it rather than reimplement it. A
 * prose lesson finishes at a button under the text; a stepped lesson finishes at
 * the last step's button. Both must record the same thing, buzz at the same
 * moment, and fail the same way — and when that logic lived inside one button
 * component, the other shape could only get at it by rendering that button a
 * second time. That is precisely what produced the duplicate screen.
 *
 * **The network is assumed to be bad.** Losing a completion to a dropped 4G
 * packet is a real occurrence for this audience, not a hypothetical (spec §7) —
 * so a failed request leaves the lesson looking complete on screen, offers a
 * retry, and never blocks the learner from moving on. Bouncing them back to "not
 * done" for something that was not their fault is how an app teaches someone
 * that their effort does not count.
 */
export function useLessonCompletion({
  lessonId,
  alreadyComplete,
}: {
  lessonId: string;
  alreadyComplete: boolean;
}) {
  const router = useRouter();

  const [complete, setComplete] = useState(alreadyComplete);
  /**
   * Finished JUST NOW, in this visit — as opposed to `complete`, which is only a
   * recorded fact and is true the instant a finished lesson is reopened.
   *
   * The two were one flag, and everything that belongs to the MOMENT of finishing
   * hung off the fact: the step player stepped aside, the reminder and feedback
   * prompts appeared. So reopening a finished lesson to revise it showed a title,
   * "Lesson complete", and no lesson — reported from a phone, with a screenshot
   * of an all-but-empty screen.
   *
   * A recorded fact says what the footer should read. Only the moment may take
   * the content away.
   */
  const [justCompleted, setJustCompleted] = useState(false);
  /**
   * Did this action just CLOSE TODAY'S GOAL? The server's `dayCounted` — "today
   * became a counted day", not "today is counted" — so it is true on exactly one
   * action per day and false on every one after it.
   *
   * This is the moment the reminder offer is worth making, and the reason it is
   * a separate flag from `justCompleted`: finishing a fourth lesson on a day
   * already counted is good work, but "want a nudge tomorrow?" has nothing to
   * point at. Asked as the goal closes, the offer argues for itself — you did
   * today's work, shall we help you do it again.
   *
   * Never optimistic, unlike `complete`. A permission ask has one chance per
   * browser, so it waits for the server to confirm rather than guessing.
   */
  const [goalClosed, setGoalClosed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [moment, setMoment] = useState<Moment | null>(null);
  const started = useRef(false);

  /*
    Opening the lesson IS starting it, and this is why the hook owns it.

    The effect used to live in the completion BUTTON, which on a stepped lesson
    was not mounted until the learner reached the end — so `lesson_started` fired
    at the moment the lesson finished, and only for the learners who finished.
    Every drop-off partway through a stepped lesson was invisible in the funnel,
    which is the one thing that funnel exists to show.

    Fire-and-forget: a failed start must never stop someone reading, and the
    route handler is idempotent so a retry on the next visit costs nothing.
  */
  useEffect(() => {
    if (started.current || alreadyComplete) return;
    started.current = true;
    fetch(`/api/lessons/${lessonId}/start`, { method: "POST" }).catch(() => {});
  }, [lessonId, alreadyComplete]);

  async function markComplete() {
    setBusy(true);
    setFailed(false);

    // Optimistic on purpose — see the note above. The buzz goes with the
    // optimistic state, not the response: the learner finished the lesson, and
    // whether our server heard about it is not their news.
    setComplete(true);
    setJustCompleted(true);
    haptic("complete");

    try {
      const response = await fetch(`/api/lessons/${lessonId}/complete`, {
        method: "POST",
      });
      if (!response.ok) {
        setFailed(true);
        return;
      }

      const body = await response.json();
      // One moment, ranked server-fact-first — see lib/learning/celebration.ts.
      // Notably it can be null, and on a second lesson the same day it should be.
      setMoment(celebrationFor(body));
      setGoalClosed(body.dayCounted === true);

      // Refresh so the dashboard's journey path, streak and goal ring reflect
      // this on the way back. The server recomputed them; the client just
      // re-reads.
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return {
    complete,
    justCompleted,
    goalClosed,
    busy,
    failed,
    moment,
    markComplete,
    dismissMoment: () => setMoment(null),
  };
}
