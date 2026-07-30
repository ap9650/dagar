import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * Runs as the SIGNED-IN USER, so every query is subject to RLS. That is the
 * point: this client is what makes the policies in supabase/migrations load
 * bearing. If a query returns nothing you did not expect, the answer is almost
 * always a policy — do not "fix" it by switching to the admin client.
 *
 * Never import this into a Client Component.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components cannot write cookies. This throw is expected and
            // safe to swallow *because* proxy.ts refreshes the session on every
            // request — see proxy.ts. If you ever remove that, sessions will
            // stop refreshing here silently.
          }
        },
      },
    },
  );
}

/**
 * The session, or null. Prefer this over calling `auth.getUser()` ad hoc so
 * there is one place to change if the shape ever moves.
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
