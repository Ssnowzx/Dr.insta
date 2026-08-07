import type { IgClient } from './client.ts'

/**
 * Reading a month of account metrics and turning it into rows.
 *
 * THE RULE THIS FILE EXISTS TO ENFORCE: never aggregate periods locally.
 *
 * `reach` counts unique accounts. Somebody who saw you on Monday and again on
 * Thursday is one account, not two, so seven days of reach added together is
 * not the reach of the week — it is a bigger number that looks entirely
 * plausible and is wrong. Nothing breaks, no test fails on its own, and the
 * funnel quietly reports an audience that does not exist.
 *
 * So every figure is asked of the API with the range it will be stored under.
 * That holds even for metrics that would add up correctly — views, likes,
 * saves — because one rule with no exceptions is a rule nobody has to remember
 * the exception to.
 *
 * Pure of I/O beyond the client it is handed, and free of the clock: the period
 * arrives as an argument.
 */

/** Account metrics we read, and what each becomes. */
const ACCOUNT_METRICS = [
  'reach', 'views', 'likes', 'comments', 'saves', 'shares', 'replies',
  'follows_and_unfollows', 'profile_links_taps', 'total_interactions'
] as const

type AccountMetric = typeof ACCOUNT_METRICS[number]

/** A value ready to be stored, already named in this project's vocabulary. */
export interface Collected {
  /** Matches `metric_def.metric_key`. */
  key: string
  value: number
}

/**
 * Direct correspondences. Anything not here is either derived below or has no
 * counterpart at all — `profile_visits` is the notable absence: it does not
 * exist as an account metric, only per media, so the funnel's second step keeps
 * coming from the manual export.
 */
const DIRECT: Partial<Record<AccountMetric, string>> = {
  reach: 'reach',
  views: 'views',
  /* The metric the current cycle turns on. Recorded as 0 since 30/07/2026
     because there was no tagged link in the bio; this is what will move. */
  profile_links_taps: 'bio_link_clicks',
  replies: 'story_replies',
  follows_and_unfollows: 'followers_net',
  shares: 'reel_shares'
}

/** Rates, all over reach — never over followers. */
const RATES: Array<{ from: AccountMetric; key: string }> = [
  { from: 'saves', key: 'saves_reach' },
  { from: 'shares', key: 'sends_reach' },
  { from: 'likes', key: 'likes_reach' },
  { from: 'comments', key: 'comments_reach' }
]

/** First and last instant of a calendar month, as UNIX seconds. */
export function monthRange (period: string): { since: number; until: number } {
  const [year, month] = period.split('-').map(Number) as [number, number]
  const since = Date.UTC(year, month - 1, 1, 0, 0, 0)
  /* Day 0 of the next month is the last day of this one. 23:59:59 and not
     midnight of the 1st, which the API would include in the range. */
  const until = Date.UTC(year, month, 0, 23, 59, 59)

  return { since: Math.floor(since / 1000), until: Math.floor(until / 1000) }
}

/**
 * Reads one month of account insights.
 *
 * Absence is preserved. A metric the API did not return produces no row at all,
 * rather than a zero — a fabricated zero on `bio_link_clicks` would read as an
 * experiment that failed, when the truth is that nothing was measured.
 */
export async function collectAccountMonth (
  client: IgClient,
  igUserId: string,
  period: string
): Promise<Collected[]> {
  const { since, until } = monthRange(period)

  const payload = await client.get(`${igUserId}/insights`, {
    metric: ACCOUNT_METRICS.join(','),
    period: 'day',
    metric_type: 'total_value',
    since: String(since),
    until: String(until)
  })

  const raw = readTotals(payload)
  const out: Collected[] = []

  for (const [metric, key] of Object.entries(DIRECT) as Array<[AccountMetric, string]>) {
    const value = raw.get(metric)
    if (value !== undefined) out.push({ key, value })
  }

  const reach = raw.get('reach')
  for (const { from, key } of RATES) {
    const numerator = raw.get(from)
    /* No reach means no denominator. A rate over an unknown base is not a
       smaller rate — it is not a rate. And a zero denominator is division by
       nothing, which would arrive on screen as Infinity. */
    if (numerator === undefined || reach === undefined || reach === 0) continue
    out.push({ key, value: numerator / reach })
  }

  return out
}

/**
 * Pulls `name` -> `total_value.value` out of the insights envelope.
 *
 * Hand-narrowed rather than cast: the shape belongs to someone else's server,
 * and an `as` here turns a changed response into a crash somewhere unrelated.
 * A metric present but without a value is treated as absent, which is what it
 * is.
 */
function readTotals (payload: unknown): Map<string, number> {
  const out = new Map<string, number>()

  if (typeof payload !== 'object' || payload === null) return out
  const data = (payload as Record<string, unknown>).data
  if (!Array.isArray(data)) return out

  for (const item of data) {
    if (typeof item !== 'object' || item === null) continue
    const record = item as Record<string, unknown>

    const name = record.name
    if (typeof name !== 'string') continue

    const total = record.total_value
    if (typeof total !== 'object' || total === null) continue

    const value = (total as Record<string, unknown>).value
    if (typeof value !== 'number' || !Number.isFinite(value)) continue

    out.set(name, value)
  }

  return out
}
