import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { orm } from '../db/client.ts'
import { db } from '../db/connection.ts'
import { auditLog, client, delivery, step, stepStatus, user } from '../db/schema.ts'
import { activeClientIds, digestFor } from '../lib/digest.ts'
import { ulid } from '../lib/ulid.ts'

/**
 * The daily summary.
 *
 * Two rules decide whether this feature works or gets filtered into oblivion:
 * a window with nothing in it must produce nothing, and the consultant's own
 * actions must never arrive as news about the client.
 */

const MARK = 'digest-test'
let clientId = 0
let clientUser = 0
let consultantUser = 0
let stepId = 0
let deliveryId = 0

const at = (iso: string): Date => new Date(iso)

beforeAll(async () => {
  const now = new Date()

  const [c] = await orm().insert(client).values({
    publicCode: ulid(), slug: MARK, name: 'Cliente do resumo',
    createdAt: now, updatedAt: now
  }).$returningId()
  clientId = c?.id ?? 0

  const [cu] = await orm().insert(user).values({
    publicCode: ulid(), clientId, email: `${MARK}-cliente@example.invalid`,
    name: 'Cliente Pessoa', role: 'client', createdAt: now, updatedAt: now
  }).$returningId()
  clientUser = cu?.id ?? 0

  const [su] = await orm().insert(user).values({
    publicCode: ulid(), email: `${MARK}-consultor@example.invalid`,
    name: 'Consultor Pessoa', role: 'consultant', createdAt: now, updatedAt: now
  }).$returningId()
  consultantUser = su?.id ?? 0

  const [d] = await orm().insert(delivery).values({
    publicCode: ulid(), clientId, slug: MARK, title: 'Entrega do resumo',
    kind: 'plan', createdAt: now, updatedAt: now
  }).$returningId()
  deliveryId = d?.id ?? 0

  const [s] = await orm().insert(step).values({
    deliveryId, clientId, code: 'a1', title: 'Etapa do resumo',
    createdAt: now, updatedAt: now
  }).$returningId()
  stepId = s?.id ?? 0
})

beforeEach(async () => {
  await orm().delete(stepStatus).where(eq(stepStatus.stepId, stepId))
})

afterAll(async () => {
  await orm().delete(auditLog).where(eq(auditLog.clientId, clientId))
  await orm().delete(stepStatus).where(eq(stepStatus.stepId, stepId))
  await orm().delete(step).where(eq(step.id, stepId))
  await orm().delete(delivery).where(eq(delivery.id, deliveryId))
  await orm().delete(user).where(eq(user.id, clientUser))
  await orm().delete(user).where(eq(user.id, consultantUser))
  await orm().delete(client).where(eq(client.id, clientId))
  await db().end()
})

async function markAt (userId: number, state: 'done' | 'blocked', when: Date, comment?: string) {
  await orm().insert(stepStatus).values({
    stepId, userId, state, createdAt: when, updatedAt: when,
    ...(comment === undefined ? {} : { comment })
  }).onDuplicateKeyUpdate({
    set: { state, updatedAt: when, comment: comment ?? null }
  })
}

