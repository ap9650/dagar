/**
 * A no-op stand-in for the `server-only` package, used by Vitest alone.
 *
 * `server-only` exists to make a BUILD fail if a server module is pulled into a
 * client bundle. It does that by throwing on import outside a server context —
 * which is correct in Next and wrong in a test runner, where importing a module
 * to test it is the whole point.
 *
 * Aliasing it here does not weaken the guarantee: the real package is still what
 * `next build` resolves, so a client component importing a server module still
 * fails the build. This only stops the guard firing in a process that has no
 * client bundle to protect.
 */
export {};
