import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { ClaimCodeForm } from "@/components/parent/ClaimCodeForm";

/**
 * `/parent/claim` — an adult redeems the 6-character code their child read out.
 *
 * The layout above guarantees a signed-in user; everything else is decided here,
 * because this screen serves three different people:
 *
 *   a parent with no profile yet   → the form. Claiming creates the profile.
 *   a parent already linked        → send them to /parent; there is nothing to do
 *   a LEARNER who wandered in      → tell them, and send them home
 *
 * The third is not hypothetical: the invite is a link a learner might tap
 * themselves to see what a parent sees. Roles are exclusive — claiming would
 * flip their own profile and take their grade and dashboard with it — so the
 * route handler refuses it and this screen never offers it.
 */
export default async function ClaimPage() {
  const supabase = await createClient();
  const t = await getTranslations();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .maybeSingle();

  if (profile?.role === "student") redirect("/learn");

  if (profile?.role === "parent") {
    // Already a parent — but possibly of nobody yet, if a previous claim failed
    // halfway. Only send them on if they actually have a live link.
    const { count } = await supabase
      .from("parent_links")
      .select("id", { count: "exact", head: true })
      .eq("parent_id", user!.id)
      .eq("status", "active");

    if ((count ?? 0) > 0) redirect("/parent");
  }

  return (
    <main className="flex-1 w-full max-w-(--container-content) mx-auto px-lg py-3xl flex flex-col gap-xl">
      <header className="flex flex-col gap-sm">
        <h1 className="text-h1 text-ink">{t("parent.claimTitle")}</h1>
        <p className="text-body-sm text-body">{t("parent.claimBody")}</p>
      </header>

      <ClaimCodeForm />
    </main>
  );
}
