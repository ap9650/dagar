"use client";

import { useState } from "react";
import { LifeBuoy, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";

/**
 * "Want a person to explain this?" — the D6 escalation offer.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * AN INLINE CARD. NEVER A MODAL, NEVER BLOCKING, ALWAYS DISMISSIBLE.
 *
 * The trigger for this is three wrong answers in a row. A learner in that moment
 * is the last person who should have a dialog thrown across their screen — the
 * app would be interrupting them to point out that they are failing.
 *
 * The copy is an OFFER, not a diagnosis: "want a person to explain this?", never
 * "you are struggling". A learner reading over a parent's shoulder on a shared
 * phone sees this too.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Dismissal is local to the session and silent. Declining help is a normal thing
 * to do and is not recorded as an event.
 */
export function MentorCta({
  conceptId,
  trigger,
}: {
  conceptId: string;
  trigger: string;
}) {
  const t = useTranslations();
  const [state, setState] = useState<"offered" | "sending" | "sent" | "dismissed">(
    "offered",
  );

  if (state === "dismissed") return null;

  if (state === "sent") {
    return (
      <div
        role="status"
        className="rounded-(--radius-card) border border-primary bg-primary-wash px-lg py-md"
      >
        <p className="text-body-sm text-primary-strong">{t("mentor.requested")}</p>
      </div>
    );
  }

  async function send() {
    setState("sending");
    try {
      const response = await fetch("/api/mentor-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concept_id: conceptId, trigger }),
      });
      // Either way the learner is told it went through. A failed request here is
      // recoverable on the next trigger, and "we could not pass that on" is a
      // second disappointment stacked on the first.
      if (!response.ok) console.error("[mentor] request failed");
    } catch {
      console.error("[mentor] request threw");
    }
    setState("sent");
  }

  return (
    <div className="flex flex-col gap-md rounded-(--radius-card) border border-primary bg-primary-wash px-lg py-md">
      <div className="flex items-start gap-md">
        <LifeBuoy
          size={20}
          strokeWidth={1.75}
          aria-hidden
          className="text-primary shrink-0 mt-0.5"
        />
        <div className="flex flex-col gap-xs min-w-0">
          <p className="text-label font-medium text-primary-strong">
            {t("mentor.ctaTitle")}
          </p>
          <p className="text-body-sm text-body">{t("mentor.ctaBody")}</p>
        </div>
        <button
          type="button"
          onClick={() => setState("dismissed")}
          aria-label={t("mentor.dismiss")}
          className="ms-auto inline-flex items-center justify-center size-11 shrink-0 rounded-(--radius-control) text-body"
        >
          <X size={20} strokeWidth={1.75} aria-hidden />
        </button>
      </div>

      <Button variant="secondary" loading={state === "sending"} onClick={send}>
        {t("mentor.ctaAction")}
      </Button>
    </div>
  );
}
