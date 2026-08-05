import 'server-only'
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { eq, lt } from 'drizzle-orm'
import { orm } from '@/db/client'
import { session, user } from '@/db/schema'
import { SESSION_COOKIE, SESSION_TTL_MS } from './constants.ts'

/**
 * Sessions with an opaque token.
 *
 * The cookie carries 32 random bytes; the database stores only their SHA-256.
 * A database leak hands nobody a usable session, and revoking is deleting the
 * row \u2014 immediate, unlike a JWT that stays valid until it expires.
 *
 * Unsalted SHA-256 is right here, unlike for passwords: the token has 256 bits
 * of real entropy, so there is no dictionary and no table to precompute. Paying
 * for an Argon2 on every request would buy nothing.
 */

/** Renew when less than a third is left \u2014 avoids an UPDATE on every request. */
const RENEW_THRESHOLD_MS = SESSION_TTL_MS / 3

export interface Identity {
  userId: number
  clientId: number | null
  role: 'consultant' | 'client'
  name: string
  email: string
}

function digest (token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
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
    expires: expiresAt
  })
}

/**
 * Reads the session from the cookie and returns the identity, or `null`.
 *
 * Renews the expiry once two thirds have elapsed. Without that, the client
 * would be signed out on day 90 even while using the platform every week.
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

  const remaining = row.expiresAt.getTime() - now.getTime()
  if (remaining < SESSION_TTL_MS - RENEW_THRESHOLD_MS) {
    const newExpiry = new Date(now.getTime() + SESSION_TTL_MS)
    await orm()
      .update(session)
      .set({ expiresAt: newExpiry, usedAt: now })
      .where(eq(session.id, row.sessionId))

    const store = await cookies()
    store.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: isProduction(),
      sameSite: 'lax',
      path: '/',
      expires: newExpiry
    })
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
export { SESSION_COOKIE, SESSION_TTL_MS }
