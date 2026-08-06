/**
 * Dependency-free constants.
 *
 * This module exists because `proxy.ts` runs in a runtime that does not load
 * `server-only`, `next/headers` or the MySQL driver. Importing `lib/session.ts`
 * from there would drag all three in and break the build — so whatever both
 * sides need to know lives here.
 */

export const SESSION_COOKIE = 'session'

/** 90 days. She signs in once on her phone and stays signed in. */
export const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000

/**
 * How long the cookie itself lives — deliberately far longer than the session.
 *
 * The DATABASE ROW is the authority on whether a session is alive, and it is
 * the only thing that slides forward with use. The cookie is just the token's
 * envelope, and it is written ONCE, at sign-in.
 *
 * That split exists because a cookie can only be written from a Server Action
 * or a Route Handler. The old arrangement matched the cookie's expiry to the
 * session's and re-wrote it during renewal — which runs inside a page render,
 * where writing a cookie throws. Every request past the renewal threshold
 * became a 500.
 *
 * A cookie outliving its session is harmless: it resolves to nothing and the
 * request is treated as signed out. What is NOT harmless is the reverse — a
 * cookie that expires while its session is still valid signs her out with a
 * live session on the server, and nothing in the product could explain why.
 *
 * 400 days is the ceiling browsers enforce on cookie lifetime; asking for more
 * is silently clamped to it.
 */
export const SESSION_COOKIE_TTL_MS = 400 * 24 * 60 * 60 * 1000

/** Single-use invite. Generous window: she may not open the email the same day. */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** Password reset. Short on purpose — it is a path to change a credential. */
export const RESET_TTL_MS = 60 * 60 * 1000

/** Length beats mandatory composition rules. */
export const MIN_PASSWORD_LENGTH = 12
