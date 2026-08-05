import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { orm } from '../db/client.ts'
import { client, session, user } from '../db/schema.ts'
import { db } from '../db/connection.ts'
import { digestToken, purgeExpiredSessions, safeCompare } from '../lib/session.ts'

/**
 * The parts of session handling that do not depend on `cookies()`.
 *
 * `createSession` and `readSession` read and write a cookie, which needs a Next
 * request context \u2014 they are exercised end to end through the browser, not
 * here. What is tested here is what fails silently: the digest, the token
 * comparison and the expired-session sweep.
 */

const MARKER = 'session-test'
let userId = 0
let clientId = 0

beforeAll(async () => {
  const [c] = await orm().insert(client).values({
    publicCode: '01TEST00000000000000CLIEN',
    slug: MARKER,
    name: 'Test client',
    createdAt: new Date(),
    updatedAt: new Date()
  }).$returningId()
  clientId = c?.id ?? 0

  const [u] = await orm().insert(user).values({
    publicCode: '01TEST000000000000000USER',
    clientId,
    email: `${MARKER}@example.invalid`,
    name: 'Test user',
    role: 'client',
    createdAt: new Date(),
    updatedAt: new Date()
  }).$returningId()
  userId = u?.id ?? 0
})

afterAll(async () => {
  // CASCADE on session.user_id takes the sessions with it.
  await orm().delete(user).where(eq(user.id, userId))
  await orm().delete(client).where(eq(client.id, clientId))
  await db().end()
})

describe('digestToken', () => {
  it('should always produce the same digest for the same token', () => {
    // ARRANGE
    const token = 'some-token-to-check'

    // ACT
    const a = digestToken(token)
    const b = digestToken(token)

    // ASSERT
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })

  it('should produce different digests for different tokens', () => {
    // ARRANGE / ACT
    const a = digestToken('token-a')
    const b = digestToken('token-b')

    // ASSERT
    expect(a).not.toBe(b)
  })

  it('should fit the CHAR(64) column on the session table', () => {
    // ARRANGE / ACT \u2014 SHA-256 hex is exactly 64 characters
    const value = digestToken('a'.repeat(500))

    // ASSERT
    expect(value).toHaveLength(64)
  })
})

describe('safeCompare', () => {
  it('should accept identical strings', () => {
    // ARRANGE / ACT / ASSERT
    expect(safeCompare('abc123', 'abc123')).toBe(true)
  })

  it('should reject different strings of the same length', () => {
    // ARRANGE / ACT / ASSERT
    expect(safeCompare('abc123', 'abc124')).toBe(false)
  })

  it('should reject strings of different lengths without throwing', () => {
    // ARRANGE \u2014 timingSafeEqual throws when buffer lengths differ
    // ACT / ASSERT
    expect(safeCompare('short', 'considerably-longer')).toBe(false)
  })
})

describe('purgeExpiredSessions', () => {
  it('should remove the expired session and keep the valid one', async () => {
    // ARRANGE
    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    const expiredId = digestToken('expired-session')
    const validId = digestToken('valid-session')

    await orm().insert(session).values([
      { id: expiredId, userId, expiresAt: yesterday, createdAt: yesterday, usedAt: yesterday },
      { id: validId, userId, expiresAt: tomorrow, createdAt: now, usedAt: now }
    ])

    // ACT
    await purgeExpiredSessions(now)

    // ASSERT
    const remaining = await orm()
      .select({ id: session.id })
      .from(session)
      .where(eq(session.userId, userId))

    const ids = remaining.map(r => r.id)
    expect(ids).toContain(validId)
    expect(ids).not.toContain(expiredId)
  })
})
