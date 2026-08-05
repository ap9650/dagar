"use client";

import { useState, useSyncExternalStore } from "react";
import { Bell, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import {
  PUSH_ASKED_KEY,
  permissionState,
  pushSupport,
  subscribeToPush,
} from "@/lib/push-client";

/**
 * "Want a nudge?" — the opt-in for daily reminders (D17b).
 *
 * ── WHEN IT APPEARS, AND WHY THAT IS THE WHOLE DESIGN ───────────────────────
 * **The moment today's goal closes** — the lesson or the fifth practice question
 * that turns today into a counted day (the server's `dayCounted`). Never on
 * arrival, never on first load, and never again later the same day.
 *
 * A permission prompt shown before any value is delivered is how an app gets
 * permission denied *permanently* — a browser remembers a refusal and Dagar
 * cannot ask again from inside the app. There is one chance, so it is spent at
 * the strongest moment there is: the learner has just done today's work, and
 * "shall we help you do it again tomorrow?" is an offer that argues for itself.
 *
 * It used to appear on any completed lesson, which sounds close and is not. A
 * fourth lesson on a day already counted earns the same words pointing at
 * nothing — and spends the one refusal to say it. Reported from a phone, where
 * it arrived before the learner had finished anything at all.
 *
 * Callers pass the moment in, so the two places a goal can close — the lesson
 * footer and the end of a practice set — both offer it, and nothing else can.
 *
 * ── AND WHY THE CARD IS NOT THE PROMPT ──────────────────────────────────────
 * The browser's permission dialog only opens on a real tap. This card is a
 * quiet inline offer; the dialog appears only if the learner says yes. That
 * ordering means a learner who ignores this has not spent their one refusal.
 *
 * Declining is remembered in localStorage — a UI preference, not learner data —
 * so it never asks twice.
 */
const subscribe = () => () => {};

function hasAsked(): boolean {
  try {
    return localStorage.getItem(PUSH_ASKED_KEY) !== null;
  } catch {
    // Storage disabled (private browsing). Treated as asked, so the failure
    // mode is never prompting rather than prompting after every lesson.
    return true;
  }
}

export function ReminderPrompt() {
  // Inlined at build time, and safe to be: a VAPID public key is meant to be
  // public — it is what a browser uses to verify a push came from us.
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  const t = useTranslations("reminders");
  const asked = useSyncExternalStore(subscribe, hasAsked, () => true);
  const [state, setState] = useState<"offered" | "working" | "enabled" | "blocked" | "dismissed">(
    "offered",
  );

  function remember() {
    try {
      localStorage.setItem(PUSH_ASKED_KEY, "1");
    } catch {
      /* nothing to remember it with — fine */
    }
  }

  const support = pushSupport();

  // Already granted or already refused: there is nothing useful to offer. A
  // browser that has denied cannot be asked again from here, and a card saying
  // so on every lesson would be nagging about something the learner cannot fix
  // where they are standing.
  if (asked || state === "dismissed" || permissionState() === "granted") return null;
  if (permissionState() === "denied") return null;

  // iPhone before the app is installed: web push is impossible, so the honest
  // move is one sentence rather than a button that silently does nothing.
  if (!support.supported && support.reason === "unsupported") return null;

  async function enable() {
    setState("working");
    const outcome = await subscribeToPush(publicKey);
    remember();
    setState(outcome === "subscribed" ? "enabled" : outcome === "denied" ? "blocked" : "dismissed");
  }

  if (state === "enabled") {
    return (
      <div
        role="status"
        className="flex items-start gap-md rounded-(--radius-card) border border-primary bg-primary-wash px-lg py-md"
      >
        <Bell size={20} strokeWidth={1.75} aria-hidden className="text-primary shrink-0 mt-0.5" />
        <p className="text-body-sm text-body">{t("enabled")}</p>
      </div>
    );
  }

  if (state === "blocked") {
    return (
      <div
        role="status"
        className="flex items-start gap-md rounded-(--radius-card) border border-border bg-surface px-lg py-md"
      >
        <Bell size={20} strokeWidth={1.75} aria-hidden className="text-muted shrink-0 mt-0.5" />
        <p className="text-body-sm text-body">{t("blocked")}</p>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-md rounded-(--radius-card) border border-border bg-surface px-lg py-md">
      <Bell size={20} strokeWidth={1.75} aria-hidden className="text-primary shrink-0 mt-0.5" />

      <div className="flex flex-col gap-sm min-w-0 flex-1">
        <p className="text-label font-medium text-ink">{t("title")}</p>
        <p className="text-body-sm text-body">{t("body")}</p>

        {support.supported ? (
          <div className="flex flex-wrap gap-sm">
            <Button onClick={enable} disabled={state === "working"} className="grow-0">
              {t("enable")}
            </Button>
            {/* A real button of equal weight. Declining has to be as easy as
                accepting, or "optional" is a word rather than a fact. */}
            <button
              type="button"
              onClick={() => {
                remember();
                setState("dismissed");
              }}
              className="min-h-12 px-lg rounded-(--radius-control) text-body-sm text-body underline underline-offset-4
                         focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              {t("notNow")}
            </button>
          </div>
        ) : (
          <p className="text-body-sm text-muted">{t("iosHint")}</p>
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          remember();
          setState("dismissed");
        }}
        aria-label={t("notNow")}
        className="inline-flex items-center justify-center size-11 shrink-0 rounded-(--radius-control) text-muted"
      >
        <X size={20} strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  );
}
