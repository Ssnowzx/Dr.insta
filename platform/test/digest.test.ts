import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { orm } from '../db/client.ts'
import { db } from '../db/connection.ts'
import {
  auditLog, client, delivery, instagramConnection, step, stepStatus, user
} from '../db/schema.ts'
import { clientDigestFor, digestFor } from '../lib/digest.ts'
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

/**
 * The broken Instagram connection.
 *
 * Its own describe because it breaks this file's central rule on purpose: every
 * other item is bounded by the window, and this one is not. A connection that
 * stopped working is a state, not an event — reporting it only on the day it
 * broke would let the single notice scroll away while the numbers go on not
 * arriving, which is indistinguishable from a quiet month.
 */
describe('digestFor and the Instagram connection', () => {
  const janela = (): [Date, Date] => [at('2026-03-10T00:00:00Z'), at('2026-03-11T00:00:00Z')]

  async function conectar (state: 'active' | 'expired' | 'failing' | 'revoked'): Promise<void> {
    const now = at('2026-01-01T00:00:00Z')
    await orm().insert(instagramConnection).values({
      publicCode: ulid(),
      clientId,
      igUserId: '17841400000000000',
      state,
      lastSyncAt: at('2026-03-01T00:00:00Z'),
      createdAt: now,
      updatedAt: now
    }).onDuplicateKeyUpdate({ set: { state, updatedAt: now } })
  }

  afterEach(async () => {
    await orm().delete(instagramConnection).where(eq(instagramConnection.clientId, clientId))
  })

  it('should say nothing when the connection is healthy', async () => {
    // ARRANGE
    await conectar('active')

    // ACT
    const digest = await digestFor(clientId, ...janela())

    // ASSERT — a warning that appears when nothing is wrong is a warning
    // that gets ignored when something is
    expect(digest?.connection).toEqual([])
    expect(digest?.total).toBe(0)
  })

  it('should say nothing when no account was ever connected', async () => {
    // ARRANGE — no row at all

    // ACT
    const digest = await digestFor(clientId, ...janela())

    // ASSERT
    expect(digest?.connection).toEqual([])
  })

  it('should report an expired credential as needing her', async () => {
    // ARRANGE
    await conectar('expired')

    // ACT
    const digest = await digestFor(clientId, ...janela())

    // ASSERT
    expect(digest?.connection).toHaveLength(1)
    expect(digest?.connection[0]?.detail).toContain('reconectar')
    expect(digest?.total).toBe(1)
  })

  it('should distinguish a failing collection from an expired credential', async () => {
    // ARRANGE
    await conectar('failing')

    // ACT
    const digest = await digestFor(clientId, ...janela())

    // ASSERT — telling him to have her reconnect would fix nothing here
    expect(digest?.connection[0]?.detail).not.toContain('reconectar')
    expect(digest?.connection[0]?.detail).toContain('coleta')
  })

  it('should report a connection that broke long before the window', async () => {
    // ARRANGE — broke in January, still broken in March
    await conectar('revoked')

    // ACT
    const digest = await digestFor(clientId, at('2026-03-10T00:00:00Z'), at('2026-03-11T00:00:00Z'))

    // ASSERT — the one thing here that outlives its own window
    expect(digest?.connection).toHaveLength(1)
  })

  it('should say how stale the numbers are', async () => {
    // ARRANGE
    await conectar('expired')

    // ACT
    const digest = await digestFor(clientId, ...janela())

    // ASSERT — the date decides what he does today, and it is not ISO on screen
    expect(digest?.connection[0]?.detail).toMatch(/\d{1,2} \w{3}/)
  })
})

/* `activeClientIds` is gone: the instance serves one client, resolved from
   `TENANT_SLUG` by `lib/tenant.ts`, so there is no list to walk. What replaced
   those two tests lives in `test/tenant.test.ts`. */

/**
 * Her side of the news.
 *
 * The rule that keeps this useful is the mirror of his: what SHE did is not
 * news to her. A digest that reports her own actions back to her is a digest
 * she learns to skip, and then the one that needed her is skipped too.
 */
describe('clientDigestFor', () => {
  const janela = (): [Date, Date] => [at('2026-03-10T00:00:00Z'), at('2026-03-11T00:00:00Z')]

  afterEach(async () => {
    await orm().delete(instagramConnection).where(eq(instagramConnection.clientId, clientId))
  })

  async function conectar (state: 'active' | 'expired' | 'failing'): Promise<void> {
    const now = at('2026-01-01T00:00:00Z')
    await orm().insert(instagramConnection).values({
      publicCode: ulid(), clientId, igUserId: '178414', state,
      lastSyncAt: at('2026-03-01T00:00:00Z'), createdAt: now, updatedAt: now
    }).onDuplicateKeyUpdate({ set: { state, updatedAt: now } })
  }

  it('should say nothing when nothing changed', async () => {
    // ARRANGE / ACT
    const dela = await clientDigestFor(clientId, at('2026-01-01T00:00:00Z'), at('2026-01-02T00:00:00Z'))

    // ASSERT
    expect(dela.total).toBe(0)
  })

  it('should tell her when the connection needs her', async () => {
    // ARRANGE
    await conectar('expired')

    // ACT
    const dela = await clientDigestFor(clientId, ...janela())

    // ASSERT — she is the only one who can renew it
    expect(dela.connection).toHaveLength(1)
  })

  it('should NOT tell her about a failure she cannot act on', async () => {
    // ARRANGE — the credential is fine; the collection is erroring
    await conectar('failing')

    // ACT
    const dela = await clientDigestFor(clientId, ...janela())

    // ASSERT — handing over worry with no action is what teaches her to
    // ignore the bell. That state belongs on his screen.
    expect(dela.connection).toEqual([])
    expect(dela.total).toBe(0)
  })

  it('should say nothing while the connection is healthy', async () => {
    // ARRANGE
    await conectar('active')

    // ACT
    const dela = await clientDigestFor(clientId, ...janela())

    // ASSERT
    expect(dela.connection).toEqual([])
  })

  it('should keep the two digests separate', async () => {
    // ARRANGE — she marked a step; that is news to him, not to her
    await markAt(clientUser, 'blocked', at('2026-03-10T14:00:00Z'), 'travou aqui')

    // ACT
    const dele = await digestFor(clientId, ...janela())
    const dela = await clientDigestFor(clientId, ...janela())

    // ASSERT
    expect(dele?.blocked).toHaveLength(1)
    expect(dela.total).toBe(0)
  })
})
