"use client";

import { useTranslations } from "next-intl";
import { Share, MoreVertical, ExternalLink } from "lucide-react";
import type { Platform } from "./store";

/**
 * The manual route, for every case where there is no button to press.
 *
 * There is a lot of "no button" in practice: iOS has no programmatic install at
 * all, an in-app WebView never fires the event, and Chrome only re-offers on its
 * own schedule. Showing nothing in those cases is what made install look broken.
 */
export function InstallHelp({
  platform,
  inAppBrowser,
}: {
  platform: Platform;
  inAppBrowser: boolean;
}) {
  const t = useTranslations("install");

  // Checked first: inside WhatsApp's browser no instruction below can work,
  // because that browser cannot install anything at all.
  if (inAppBrowser) {
    return (
      <Row icon={<ExternalLink size={20} strokeWidth={1.75} aria-hidden />}>
        {t("inAppBrowser")}
      </Row>
    );
  }

  if (platform === "ios") {
    return <Row icon={<Share size={20} strokeWidth={1.75} aria-hidden />}>{t("iosSteps")}</Row>;
  }

  return (
    <div className="flex flex-col gap-sm">
      <Row icon={<MoreVertical size={20} strokeWidth={1.75} aria-hidden />}>
        {t("androidSteps")}
      </Row>
      {/* The failure this exists for: on MIUI and several other Android skins a
          PWA installs into the app list and the launcher never places an icon.
          It looks exactly like a failed install, and it is the phone population
          Dagar actually targets. */}
      <p className="text-caption text-muted">{t("launcherNote")}</p>
    </div>
  );
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-sm text-body-sm text-body">
      <span className="shrink-0 text-primary mt-0.5">{icon}</span>
      {children}
    </p>
  );
}
