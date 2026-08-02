/**
 * Saathi service worker — APP SHELL ONLY.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS DELIBERATELY DOES NOT DO
 *
 * It never caches an API response, a lesson, a question or any progress.
 *
 * Two reasons, and both are about the learner rather than about performance:
 *   - a cached lesson can show stale content as authoritative teaching
 *   - a cached API response on a SHARED PHONE can show one child another
 *     child's data, which is the single worst failure this product could have
 *
 * Full offline learning is Phase 3 (D15). Half-building it here would trade a
 * real safety property for a feature nobody asked for yet.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// Bump on every deploy that changes the shell. The version is what stops the
// classic PWA failure: a learner running last week's JavaScript against this
// week's API, with no way to tell that is what is happening.
const VERSION = "dagar-v1";
const OFFLINE_URL = "/offline";

const PRECACHE = [
  OFFLINE_URL,
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      // Individually, not addAll: addAll rejects the whole install if any one
      // request fails, which would leave the learner with no offline page at all
      // because an icon 404'd.
      await Promise.allSettled(PRECACHE.map((url) => cache.add(url)));
      // Take over immediately rather than waiting for every tab to close.
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Delete every previous version's cache, so a redeploy cannot strand a
      // learner on an old shell.
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => name !== VERSION).map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only ever touch same-origin GETs. A POST is a learner submitting work; it
  // must reach the server or fail loudly, never be served from a cache.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept the API or the auth routes. Learner data does not enter
  // this cache under any circumstances.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  // Navigations: network first, and the offline page only as a last resort. A
  // lesson must always come from the server, so the learner is never taught
  // from a stale copy.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cache = await caches.open(VERSION);
          const offline = await cache.match(OFFLINE_URL);
          return (
            offline ??
            new Response("You are offline.", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            })
          );
        }
      })(),
    );
    return;
  }

  // Static build output only. Next fingerprints these paths in a production
  // build, so a cached copy can never be stale — a new build produces new URLs.
  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/");

  if (!isStaticAsset) return;

  // …but that fingerprinting guarantee does NOT hold in `next dev`, where
  // Turbopack reuses chunk names and rewrites their contents in place. Caching
  // there serves the previous edit's JavaScript against the current server
  // render: the page hydrates into stale components, React reports a hydration
  // mismatch, and the actual code change appears to have had no effect. That is
  // an expensive thing to debug and it is entirely an artefact of the cache.
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;

      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(VERSION);
        cache.put(request, response.clone());
      }
      return response;
    })(),
  );
});
