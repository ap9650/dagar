"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/security/adminGuard";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Move a request out of the open queue.
 *
 * ── WHY A QUEUE NEEDS A WAY TO CLEAR ────────────────────────────────────────
 * D8 says status moves by hand, and for four days "by hand" meant a SQL client
 * nobody opened. A list that cannot be emptied stops being read within about a
 * week, and then a learner asking for help is invisible again for a different
 * reason than before.
 *
 * `requireAdmin()` runs here as well as in the layout. A server action is its
 * own entry point reachable by POST, and a guard on the page that rendered the
 * button protects the page, not the action.
 */

const schema = z.object({
  id: z.string().uuid(),
  status: z.enum(["acknowledged", "resolved"]),
});

export async function updateRequestStatus(formData: FormData) {
  await requireAdmin();

  const parsed = schema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) return;

  // Service role rather than the admin's own session: `mentor_requests` has no
  // policy granting an adult read or write across learners, and it should not.
  // The authorisation here is `requireAdmin`, not a row policy.
  await createAdminClient()
    .from("mentor_requests")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id);

  revalidatePath("/admin/requests");
}
