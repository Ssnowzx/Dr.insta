import { describe, expect, it } from 'vitest'
import { createClient } from '../lib/instagram/client.ts'
import { listRecentMedia, mediaInsights, retentionPct } from '../lib/instagram/media.ts'

/**
 * Per-post collection.
 *
 * The assertion that matters most is that `reach` never comes from `views`.
 * `test/import.test.ts` guards the public importer against that mistake; this
 * file guards the path that IS allowed to write reach, which is the one where
 * the confusion would be easiest to introduce and hardest to see.
 */

function fake (respostas: unknown[]): { client: ReturnType<typeof createClient>; asked: URL[] } {
  const asked: URL[] = []
  let i = 0
  const client = createClient('t', (async (input: string | URL) => {
    asked.push(new URL(String(input)))
    const body = respostas[Math.min(i, respostas.length - 1)]
    i += 1
    return { ok: true, status: 200, json: async () => body }
  }) as unknown as typeof fetch)

  return { client, asked }
}

const media = (over: Partial<{ igCode: string; publishedAt: Date; isReel: boolean }> = {}) => ({
  igCode: over.igCode ?? '1',
  publishedAt: over.publishedAt ?? new Date('2026-08-01T12:00:00Z'),
  isReel: over.isReel ?? true,
  permalink: null,
  caption: null,
  likes: null,
  comments: null
})

describe('mediaInsights', () => {
  it('should read reach from its own field', async () => {
    // ARRANGE
    const { client } = fake([{
      data: [
        { name: 'reach', total_value: { value: 41200 } },
        { name: 'views', total_value: { value: 98300 } }
      ]
    }])

    // ACT
    const insights = await mediaInsights(client, media())

    // ASSERT — two different counts: accounts, and plays including loops
    expect(insights.reach).toBe(41200)
    expect(insights.views).toBe(98300)
  })

  it('should leave reach null when the API did not report it', async () => {
    // ARRANGE — views present, reach absent: the exact shape that invites the bug
    const { client } = fake([{ data: [{ name: 'views', total_value: { value: 98300 } }] }])

    // ACT
    const insights = await mediaInsights(client, media())

    // ASSERT — every rate in this project divides by reach. Falling back to
    // views here would make each of them wrong, and nothing would look broken.
    expect(insights.reach).toBeNull()
    expect(insights.views).toBe(98300)
  })

  it('should never return a reach equal to views by accident', async () => {
    // ARRANGE
    const { client } = fake([{ data: [{ name: 'views', total_value: { value: 500 } }] }])

    // ACT
    const insights = await mediaInsights(client, media())

    // ASSERT — mirrors the assertion in test/import.test.ts
    expect(insights.reach).not.toBe(insights.views)
  })

  it('should read the older values[] shape too', async () => {
    // ARRANGE — media insights still answer this way for some metrics
    const { client } = fake([{ data: [{ name: 'saved', values: [{ value: 77 }] }] }])

    // ACT
    const insights = await mediaInsights(client, media())

    // ASSERT
    expect(insights.saves).toBe(77)
  })

  it('should ask for watch time only on reels', async () => {
    // ARRANGE
    const { client, asked } = fake([{ data: [] }, { data: [] }])

    // ACT
    await mediaInsights(client, media({ isReel: true }))
    await mediaInsights(client, media({ isReel: false }))

    // ASSERT — asking for a metric a media type does not have is an error response
    expect(asked[0]?.searchParams.get('metric')).toContain('ig_reels_avg_watch_time')
    expect(asked[1]?.searchParams.get('metric')).not.toContain('ig_reels_avg_watch_time')
  })
})

describe('listRecentMedia', () => {
  it('should stop at the window instead of walking the whole archive', async () => {
    // ARRANGE — 205 Reels live here; re-reading them daily would be 205 calls
    // for numbers that stopped moving months ago
    const { client } = fake([{
      data: [
        { id: 'novo', timestamp: '2026-08-05T12:00:00+0000', media_product_type: 'REELS' },
        { id: 'velho', timestamp: '2026-01-05T12:00:00+0000', media_product_type: 'REELS' }
      ],
      paging: { next: 'https://graph.instagram.com/v23.0/1/media?after=x' }
    }])

    // ACT
    const lista = await listRecentMedia(client, '1', new Date('2026-07-08T00:00:00Z'))

    // ASSERT
    expect(lista.map(m => m.igCode)).toEqual(['novo'])
    expect(client.calls).toBe(1)
  })

  it('should not paginate forever when everything is recent', async () => {
    // ARRANGE — a page that always says there is more
    const { client } = fake([{
      data: [{ id: 'a', timestamp: '2026-08-05T12:00:00+0000', media_product_type: 'REELS' }],
      paging: { next: 'https://graph.instagram.com/v23.0/1/media?after=x' }
    }])

    // ACT
    await listRecentMedia(client, '1', new Date('2026-01-01T00:00:00Z'), 3)

    // ASSERT — the cap is what keeps a runaway cursor from spending the quota
    expect(client.calls).toBe(3)
  })

  it('should not carry the access token into the next page request', async () => {
    // ARRANGE — Meta's `paging.next` arrives with the token embedded
    const { client, asked } = fake([
      {
        data: [{ id: 'a', timestamp: '2026-08-05T12:00:00+0000', media_product_type: 'REELS' }],
        paging: { next: 'https://graph.instagram.com/v23.0/1/media?after=x&access_token=ANTIGO' }
      },
      { data: [] }
    ])

    // ACT
    await listRecentMedia(client, '1', new Date('2026-01-01T00:00:00Z'), 2)

    // ASSERT — a stale token from a cursor would outlive a refresh
    expect(asked[1]?.searchParams.get('access_token')).toBe('t')
  })

  it('should mark reels apart from other media', async () => {
    // ARRANGE
    const { client } = fake([{
      data: [
        { id: 'r', timestamp: '2026-08-05T12:00:00+0000', media_product_type: 'REELS' },
        { id: 'f', timestamp: '2026-08-05T12:00:00+0000', media_product_type: 'FEED' }
      ]
    }])

    // ACT
    const lista = await listRecentMedia(client, '1', new Date('2026-01-01T00:00:00Z'))

    // ASSERT
    expect(lista.map(m => m.isReel)).toEqual([true, false])
  })

  it('should skip entries with an unusable timestamp', async () => {
    // ARRANGE
    const { client } = fake([{ data: [{ id: 'a', timestamp: 'não é data' }, { id: 'b' }] }])

    // ACT
    const lista = await listRecentMedia(client, '1', new Date('2026-01-01T00:00:00Z'))

    // ASSERT — a NaN date would compare false against every window and slip through
    expect(lista).toEqual([])
  })
})

describe('retentionPct', () => {
  it('should express watch time as a share of the duration', () => {
    // ARRANGE / ACT — 12s watched of a 30s Reel
    const pct = retentionPct(12000, 30)

    // ASSERT
    expect(pct).toBeCloseTo(0.4, 6)
  })

  it('should cap at one when people loop', () => {
    // ARRANGE / ACT — average watch time can exceed the video's length
    const pct = retentionPct(45000, 30)

    // ASSERT — "180% assistido" on screen reads as a bug, not as loops
    expect(pct).toBe(1)
  })

  it('should be null without a duration to divide by', () => {
    // ARRANGE / ACT / ASSERT
    expect(retentionPct(12000, null)).toBeNull()
    expect(retentionPct(12000, 0)).toBeNull()
  })

  it('should be null without watch time', () => {
    // ARRANGE / ACT / ASSERT
    expect(retentionPct(null, 30)).toBeNull()
  })
})
