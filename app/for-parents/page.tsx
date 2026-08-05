import Link from "next/link";
import { Check, Eye, EyeOff, Link2 as LinkIcon, Lock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { buttonClasses } from "@/components/ui/Button";
import { BackLink } from "@/components/ui/BackLink";

/**
 * `/for-parents` — what this is, and how a parent gets in.
 *
 * ── WHY THIS SCREEN EXISTS ──────────────────────────────────────────────────
 * Parent linking is a concept no other e-learning site has, and both people in
 * it were being asked to act on information neither had been given. A parent
 * landing on the sign-in screen has never heard of Dagar, does not know what
 * they would be able to see, and — if their child has not made a code yet —
 * reaches a dead end with nothing to do.
 *
 * So this is a plain explanation, reachable BEFORE anyone makes an account.
 * It is deliberately a separate screen rather than more text on the sign-in
 * page: the overwhelming majority of arrivals are learners, and the parent path
 * must be findable without competing with them.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Note the route: `/for-parents`, NOT under `/parent`. Everything under
 * `/parent` is behind the auth redirect in proxy.ts, and an explanation you have
 * to sign in to read is not an explanation.
 *
 * Static — no session, no database, nothing to load on a slow connection.
 */
export default async function ForParentsPage() {
  const t = await getTranslations("forParents");

  /*
    FIVE, and the fifth is the one that was missing.

    The parent screen's most useful section is "What would help most" — one
    named concept and one thing to do about it tonight. It is the whole reason
    an adult without the maths would open this at all, and the list promising
    what they would see never mentioned it: four lines of reporting and nothing
    about being helped.

    `sees2` also now uses the exact words the badges use — "Mastered", "Getting
    there" — rather than paraphrasing them. A promise a reader has to translate
    into what they later see on screen is a weaker promise.
  */
  const sees = [t("sees1"), t("sees2"), t("sees3"), t("sees4"), t("sees5")];
  // ONE line, because one thing is actually enforced.
  //
  // This list used to promise that the answers a learner gave and "anything they
  // typed for themselves" stayed private too. Neither was true: a linked parent
  // could read both. Rather than enforce promises the product may not want to
  // keep — the answers are being left visible on purpose, for a future screen —
  // the list now claims only what migration 0017 guarantees.
  //
  // A short list that holds is worth more than a long one that does not. This is
  // a promise made to a child about their own words.
  const doesNotSee = [t("private1")];
  // TWO paths, and the link goes first because it IS the primary one.
  //
  // This page used to describe only the account-and-code route — four numbered
  // steps ending in "create your own Dagar account". An adult who had just been
  // sent a LINK and tapped through to here was being told to sign up for
  // something they did not need, to reach a page they were already one tap from.
  //
  // The link path was chosen precisely because it has no friction (no account,
  // no password, works on a borrowed phone). Explaining only the fallback made
  // the product look like the thing it was designed not to be.
  const linkWay = [t("linkWay1"), t("linkWay2"), t("linkWay3")];
  const steps = [t("step1"), t("step2"), t("step3"), t("step4")];

  return (
    <main className="flex-1 w-full max-w-(--container-content) mx-auto px-lg py-lg flex flex-col gap-xl">
      <header className="flex flex-col gap-lg">
        <BackLink href="/login" label={t("back")} />
        <h1 className="text-h1 text-ink">{t("title")}</h1>
        <p className="text-body text-body">{t("intro")}</p>
      </header>

      <h2 className="text-h3 text-ink">{t("waysTitle")}</h2>

      {/* ── 1. the link: no account at all ───────────────────────────────── */}
      <section
        aria-labelledby="link-way-heading"
        className="flex flex-col gap-md rounded-(--radius-card) border border-primary-soft bg-primary-wash px-lg py-lg"
      >
        <h3 id="link-way-heading" className="flex items-center gap-sm text-h3 text-primary-strong">
          <LinkIcon size={20} strokeWidth={1.75} aria-hidden />
          {t("linkWayTitle")}
        </h3>
        {/* Tinted and placed first, so a reader who stops after one section has
            stopped on the right one. */}
        <ul className="flex flex-col gap-sm">
          {linkWay.map((line) => (
            <li key={line} className="flex items-start gap-sm text-body text-body">
              <Check size={20} strokeWidth={1.75} aria-hidden className="text-primary shrink-0 mt-0.5" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── 2. the account: for a second adult, or a parent who prefers it ── */}
      <section aria-labelledby="steps-heading" className="flex flex-col gap-lg">
        <h2 id="steps-heading" className="text-h3 text-ink">
          {t("codeWayTitle")}
        </h2>
        <p className="text-body-sm text-muted">{t("codeWayWhy")}</p>

        <ol className="flex flex-col gap-lg">
          {steps.map((step, index) => (
            <li key={index} className="flex items-start gap-md">
              {/* A numbered node, not a bullet: this is a sequence and the order
                  is the whole point of the screen. */}
              <span
                aria-hidden
                className="inline-flex items-center justify-center size-8 shrink-0 rounded-full
                           bg-primary text-white text-label font-medium"
              >
                {index + 1}
              </span>
              <p className="text-body text-ink pt-xs">{step}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── what a parent sees ───────────────────────────────────────────── */}
      <section
        aria-labelledby="sees-heading"
        className="flex flex-col gap-md rounded-(--radius-card) border border-border bg-surface px-lg py-lg"
      >
        <h2 id="sees-heading" className="flex items-center gap-sm text-h3 text-ink">
          <Eye size={20} strokeWidth={1.75} aria-hidden className="text-primary" />
          {t("seesTitle")}
        </h2>
        <ul className="flex flex-col gap-sm">
          {sees.map((item) => (
            <li key={item} className="flex items-start gap-sm text-body text-body">
              <Check
                size={20}
                strokeWidth={1.75}
                aria-hidden
                className="text-correct shrink-0 mt-0.5"
              />
              {item}
            </li>
          ))}
        </ul>
      </section>

      {/* ── and what they do not ─────────────────────────────────────────── */}
      <section
        aria-labelledby="private-heading"
        className="flex flex-col gap-md rounded-(--radius-card) border border-border bg-background px-lg py-lg"
      >
        <h2 id="private-heading" className="flex items-center gap-sm text-h3 text-ink">
          <EyeOff size={20} strokeWidth={1.75} aria-hidden className="text-muted" />
          {t("privateTitle")}
        </h2>
        {/* Stated as plainly as the list above it. A child deciding whether to
            share their learning data is entitled to know exactly what is shared
            — and what a parent cannot see is the half they actually worry
            about. */}
        <ul className="flex flex-col gap-sm">
          {doesNotSee.map((item) => (
            <li key={item} className="text-body text-body">
              {item}
            </li>
          ))}
        </ul>
        <p className="flex items-start gap-sm text-body-sm text-body">
          <Lock size={20} strokeWidth={1.75} aria-hidden className="text-primary shrink-0 mt-0.5" />
          {t("readOnly")}
        </p>
      </section>

      {/* ── the case no amount of explaining removes ─────────────────────── */}
      {/* On a shared low-end Android — the norm for this audience, and often the
          PARENT's phone that the child borrows — creating a parent account signs
          the child out. That is not a copy problem, it is the design. What copy
          can do is set the expectation before it happens, so the first sign-out
          reads as "as described" rather than "the app lost my child's account". */}
      <section className="flex flex-col gap-xs rounded-(--radius-card) border border-hint/30 bg-primary-wash px-lg py-md">
        <h2 className="text-label font-medium text-ink">{t("sharedPhoneTitle")}</h2>
        <p className="text-body-sm text-body">{t("sharedPhoneBody")}</p>
      </section>

      {/* ── the two ways out of this screen ──────────────────────────────── */}
      <div className="flex flex-col gap-md">
        <Link href="/parent/claim" className={buttonClasses("primary")}>
          {t("haveCode")}
        </Link>

        {/* The dead end this screen was built to remove: a parent who arrives
            before their child has made a code now knows exactly what to ask
            for, rather than finding a form they cannot fill in. */}
        <div className="flex flex-col gap-xs rounded-(--radius-card) border border-border bg-surface px-lg py-md">
          <p className="text-label font-medium text-ink">{t("noCodeTitle")}</p>
          <p className="text-body-sm text-body">{t("noCodeBody")}</p>
        </div>
      </div>
    </main>
  );
}
