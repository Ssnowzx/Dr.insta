import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { orm } from '../db/client.ts'
import { db } from '../db/connection.ts'
import { client, metricDef, metricValue } from '../db/schema.ts'
import { latestPeriod, metrics } from '../lib/dashboard.ts'
import { ulid } from '../lib/ulid.ts'

/**
 * Which month the panel shows, once a metric is filed by DAY.
 *
 * `escolherPeriodo` is tested on its own and was never wrong. The defect lived
 * in the query underneath it: it read every period in `metric_value` regardless
 * of granularity, so the first `followers_total` row — 2026-08-20 — became the
 * newest "period" in the table. The panel switched to that date, found no
 * monthly metric under it, and rendered the cycle with no cards at all: no
 * north star, no guard-rails, no funnel. It shipped, and it was caught by
 * looking at the page rather than by any test.
 *
 * The second case here is the one that would have come back a fortnight later:
 * on the first of any month a day row and a month row share a period string.
 */

const MARK = 'periodo-dia-test'

let clientId = 0
let reachDefId = 0
let totalDefId = 0

beforeAll(async () => {
  const now = new Date()

  const [c] = await orm().insert(client).values({
    publicCode: ulid(), slug: MARK, name: 'Cliente do período',
    niche: 'lifestyle', createdAt: now, updatedAt: now
  }).$returningId()
  clientId = c?.id ?? 0

  const [d1] = await orm().insert(metricDef).values({
    metricKey: `${MARK}-reach`, label: 'Alcance', unit: 'count', tier: 'monitor'
  }).$returningId()
  reachDefId = d1?.id ?? 0

  const [d2] = await orm().insert(metricDef).values({
    metricKey: `${MARK}-total`, label: 'Seguidores', unit: 'count', tier: 'monitor'
  }).$returningId()
  totalDefId = d2?.id ?? 0

  await orm().insert(metricValue).values([
    /* Two closed months, and a daily total newer than both. */
    {
      clientId, metricDefId: reachDefId, period: '2026-07-01', granularity: 'month',
      value: '5584671.000000', source: 'api', createdAt: now, updatedAt: now
    },
    {
      clientId, metricDefId: reachDefId, period: '2026-08-01', granularity: 'month',
      value: '3154875.000000', source: 'api', createdAt: now, updatedAt: now
    },
    {
      clientId, metricDefId: totalDefId, period: '2026-08-20', granularity: 'day',
      value: '715517.000000', source: 'api', createdAt: now, updatedAt: now
    },
    /* The collision: a day row on the first of a month. */
    {
      clientId, metricDefId: totalDefId, period: '2026-08-01', granularity: 'day',
      value: '714000.000000', source: 'api', createdAt: now, updatedAt: now
    }
  ])
})

afterAll(async () => {
  await orm().delete(metricValue).where(eq(metricValue.clientId, clientId))
  await orm().delete(metricDef).where(eq(metricDef.id, reachDefId))
  await orm().delete(metricDef).where(eq(metricDef.id, totalDefId))
  await orm().delete(client).where(eq(client.id, clientId))
  await db().end()
})

describe('latestPeriod', () => {
  it('should ignore a daily row when choosing the month to show', async () => {
    // ARRANGE / ACT — August is the running month, so July is the answer
    const periodo = await latestPeriod(clientId, new Date('2026-08-20T12:00:00Z'))

    // ASSERT — 2026-08-20 is newer than both months and is not a month
    expect(periodo).toBe('2026-07-01')
  })

  it('should not read a daily value as the month it happens to start', async () => {
    // ARRANGE / ACT — 2026-08-01 exists at both granularities
    const cartoes = await metrics(clientId, 0, '2026-08-01', 'lifestyle')

    // ASSERT — the follower total must not arrive as August's figure
    const total = cartoes.find(m => m.key === `${MARK}-total`)
    expect(total?.value ?? null).toBeNull()
  })
})
