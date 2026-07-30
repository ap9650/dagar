# Spec: Reminder Notifications

**Build slice:** 3.2b (Day 3, alongside the parent notification layer)
**Implements:** D17b (reminders as encouragement) · D15 (Web Push via the PWA service worker)
**Depends on:** PWA shell (1.1b) · daily goal + streak (1.3, 1.4) · deployed HTTPS
**Copy:** `docs/HINDI_STYLE.md` — the reminder is conversational, **तुम**, never a notice

---

## 1. Why this exists

Pull mechanics — the streak flame, the goal ring — only work on a learner who has
already opened the app. **A learner who forgets never sees them**, and forgetting is
most likely in the first weeks, before the habit exists. That is a real gap, and it
is not a motivational failure to be shamed out of.

This is **not** the Duolingo owl. D17 rejects guilt notifications and D17b draws the
line: this reminds, it never reproaches.

---

## 2. The copy rule, which is the whole feature

| Ship | Never ship |
|---|---|
| "Ready for today's lesson?" | "Your streak dies in 3 hours" |
| "5 minutes is enough today." | "You're about to lose 6 days" |
| Timed to a routine — after school | Timed to a deadline — midnight |
| Silent when the goal is already done | Fires regardless |

**Shared phones make this a constraint, not a preference.** The notification lands
on whoever is holding the handset, often a parent. Every string must be safe to read
over a learner's shoulder.

No countdown. No streak-loss language. No number that can go down.

---

## 3. Data

New table `push_subscriptions`: `student_id` (FK) · `endpoint` (unique) · `p256dh` ·
`auth` · `locale` · `created_at`. RLS: a student manages only their own rows, and
**no parent read policy** — a push endpoint is a device address, not learner progress.

---

## 4. API contract

| Route | Behaviour |
|---|---|
| `POST /api/push/subscribe` | Zod-validated subscription. Upsert on `endpoint`. |
| `POST /api/push/unsubscribe` | Removes the row. Must also work after sign-out. |
| `POST /api/cron/reminders` | **Cron only.** Guarded by `CRON_SECRET`, exactly like the parent summary. Selects learners who have not met today's goal, sends one push each, in their own locale. |

Sending goes through the **existing channel-agnostic notify interface** (D4) —
`lib/notify/` gains a `push.ts` adapter. Do not build a second notification path.

---

## 5. When it fires

- **19:00 IST, one notification, every day — no tapering.** A learner in week 3
  forgets as easily as one in week 1, and an app that quietly stops reminding has
  decided on the learner's behalf that they no longer need help.
- **Skipped entirely if today's goal is already met.** This, not frequency, is what
  controls fatigue: an engaged learner naturally gets fewer notifications, and an
  app that reminds you to do something you have already done is one you stop
  trusting.
- **19:00 carries the urgency so the copy does not have to.** It lands after school
  with roughly five hours of the day left — real time to act — without ever telling
  the learner a clock is running. D7's grace day means one missed day does not break
  a streak anyway, so there is nothing genuinely expiring.
- **One a day, never two.** A "last chance" follow-up is the precise point where a
  reminder becomes a nag.

## 6. Permission

Asked **after a first completed lesson**, never on first load — the same rule as the
install prompt, for the same reason. A permission dialog shown before any value is
delivered gets denied, and a denied permission is permanent.

Declining is not an error state and is never asked again.

---

## 7. Platform reality — say this in the demo

| Platform | Works |
|---|---|
| Android Chrome | ✅ directly |
| Desktop Chrome | ✅ |
| **iOS Safari** | ⚠️ **only after the PWA is installed to the home screen**, iOS 16.4+ |

iOS is **not a scope concern** — it is rare in the communities Saathi serves, and
the product owner has confirmed it is not worth building around. Kept here only so
there is a straight answer if a judge opens the demo on an iPhone.

---

## 8. Acceptance criteria

- [ ] Permission is requested only after a first lesson is completed
- [ ] Declining is remembered and never re-prompted
- [ ] A learner who has met today's goal receives **no** notification
- [ ] Exactly one notification per learner per day, at 19:00 IST, with no tapering by tenure
- [ ] The notification body renders in the learner's chosen locale
- [ ] No string contains a countdown, a deadline, or streak-loss language
- [ ] Tapping the notification opens `/learn`, not a marketing page
- [ ] `POST /api/cron/reminders` without `CRON_SECRET` returns 401
- [ ] Unsubscribing stops delivery, and works after sign-out
- [ ] `push_subscriptions` is not readable by a linked parent

---

## 9. Edge cases

| Case | Required behaviour |
|---|---|
| **Shared phone, two learners** | The subscription belongs to whoever was signed in when it was granted. On sign-out, unsubscribe — otherwise child B gets child A's reminder. |
| **Learner denies permission** | Silent, permanent, no nagging banner. The app works exactly as well without it. |
| **Endpoint expired (410 Gone)** | Delete the row. A dead endpoint retried daily is wasted quota. |
| **Cron fires while a learner is mid-lesson** | Goal not yet met, so it sends — acceptable. Do not build presence detection for this. |
| **iOS, not installed** | No permission prompt at all. Show nothing rather than a control that cannot work. |