describe('digestFor', () => {
  it('should report nothing for a window with no activity', async () => {
    // ARRANGE — the rule that keeps the summary out of a spam filter: one that
    // arrives every day regardless gets ignored, and then the one that mattered
    // is ignored with it
    // ACT
    const digest = await digestFor(clientId, at('2026-01-01T00:00:00Z'), at('2026-01-02T00:00:00Z'))

    // ASSERT
    expect(digest?.total).toBe(0)
  })

  it('should pick up a blocked step with its note', async () => {
    // ARRANGE — the item that actually changes what the consultant does today
    await markAt(clientUser, 'blocked', at('2026-03-10T14:00:00Z'), 'não achei onde troca')

    // ACT
    const digest = await digestFor(clientId, at('2026-03-10T00:00:00Z'), at('2026-03-11T00:00:00Z'))

    // ASSERT
    expect(digest?.blocked).toHaveLength(1)
    expect(digest?.blocked[0]?.detail).toBe('não achei onde troca')
    expect(digest?.done).toHaveLength(0)
  })

  it('should separate done from blocked', async () => {
    // ARRANGE
    await markAt(clientUser, 'done', at('2026-03-10T14:00:00Z'))

    // ACT
    const digest = await digestFor(clientId, at('2026-03-10T00:00:00Z'), at('2026-03-11T00:00:00Z'))

    // ASSERT
    expect(digest?.done).toHaveLength(1)
    expect(digest?.blocked).toHaveLength(0)
  })

  it('should ignore what the consultant did', async () => {
    // ARRANGE — the consultant marking something is not news about the client,
    // and reporting it back to him would be the platform telling him what he
    // just did
    await markAt(consultantUser, 'done', at('2026-03-10T14:00:00Z'))

    // ACT
    const digest = await digestFor(clientId, at('2026-03-10T00:00:00Z'), at('2026-03-11T00:00:00Z'))

    // ASSERT
    expect(digest?.total).toBe(0)
  })

  it('should exclude activity before the window', async () => {
    // ARRANGE
    await markAt(clientUser, 'done', at('2026-03-09T23:59:00Z'))

    // ACT
    const digest = await digestFor(clientId, at('2026-03-10T00:00:00Z'), at('2026-03-11T00:00:00Z'))

    // ASSERT
    expect(digest?.total).toBe(0)
  })

  it('should exclude activity at the exact end of the window', async () => {
    // ARRANGE — the upper bound is exclusive, so consecutive daily runs cannot
    // report the same event twice
    await markAt(clientUser, 'done', at('2026-03-11T00:00:00Z'))

    // ACT
    const digest = await digestFor(clientId, at('2026-03-10T00:00:00Z'), at('2026-03-11T00:00:00Z'))

    // ASSERT
    expect(digest?.total).toBe(0)
  })

  it('should include activity at the exact start of the window', async () => {
    // ARRANGE — the lower bound is inclusive, so nothing falls between two runs
    await markAt(clientUser, 'done', at('2026-03-10T00:00:00Z'))

    // ACT
    const digest = await digestFor(clientId, at('2026-03-10T00:00:00Z'), at('2026-03-11T00:00:00Z'))

    // ASSERT
    expect(digest?.total).toBe(1)
  })

  it('should surface someone who could not get in', async () => {
    // ARRANGE — with no reset email, a client who cannot sign in has no
    // self-service path. The attempt is recorded so it reaches this screen
    // instead of depending on her remembering to message him.
    await orm().insert(auditLog).values({
      action: 'asked_for_access',
      userId: clientUser,
      clientId,
      createdAt: at('2026-03-10T14:00:00Z')
    })

    // ACT
    const digest = await digestFor(clientId, at('2026-03-10T00:00:00Z'), at('2026-03-11T00:00:00Z'))

    // ASSERT
    expect(digest?.askedForAccess).toHaveLength(1)
    expect(digest?.total).toBe(1)

    await orm().delete(auditLog).where(eq(auditLog.clientId, clientId))
  })

  it('should return null for a client that does not exist', async () => {
    // ARRANGE / ACT / ASSERT
    expect(await digestFor(999999, at('2026-03-10T00:00:00Z'), at('2026-03-11T00:00:00Z')))
      .toBeNull()
  })
})

describe('activeClientIds', () => {
  it('should list a client that is not archived', async () => {
    // ARRANGE / ACT
    const ids = await activeClientIds()

    // ASSERT
    expect(ids).toContain(clientId)
  })

  it('should leave out an archived client', async () => {
    // ARRANGE — `isNull` and not `eq(column, null)`: in SQL nothing equals NULL,
    // so the equality form would match no rows and the digest would go out
    // about nobody
    await orm().update(client).set({ archivedAt: new Date() }).where(eq(client.id, clientId))

    // ACT
    const ids = await activeClientIds()

    // ASSERT
    expect(ids).not.toContain(clientId)
    await orm().update(client).set({ archivedAt: null }).where(eq(client.id, clientId))
  })
})
