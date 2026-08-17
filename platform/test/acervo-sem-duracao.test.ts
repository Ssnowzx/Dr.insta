import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { orm } from '../db/client.ts'
import { db } from '../db/connection.ts'
import { client, post } from '../db/schema.ts'
import { postCounts, posts } from '../lib/dashboard.ts'
import { ulid } from '../lib/ulid.ts'

/**
 * A post whose length nobody knows.
 *
 * The Instagram media edge reports no duration — not on the media itself and
 * not in any insight metric — so every post the collector creates arrives with
 * `duration_sec` NULL. That is new: until 17/08/2026 the archive grew only
 * through the public export, which always carries duration, and both chips
 * added up to the total by accident of the data rather than by design.
 *
 * The failure this guards against is silent by construction. A post outside
 * BOTH sides of the "<=20s against 90s+" cut simply stops being counted, on the
 * one screen the cycle's whole thesis is read from — and the screen would look
 * perfectly consistent while covering less and less of what she publishes.
 */

const MARK = 'acervo-sem-duracao'
let clientId = 0

beforeAll(async () => {
  const now = new Date()

  const [c] = await orm().insert(client).values({
    publicCode: ulid(), slug: MARK, name: 'Cliente do acervo',
    createdAt: now, updatedAt: now
  }).$returningId()
  clientId = c?.id ?? 0

  const criar = async (
    igCode: string,
    durationSec: number | null,
    mentionsBrand: number
  ): Promise<void> => {
    await orm().insert(post).values({
      clientId, igCode, kind: 'reel',
      publishedAt: new Date('2026-08-15T12:00:00Z'),
      durationSec, mentionsBrand,
      views: 1000,
      provenance: durationSec === null ? 'insights' : 'public',
      createdAt: now, updatedAt: now
    })
  }

  await criar(`${MARK}-curto`, 12, 0)
  await criar(`${MARK}-longo`, 95, 0)
  /* The one the collector would create: measured, and with no length. */
  await criar(`${MARK}-sem-a`, null, 0)
  await criar(`${MARK}-sem-b`, null, 1)
})

afterAll(async () => {
  await orm().delete(post).where(eq(post.clientId, clientId))
  await orm().delete(client).where(eq(client.id, clientId))
  await db().end()
})

describe('postCounts with unknown durations', () => {
  it('should count them apart rather than lose them', async () => {
    // ARRANGE / ACT
    const contas = await postCounts(clientId)

    // ASSERT
    expect(contas.total).toBe(4)
    expect(contas.semDuracao).toBe(2)
  })

  it('should NOT fold an unknown duration into either side of the cut', async () => {
    // ARRANGE — the temptation is to treat null as long, or as short. Both are
    // guesses, and the cut they would land in is the one the cycle is decided
    // by: short converts worst, long converts 41x better.
    // ACT
    const contas = await postCounts(clientId)

    // ASSERT
    expect(contas.curtos).toBe(1)
    expect(contas.longos).toBe(1)
  })

  it('should leave the two chips deliberately not adding up to the total', async () => {
    // ARRANGE — this is the assertion that documents the design. If someone
    // "fixes" the arithmetic by bucketing nulls, this fails and says why.
    // ACT
    const contas = await postCounts(clientId)

    // ASSERT
    expect(contas.curtos + contas.longos).toBeLessThan(contas.total)
    expect(contas.curtos + contas.longos + contas.semDuracao).toBe(contas.total)
  })

  it('should count the unknowns inside the brand cut, like the other chips', async () => {
    // ARRANGE — every chip is counted inside the other axis's current cut, so
    // the three of them always describe the same slice
    // ACT
    const contas = await postCounts(clientId, { brand: 'marca' })

    // ASSERT — only `-sem-b` mentions the brand
    expect(contas.semDuracao).toBe(1)
  })

  it('should still list a post with no duration', async () => {
    // ARRANGE — it is excluded from the duration FILTER, which is honest,
    // but it must never disappear from the unfiltered archive
    // ACT
    const lista = await posts(clientId)

    // ASSERT
    expect(lista.map(p => p.igCode)).toContain(`${MARK}-sem-a`)
  })

  it('should keep a post with no duration out of a duration filter', async () => {
    // ARRANGE / ACT — "até 20s" must mean measured at 20s or less, not
    // "everything I could not rule out"
    const curtos = await posts(clientId, { duration: 'curto' })

    // ASSERT
    expect(curtos.map(p => p.igCode)).toEqual([`${MARK}-curto`])
  })
})
