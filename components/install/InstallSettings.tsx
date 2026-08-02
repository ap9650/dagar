"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Check, Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { InstallHelp } from "./InstallHelp";
import { getServerSnapshot, getSnapshot, refresh, runInstall, subscribe } from "./store";

/**
 * The install route that is ALWAYS there.
 *
 * The dashboard card offers once and then gets out of the way, which is right
 * for a prompt and wrong as the only path — dismiss it by accident and the app
 * had no way to install at all. This row is the answer: it never hides itself
 * for having been dismissed, only for the app already being installed.
 *
 * It always says *something*. A button when the browser can install, real
 * instructions when it cannot, and a done state when there is nothing to do.
 */
export function InstallSettings() {
  const t = useTranslations("install");
  const { deferred, installed, platform, inAppBrowser } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  useEffect(() => {
    refresh();
  }, []);

  if (installed) {
    return (
      <Card className="flex items-center gap-md bg-primary-wash border-primary-soft">
        <Check size={20} strokeWidth={2} aria-hidden className="text-correct shrink-0" />
        <p className="text-body text-ink">{t("alreadyInstalled")}</p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-md">
      <p className="flex items-start gap-sm text-body text-ink">
        <Smartphone size={20} strokeWidth={1.75} aria-hidden className="text-primary shrink-0 mt-0.5" />
        {t("body")}
      </p>

      {deferred ? (
        <Button onClick={() => void runInstall()}>{t("action")}</Button>
      ) : (
        <InstallHelp platform={platform} inAppBrowser={inAppBrowser} />
      )}
    </Card>
  );
}
