import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { and, eq } from 'drizzle-orm'
import { orm } from '../db/client.ts'
import { db } from '../db/connection.ts'
import { client, delivery, step, stepStatus, user } from '../db/schema.ts'
import { ulid } from '../lib/ulid.ts'

/**
 * `step_status`, against the real database.
 *
 * The server action itself needs a Next request context, so what is exercised
 * here is the table's contract — which is where the mistake would live. If the
 * unique key were on `step_id` alone, two people following the same delivery
 * would silently overwrite each other, and the symptom would be one of them
 * saying "I marked that" while the screen says otherwise.
 */

const MARK = 'step-status-test'
let clientId = 0
let otherClientId = 0
let userA = 0
let userB = 0
let stepId = 0
let deliveryId = 0

async function makeClient (slug: string, name: string): Promise<number> {
  const now = new Date()
  const [row] = await orm().insert(client).values({
    publicCode: ulid(), slug, name, createdAt: now, updatedAt: now
  }).$returningId()
  return row?.id ?? 0
}

beforeAll(async () => {
  const now = new Date()
  clientId = await makeClient(`${MARK}-a`, 'Cliente A')
  otherClientId = await makeClient(`${MARK}-b`, 'Cliente B')

  const mk = async (email: string, name: string): Promise<number> => {
    const [row] = await orm().insert(user).values({
      publicCode: ulid(), clientId, email, name, role: 'client',
      createdAt: now, updatedAt: now
    }).$returningId()
    return row?.id ?? 0
  }

  userA = await mk(`${MARK}-a@example.invalid`, 'Pessoa A')
  userB = await mk(`${MARK}-b@example.invalid`, 'Pessoa B')

  const [d] = await orm().insert(delivery).values({
    publicCode: ulid(), clientId, slug: MARK, title: 'Entrega de teste',
    kind: 'plan', createdAt: now, updatedAt: now
  }).$returningId()
  deliveryId = d?.id ?? 0

  const [s] = await orm().insert(step).values({
    deliveryId, clientId, code: 'a1', title: 'Etapa de teste',
    createdAt: now, updatedAt: now
  }).$returningId()
  stepId = s?.id ?? 0
})

beforeEach(async () => {
  await orm().delete(stepStatus).where(eq(stepStatus.stepId, stepId))
})

afterAll(async () => {
  await orm().delete(stepStatus).where(eq(stepStatus.stepId, stepId))
  await orm().delete(step).where(eq(step.id, stepId))
  await orm().delete(delivery).where(eq(delivery.id, deliveryId))
  await orm().delete(user).where(eq(user.id, userA))
  await orm().delete(user).where(eq(user.id, userB))
  await orm().delete(client).where(eq(client.id, clientId))
  await orm().delete(client).where(eq(client.id, otherClientId))
  await db().end()
})

async function mark (userId: number, state: 'pending' | 'done' | 'blocked', comment?: string) {
  const now = new Date()
  await orm().insert(stepStatus).values({
    stepId, userId, state, createdAt: now, updatedAt: now,
    ...(comment === undefined ? {} : { comment }),
    ...(state === 'done' ? { completedAt: now } : {})
  }).onDuplicateKeyUpdate({
    set: {
      state,
      comment: comment ?? null,
      updatedAt: now,
      completedAt: state === 'done' ? now : null
    }
  })
}

async function read (userId: number) {
  const rows = await orm()
    .select({
      state: stepStatus.state,
      comment: stepStatus.comment,
      completedAt: stepStatus.completedAt
    })
    .from(stepStatus)
    .where(and(eq(stepStatus.stepId, stepId), eq(stepStatus.userId, userId)))
    .limit(1)
  return rows[0]
}

describe('step_status', () => {
  it('should keep two users answers on the same step apart', async () => {
    // ARRANGE / ACT — the whole reason the unique key is (step_id, user_id)
    await mark(userA, 'done')
    await mark(userB, 'blocked', 'não achei onde troca')

    // ASSERT
    expect((await read(userA))?.state).toBe('done')
    expect((await read(userB))?.state).toBe('blocked')
    expect((await read(userB))?.comment).toBe('não achei onde troca')
  })

  it('should update rather than duplicate when the same user marks twice', async () => {
    // ARRANGE
    await mark(userA, 'done')

    // ACT
    await mark(userA, 'blocked', 'na verdade travou')

    // ASSERT
    const rows = await orm()
      .select({ id: stepStatus.id })
      .from(stepStatus)
      .where(and(eq(stepStatus.stepId, stepId), eq(stepStatus.userId, userA)))

    expect(rows).toHaveLength(1)
    expect((await read(userA))?.state).toBe('blocked')
  })

  it('should record the completion time when marked done', async () => {
    // ARRANGE / ACT
    await mark(userA, 'done')

    // ASSERT
    expect((await read(userA))?.completedAt).toBeInstanceOf(Date)
  })

  it('should clear the completion time when it stops being done', async () => {
    // ARRANGE — otherwise a step marked, unmarked and marked again keeps the
    // first completion date, and the timeline lies about when it happened
    await mark(userA, 'done')
    expect((await read(userA))?.completedAt).toBeInstanceOf(Date)

    // ACT
    await mark(userA, 'pending')

    // ASSERT
    expect((await read(userA))?.completedAt).toBeNull()
  })

  it('should clear the comment when a new mark carries none', async () => {
    // ARRANGE
    await mark(userA, 'blocked', 'travou por causa disso')

    // ACT — she solved it and marked done without writing anything
    await mark(userA, 'done')

    // ASSERT — a stale "what blocked me" on a done step would be misread as
    // still blocking
    expect((await read(userA))?.comment).toBeNull()
  })

  it('should refuse a state outside the three', async () => {
    // ARRANGE — the ENUM is the last line of defence if application code lets
    // an unexpected value through
    const bogus = orm().execute(
      `INSERT INTO step_status (step_id, user_id, state, created_at, updated_at)
       VALUES (${stepId}, ${userA}, 'concluido', NOW(), NOW())`
    )

    // ACT / ASSERT
    await expect(bogus).rejects.toThrow()
  })

  it('should remove the answers when the step is removed', async () => {
    // ARRANGE — CASCADE, so deleting a delivery does not leave orphan answers
    const now = new Date()
    const [s] = await orm().insert(step).values({
      deliveryId, clientId, code: 'zz', title: 'Etapa efêmera',
      createdAt: now, updatedAt: now
    }).$returningId()
    const efemera = s?.id ?? 0
    await orm().insert(stepStatus).values({
      stepId: efemera, userId: userA, state: 'done', createdAt: now, updatedAt: now
    })

    // ACT
    await orm().delete(step).where(eq(step.id, efemera))

    // ASSERT
    const restantes = await orm()
      .select({ id: stepStatus.id })
      .from(stepStatus)
      .where(eq(stepStatus.stepId, efemera))

    expect(restantes).toHaveLength(0)
  })
})
