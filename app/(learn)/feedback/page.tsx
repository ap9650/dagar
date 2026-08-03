import { getTranslations } from "next-intl/server";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { FeedbackForm, type FeedbackAnswers } from "@/components/learn/FeedbackForm";
import { BackLink } from "@/components/ui/BackLink";

/**
 * `/feedback` — what a real user thinks of Dagar (0018).
 *
 * Inside `(learn)`, so it is behind the auth layout. That is deliberate: to say
 * anything useful about a learning app you have to have used it, and using it
 * needs an account. A no-login form would collect "looks nice" from people who
 * never opened a lesson.
 *
 * It also means every response is attributable to a distinct real account,
 * which is the claim the submission makes — without the export ever carrying an
 * email address.
 *
 * Existing answers are loaded so returning here is an edit, not a second
 * opinion. `product_feedback` is unique on `user_id` and the route upserts.
 */
export default async function FeedbackPage() {
  const t = await getTranslations("productFeedback");
  const supabase = await createClient();

  const user = await getCurrentUser();

  // RLS scopes this to the caller's own row — the `.eq` is the belt to that
  // braces, not the boundary itself.
  const { data: existing } = await supabase
    .from("product_feedback")
    .select("respondent_role, understood, would_return, improve_most, worked_well, confusing")
    .eq("user_id", user!.id)
    .maybeSingle();

  return (
    <main className="flex-1 w-full max-w-(--container-content) mx-auto px-lg py-lg flex flex-col gap-xl">
      <header className="flex flex-col gap-lg">
        <BackLink href="/learn" label={t("back")} />
        <h1 className="text-h1 text-ink">{t("title")}</h1>
        <p className="text-body text-body">{t("intro")}</p>
      </header>

      <FeedbackForm initial={(existing as FeedbackAnswers | null) ?? null} />
    </main>
  );
}
