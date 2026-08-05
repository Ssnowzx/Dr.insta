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

/** Single-use invite. Generous window: she may not open the email the same day. */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** Password reset. Short on purpose — it is a path to change a credential. */
export const RESET_TTL_MS = 60 * 60 * 1000

/** Length beats mandatory composition rules. */
export const MIN_PASSWORD_LENGTH = 12
