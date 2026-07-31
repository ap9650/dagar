import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { buttonClasses } from "@/components/ui/Button";
import { EmailAuthForm } from "@/components/auth/EmailAuthForm";
import { safeNextPath } from "@/lib/security/nextPath";

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

  return (
    <main className="flex-1 w-full max-w-(--container-content) mx-auto px-lg py-3xl flex flex-col gap-xl">
      <header className="flex flex-col gap-sm">
        <h1 className="text-h1 text-ink">{t("login.title")}</h1>
        <p className="text-body-sm text-body">{t("login.subtitle")}</p>
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
      <a
        href="/parent/claim"
        className="self-center min-h-11 inline-flex items-center text-body-sm text-primary-strong underline underline-offset-4"
      >
        {t("login.parentCode")}
      </a>
    </main>
  );
}
