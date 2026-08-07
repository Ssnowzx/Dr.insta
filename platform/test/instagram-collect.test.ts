import { describe, expect, it } from 'vitest'
import { createClient, IgAuthError, IgTransientError } from '../lib/instagram/client.ts'
import { collectAccountMonth, monthRange } from '../lib/instagram/collect.ts'

/**
 * Collection.
 *
 * Two failure modes are worth more than all the happy paths here: summing days
 * of `reach`, which produces a plausible number that is simply too big, and
 * turning an absent metric into a zero, which reads as an experiment that
 * failed rather than one that was not measured.
 */

/** A fake client that records what was asked for. */
function fakeClient (payload: unknown): { client: ReturnType<typeof createClient>; asked: URL[] } {
  const asked: URL[] = []
  const client = createClient('token', (async (input: string | URL) => {
    asked.push(new URL(String(input)))
    return { ok: true, status: 200, json: async () => payload }
  }) as unknown as typeof fetch)

  return { client, asked }
}

const insights = (valores: Record<string, number>): unknown => ({
  data: Object.entries(valores).map(([name, value]) => ({ name, total_value: { value } }))
})

describe('monthRange', () => {
  it('should cover the whole calendar month', () => {
    // ARRANGE / ACT
    const { since, until } = monthRange('2026-07-01')

    // ASSERT
    expect(new Date(since * 1000).toISOString()).toBe('2026-07-01T00:00:00.000Z')
    expect(new Date(until * 1000).toISOString()).toBe('2026-07-31T23:59:59.000Z')
  })

  it('should end on the last day of a short month', () => {
    // ARRANGE / ACT — February, and the API includes `until`
    const { until } = monthRange('2026-02-01')

    // ASSERT
    expect(new Date(until * 1000).toISOString()).toBe('2026-02-28T23:59:59.000Z')
  })

  it('should not spill into the next month', () => {
    // ARRANGE / ACT
    const { until } = monthRange('2026-12-01')

    // ASSERT — midnight on the 1st would pull a day of January into December
    expect(new Date(until * 1000).getUTCMonth()).toBe(11)
  })
})

describe('collectAccountMonth', () => {
  it('should ask the API for the range it will store, never summing days', async () => {
    // ARRANGE
    const { client, asked } = fakeClient(insights({ reach: 5413754 }))

    // ACT
    await collectAccountMonth(client, '178414', '2026-07-01')

    // ASSERT — reach counts unique accounts. Adding seven days of it gives a
    // number that looks right and is bigger than the truth, which is why the
    // range goes to the API and the addition never happens here.
    const url = asked[0]
    expect(url?.searchParams.get('since')).toBe(String(monthRange('2026-07-01').since))
    expect(url?.searchParams.get('until')).toBe(String(monthRange('2026-07-01').until))
  })

  it('should make exactly one request for the month', async () => {
    // ARRANGE
    const { client, asked } = fakeClient(insights({ reach: 100 }))

    // ACT
    await collectAccountMonth(client, '178414', '2026-07-01')

    // ASSERT — one call, not one per day
    expect(asked).toHaveLength(1)
    expect(client.calls).toBe(1)
  })

  it('should map bio link taps to the metric the cycle turns on', async () => {
    // ARRANGE — profile_links_taps is the criterion for experiment a1
    const { client } = fakeClient(insights({ reach: 1000, profile_links_taps: 47 }))

    // ACT
    const linhas = await collectAccountMonth(client, '178414', '2026-07-01')

    // ASSERT
    expect(linhas).toContainEqual({ key: 'bio_link_clicks', value: 47 })
  })

  it('should compute rates over reach and not over followers', async () => {
    // ARRANGE
    const { client } = fakeClient(insights({ reach: 1000, saves: 23, shares: 132, likes: 77 }))

    // ACT
    const linhas = await collectAccountMonth(client, '178414', '2026-07-01')
    const byKey = new Map(linhas.map(l => [l.key, l.value]))

    // ASSERT
    expect(byKey.get('saves_reach')).toBeCloseTo(0.023, 6)
    expect(byKey.get('sends_reach')).toBeCloseTo(0.132, 6)
    expect(byKey.get('likes_reach')).toBeCloseTo(0.077, 6)
  })

  it('should omit a metric the API did not return, never zero it', async () => {
    // ARRANGE — the whole month came back without profile_links_taps
    const { client } = fakeClient(insights({ reach: 1000 }))

    // ACT
    const linhas = await collectAccountMonth(client, '178414', '2026-07-01')

    // ASSERT — a fabricated zero here reads as "the experiment failed"
    expect(linhas.map(l => l.key)).not.toContain('bio_link_clicks')
  })

  it('should skip rates when there is no reach to divide by', async () => {
    // ARRANGE
    const { client } = fakeClient(insights({ saves: 23 }))

    // ACT
    const linhas = await collectAccountMonth(client, '178414', '2026-07-01')

    // ASSERT — a rate over an unknown base is not a smaller rate, it is not a rate
    expect(linhas.map(l => l.key)).not.toContain('saves_reach')
  })

  it('should not divide by a zero reach', async () => {
    // ARRANGE
    const { client } = fakeClient(insights({ reach: 0, saves: 5 }))

    // ACT
    const linhas = await collectAccountMonth(client, '178414', '2026-07-01')

    // ASSERT — Infinity would render as a number on her screen
    expect(linhas.map(l => l.key)).not.toContain('saves_reach')
    expect(linhas.every(l => Number.isFinite(l.value))).toBe(true)
  })

  it('should ignore entries with no usable value', async () => {
    // ARRANGE — a name with no total_value, which the envelope allows
    const { client } = fakeClient({ data: [{ name: 'reach' }, { name: 'views', total_value: {} }] })

    // ACT
    const linhas = await collectAccountMonth(client, '178414', '2026-07-01')

    // ASSERT
    expect(linhas).toEqual([])
  })

  it('should survive a response with no data at all', async () => {
    // ARRANGE
    const { client } = fakeClient({})

    // ACT
    const linhas = await collectAccountMonth(client, '178414', '2026-07-01')

    // ASSERT — nothing collected is a legitimate outcome, not a crash
    expect(linhas).toEqual([])
  })
})

