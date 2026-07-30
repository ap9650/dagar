"use client";

import { useEffect, useState } from "react";
import { Award, X } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Milestone toast (D7b) — celebratory, and the ONLY place motion may be playful.
 *
 * Capped at 400ms and wrapped in `prefers-reduced-motion`: under reduced motion it
 * becomes a static badge rather than a removed feature. Some neurodiverse learners
 * — named in the PRD vision — are affected by motion, and losing the celebration
 * entirely would take the reward away from exactly the learners it is for.
 *
 * Amber on cream, never red, and dismissible.
 */
export function MilestoneToast({
  codes,
  onDismiss,
}: {
  codes: string[];
  onDismiss: () => void;
}) {
  const t = useTranslations();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // 4s auto-dismiss. Long enough to read in a second language, short enough
    // that it never blocks the next action.
    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss();
    }, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  if (!visible || codes.length === 0) return null;

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
      <Award size={20} strokeWidth={1.75} aria-hidden className="text-celebrate shrink-0" />
      <div className="flex flex-col min-w-0">
        <span className="text-label text-celebrate">{t("milestone.earned")}</span>
        <span className="text-body-sm text-ink">
          {codes.map((code) => t(`milestone.${code}` as never)).join(" · ")}
        </span>
      </div>
      <button
        type="button"
        onClick={() => {
          setVisible(false);
          onDismiss();
        }}
        aria-label={t("common.close")}
        className="ms-auto inline-flex items-center justify-center size-11 shrink-0 rounded-(--radius-control) text-celebrate"
      >
        <X size={20} strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  );
}
