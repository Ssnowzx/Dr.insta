import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { orm } from '../db/client.ts'
import { db } from '../db/connection.ts'
import { client, cycle, metricDef, metricValue } from '../db/schema.ts'
import { metrics } from '../lib/dashboard.ts'
import { ulid } from '../lib/ulid.ts'

/**
 * The duplicate card, proven against the database.
 *
 * `lib/precedencia.ts` is tested on its own, but the bug this prevents does not
 * live in the rule — it lives in the join. `metrics()` reaches `metric_value`
 * through a `leftJoin`, and a join that matches twice returns two rows for one
 * definition. Only a query against a real database shows that, so this test
 * writes both rows and counts the cards.
 *
 * It runs before the Instagram collection exists, deliberately: once collection
 * writes `api` over a month that was already transcribed, every measured metric
 * has two sources at once.
 */

const MARK = 'precedencia-test'
const PERIOD = '2026-07-01'

let clientId = 0
let cycleId = 0
let reachDefId = 0
let revenueDefId = 0

beforeAll(async () => {
  const now = new Date()

  const [c] = await orm().insert(client).values({
    publicCode: ulid(), slug: MARK, name: 'Cliente da precedência',
    niche: 'lifestyle', createdAt: now, updatedAt: now
  }).$returningId()
  clientId = c?.id ?? 0

  const [cy] = await orm().insert(cycle).values({
    publicCode: ulid(), clientId, title: 'Ciclo da precedência',
    startsOn: '2026-08-04', state: 'active', createdAt: now, updatedAt: now
  }).$returningId()
  cycleId = cy?.id ?? 0

  /* Two definitions, because the two collisions differ: `reach` is the one the
     API will contend with `insights` over, and `revenue` is the disagreement
     that already exists in the seeded database. */
  const [d1] = await orm().insert(metricDef).values({
    metricKey: `${MARK}-reach`, label: 'Alcance', unit: 'count', tier: 'monitor'
  }).$returningId()
  reachDefId = d1?.id ?? 0

  const [d2] = await orm().insert(metricDef).values({
    metricKey: `${MARK}-revenue`, label: 'Receita', unit: 'currency', tier: 'monitor'
  }).$returningId()
  revenueDefId = d2?.id ?? 0

  await orm().insert(metricValue).values([
    // Same metric, same period, two measured sources that disagree.
    {
      clientId, metricDefId: reachDefId, period: PERIOD, granularity: 'month',
      value: '5413754.000000', source: 'insights', createdAt: now, updatedAt: now
    },
    {
      clientId, metricDefId: reachDefId, period: PERIOD, granularity: 'month',
      value: '5418002.000000', source: 'api', createdAt: now, updatedAt: now
    },
    // The case already in the database: measured panel versus reported figure.
    {
      clientId, metricDefId: revenueDefId, period: PERIOD, granularity: 'month',
      value: '10583.280000', source: 'store', createdAt: now, updatedAt: now
    },
    {
      clientId, metricDefId: revenueDefId, period: PERIOD, granularity: 'month',
      value: '12700.000000', source: 'manual', createdAt: now, updatedAt: now
    }
  ])
})

afterAll(async () => {
  await orm().delete(metricValue).where(eq(metricValue.clientId, clientId))
  await orm().delete(metricDef).where(eq(metricDef.id, reachDefId))
  await orm().delete(metricDef).where(eq(metricDef.id, revenueDefId))
  await orm().delete(cycle).where(eq(cycle.id, cycleId))
  await orm().delete(client).where(eq(client.id, clientId))
  await db().end()
})

describe('metrics with two sources for the same period', () => {
  it('should return one card per definition, not one per row', async () => {
    // ARRANGE / ACT
    const cards = await metrics(clientId, cycleId, PERIOD, 'lifestyle')
    const reach = cards.filter(c => c.key === `${MARK}-reach`)

    // ASSERT — this is the whole point: two rows in, one card out
    expect(reach).toHaveLength(1)
  })

  it('should show the automatic source over the transcribed one', async () => {
    // ARRANGE / ACT
    const cards = await metrics(clientId, cycleId, PERIOD, 'lifestyle')
    const reach = cards.find(c => c.key === `${MARK}-reach`)

    // ASSERT
    expect(reach?.source).toBe('api')
    expect(reach?.value).toBe(5418002)
  })

  it('should carry the disagreement instead of dropping it', async () => {
    // ARRANGE / ACT
    const cards = await metrics(clientId, cycleId, PERIOD, 'lifestyle')
    const reach = cards.find(c => c.key === `${MARK}-reach`)

    // ASSERT — hiding the loser turns disagreement into false certainty
    expect(reach?.divergences).toHaveLength(1)
    expect(reach?.divergences[0]?.source).toBe('insights')
    expect(reach?.divergences[0]?.value).toBe(5413754)
  })

  it('should keep the reported figure out of the number shown', async () => {
    // ARRANGE / ACT
    const cards = await metrics(clientId, cycleId, PERIOD, 'lifestyle')
    const revenue = cards.find(c => c.key === `${MARK}-revenue`)

    // ASSERT — `manual` is not a measured source and never becomes the figure
    expect(revenue?.source).toBe('store')
    expect(revenue?.value).toBe(10583.28)
    expect(revenue?.divergences).toEqual([])
  })

  it('should not invent divergences for metrics with a single source', async () => {
    // ARRANGE / ACT
    const cards = await metrics(clientId, cycleId, PERIOD, 'lifestyle')
    const others = cards.filter(c => !c.key.startsWith(MARK))

    // ASSERT — every seeded metric has one source; none should look contested
    expect(others.every(c => c.divergences.length === 0)).toBe(true)
  })
})
