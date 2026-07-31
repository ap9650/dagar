import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * THE AUTH BOUNDARY for the parent routes — and note what it does NOT check.
 *
 * It requires a signed-in user and nothing more. It deliberately does not check
 * `role = 'parent'`, because `/parent/claim` lives under here and that screen's
 * whole job is to serve someone who has **no profile yet**: an adult who has
 * just created an account and is about to become a parent by redeeming a code.
 * A role check here would lock out the only route that can grant the role.
 *
 * So the role check lives on `/parent` itself, one level down, where it belongs.
 * Each page below states the condition it actually needs.
 *
 * And behind both: RLS. A parent with no `parent_links` row reads nothing,
 * whatever any layout does or fails to do.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export default async function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/parent");

  return <>{children}</>;
}
