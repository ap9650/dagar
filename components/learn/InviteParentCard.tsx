"use client";

import { useState } from "react";
import { Check, Eye, Share2, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { linkCodeHoursLeft } from "@/lib/parent/linkCode";

/**
 * Sharing progress with a supporting adult — the learner's side of D2/D4.
 *
 * ── TWO PATHS, AND THE ORDER IS THE DESIGN ──────────────────────────────────
 * The LINK is primary. It is one tap for the learner and one tap for the adult,
 * with no account, no code and no password at the other end. In this
 * demographic the reader is often the most literate person in the household —
 * frequently an older sibling — or a tutor looking at it beside a parent, and
 * asking any of them to register is where the feature stops being used.
 *
 * The CODE is secondary and stays for the cases that earn the friction: a tutor
 * with several learners, a parent with more than one child, anyone who wants a
 * permanent signed-in view.
 *
 * Both are generated on TAP, never on page load. A learner who shares with
 * nobody should have no live key to their account sitting in the database.
 * ────────────────────────────────────────────────────────────────────────────
 */
export function InviteParentCard() {
  const t = useTranslations();

  const [token, setToken] = useState<string | null>(null);
  const [views, setViews] = useState<{ count: number; last: string | null }>({
    count: 0,
    last: null,
  });
  const [code, setCode] = useState<string | null>(null);
  const [codeCreatedAt, setCodeCreatedAt] = useState<string | null>(null);

  const [busy, setBusy] = useState<null | "link" | "code" | "revoke">(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showCode, setShowCode] = useState(false);

  function summaryUrl(forToken: string): string {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "https://dagar-ap19.vercel.app";
    return `${origin}/s/${forToken}`;
  }

  /** Create-or-reuse the link, then hand it straight to the share sheet. */
  async function shareLink() {
    setBusy("link");
    setFailed(false);
    try {
      const response = await fetch("/api/summary-links", { method: "POST" });
      if (!response.ok) {
        setFailed(true);
        return;
      }
      const body = (await response.json()) as {
        token: string;
        view_count: number;
        last_viewed_at: string | null;
      };
      setToken(body.token);
      setViews({ count: body.view_count, last: body.last_viewed_at });

      const message = t("settings.shareLinkMessage", { url: summaryUrl(body.token) });

      // The Web Share sheet first: on Android this opens WhatsApp directly,
      // which is the actual delivery route for this audience. Clipboard is the
      // fallback for desktop and for WebViews without it.
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
        // Blocked on some Android WebViews. The link is on screen and readable.
      }
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  }

  async function revokeLink() {
    setBusy("revoke");
    setFailed(false);
    try {
      const response = await fetch("/api/summary-links", { method: "DELETE" });
      if (!response.ok) {
        setFailed(true);
        return;
      }
      setToken(null);
      setViews({ count: 0, last: null });
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  }

  async function requestCode() {
    setBusy("code");
    setFailed(false);
    try {
      const response = await fetch("/api/parent-links", { method: "POST" });
      if (!response.ok) {
        setFailed(true);
        return;
      }
      const body = (await response.json()) as { link_code: string; created_at: string };
      setCode(body.link_code);
      setCodeCreatedAt(body.created_at);
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-lg">
      <p className="text-body-sm text-body">{t("settings.inviteParentBody")}</p>

      {/* ── disclosure, BEFORE anything is created ──────────────────────────
          A learner deciding whether to let an adult see their learning data is
          entitled to know what is shared, and the second line is the half they
          actually worry about. After the link exists is disclosure after the
          decision, which is not disclosure. */}
      <div className="flex flex-col gap-xs rounded-(--radius-card) border border-border bg-surface px-lg py-md">
        <p className="text-body-sm text-body">{t("settings.inviteParentSees")}</p>
        <p className="text-body-sm text-body">{t("settings.inviteParentPrivate")}</p>
      </div>

      {failed && (
        <p role="status" className="text-body-sm text-notquite">
          {t("errors.offline")}
        </p>
      )}

      {/* ── the primary path ─────────────────────────────────────────────── */}
      <Button variant="primary" loading={busy === "link"} onClick={shareLink}>
        {copied ? (
          <>
            <Check size={20} strokeWidth={1.75} aria-hidden />
            {t("settings.inviteParentCopied")}
          </>
        ) : (
          <>
            <Share2 size={20} strokeWidth={1.75} aria-hidden />
            {token ? t("settings.shareLinkAgain") : t("settings.shareLink")}
          </>
        )}
      </Button>

      {token && (
        <div className="flex flex-col gap-md rounded-(--radius-card) border border-primary bg-primary-wash px-lg py-md">
          {/* The link itself, readable. On a shared phone the learner may want
              to show it rather than send it. */}
          <p className="text-caption text-body break-all font-mono">{summaryUrl(token)}</p>

          {/* Who is actually reading it — so the learner can decide whether to
              keep it open. This is the control that makes sharing reversible in
              practice and not just in theory. */}
          <p className="flex items-center gap-sm text-body-sm text-body">
            <Eye size={20} strokeWidth={1.75} aria-hidden className="text-primary shrink-0" />
            {views.count > 0
              ? t("settings.shareLinkViews", { count: views.count })
              : t("settings.shareLinkUnopened")}
          </p>

          <Button variant="ghost" loading={busy === "revoke"} onClick={revokeLink}>
            <XCircle size={20} strokeWidth={1.75} aria-hidden />
            {t("settings.shareLinkRevoke")}
          </Button>
        </div>
      )}

      {/* ── the secondary path, behind a tap ─────────────────────────────── */}
      {!showCode && !code ? (
        <button
          type="button"
          onClick={() => setShowCode(true)}
          className="self-start min-h-11 text-body-sm text-primary-strong underline underline-offset-4"
        >
          {t("settings.inviteParentCodeToggle")}
        </button>
      ) : (
        <div className="flex flex-col gap-md">
          <p className="text-body-sm text-body">{t("settings.inviteParentCodeWhy")}</p>

          {code ? (
            <>
              {/* Wide tracking and a monospace face: this gets read aloud, and
                  grouped characters are what stop "was that an M or an N". */}
              <p
                className="text-center font-mono text-h1 tracking-[0.2em] text-ink
                           rounded-(--radius-card) border border-primary bg-primary-wash py-lg"
                // Announced character by character rather than as a word a
                // screen reader would try to pronounce.
                aria-label={code.split("").join(" ")}
              >
                {code}
              </p>
              <p className="text-body-sm text-body">{t("settings.inviteParentHow")}</p>
              <p className="text-caption text-muted">
                {t("settings.inviteParentExpiry", {
                  hours: codeCreatedAt ? linkCodeHoursLeft(codeCreatedAt) : 0,
                })}
              </p>
            </>
          ) : (
            <Button variant="secondary" loading={busy === "code"} onClick={requestCode}>
              {t("settings.inviteParent")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
