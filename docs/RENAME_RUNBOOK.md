# Saathi → Dagar (डगर): the rename runbook

**Decided 2 Aug 2026.** Written because half of this happens in the Vercel and
Supabase dashboards, where a wrong order breaks Google sign-in **silently** — the
redirect simply never comes back, with no error anywhere.

> **Why now and not later.** Distribution has deliberately been held (D18). Nobody
> outside this laptop has the app installed and no share link is sitting in anyone's
> WhatsApp. So the cost of a URL changing is **zero today** and large the moment the
> forwarding messages go out. This is the last free moment.

---

## 0. The URL route — **decided: Route B**, with a real domain deferred

**Chosen 2 Aug 2026: rename the Vercel project, stay free, buy a domain in ~2–3
months once there are users worth keeping.**

The reasoning holds because the two moves carry **different risk**, not just
different cost:

- Tonight's rename is **destructive** — the old URLs die. Free only because nobody
  has the app yet.
- Adding a custom domain later is **additive** — you gain a hostname without losing
  one, so it is safe even with real users. See §7.

Doing the destructive move while it is free, and deferring the safe move until it
is worth paying for, is the right way round.

### Route A — buy a real domain *(deferred, see §7)*

`dagar.app`, `dagar.in` — roughly ₹1,000/year. Additive: the `.vercel.app` address
keeps working. Better in front of judges and on a WhatsApp forward.

### Route B — rename the Vercel project *(chosen)*

The project `saathi` becomes `dagar`, and Vercel auto-assigns
**`dagar-ap19.vercel.app`** — confirmed free (404) as of 2 Aug.

The catch: **both current `saathi-*.vercel.app` addresses die at that moment** and
become claimable by anyone. Today that costs nothing. After distribution it would
mean dead icons on real phones.

*(`dagar.vercel.app` without the team suffix is already taken by someone else. It
was never available to us anyway — Vercel assigns `project-team`, not the bare name.)*

---

## 1. What I change in the code (~2 hours, no dashboard involved)

Done first, deployed to the **old** URL, and verified there. Nothing below depends
on the URL, so this stage is fully reversible.

| Area | Count | Note |
|---|---|---|
| `messages/en.json` | 34 strings | `Saathi` → `Dagar` |
| `messages/hi.json` | 34 strings | `साथी` → `डगर` |
| Real code strings | 9 | manifest ×2, `appleWebApp` title, welcome `<h1>`, tutor prompt ×2, summaries ×3 |
| Comments | ~35 | Cosmetic |
| Docs + deck source | ~110 | PRD, DECISIONS, BUILD_PLAN, specs, HOW_WE_BUILT_IT, `build-deck.py` |

Three judgement calls inside that:

**The tutor gets de-named.** "Ask Saathi" worked because *saathi* is a person-word.
**डगर से पूछो** means "ask the trail". So the tutor's UI strings lose the name —
"Ask a question", "Working it out", "The tutor said". Giving the tutor its own name
is the mascot's job, and that is the next item anyway.

**The Hindi tagline keeps साथी.** In `तुम्हारा पढ़ाई का साथी` the word is the ordinary
noun "companion", not the brand. `तुम्हारा पढ़ाई का डगर` is not even grammatical.
Pleasingly, the tagline now describes the app instead of repeating its name.

**The tutor's system prompt changes meaning, not just spelling.** It currently reads
*"Saathi means companion. You sit beside the learner; you do not test them."* That
becomes *"Dagar means the trail. You walk it beside the learner, at their pace; you
do not test them."* — the sitting-beside principle survives, which matters because
the whole amber-not-red design follows from it.

