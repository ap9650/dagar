import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * `/` — the splash. Renders nothing; it decides where you belong.
 *
 * Four outcomes (SCREENS.md Flow 1):
 *
 *   no session            → /welcome            language first, always
 *   session, no profile   → /onboarding/grade   finish signing up
 *   session, parent       → /parent
 *   session, student      → /learn              the returning-learner path
 *
 * A returning learner must never see the language picker again — they already
 * answered that question, and `/settings` is where it changes.
 */
export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/welcome");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/onboarding/grade");
  redirect(profile.role === "parent" ? "/parent" : "/learn");
}
