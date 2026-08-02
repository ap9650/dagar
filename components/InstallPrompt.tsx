"use client";

import { useEffect, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { InstallHelp } from "@/components/install/InstallHelp";
import {
  getServerSnapshot,
  getSnapshot,
  markDismissed,
  refresh,
  runInstall,
  subscribe,
} from "@/components/install/store";

/**
 * Add-to-Home-Screen prompt (D15).
 *
 * **Shown only after a first lesson is completed, never on first load.** A
 * learner who has not yet got anything out of Saathi has no reason to install
 * it, and asking then is how an app trains someone to dismiss its prompts
 * without reading them.
 *
 * This is the *offer*, and it is allowed to be shy. The always-available route
 * lives in Settings (`InstallSettings`) — which is the half that was missing,
 * and the reason a single mis-tap here used to end the story permanently. See
 * `runInstall` in the store for what that bug actually was.
 *
 * When there is no programmatic install — iOS, an in-app WebView, or Chrome
 * simply not having offered yet — the card shows the manual steps rather than
 * a button that does nothing.
 */
export function InstallPrompt({ show }: { show: boolean }) {
  const t = useTranslations("install");
  const { deferred, installed, dismissed, platform, inAppBrowser } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  // `beforeinstallprompt` can fire before this component ever mounts, so the
  // store may already hold it. Re-read once on mount to pick up anything that
  // landed while the learner was elsewhere in the app.
  useEffect(() => {
    refresh();
  }, []);

  if (!show || installed || dismissed) return null;

  return (
    <Card className="flex flex-col gap-md bg-primary-wash border-primary-soft">
      <div className="flex items-start justify-between gap-md">
        <div className="flex flex-col gap-xs min-w-0">
          <h2 className="text-h3 text-ink">{t("title")}</h2>
          <p className="text-body-sm text-body">{t("body")}</p>
        </div>
        <button
          type="button"
          onClick={markDismissed}
          aria-label={t("notNow")}
          className="inline-flex items-center justify-center size-11 shrink-0 rounded-(--radius-control) text-muted"
        >
          <X size={20} strokeWidth={1.75} aria-hidden />
        </button>
      </div>

      {deferred ? (
        <Button onClick={() => void runInstall()}>{t("action")}</Button>
      ) : (
        <InstallHelp platform={platform} inAppBrowser={inAppBrowser} />
      )}
    </Card>
  );
}
