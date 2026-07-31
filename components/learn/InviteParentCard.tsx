"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
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

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
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
            <Copy size={20} strokeWidth={1.75} aria-hidden />
            {t("settings.inviteParentCopy")}
          </>
        )}
      </Button>
    </div>
  );
}
