import { requireAdmin } from "@/lib/security/adminGuard";

/**
 * Every page under `/admin` is guarded here, so no page added later can forget.
 *
 * This is the same shape as the `(learn)` and `(parent)` layouts — the route
 * layout is the enforcing boundary for pages, and `proxy.ts` only redirects
 * optimistically. Next's own docs are explicit that proxy must not be a
 * session-management or authorization solution, and `/admin` being in its
 * PROTECTED list buys a redirect for the signed-out, nothing more.
 *
 * Pages under here call `requireAdmin()` again. That is not belt and braces for
 * its own sake: `getCurrentUser` is request-cached, so the second call is free,
 * and it means a page cannot be moved out of this folder and quietly lose its
 * guard.
 *
 * No shared chrome, no nav, no wordmark. `/admin` is not part of the app a
 * learner uses and should not look like it — and there is nothing to link to
 * from here anyway.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return <>{children}</>;
}
