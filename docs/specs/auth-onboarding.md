# Spec: Auth & Onboarding

**Build slice:** 1.1 (auth + onboarding), 1.1a (settings)
**Implements:** D2 (auth method), D16 (language first), D10 (accessibility)
**Depends on:** migrations 0001 applied · next-intl configured (Day 0 prompt 5)
**Flow:** `docs/SCREENS.md` Flow 1 · **Design:** `dagar-design` → Language picker, Buttons

---

## 1. User flow

`/welcome` → `/login` → `/onboarding/grade` → `/learn`

Full diagram in `SCREENS.md` Flow 1. The load-bearing property:

> **Locale is chosen before a user row exists.** Hold it in the `saathi_locale`
> **cookie**, then write it to `profiles.locale` at profile creation. Do not build
> the picker behind auth — that silently reverses D16.

A cookie, not `localStorage` (which this spec originally said): the locale must be
readable during a **server** render, or `/login` paints in English and flips to Hindi
on hydration. Full rationale and the sync table in `docs/specs/i18n.md` §3.

---

## 2. Data

Writes `profiles` (one row, on completing grade selection). Reads it on every
subsequent request. No other table is touched by this slice.

---

## 3. API contract

Auth actions go through route handlers, not the browser client — a client-only flow
has no server surface to rate-limit or log against.

| Route | Behaviour |
|---|---|
| `GET /auth/callback` | Supabase OAuth redirect target. Exchanges the code for a session, then redirects: profile exists → `/learn`; no profile → `/onboarding/grade`. |
| `POST /api/auth/signup` | Zod `{ email, password (min 8) }`. Rate limit **10/min keyed by lowercased email** → `429`. Returns Supabase's error verbatim at `400` ("User already registered" gets a link to `/login`). |
| `POST /api/auth/login` | Same validation and limit. On failure returns a **generic** `401 { error: "Invalid email or password" }` — never reveal whether the email exists. |
| `POST /api/auth/logout` | Clears the session. Always `{ ok: true }`. |
| `POST /api/profile` | Zod `{ grade: 6\|7\|8, locale: "en"\|"hi", display_name?: string }`. Creates the profile with `role: "student"`. **Idempotent** — if a profile exists, update rather than error. Emits `learner_registered` on create only. |
| `PATCH /api/profile` | Settings. Same zod shape, all fields optional. Changing `locale` re-renders in place — never signs out, never resets progress. |

`proxy.ts` (Next 16 renamed `middleware` → `proxy`; same file location, root level,
export a `proxy` function) refreshes the Supabase session cookie on every request.

> **Proxy is an optimistic check, not the auth boundary.** Next 16's docs state it
> must not be used as a full session-management or authorization solution. The real
> guard is the `(learn)` / `(parent)` layout server component reading the session and
> calling `redirect('/login')`, plus `requireAuth()` in every route handler. Proxy
> keeps the cookie fresh and redirects early for UX; it is never the only check.

Redirect happens **server-side** — no flash of protected content.

---

## 4. Components

| File | Responsibility |
|---|---|
| `app/welcome/page.tsx` | Language picker. Writes `localStorage`, routes to `/login`. No auth. |
| `app/login/page.tsx` | Google button primary, email form below a divider |
| `app/onboarding/grade/page.tsx` | Three tap targets → `POST /api/profile` |
| `app/(learn)/settings/page.tsx` | Language toggle, grade, display name, parent code, sign out |
| `components/ui/LanguagePicker.tsx` | **Shared by `/welcome` and `/settings`** — one component, two mount points |
| `proxy.ts` | Session-cookie refresh + optimistic redirect (**not** the auth boundary) |
| `app/(learn)/layout.tsx` | **The real guard** — server component, reads session, redirects |

`LanguagePicker` being shared is what guarantees a learner recognises the control in
Settings as the same one they used at onboarding.

---

## 5. Analytics

`learner_registered` — fires **once**, on successful profile creation, with
`{ grade, locale }`. Never on login. Never on retry of an existing profile.

---

## 6. Acceptance criteria

**Onboarding**
- [ ] A brand-new visitor lands on `/welcome` and sees exactly two options, `English` and `हिंदी`, each written in its own script
- [ ] Selecting `हिंदी` makes the login screen and every screen after it render in Hindi, before any account exists
- [ ] The grade screen offers 6, 7, 8 and nothing else; no free-text age, school or location field appears anywhere in onboarding
- [ ] Completing grade selection creates a `profiles` row with the correct `grade` and `locale` and lands on `/learn`
- [ ] `learner_registered` appears in `events` exactly once with the right grade and locale

**Auth**
- [ ] Google Sign-In completes and returns to the app on the deployed Vercel URL, not just localhost
- [ ] Email signup with a password under 8 characters is rejected inline, without a page reload
- [ ] Wrong password returns "Invalid email or password" — and the same message for an email that has no account
- [ ] More than 10 login attempts for one email in a minute returns `429`
- [ ] Signing out returns to `/`, and navigating back to `/learn` redirects to `/login`
- [ ] No phone/OTP option appears anywhere — DLT-blocked (D2)

**Returning learner**
- [ ] A learner with a profile who opens the app goes straight to `/learn` — the language picker never re-appears
- [ ] Visiting `/welcome` directly with a profile redirects to `/learn`
- [ ] Visiting `/login` while signed in redirects to `/learn`

**Settings**
- [ ] Changing language in `/settings` re-renders immediately, keeps the session, and keeps all progress
- [ ] The Settings language control is visibly the same component as the onboarding one

**Accessibility (D10)**
- [ ] Every option is reachable and selectable by keyboard, with a visible focus ring
- [ ] Selected language is signalled by border **and** check icon, not colour alone
- [ ] Language option cards are ≥64px tall; every other control ≥44px

---

## 7. Edge cases

| Case | Required behaviour |
|---|---|
| **Auth succeeds, profile creation fails** | The learner has an `auth.users` row and no profile — the dangerous one. On next load, no profile ⇒ route to `/onboarding/grade`, not `/learn`. Never dead-end into an empty dashboard. |
| **Learner abandons after picking language** | The cookie persists (1 year). Returning goes to `/login` in the chosen language, not back to `/welcome`. |
| **Google account already registered** | Not an error. OAuth signs them in; the callback routes on profile presence. |
| **Shared phone, parent already signed in** | Sign-out must be reachable in ≤2 taps from any screen. This is the common case for this audience, not an edge case. |
| **Parent signs in at `/login` instead of `/parent/claim`** | On callback, `role: "parent"` → `/parent`, not `/learn`. Route on role, never assume student. |
| **Device locale is Hindi, learner wants English** | Device locale may pre-highlight an option; **it never skips the picker** (D16). |
| **Back button from grade screen** | Returns to `/login` in a signed-in state. Show sign-out — do not trap them on a screen with no exit. |
| **Learner picks the wrong language and cannot read the app** | `/settings` must be reachable from a persistent icon in the header, recognisable without reading text. This is the whole reason slice 1.1a exists. |
| **OAuth redirect on Vercel** | `NEXT_PUBLIC_SITE_URL` must match the deployed origin, and that origin must be in Supabase's redirect allow-list. **Verify on Day 0**, not Day 4 — a wrong value fails silently. |
