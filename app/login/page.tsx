import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { buttonClasses } from "@/components/ui/Button";
import { EmailAuthForm } from "@/components/auth/EmailAuthForm";

/**
 * `/login` — Google primary, email below a divider (D2).
 *
 * Already renders in the language chosen at `/welcome`, because the locale is in
 * a cookie by the time we get here — no account needed.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Signed in already: never show a login screen to someone who is logged in.
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile) redirect(profile.role === "parent" ? "/parent" : "/learn");
    redirect("/onboarding/grade");
  }

  const t = await getTranslations();
  const { error } = await searchParams;

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

      <EmailAuthForm />
    </main>
  );
}
