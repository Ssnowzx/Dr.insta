import 'server-only'
import { randomBytes } from 'node:crypto'
import { and, eq, isNull } from 'drizzle-orm'
import { orm } from '@/db/client'
import { credentialToken, user } from '@/db/schema'
import { digestToken } from './session.ts'
import { INVITE_TTL_MS, RESET_TTL_MS } from './constants.ts'

/**
 * Single-use tokens for invites and password resets.
 *
 * Invite and reset share one table because the mechanism is identical: a
 * single-use secret with an expiry. `purpose` tells them apart, and the two
 * lifetimes differ because the risks differ — an invite has to survive an inbox
 * being ignored for a few days, a reset is a live path to change a credential.
 *
 * Only the SHA-256 of the token is stored. The raw value exists exactly twice:
 * in the link that is sent, and in the request that redeems it.
 */

export type Purpose = 'invite' | 'reset'

const TTL: Record<Purpose, number> = {
  invite: INVITE_TTL_MS,
  reset: RESET_TTL_MS
}

export interface IssuedToken {
  token: string
  expiresAt: Date
  url: string
}

/**
 * Issues a token and returns the link to send.
 *
 * Any earlier unused token for the same purpose is dropped first. Without that,
 * asking for a second reset would leave the first one live — and the whole
 * point of a short expiry is that exactly one path is open at a time.
 */
export async function issueToken (
  userId: number,
  purpose: Purpose,
  now: Date = new Date()
): Promise<IssuedToken> {
  await orm()
    .delete(credentialToken)
    .where(and(
      eq(credentialToken.userId, userId),
      eq(credentialToken.purpose, purpose),
      isNull(credentialToken.usedAt)
    ))

  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(now.getTime() + TTL[purpose])

  await orm().insert(credentialToken).values({
    userId,
    tokenHash: digestToken(token),
    purpose,
    expiresAt,
    createdAt: now
  })

  const base = (process.env.APP_URL ?? '').replace(/\/+$/, '')
  const path = purpose === 'invite' ? 'convite' : 'nova-senha'

  return { token, expiresAt, url: `${base}/${path}/${token}` }
}

export interface TokenHolder {
  userId: number
  /** Null for a consultant. Carried so the audit row can be scoped to a client. */
  clientId: number | null
  role: 'consultant' | 'client'
  email: string
  name: string
  tokenId: number
}

/**
 * Resolves a raw token to its owner, or `null`.
 *
 * The lookup is by digest, so it hits the unique index — no scan, and no
 * comparison of secrets in application code. Expiry and prior use are checked
 * here rather than by the caller, because a caller that forgets is a caller
 * that accepts a token used last week.
 */
export async function resolveToken (
  raw: string,
  purpose: Purpose,
  now: Date = new Date()
): Promise<TokenHolder | null> {
  if (raw === '') return null

  const rows = await orm()
    .select({
      tokenId: credentialToken.id,
      expiresAt: credentialToken.expiresAt,
      usedAt: credentialToken.usedAt,
      userId: user.id,
      clientId: user.clientId,
      role: user.role,
      email: user.email,
      name: user.name,
      active: user.active
    })
    .from(credentialToken)
    .innerJoin(user, eq(user.id, credentialToken.userId))
    .where(and(
      eq(credentialToken.tokenHash, digestToken(raw)),
      eq(credentialToken.purpose, purpose)
    ))
    .limit(1)

  const row = rows[0]
  if (row === undefined) return null
  if (row.usedAt !== null) return null
  if (row.active !== 1) return null
  if (row.expiresAt.getTime() <= now.getTime()) return null

  return {
    userId: row.userId,
    clientId: row.clientId,
    role: row.role,
    email: row.email,
    name: row.name,
    tokenId: row.tokenId
  }
}

/**
 * Marks a token as spent.
 *
 * The `isNull(usedAt)` in the WHERE is what makes it single-use under
 * concurrency: two requests redeeming the same token race on the same row, and
 * only the one that finds it unused gets an affected row. Checking in
 * application code and updating afterwards would let both through.
 */
export async function consumeToken (tokenId: number, now: Date = new Date()): Promise<boolean> {
  const [result] = await orm()
    .update(credentialToken)
    .set({ usedAt: now })
    .where(and(eq(credentialToken.id, tokenId), isNull(credentialToken.usedAt)))

  return result.affectedRows === 1
}
