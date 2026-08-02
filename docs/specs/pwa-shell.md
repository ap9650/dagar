# Spec: PWA Shell

**Build slice:** 1.1b
**Implements:** D15 (PWA now, Play Store later)
**Depends on:** app deployed to Vercel over HTTPS (Day 0.6)

---

## 1. Why this exists

There is no APK in the MVP. The Play Store requires a 14-day closed test with 12+
testers, which does not fit a 4-day build. A PWA gives an icon on the home screen
that opens full-screen with no browser chrome — indistinguishable from an app for a
learner, reachable by URL for a demo judge.

Post-buildathon, a Trusted Web Activity (Bubblewrap) wraps this same PWA for Play
Store without rewriting anything.

---

## 2. Files

| File | Contents |
|---|---|
| `app/manifest.ts` | name, short_name, `display: "standalone"`, `start_url: "/"`, `theme_color: "#0F766E"`, `background_color: "#FFFFFF"`, icons at 192px and 512px + a 512px `maskable` |
| `public/icons/` | The three icons above. Maskable needs ~20% safe padding or Android crops the logo. |
| `public/sw.js` | Service worker — **app shell only** |
| `components/InstallPrompt.tsx` | Add-to-Home-Screen prompt |

---

## 3. Service worker scope

**Cache the shell. Never cache learner data.**

| Cache | Do not cache |
|---|---|
| CSS, JS, fonts, icons | Any API response |
| The offline fallback page | Lesson content, questions, progress |

Caching a lesson risks showing a learner stale content; caching an API response
risks showing one learner another learner's data from a shared phone. Full offline
learning is Phase 3 (D15) — do not half-build it here.

On a failed navigation while offline, show a small "You're offline — Dagar needs a
connection right now" page in the learner's locale, with a retry.

---

## 4. Install prompt

Capture `beforeinstallprompt`, suppress the browser's default banner, and surface
your own control instead.

- Show **after** the first completed lesson, never on first load. A learner who has
  not yet seen value has no reason to install.
- Dismissible, and the dismissal persists — never ask twice.
- iOS Safari does not fire `beforeinstallprompt`. Show static "Share → Add to Home
  Screen" instructions there instead. Most learners are on Android, but a judge may
  well open the demo on an iPhone.

---

## 5. Analytics

No new events. Off the canonical list — do not invent one.

---

## 6. Acceptance criteria

- [ ] Chrome on Android offers "Install app" / "Add to Home Screen" on the deployed URL
- [ ] The installed app opens **full-screen with no browser address bar**
- [ ] The home-screen icon is the Dagar icon, not a screenshot or a generic globe
- [ ] The maskable icon is not cropped into on a circular-icon Android launcher
- [ ] Lighthouse PWA installability checks pass on the deployed URL
- [ ] The install prompt appears only after a first lesson is completed
- [ ] Dismissing the prompt persists — it does not reappear on the next visit
- [ ] iOS Safari shows the static Add-to-Home-Screen instructions instead of a dead button
- [ ] Going offline mid-session shows the offline page, not a browser error page
- [ ] The offline page renders in the learner's chosen language
- [ ] No API response appears in the cache storage inspector after a full session
- [ ] Deploying a new version does not leave a learner stuck on the old cached shell

---

## 7. Edge cases

| Case | Required behaviour |
|---|---|
| **Stale shell after deploy** | The classic PWA failure — a learner runs last week's JS against this week's API. Use a versioned cache name and `skipWaiting` + `clients.claim`, so a new deploy takes effect on next launch. **Verify this before the demo**, not after. |
| **Offline mid-lesson** | Shell renders, content fails. Show the offline state inside the layout, keeping the nav — not a full white browser error. |
| **Shared phone, two learners** | The PWA holds one session. Sign-out must fully clear the session; never cache anything keyed to a learner. |
| **Judge opens on desktop Chrome** | Install is offered on desktop too. It must not look broken at 1280px — content stays 480px centred, per `saathi-design`. |
| **Learner already installed, then you redeploy** | Covered by the versioned cache above. Worth an explicit manual test on Day 4. |
| **HTTP not HTTPS** | Service workers do not register at all except on `localhost` and HTTPS. Nothing to fix on Vercel — but it means **you cannot test install from a phone against `npm run dev`**. Test against the deployed URL. |
