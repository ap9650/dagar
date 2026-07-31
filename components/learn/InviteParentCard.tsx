"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { linkCodeHoursLeft } from "@/lib/parent/linkCode";

/**
 * "Invite a parent" — the learner's half of D2.
 *
 * The code is generated on TAP, not on page load. A learner who never invites
 * anyone should never have a live code sitting in the database: every unclaimed
 * code is a guessable key to their account, and the cheapest way to have fewer
 * of them is to only make one when someone asks.
 *
 * Displayed in a large monospace row because the primary way this travels is a
 * learner reading it out loud to a parent in the same room. Copy is secondary.
 */
export function InviteParentCard() {
  const t = useTranslations();

  const [code, setCode] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  async function requestCode() {
    setBusy(true);
    setFailed(false);
    try {
      const response = await fetch("/api/parent-links", { method: "POST" });
      if (!response.ok) {
        setFailed(true);
        return;
      }
      const body = (await response.json()) as { link_code: string; created_at: string };
      setCode(body.link_code);
      setCreatedAt(body.created_at);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  /**
   * The whole message, not the six characters.
   *
   * Copying just the code was the original behaviour and it broke the flow at
   * the exact point it mattered: a parent receives `U322CT` on WhatsApp with no
   * idea what it is, where to go, or what it would show them. Everything they
   * need travels in one paste.
   */
  function shareMessage(): string {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "https://saathi-ap19.vercel.app";
    // Points at the EXPLANATION, not the sign-in screen. A parent following this
    // link has never heard of Saathi; dropping them on a form asking for a
    // 6-character code answers none of the questions they arrive with.
    return t("settings.inviteParentShareMessage", {
      url: `${origin}/for-parents`,
      code: code ?? "",
    });
  }

  async function copy() {
    if (!code) return;
    const message = shareMessage();

    // The Web Share sheet first: on Android this opens WhatsApp directly, which
    // is the actual delivery route for this audience. Clipboard is the fallback
    // for desktop and for WebViews that do not implement it.
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ text: message });
        return;
      } catch {
        // Includes the learner simply dismissing the sheet — fall through to
        // copying rather than treating a cancelled share as a failure.
      }
    }

    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is blocked on some Android WebViews. The code is on screen and
      // readable, which was always the primary path — nothing to report.
    }
  }

  if (!code) {
    return (
      <div className="flex flex-col gap-md">
        <p className="text-body-sm text-body">{t("settings.inviteParentBody")}</p>

        {/* ── told BEFORE the code exists, not after ────────────────────────
            A learner deciding whether to let an adult see their learning data
            is entitled to know what is shared, and the second line is the half
            they actually worry about. Putting this after the code appears would
            be disclosure after the decision, which is not disclosure. */}
        <div className="flex flex-col gap-xs rounded-(--radius-card) border border-border bg-surface px-lg py-md">
          <p className="text-body-sm text-body">{t("settings.inviteParentSees")}</p>
          <p className="text-body-sm text-body">{t("settings.inviteParentPrivate")}</p>
        </div>

        {failed && (
          <p role="status" className="text-body-sm text-notquite">
            {t("errors.offline")}
          </p>
        )}
        <Button variant="secondary" loading={busy} onClick={requestCode}>
          {t("settings.inviteParent")}
        </Button>
      </div>
    );
  }

  const hoursLeft = createdAt ? linkCodeHoursLeft(createdAt) : 0;

  return (
    <div className="flex flex-col gap-md">
      {/* Wide tracking and a monospace face: this gets read aloud, and grouped
          characters are what stop "was that an M or an N". */}
      <p
        className="text-center font-mono text-h1 tracking-[0.2em] text-ink
                   rounded-(--radius-card) border border-primary bg-primary-wash py-lg"
        // Announced as individual characters rather than as a word a screen
        // reader would try to pronounce.
        aria-label={code.split("").join(" ")}
      >
        {code}
      </p>

      <p className="text-body-sm text-body">{t("settings.inviteParentHow")}</p>
      <p className="text-caption text-muted">
        {t("settings.inviteParentExpiry", { hours: hoursLeft })}
      </p>

      <Button variant="secondary" onClick={copy}>
        {copied ? (
          <>
            <Check size={20} strokeWidth={1.75} aria-hidden />
            {t("settings.inviteParentCopied")}
          </>
        ) : (
          <>
            <Share2 size={20} strokeWidth={1.75} aria-hidden />
            {t("settings.inviteParentShare")}
          </>
        )}
      </Button>
    </div>
  );
}