describe('createClient error handling', () => {
  const responder = (status: number, body: unknown): typeof fetch =>
    (async () => ({ ok: false, status, json: async () => body })) as unknown as typeof fetch

  it('should treat an expired token as an auth failure', async () => {
    // ARRANGE
    const client = createClient('t', responder(400, {
      error: { code: 190, error_subcode: 463, message: 'Session has expired' }
    }))

    // ACT
    const act = async (): Promise<unknown> => await client.get('me')

    // ASSERT — this is the one she has to fix, and it must be said out loud
    await expect(act).rejects.toBeInstanceOf(IgAuthError)
  })

  it('should treat a permission refusal as an auth failure', async () => {
    // ARRANGE
    const client = createClient('t', responder(403, { error: { code: 200, message: 'Permissions error' } }))

    // ACT
    const act = async (): Promise<unknown> => await client.get('me')

    // ASSERT — retrying a refusal just refuses again
    await expect(act).rejects.toBeInstanceOf(IgAuthError)
  })

  it('should treat rate limiting as transient', async () => {
    // ARRANGE
    const client = createClient('t', responder(429, { error: { code: 4, message: 'rate limit' } }))

    // ACT
    const act = async (): Promise<unknown> => await client.get('me')

    // ASSERT — telling her to reconnect over this trains her to ignore the warning
    await expect(act).rejects.toBeInstanceOf(IgTransientError)
  })

  it('should treat a server error as transient', async () => {
    // ARRANGE
    const client = createClient('t', responder(500, {}))

    // ACT
    const act = async (): Promise<unknown> => await client.get('me')

    // ASSERT
    await expect(act).rejects.toBeInstanceOf(IgTransientError)
  })

  it('should treat a network failure as transient', async () => {
    // ARRANGE — we never reached anyone, so nobody refused us
    const client = createClient('t', (async () => { throw new Error('ECONNRESET') }) as unknown as typeof fetch)

    // ACT
    const act = async (): Promise<unknown> => await client.get('me')

    // ASSERT
    await expect(act).rejects.toBeInstanceOf(IgTransientError)
  })

  it('should never let a caller override the access token', async () => {
    // ARRANGE
    const asked: URL[] = []
    const client = createClient('token-real', (async (input: string | URL) => {
      asked.push(new URL(String(input)))
      return { ok: true, status: 200, json: async () => ({}) }
    }) as unknown as typeof fetch)

    // ACT
    await client.get('me', { access_token: 'outro' })

    // ASSERT
    expect(asked[0]?.searchParams.get('access_token')).toBe('token-real')
  })

  it('should count the calls it made', async () => {
    // ARRANGE
    const client = createClient('t', (async () => ({ ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch)

    // ACT — measured rather than assumed, so the rate limit can be answered with data
    await client.get('a')
    await client.get('b')

    // ASSERT
    expect(client.calls).toBe(2)
  })
})
