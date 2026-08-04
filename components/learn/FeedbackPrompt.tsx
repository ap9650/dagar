"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { MessageSquare, X } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * "Got a minute?" — the one-time nudge toward `/feedback`.
 *
 * ── why this exists at all ──────────────────────────────────────────────────
 * Without it, the only route to the feedback form is a link in Settings, and
 * almost nobody goes looking in Settings to volunteer an opinion. For a
 * submission that needs real user feedback attached, discoverability IS the
 * feature.
 *
 * ── why it appears HERE ─────────────────────────────────────────────────────
 * After finishing a lesson, next to the completion state. That is the moment a
 * person actually has an opinion — they have just done the thing. Ask on arrival
 * and you get "looks nice"; ask after ten minutes of real work and you get the
 * specific sentence worth quoting.
 *
 * ── and why it is so quiet ──────────────────────────────────────────────────
 * An inline card, never a modal, always dismissible — the same rule as the
 * mentor offer. A learner who has just finished a lesson has earned a
 * celebration, not a request. So it sits BELOW the next action: whoever wants to
 * carry straight on is never interrupted, and only somebody pausing sees it.
 *
 * Once dismissed or followed, it never returns. Remembered in localStorage
 * rather than the database — this is a UI preference, not learner data, and
 * asking twice is the fastest way to be ignored.
 */
// Keeps the `saathi` prefix after the rename to Dagar, on purpose: this key
// already exists in real browsers, and renaming it would silently reset the
// setting for everyone who has one. A stale identifier is cheaper than that.
const SEEN_KEY = "saathi.feedbackPrompt.seen";

/** No external changes to listen for — the value only moves when we set it. */
const subscribe = () => () => {};

/**
 * Read localStorage without a hydration mismatch.
 *
 * `useSyncExternalStore` rather than an effect that calls setState: the server
 * snapshot says "already seen", so the server renders nothing and the client
 * decides on its own. An effect would work too, but it sets state during render
 * commit — which `react-hooks/set-state-in-effect` flags, correctly.
 *
 * Storage can throw (private browsing with it disabled). Treated as "seen", so
 * the failure mode is never prompting rather than prompting on every lesson.
 */
function hasSeenPrompt(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) !== null;
  } catch {
    return true;
  }
}

export function FeedbackPrompt() {
  const t = useTranslations("productFeedback");

  const seen = useSyncExternalStore(subscribe, hasSeenPrompt, () => true);
  // Set from a click handler, which is ordinary state, not an effect.
  const [dismissed, setDismissed] = useState(false);

  /**
   * The denominator for feedback conversion.
   *
   * The submission says "feedback from N real users". N alone is a number
   * without a shape — out of twelve asks it is a strong signal, out of two
   * hundred it is a different product. `feedback_submitted` fires in the API
   * route; this is the other half.
   *
   * Fires only when the card actually renders, which localStorage already
   * limits to once per browser — so this counts PEOPLE ASKED, not impressions.
   * Ref-guarded for the same reason as `MentorCta`: Strict Mode runs effects
   * twice in development and a denominator must not be double there.
   */
  const counted = useRef(false);
  useEffect(() => {
    if (seen || dismissed || counted.current) return;
    counted.current = true;
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "feedback_shown" }),
    }).catch(() => {});
  }, [seen, dismissed]);

  function close() {
    setDismissed(true);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* nothing to remember it with — fine */
    }
  }

  if (seen || dismissed) return null;

  return (
    <div className="flex items-start gap-md rounded-(--radius-card) border border-border bg-surface px-lg py-md">
      <MessageSquare size={20} strokeWidth={1.75} aria-hidden className="text-primary shrink-0 mt-0.5" />

      <div className="flex flex-col gap-sm min-w-0">
        <p className="text-label font-medium text-ink">{t("promptTitle")}</p>
        <p className="text-body-sm text-body">{t("promptBody")}</p>
        <Link
          href="/feedback"
          onClick={close}
          className="self-start min-h-11 inline-flex items-center text-body-sm text-primary-strong underline underline-offset-4"
        >
          {t("promptAction")}
        </Link>
      </div>

      <button
        type="button"
        onClick={close}
        aria-label={t("promptDismiss")}
        className="ms-auto inline-flex items-center justify-center size-11 shrink-0 rounded-(--radius-control) text-body"
      >
        <X size={20} strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  );
}
