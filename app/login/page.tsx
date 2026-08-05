import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { buttonClasses } from "@/components/ui/Button";
import { EmailAuthForm } from "@/components/auth/EmailAuthForm";
import { safeNextPath } from "@/lib/security/nextPath";
import { trackAnonymous } from "@/lib/analytics/track";

/**
 * `/login` — Google primary, email below a divider (D2).
 *
 * Already renders in the language chosen at `/welcome`, because the locale is in
 * a cookie by the time we get here — no account needed.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error, next } = await searchParams;
  // Validated, never used raw: `?next=` is attacker-controlled and an unchecked
  // redirect target is how a genuine sign-in delivers someone to a fake one.
  const destination = safeNextPath(next);

  // Signed in already: never show a login screen to someone who is logged in.
  if (user) {
    // Honour where they were heading BEFORE role routing. A parent who followed
    // an invite to /parent/claim has no profile yet, and the role branch below
    // would send them to the learner grade picker — asking an adult which class
    // they are in, and stranding the invitation.
    if (destination !== "/") redirect(destination);

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile) redirect(profile.role === "parent" ? "/parent" : "/learn");
    redirect("/onboarding/grade");
  }

  const t = await getTranslations();

  // Funnel step 2, and the last one we can see before the learner leaves for
  // Google. Anonymous by construction — see `trackAnonymous`. What happens on
  // Google's screen is not measurable from here and never will be: someone who
  // backs out of the account chooser is a gap between this event and
  // `onboarding_started`, not a number we can read directly.
  await trackAnonymous("login_viewed", { failed: error === "oauth" });

  return (
    <main className="flex-1 w-full max-w-(--container-content) mx-auto px-lg py-3xl flex flex-col gap-xl">
      {/*
        ── WHAT THIS SCREEN SAYS DAGAR IS ──────────────────────────────────────
        The subtitle read "NCERT mathematics for Classes 6 to 8", which promoted
        a temporary scope decision into the product's identity. The PRD is
        explicit that it IS temporary — "Dagar's long-term vision spans multiple
        subjects and learner groups; the MVP focuses on Mathematics for Classes
        6–8" — so the first screen a learner ever sees was introducing the
        smallest true thing about the product.

        Purpose in the subtitle, scope in the line under it. The subtitle
        survives a new subject or a new class; only the small line moves. And
        "Starting with" rather than "Currently" or "Only": a journey has a
        starting point, which is the same idea the name carries.

        The scope line stays because it is load-bearing for the ADULT — a parent
        or teacher opening the link needs to know whether this covers their
        child's class before they sign anyone up.
      */}
      <header className="flex flex-col gap-sm">
        <h1 className="text-h1 text-ink">{t("login.title")}</h1>
        <p className="text-body-sm text-body">{t("login.subtitle")}</p>
        <p className="text-caption text-muted">{t("login.scope")}</p>
      </header>

      {error === "oauth" && (
        // A failed OAuth round-trip IS a system error, so this one is red.
        <p role="alert" className="text-body-sm text-error">
          {t("errors.generic")}
        </p>
      )}

      {/* A plain link, not fetch(): the route handler answers with a redirect to
          Google, and the browser has to follow it as a navigation. */}
      <a href="/api/auth/google" className={buttonClasses()}>
        {t("login.google")}
      </a>

      <div className="flex items-center gap-md" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        <span className="text-caption text-muted">{t("login.divider")}</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <EmailAuthForm next={destination} />

      {/* The only route into the parent flow. Without it /parent/claim is a URL
          nobody can reach: a parent arrives at the front door like everyone
          else, and the code is what tells us which door they wanted.
          Deliberately quiet — the overwhelming majority of arrivals are
          learners, and this must not compete with the primary path. */}
      <div className="flex flex-col items-center gap-xs">
        <a
          href="/parent/claim"
          className="min-h-11 inline-flex items-center text-body-sm text-primary-strong underline underline-offset-4"
        >
          {t("login.parentCode")}
        </a>
        {/* Beside it, not instead of it. A parent who already has a code wants
            the first link; a parent who does not yet know what any of this is
            wants the second, and making them guess between one link is how the
            second person leaves. */}
        <a
          href="/for-parents"
          className="min-h-11 inline-flex items-center text-body-sm text-body underline underline-offset-4"
        >
          {t("login.parentHow")}
        </a>
      </div>

      {/*
        WHAT WE KEEP, said before an account exists rather than after.

        Until 3 Aug this screen said nothing at all: no notice, no privacy page,
        no terms. For a product whose every user is 11–14 that is indefensible
        however careful the engineering behind it is — a learner, or the parent
        whose phone it is, could not find out what was collected even if they
        went looking.

        Deliberately one sentence and a link. A wall of policy text above the
        sign-in button would be read by nobody and would push the actual control
        below the fold, which is how disclosure becomes theatre.
      */}
      <p className="text-caption text-muted text-center text-balance">
        {t("login.privacyNotice")}{" "}
        <a
          href="/privacy"
          className="text-primary-strong underline underline-offset-4"
        >
          {t("login.privacyLink")}
        </a>
      </p>
    </main>
  );
}
