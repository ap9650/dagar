"use client";

import { useEffect } from "react";

/**
 * Registers the service worker.
 *
 * NOT named `ServiceWorkerRegistration`: that is a DOM global interface, and
 * TypeScript resolves the global ahead of the import in JSX position, so the
 * component fails to typecheck with a message that points nowhere useful.
 *
 * Renders nothing. It exists because registration is a browser API and the root
 * layout is a Server Component.
 *
 * Failure is swallowed on purpose: the service worker is an enhancement, and a
 * learner whose browser refuses to register one must still get a working app.
 * Note that registration only happens on HTTPS and localhost — which is why the
 * install flow **cannot be tested from a phone against `npm run dev`**, only
 * against the deployed URL (pwa-shell spec §7).
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // After load, not during: registration competes with the first render for
    // bandwidth otherwise, and this audience has little to spare.
    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
        console.warn("[sw] registration failed:", error);
      });
    };

    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
