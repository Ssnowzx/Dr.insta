import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { and, eq, isNull } from 'drizzle-orm'
import { orm } from '../db/client.ts'
import { db } from '../db/connection.ts'
import { client, credentialToken, user } from '../db/schema.ts'
import { consumeToken, issueToken, resolveToken } from '../lib/tokens.ts'
import { ulid } from '../lib/ulid.ts'

/**
 * The credential-token lifecycle, against the real database.
 *
 * This is where a mistake hides best: a token that stays valid after use, or
 * one that survives its expiry, looks exactly like a working system until
 * someone replays an old link.
 */

const MARKER = 'tokens-test'
let userId = 0
let clientId = 0

beforeAll(async () => {
  process.env.APP_URL ??= 'http://localhost:3000'

  const now = new Date()
  const [c] = await orm().insert(client).values({
    publicCode: ulid(), slug: MARKER, name: 'Token test client',
    createdAt: now, updatedAt: now
  }).$returningId()
  clientId = c?.id ?? 0

  const [u] = await orm().insert(user).values({
    publicCode: ulid(), clientId, email: `${MARKER}@example.invalid`,
    name: 'Token test user', role: 'client', createdAt: now, updatedAt: now
  }).$returningId()
  userId = u?.id ?? 0
})

beforeEach(async () => {
  await orm().delete(credentialToken).where(eq(credentialToken.userId, userId))
})

afterAll(async () => {
  await orm().delete(user).where(eq(user.id, userId))
  await orm().delete(client).where(eq(client.id, clientId))
  await db().end()
})

describe('issueToken', () => {
  it('should resolve the token it just issued', async () => {
    // ARRANGE / ACT
    const issued = await issueToken(userId, 'invite')
    const holder = await resolveToken(issued.token, 'invite')

    // ASSERT
    expect(holder).not.toBeNull()
    expect(holder?.userId).toBe(userId)
  })

  it('should never store the raw token', async () => {
    // ARRANGE
    const issued = await issueToken(userId, 'invite')

    // ACT
    const rows = await orm()
      .select({ hash: credentialToken.tokenHash })
      .from(credentialToken)
      .where(eq(credentialToken.userId, userId))

    // ASSERT — a database dump must not hand anyone a usable link
    expect(rows[0]?.hash).not.toBe(issued.token)
    expect(rows[0]?.hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('should build a link on APP_URL without a double slash', async () => {
    // ARRANGE
    const before = process.env.APP_URL
    process.env.APP_URL = 'https://exemplo.com.br/'

    // ACT
    const issued = await issueToken(userId, 'invite')

    // ASSERT — a trailing slash in the env var must not produce `//convite`
    expect(issued.url).toBe(`https://exemplo.com.br/convite/${issued.token}`)
    process.env.APP_URL = before
  })

  it('should drop the previous unused token of the same purpose', async () => {
    // ARRANGE — otherwise asking for a second reset leaves the first one live,
    // and the point of a short expiry is that one path is open at a time
    const first = await issueToken(userId, 'reset')

    // ACT
    const second = await issueToken(userId, 'reset')

    // ASSERT
    expect(await resolveToken(first.token, 'reset')).toBeNull()
    expect(await resolveToken(second.token, 'reset')).not.toBeNull()
  })

  it('should keep tokens of different purposes side by side', async () => {
    // ARRANGE / ACT
    const invite = await issueToken(userId, 'invite')
    const reset = await issueToken(userId, 'reset')

    // ASSERT — issuing a reset must not silently cancel a pending invite
    expect(await resolveToken(invite.token, 'invite')).not.toBeNull()
    expect(await resolveToken(reset.token, 'reset')).not.toBeNull()
  })
})

describe('resolveToken', () => {
  it('should refuse a token used for the wrong purpose', async () => {
    // ARRANGE
    const issued = await issueToken(userId, 'invite')

    // ACT / ASSERT — an invite link must not work as a password reset
    expect(await resolveToken(issued.token, 'reset')).toBeNull()
  })

  it('should refuse an unknown token', async () => {
    // ARRANGE / ACT / ASSERT
    expect(await resolveToken('token-that-was-never-issued', 'invite')).toBeNull()
  })

  it('should refuse an empty token', async () => {
    // ARRANGE / ACT / ASSERT — an empty path segment must not match a row
    expect(await resolveToken('', 'invite')).toBeNull()
  })

  it('should refuse an expired token', async () => {
    // ARRANGE
    const issued = await issueToken(userId, 'invite')
    const afterExpiry = new Date(issued.expiresAt.getTime() + 1000)

    // ACT / ASSERT
    expect(await resolveToken(issued.token, 'invite', afterExpiry)).toBeNull()
  })

  it('should accept a token one second before expiry', async () => {
    // ARRANGE — guards the boundary in the other direction, so "expired" does
    // not quietly become "expires an hour early"
    const issued = await issueToken(userId, 'invite')
    const justBefore = new Date(issued.expiresAt.getTime() - 1000)

    // ACT / ASSERT
    expect(await resolveToken(issued.token, 'invite', justBefore)).not.toBeNull()
  })

  it('should refuse a token belonging to a deactivated user', async () => {
    // ARRANGE
    const issued = await issueToken(userId, 'invite')
    await orm().update(user).set({ active: 0 }).where(eq(user.id, userId))

    // ACT
    const holder = await resolveToken(issued.token, 'invite')

    // ASSERT
    expect(holder).toBeNull()
    await orm().update(user).set({ active: 1 }).where(eq(user.id, userId))
  })
})

describe('consumeToken', () => {
  it('should invalidate the token after use', async () => {
    // ARRANGE
    const issued = await issueToken(userId, 'invite')
    const holder = await resolveToken(issued.token, 'invite')

    // ACT
    const consumed = await consumeToken(holder?.tokenId ?? 0)

    // ASSERT — the whole point of single use: replaying the link does nothing
    expect(consumed).toBe(true)
    expect(await resolveToken(issued.token, 'invite')).toBeNull()
  })

  it('should let only the first of two attempts win', async () => {
    // ARRANGE — two requests redeeming the same link race on the same row.
    // Checking in application code and updating afterwards would let both set a
    // password.
    const issued = await issueToken(userId, 'invite')
    const holder = await resolveToken(issued.token, 'invite')
    const tokenId = holder?.tokenId ?? 0

    // ACT
    const results = await Promise.all([consumeToken(tokenId), consumeToken(tokenId)])

    // ASSERT
    expect(results.filter(Boolean)).toHaveLength(1)
  })

  it('should leave no unused token behind after consumption', async () => {
    // ARRANGE
    const issued = await issueToken(userId, 'reset')
    const holder = await resolveToken(issued.token, 'reset')

    // ACT
    await consumeToken(holder?.tokenId ?? 0)

    // ASSERT
    const pending = await orm()
      .select({ id: credentialToken.id })
      .from(credentialToken)
      .where(and(eq(credentialToken.userId, userId), isNull(credentialToken.usedAt)))

    expect(pending).toHaveLength(0)
  })
})
