import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { orm } from '../db/client.ts'
import { db } from '../db/connection.ts'
import { client, delivery, deliverySection, step, user } from '../db/schema.ts'
import { deliveries, readingDeliveries } from '../lib/dashboard.ts'
import { ulid } from '../lib/ulid.ts'

/**
 * Deliveries that are done, and deliveries that are read.
 *
 * `deliveries()` used an INNER JOIN on `step`, which meant a delivery with no
 * steps did not exist for the product — no screen, no count, no summary. The
 * join was deciding what existed. These tests hold both halves of the fix: the
 * step-less delivery is now visible, AND the one with steps still assembles
 * them in order, which is the half a careless revert would take out.
 */

const MARK = 'entrega-test'
let clientId = 0
let userId = 0
let comEtapas = 0
let semEtapas = 0
let leitura = 0

beforeAll(async () => {
  const now = new Date()

  const [c] = await orm().insert(client).values({
    publicCode: ulid(), slug: MARK, name: 'Cliente da entrega',
    createdAt: now, updatedAt: now
  }).$returningId()
  clientId = c?.id ?? 0

  const [u] = await orm().insert(user).values({
    publicCode: ulid(), clientId, email: `${MARK}@example.invalid`,
    name: 'Pessoa', role: 'client', createdAt: now, updatedAt: now
  }).$returningId()
  userId = u?.id ?? 0

  const criar = async (slug: string, kind: 'plan' | 'analysis'): Promise<number> => {
    const [d] = await orm().insert(delivery).values({
      publicCode: ulid(), clientId, slug, title: `Entrega ${slug}`, kind,
      publishedAt: new Date('2026-08-13T12:00:00Z'), createdAt: now, updatedAt: now
    }).$returningId()
    return d?.id ?? 0
  }

  comEtapas = await criar(`${MARK}-com`, 'plan')
  semEtapas = await criar(`${MARK}-sem`, 'plan')
  leitura = await criar(`${MARK}-leitura`, 'analysis')

  /* Inserted out of order on purpose: the ordering has to come from `position`
     and not from whatever order the rows happened to be written in. */
  for (const [code, position] of [['b', 2], ['a', 1], ['c', 3]] as const) {
    await orm().insert(step).values({
      deliveryId: comEtapas, clientId, code: String(code),
      title: `Etapa ${String(code)}`, position, createdAt: now, updatedAt: now
    })
  }

  for (const [i, corpo] of ['primeiro', 'segundo'].entries()) {
    await orm().insert(deliverySection).values({
      deliveryId: leitura, position: i + 1, body: corpo,
      createdAt: now, updatedAt: now
    })
  }
})

afterAll(async () => {
  for (const id of [comEtapas, semEtapas, leitura]) {
    await orm().delete(step).where(eq(step.deliveryId, id))
    await orm().delete(deliverySection).where(eq(deliverySection.deliveryId, id))
    await orm().delete(delivery).where(eq(delivery.id, id))
  }
  await orm().delete(user).where(eq(user.id, userId))
  await orm().delete(client).where(eq(client.id, clientId))
  await db().end()
})

describe('deliveries', () => {
  it('should list a published delivery that has no steps', async () => {
    // ARRANGE — the whole point of dropping the INNER JOIN. An analysis has no
    // chores, and for months that meant it could not be rendered anywhere.
    // ACT
    const lista = await deliveries(clientId, userId)

    // ASSERT
    const achada = lista.find(d => d.id === semEtapas)
    expect(achada).toBeDefined()
    expect(achada?.steps).toEqual([])
  })

  it('should keep assembling steps in position order', async () => {
    // ARRANGE — the half a careless revert would break: the plan still needs
    // its steps, in the order the seed gave them
    // ACT
    const lista = await deliveries(clientId, userId)

    // ASSERT
    const achada = lista.find(d => d.id === comEtapas)
    expect(achada?.steps.map(s => s.code)).toEqual(['a', 'b', 'c'])
  })
})

describe('readingDeliveries', () => {
  it('should return sections in order', async () => {
    // ARRANGE / ACT
    const lista = await readingDeliveries(clientId)

    // ASSERT
    const achada = lista.find(d => d.id === leitura)
    expect(achada?.sections.map(s => s.body)).toEqual(['primeiro', 'segundo'])
  })

  it('should leave out a delivery that carries chores', async () => {
    // ARRANGE — a plan is not reading. Listing it here would put the checkbox
    // screen's content on the screen that exists to be read.
    // ACT
    const lista = await readingDeliveries(clientId)

    // ASSERT
    expect(lista.map(d => d.id)).not.toContain(comEtapas)
  })
})
