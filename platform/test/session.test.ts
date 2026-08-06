import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { orm } from '../db/client.ts'
import { client, session, user } from '../db/schema.ts'
import { db } from '../db/connection.ts'
import { digestToken, precisaRenovar, purgeExpiredSessions, safeCompare } from '../lib/session.ts'
import { SESSION_COOKIE_TTL_MS, SESSION_TTL_MS } from '../lib/constants.ts'

/**
 * The parts of session handling that do not depend on `cookies()`.
 *
 * `createSession` and `readSession` read and write a cookie, which needs a Next
 * request context — they are exercised end to end through the browser, not
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
    // ARRANGE / ACT — SHA-256 hex is exactly 64 characters
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
    // ARRANGE — timingSafeEqual throws when buffer lengths differ
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

const DIA = 24 * 60 * 60 * 1000

/**
 * When a session slides forward, and why the cookie must outlive it.
 *
 * This is the arithmetic behind a bug that took the whole product down: the
 * renewal ran inside a page render and re-wrote the cookie there, which Next
 * forbids, so every request past the threshold answered 500. Nothing asserted
 * the threshold, and the comment describing it was backwards for months —
 * "renew when less than a third is left" when it renews with less than two
 * thirds left. That is why these cases exist.
 */
describe('precisaRenovar', () => {
  const agora = new Date('2026-08-06T12:00:00Z')
  const daquiA = (ms: number): Date => new Date(agora.getTime() + ms)

  it('should not renew a session that has just been created', () => {
    // ARRANGE / ACT / ASSERT — a full TTL remaining is as fresh as it gets
    expect(precisaRenovar(daquiA(SESSION_TTL_MS), agora)).toBe(false)
  })

  it('should renew once a third of the session has been spent', () => {
    // ARRANGE — 90-day session: renewal starts on day 30, which is EARLIER
    // than the old comment implied. The number matters because it is how soon
    // the failure it used to cause reached a real person.
    const umDiaAntes = daquiA(SESSION_TTL_MS - 30 * DIA + 60_000)
    const logoDepois = daquiA(SESSION_TTL_MS - 30 * DIA - 60_000)

    // ACT / ASSERT
    expect(precisaRenovar(umDiaAntes, agora)).toBe(false)
    expect(precisaRenovar(logoDepois, agora)).toBe(true)
  })

  it('should renew a session close to running out', () => {
    // ARRANGE / ACT / ASSERT
    expect(precisaRenovar(daquiA(DIA), agora)).toBe(true)
  })

  it('should renew a session that already expired', () => {
    // ARRANGE — the caller deletes it before ever asking, but the predicate
    // must not answer "no renewal needed" for a negative remainder
    // ACT / ASSERT
    expect(precisaRenovar(daquiA(-DIA), agora)).toBe(true)
  })
})

describe('a vida do cookie contra a da sessão', () => {
  it('should outlive any session by a wide margin', () => {
    // ARRANGE — the cookie is written once, at sign-in, and never again: the
    // renewal cannot touch it from inside a page render. So it must never be
    // the thing that expires first, or she is signed out while the server
    // still holds a valid session and no screen can explain why.
    // ACT / ASSERT
    expect(SESSION_COOKIE_TTL_MS).toBeGreaterThan(SESSION_TTL_MS * 4)
  })

  it('should stay inside the ceiling browsers enforce', () => {
    // ARRANGE — anything past 400 days is silently clamped, and a constant
    // that lies about its own effect is worse than a smaller one
    // ACT / ASSERT
    expect(SESSION_COOKIE_TTL_MS).toBeLessThanOrEqual(400 * DIA)
  })
})
