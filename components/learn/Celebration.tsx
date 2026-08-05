"use client";

import { useEffect, useState } from "react";
import { Award, Flame, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { haptic } from "@/lib/haptics";
import { nextRung, rungFromCode } from "@/lib/learning/streakLadder";
import type { Celebration as Moment } from "@/lib/learning/celebration";

/**
 * The one celebration surface (D7b, D17) — **the only place motion may be playful.**
 *
 * Was `MilestoneToast`, which handled the rare half of this well and the common
 * half not at all: a milestone is earned seven times in a learner's whole life
 * here, so most finished lessons ended with a line of small grey text. It now
 * carries both moments `celebrationFor` can produce, which keeps the ranking in
 * one tested place instead of spread across three call sites deciding for
 * themselves what deserves a toast.
 *
 * A toast rather than a full screen, deliberately. Duolingo can afford to stop a
 * voluntary adult hobbyist and make them tap through a victory page; a learner
 * being told to finish their maths cannot be taxed a tap for good news. This sits
 * above the next action and never blocks it.
 *
 * Amber on cream, never red. Capped at 400ms and wrapped in
 * `prefers-reduced-motion`, where it becomes a static badge rather than a removed
 * feature — losing the celebration entirely would take the reward away from
 * exactly the learners the PRD vision names.
 */
/**
 * `useTranslations()` with no namespace — the root translator, which is what lets
 * one component reach both `milestone.*` and `streak.*`.
 *
 * Spelled out because the bare `ReturnType<typeof useTranslations>` resolves to
 * next-intl's *namespaced* default, and every root key then fails to typecheck.
 */
type RootTranslator = ReturnType<typeof useTranslations<never>>;

export function Celebration({
  moment,
  onDismiss,
}: {
  moment: Moment | null;
  onDismiss: () => void;
}) {
  const t = useTranslations();
  const [visible, setVisible] = useState(true);

  const isMilestone = moment?.kind === "milestone";

  // A milestone buzzes; the day does not.
  //
  // Not an oversight. The action that produced this moment ALREADY buzzed — the
  // complete button fires `complete` on tap, a right answer fires `correct` — and
  // a second pattern 300ms behind the first reads as a glitch, not a flourish.
  // The rare thing gets the flourish; the daily thing gets the screen.
  useEffect(() => {
    if (isMilestone) haptic("milestone");
  }, [isMilestone]);

  useEffect(() => {
    if (!moment) return;
    // 4s. Long enough to read in a second language, short enough that it never
    // stands between the learner and the next thing.
    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss();
    }, 4000);
    return () => clearTimeout(timer);
  }, [moment, onDismiss]);

  if (!moment || !visible) return null;

  const { title, body } = copyFor(moment, t);

  return (
    <div
      // `status`, not `alert`: this is good news, and alert interrupts a screen
      // reader mid-sentence.
      role="status"
      aria-live="polite"
      className="fixed inset-x-lg bottom-xl z-50 mx-auto max-w-(--container-content)
                 flex items-center gap-md
                 bg-celebrate-bg border border-celebrate rounded-(--radius-card)
                 px-lg py-md shadow-(--shadow-raised)
                 celebrate-enter"
    >
      {isMilestone ? (
        <Award
          size={20}
          strokeWidth={1.75}
          aria-hidden
          className="text-celebrate shrink-0 celebrate-pop"
        />
      ) : (
        // The live-streak orange, matching the flame the learner already knows
        // from the header — the same streak, so the same colour.
        <Flame
          size={20}
          strokeWidth={1.75}
          aria-hidden
          className="text-streak-active shrink-0 celebrate-pop"
        />
      )}

      <div className="flex flex-col min-w-0">
        <span className="text-label text-celebrate">{title}</span>
        <span className="text-body-sm text-ink">{body}</span>
      </div>

      <button
        type="button"
        onClick={() => {
          setVisible(false);
          onDismiss();
        }}
        aria-label={t("common.close")}
        className="ms-auto inline-flex items-center justify-center size-11 shrink-0
                   rounded-(--radius-control) text-celebrate"
      >
        <X size={20} strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  );
}

/**
 * Two lines, always: a label and one sentence.
 *
 * The streak line reuses `streak.extended`, which was written in both languages
 * for exactly this moment and then never wired to anything. Adding a second key
 * saying the same thing would have left two translations to keep in agreement.
 *
 * The first day is worded separately even though the ICU plural handles it
 * grammatically. "1 day in a row" is not a sentence anyone says, and a learner on
 * day one has no streak to be proud of yet — what they have is a reason to come
 * back tomorrow, so that is what it tells them.
 */
function copyFor(moment: Moment, t: RootTranslator) {
  if (moment.kind === "milestone") {
    /**
     * ── A STREAK RUNG IS CELEBRATED AND THEN IMMEDIATELY RE-AIMED ───────────
     * "3 days in a row." is a full stop. "3 days in a row. Ready for 7?" is a
     * handoff — the celebration and the invitation in one breath, which is the
     * entire point of the ladder. A milestone that only says well done is the
     * dead end this replaced.
     *
     * The rung takes the headline instead of the generic "New badge!", because
     * the number IS the news. Ordinary badges keep the generic title, where the
     * badge name is the news instead.
     *
     * At the top of the ladder there is no next rung, and the copy says so
     * plainly rather than inventing a target — a learner who has kept this going
     * for a year is owed a true sentence, not another ask.
     */
    const rung = moment.codes.map(rungFromCode).find((r) => r !== null) ?? null;

    if (rung !== null) {
      const next = nextRung(rung);
      return {
        title: t(`milestone.streak_${rung}` as never),
        body: next !== null ? t("streak.nextRung", { days: next }) : t("streak.ladderDone"),
      };
    }

    return {
      title: t("milestone.earned"),
      body: moment.codes.map((code) => t(`milestone.${code}` as never)).join(" · "),
    };
  }

  return moment.streak > 1
    ? {
        title: t("streak.extended", { days: moment.streak }),
        body: t("celebration.goalDone"),
      }
    : {
        title: t("celebration.firstDayTitle"),
        body: t("celebration.firstDayBody"),
      };
}
