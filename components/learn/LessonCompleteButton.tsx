"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { MilestoneToast } from "./MilestoneToast";

/**
 * Marks the lesson complete, and reports the lesson as started when it opens.
 *
 * **The network is assumed to be bad.** Losing a completion to a dropped 4G packet
 * is a real occurrence for this audience, not a hypothetical (spec §7) — so a
 * failed request leaves the lesson looking complete on screen, offers a retry, and
 * never blocks the learner from moving on. The alternative, bouncing them back to
 * "not done" for something that was not their fault, is how an app teaches someone
 * that their effort does not count.
 */
export function LessonCompleteButton({
  lessonId,
  nextHref,
  alreadyComplete,
}: {
  lessonId: string;
  /** Where "what next" goes — practice, or the next lesson. Never a dead end. */
  nextHref: string;
  alreadyComplete: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();

  const [complete, setComplete] = useState(alreadyComplete);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [milestones, setMilestones] = useState<string[]>([]);
  const started = useRef(false);

  // Opening the lesson IS starting it. Fire-and-forget: a failed start must never
  // stop someone reading, and the route handler is idempotent so a retry on the
  // next visit costs nothing.
  useEffect(() => {
    if (started.current || alreadyComplete) return;
    started.current = true;
    fetch(`/api/lessons/${lessonId}/start`, { method: "POST" }).catch(() => {});
  }, [lessonId, alreadyComplete]);

  async function markComplete() {
    setBusy(true);
    setFailed(false);

    // Optimistic on purpose — see the note above.
    setComplete(true);

    try {
      const response = await fetch(`/api/lessons/${lessonId}/complete`, {
        method: "POST",
      });
      if (!response.ok) {
        setFailed(true);
        return;
      }

      const body = await response.json();
      if (body.milestonesEarned?.length) setMilestones(body.milestonesEarned);

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

  return (
    <div className="flex flex-col gap-md">
      {!complete ? (
        <Button onClick={markComplete} loading={busy}>
          {t("lesson.complete")}
        </Button>
      ) : (
        <>
          <p className="text-body-sm text-correct">{t("lesson.completed")}</p>
          {/* The next action is always on screen after completion. */}
          <Button onClick={() => router.push(nextHref)}>
            {t("lesson.practiceNext")}
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

      {milestones.length > 0 && (
        <MilestoneToast codes={milestones} onDismiss={() => setMilestones([])} />
      )}
    </div>
  );
}