**Not changed, on purpose:** the `.claude/skills/saathi-*` directories (internal
tooling, and renaming them mid-deadline risks breaking skill loading), the
`saathi_locale` cookie and `saathi.*` localStorage keys (renaming them silently
resets every learner's language and haptics preference), and the app icon — it is
pure geometry with no letterform, so it needs no redraw.

---

## 2. Vercel — Route A (custom domain)

> Do these **in order**. Steps 1–3 change nothing for existing users.

1. **Buy the domain** at any registrar (Namecheap, GoDaddy, Cloudflare).
2. **Vercel → project `saathi` → Settings → Domains → Add**, enter `dagar.app`.
3. Vercel shows either an **A record** or **nameservers**. Add them at your
   registrar. Wait for Vercel to show **Valid Configuration** — usually minutes,
   occasionally an hour.
4. *(Do Supabase §4 step 1 now, before continuing.)*
5. **Settings → Environment Variables →** edit `NEXT_PUBLIC_SITE_URL` to
   `https://dagar.app`. Set it for **Production**, and for **Preview** if it is set
   there.
   > ⚠️ `NEXT_PUBLIC_*` is **baked into the browser bundle at build time**. Saving
   > the variable changes nothing until a new deployment is built. Step 6 is not
   > optional.
6. **Redeploy** — I run `npx vercel --prod --yes`, or you use Deployments →
   Redeploy **with "use existing build cache" unticked**.
7. Optionally set `dagar.app` as the **primary** domain so Vercel redirects the
   others to it.

The old `saathi-*.vercel.app` addresses keep working throughout. Nothing breaks.

## 2b. Vercel — Route B (project rename)

1. **Vercel → project `saathi` → Settings → General → Project Name** → `dagar` → Save.
2. **Settings → Domains** — write down what Vercel now lists. It should include
   `dagar-ap19.vercel.app`. **Use whatever is actually shown, not what this document
   predicts.** Everything downstream depends on the real value.
3. Then steps 5–6 above (env var + redeploy), using the new hostname.

From step 1 the old URLs are dead. Sign-in stays broken until step 6 completes and
Supabase §4 is done — expect a window of several minutes where the app does not
work. That is fine tonight and unacceptable next week.

---

## 3. Supabase — the step that fails silently

**Dashboard → Authentication → URL Configuration.**

1. **Redirect URLs → Add** the new address **before** anything else changes:
   - `https://dagar.app/**` (Route A) or `https://dagar-ap19.vercel.app/**` (Route B)
   - **Leave the existing Saathi entries in place for now.** Additive first: this
     is what gives you a working rollback.
2. *(Now do the Vercel section.)*
3. Once the new URL is confirmed serving, set **Site URL** to the new address.
4. Only after sign-in is verified working, remove the old Saathi entries.

**If you skip this, Google sign-in fails with no error message.** Supabase redirects
back to an address that is no longer on its allowlist, and the user lands on a blank
page or the login screen again. It looks like the app is broken, not like a config
problem — which is exactly why this is the step to be careful with.

**Optional, cosmetic:** Settings → General → project name. The project *ref* and the
API URL never change, so no keys, no `.env.local` edits, no migrations.

---

## 4. What needs no change at all

- **Supabase keys and project URL** — the ref is random, not `saathi.supabase.co`.
- **Google Cloud Console** — the OAuth redirect URI points at
  `<ref>.supabase.co/auth/v1/callback`, which is unaffected. *Verify by testing
  sign-in; do not edit pre-emptively.*
- **Twilio, Anthropic** — no hostname anywhere in either integration.
- **The cron** — `vercel.json` uses the path `/api/cron/weekly-summary`, not a host.
  `CRON_SECRET` is unchanged.
- **The database** — no chapter, lesson, concept or question mentions the name.
  No migration, no re-seed.

---

## 5. Verify — on a phone, not just a browser tab

In this order. Stop at the first failure.

1. `/welcome` loads on the new URL.
2. **Sign up with email** → class picker → dashboard. *(Proves the Supabase Site URL.)*
3. **Sign in with Google.** *(Proves the redirect allowlist. This is the one that
   fails silently — do not skip it.)*
4. Open a lesson, finish it, see the celebration.
5. Settings → **Share your progress** → open the `/s/<token>` link. Confirm the
   generated link carries the **new** host.
6. **Add to home screen** — the icon should say **Dagar**, and launching it should
   open the new URL.
7. Only now, send the forwarding messages.

> Note on step 5: existing share tokens stay valid — they live in the database, not
> in the URL. But any link **already sent** contains the old host and dies under
> Route B. Re-share after the cutover.

---

## 6. Order of the whole night

1. Code rename → deploy to the old URL → verify there *(reversible)*
2. Supabase: **add** the new redirect URL *(additive)*
3. Vercel: domain or rename *(the cutover)*
4. Vercel: `NEXT_PUBLIC_SITE_URL` → **redeploy**
5. Supabase: Site URL → new; remove old entries
6. Verify §5 on a phone
7. Rebuild the deck and how-doc (`npm run deck`)
8. *Then* the forwarding messages

Steps 1 and 2 are safe at any hour. Step 3 is the only one that takes the app down,
and only for minutes.

---

## 7. Later — moving to a real domain (~month 3)

Deferred deliberately. **Nothing about this is destructive**, which is why it can
wait until there are users worth paying for.

### What survives

**Everything in the database.** Learners, attempts, concept mastery, streaks,
milestones, tutor messages and every `analytics_events` row live in Postgres, keyed
to a Supabase project whose ref never changes. A domain is only how a browser
reaches the app. **No metrics history is lost.**

### What resets, because it is scoped to a hostname

| | Effect | Cost to the user |
|---|---|---|
| Auth session cookie | Signed out on the new host | Sign in once |
| `localStorage` — haptics, spoken-audio language, install-card dismissal | Back to defaults | One tap each, if they care |
| Installed PWAs | Stay on the old host until reinstalled | Follow the redirect below |

None of this is data loss. It is browser-local preference, and each item is one tap.

### The step that makes it nearly seamless

After adding the domain, set it as **primary** in Vercel. Vercel then 308-redirects
`dagar-ap19.vercel.app` → `dagar.app`, so every link already shared on WhatsApp keeps
working and every installed PWA lands on the new host. The only thing anyone notices
is signing in once more.

### Procedure

1. Buy the domain.
2. Vercel → Settings → Domains → Add → complete the DNS records at the registrar.
3. Supabase → Redirect URLs → **add** the new domain, leaving the old entry.
4. Vercel → `NEXT_PUBLIC_SITE_URL` → new domain → **redeploy** (it is baked at build).
5. Supabase → Site URL → new domain.
6. Verify §5 on a phone.
7. Vercel → set the new domain **primary** so the old one redirects.
8. Leave the old entry in the Supabase allowlist for a few weeks. It costs nothing
   and it is the rollback.

### One thing that is NOT recoverable

Vercel's own runtime logs are short-retention (hours to days on Hobby) regardless of
domains. They are a debugging stream, not a store — which is exactly why product
metrics go through `track()` into our own `analytics_events` table instead.
