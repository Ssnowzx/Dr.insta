import 'server-only'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { eq, lt } from 'drizzle-orm'
import { orm } from '@/db/client'
import { session, user } from '@/db/schema'
import { SESSION_COOKIE, SESSION_COOKIE_TTL_MS, SESSION_TTL_MS } from './constants.ts'
import { digestToken as digest } from './token-hash.ts'

/**
 * Sessions with an opaque token.
 *
 * The cookie carries 32 random bytes; the database stores only their SHA-256.
 * A database leak hands nobody a usable session, and revoking is deleting the
 * row — immediate, unlike a JWT that stays valid until it expires.
 *
 * Unsalted SHA-256 is right here, unlike for passwords: the token has 256 bits
 * of real entropy, so there is no dictionary and no table to precompute. Paying
 * for an Argon2 on every request would buy nothing.
 */

/**
 * A session slides forward once a third of its life has been spent. Waiting
 * that long is what keeps an UPDATE off every single request.
 *
 * The old comment here read "renew when less than a third is left", which was
 * backwards and hid how early this fires: with a 90-day session the renewal
 * starts on day 30, not day 60.
 */
const RENEW_AFTER_MS = SESSION_TTL_MS / 3

/**
 * Whether a session is far enough along to be pushed forward.
 *
 * Pure, and exported so the threshold can be pinned by a test: it is arithmetic
 * on two dates, and it was wrong in the comment for months without anyone
 * noticing, because nothing ever asserted it.
 */
export function precisaRenovar (expiresAt: Date, now: Date): boolean {
  const restante = expiresAt.getTime() - now.getTime()
  return restante < SESSION_TTL_MS - RENEW_AFTER_MS
}

export interface Identity {
  userId: number
  clientId: number | null
  role: 'consultant' | 'client'
  name: string
  email: string
}

/**
 * In production the cookie needs `Secure`; in development over plain HTTP,
 * `Secure` makes the browser drop the cookie silently and sign-in loops:
 * authenticate, redirect, ask for sign-in again.
 */
function isProduction (): boolean {
  return process.env.NODE_ENV === 'production'
}

export async function createSession (
  userId: number,
  context: { ip?: string; userAgent?: string } = {}
): Promise<void> {
  const token = randomBytes(32).toString('base64url')
  const now = new Date()
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS)

  await orm().insert(session).values({
    id: digest(token),
    userId,
    expiresAt,
    createdAt: now,
    usedAt: now,
    ...(context.ip === undefined ? {} : { ip: context.ip.slice(0, 45) }),
    ...(context.userAgent === undefined ? {} : { userAgent: context.userAgent.slice(0, 255) })
  })

  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax',
    path: '/',
    /* Not `expiresAt`. The cookie outlives the session on purpose — see
       `SESSION_COOKIE_TTL_MS`. This is the only place the cookie is ever
       written, which is what makes renewal safe inside a page render. */
    maxAge: Math.floor(SESSION_COOKIE_TTL_MS / 1000)
  })
}

/**
 * Reads the session from the cookie and returns the identity, or `null`.
 *
 * Slides the expiry forward once a third of the session has been spent, so
 * someone who uses the platform every week is never signed out on day 90. Only
 * the database row moves — see the comment on the renewal below.
 */
export async function readSession (): Promise<Identity | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (token === undefined || token === '') return null

  const now = new Date()
  const rows = await orm()
    .select({
      sessionId: session.id,
      expiresAt: session.expiresAt,
      userId: user.id,
      clientId: user.clientId,
      role: user.role,
      name: user.name,
      email: user.email,
      active: user.active
    })
    .from(session)
    .innerJoin(user, eq(user.id, session.userId))
    .where(eq(session.id, digest(token)))
    .limit(1)

  const row = rows[0]
  if (row === undefined) return null

  /* A deactivated user loses access immediately, without waiting for expiry. */
  if (row.active !== 1) return null

  if (row.expiresAt.getTime() <= now.getTime()) {
    await orm().delete(session).where(eq(session.id, row.sessionId))
    return null
  }

  /* Renewal touches the DATABASE ONLY.

     This runs inside a page render, and a page render may not write cookies —
     Next allows that from a Server Action or a Route Handler and nowhere else.
     The version of this block that also re-wrote the cookie threw on every
     request once a session passed the threshold, and the throw surfaced as a
     500 on every screen. An UPDATE is legal here; a Set-Cookie is not.

     Nothing is lost by dropping the cookie write: the cookie is issued once at
     sign-in with a lifetime far longer than any session, so it has no expiry to
     keep in step. See `SESSION_COOKIE_TTL_MS`. */
  if (precisaRenovar(row.expiresAt, now)) {
    await orm()
      .update(session)
      .set({ expiresAt: new Date(now.getTime() + SESSION_TTL_MS), usedAt: now })
      .where(eq(session.id, row.sessionId))
  }

  return {
    userId: row.userId,
    clientId: row.clientId,
    role: row.role,
    name: row.name,
    email: row.email
  }
}

export async function destroySession (): Promise<void> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value

  if (token !== undefined && token !== '') {
    await orm().delete(session).where(eq(session.id, digest(token)))
  }
  store.delete(SESSION_COOKIE)
}

/** Ends every session for a user. Used when the password changes. */
export async function destroyAllSessions (userId: number): Promise<void> {
  await orm().delete(session).where(eq(session.userId, userId))
}

/** Removes expired sessions. The table grows forever if nobody sweeps it. */
export async function purgeExpiredSessions (now = new Date()): Promise<void> {
  await orm().delete(session).where(lt(session.expiresAt, now))
}

/**
 * Constant-time comparison for invite and reset tokens.
 *
 * An index on the hash plus `===` is not enough here: the timing difference
 * between "wrong at the first character" and "wrong at the last" leaks the
 * correct prefix, one character per attempt.
 */
export function safeCompare (a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

export { digest as digestToken }
export { SESSION_COOKIE, SESSION_COOKIE_TTL_MS, SESSION_TTL_MS }
