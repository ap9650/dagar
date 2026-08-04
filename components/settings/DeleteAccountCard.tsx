"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";

/**
 * Delete my account — the control that makes the privacy page's promise real.
 *
 * ── THE ONE DESTRUCTIVE CONTROL IN THE PRODUCT ──────────────────────────────
 * Everything else here is reversible. This is not, and the person holding the
 * phone is 11–14, so the shape matters more than the code:
 *
 *   - It is CLOSED by default. A learner scrolling Settings sees a quiet row,
 *     not a red button one mis-tap from destroying their streak.
 *   - Opening it is not confirming it. The first tap only reveals what will
 *     happen; the second tap, on a differently-worded button, does it.
 *   - It says what is lost in plain terms — lessons, practice, streak, badges —
 *     because "your account" means nothing to a 12-year-old and "your streak"
 *     means a great deal.
 *   - "Not now" is listed FIRST and is the visually heavier option. A learner
 *     who opened this by accident should fall out of it, not through it.
 *
 * Red is correct here and nowhere else in this product: this genuinely is
 * destructive, which is the one thing the design system reserves red for.
 * Amber would be a kindness that misleads.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * On success the browser is sent to `/welcome` with a hard navigation rather
 * than a router push: the session is gone, every cached RSC payload above this
 * belongs to a user who no longer exists, and a soft navigation would render
 * them.
 */
export function DeleteAccountCard() {
  const t = useTranslations("deleteAccount");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function remove() {
    setBusy(true);
    setFailed(false);
    try {
      const response = await fetch("/api/account", { method: "DELETE" });
      if (!response.ok) throw new Error("delete failed");
      // Hard navigation — see the header.
      window.location.href = "/welcome";
    } catch {
      setBusy(false);
      setFailed(true);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-md min-h-14 px-lg rounded-(--radius-card)
                   border border-border bg-background text-body
                   transition-colors duration-150 ease-out hover:bg-surface
                   active:bg-surface
                   focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2
                   [-webkit-tap-highlight-color:transparent]"
      >
        <Trash2 size={20} strokeWidth={1.75} aria-hidden className="text-muted shrink-0" />
        <span className="text-body">{t("open")}</span>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-md rounded-(--radius-card) border border-error px-lg py-lg">
      <p className="text-label font-medium text-ink">{t("title")}</p>
      <p className="text-body-sm text-body">{t("body")}</p>

      {failed && (
        // A genuine system failure, so this one is red — and it must never
        // leave the learner thinking it worked.
        <p role="alert" className="text-body-sm text-error">
          {t("failed")}
        </p>
      )}

      {/* "Not now" first and full-weight. The way out of a screen you opened by
          accident should be the easiest thing on it. */}
      <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
        {t("cancel")}
      </Button>

      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="min-h-12 px-lg rounded-(--radius-control) text-label font-medium
                   text-error underline underline-offset-4 disabled:opacity-60
                   focus-visible:outline-2 focus-visible:outline-error focus-visible:outline-offset-2"
      >
        {busy ? t("deleting") : t("confirm")}
      </button>
    </div>
  );
}
