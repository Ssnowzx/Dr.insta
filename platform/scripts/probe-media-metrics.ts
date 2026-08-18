import { eq } from 'drizzle-orm'
import { orm } from '../db/client.ts'
import { db, waitForDatabase } from '../db/connection.ts'
import { client } from '../db/schema.ts'
import { createClient, IgAuthError, type IgClient } from '../lib/instagram/client.ts'
import { tokenFor } from '../lib/instagram/connection.ts'

/**
 * Asks the API what it is willing to answer, and writes nothing.
 *
 * TWO QUESTIONS, AND THEY ARE NOT THE SAME QUESTION
 *
 * 1. Does `follows` exist as a PER-MEDIA insight metric? If it does, follower
 *    conversion stops being typed in and becomes measured across the whole
 *    archive — `post.non_follower_pct` exists only because nothing measured it.
 *
 *    ANSWERED 18/08/2026, FOR REELS: no. `follows`, `profile_visits` and
 *    `profile_activity` all came back 400 — "The Media Insights API does not
 *    support the <metric> metric for this media product type" — while `reach`
 *    and `views` answered on the same media. The controls passing is what makes
 *    that a verdict about the metric rather than about the call.
 *
 *    ANSWERED 18/08/2026, FOR FEED: yes. The same three metrics answered on a
 *    carousel — `follows = 8`, `profile_visits = 199`, `profile_activity = 3` —
 *    while `ig_reels_*` was refused there instead. So the constraint is the
 *    PAIR, metric x surface, and neither one alone. Follower conversion is
 *    measurable on the feed and stays typed in on Reels, which is the surface
 *    this cycle actually runs on.
 *
 *    `--feed-sweep` reads the six that FEED answers on every feed post in the
 *    window, because one carousel is an anecdote and this project's rule is
 *    seven posts or fourteen days.
 *
 * 2. Does a Reel that is currently in a TRIAL show up on `/{ig-user-id}/media`?
 *    A trial is served only to non-followers and is not public, so it may not
 *    be listed at all. This script cannot answer that on its own — it prints
 *    the window and a human compares it against what she knows is in testing.
 *    RUN IT WHILE A TRIAL IS ACTIVE or question 2 gets no evidence either way.
 *
 * WHY ONE METRIC PER CALL
 *
 * The insights endpoint rejects the whole request when any single metric in the
 * list is invalid. Asking for ten at once and getting an error teaches nothing
 * about which nine were fine. One call per metric costs ~20 requests and
 * returns a per-metric verdict.
 *
 * `reach` and `views` are in the list as CONTROLS. They are known to work — the
 * daily sync reads them. If they fail here, the failure is the call, the token
 * or the media, and no conclusion about `follows` may be drawn from this run.
 *
 * Read-only: no INSERT, no UPDATE, nothing touches `post` or `metric_value`.
 *
 * Usage:
 *   npm run probe:media
 *   npm run probe:media -- --media 17912345678901234   # a specific media id
 *   npm run probe:media -- --limit 25
 *   npm run probe:media -- --feed-sweep              # every feed post, as a table
 */

/** Fields the media edge is known to accept — see `lib/instagram/media.ts`. */
const LIST_FIELDS = [
  'id', 'media_type', 'media_product_type', 'timestamp', 'permalink',
  'like_count', 'comments_count'
].join(',')

/**
 * What to ask for, one at a time.
 *
 * The first two are controls. The rest are the question: `follows` and
 * `profile_visits` are the two that would end the manual conversion figure,
 * and the others are here because a run that has already paid for the token
 * may as well map the whole surface.
 */
const CANDIDATE_METRICS = [
  'reach',
  'views',
  'follows',
  'profile_visits',
  'profile_activity',
  'total_interactions',
  'saved',
  'shares',
  'ig_reels_avg_watch_time',
  'ig_reels_video_view_total_time'
] as const

/**
 * What to read on every feed post, once the surface question is settled.
 *
 * Only the six that FEED answered on 18/08/2026, so the sweep costs one call
 * per metric instead of two and no line is padded with refusals already known.
 * `ig_reels_*` is absent for the same reason it is refused there: a carousel
 * is not a Reel.
 */
const FEED_SWEEP_METRICS = [
  'reach', 'views', 'follows', 'profile_visits', 'saved', 'shares'
] as const

interface MediaRow {
  id: string
  mediaType: string
  productType: string
  timestamp: string
  permalink: string
}

interface Verdict {
  metric: string
  /** How the API answered: available, refused, or available only with a flag. */
  state: 'ok' | 'ok_total_value' | 'unavailable'
  value: number | null
  detail: string | null
}

function arg (flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  if (i === -1) return undefined
  const value = process.argv[i + 1]
  return value === undefined || value.startsWith('--') ? undefined : value
}

/** Narrows the media page by hand: the shape belongs to someone else's server. */
function readMediaList (payload: unknown): MediaRow[] {
  if (typeof payload !== 'object' || payload === null) return []
  const data = (payload as Record<string, unknown>).data
  if (!Array.isArray(data)) return []

  const out: MediaRow[] = []
  for (const item of data) {
    if (typeof item !== 'object' || item === null) continue
    const row = item as Record<string, unknown>
    if (typeof row.id !== 'string') continue

    out.push({
      id: row.id,
      mediaType: typeof row.media_type === 'string' ? row.media_type : '?',
      productType: typeof row.media_product_type === 'string' ? row.media_product_type : '?',
      timestamp: typeof row.timestamp === 'string' ? row.timestamp : '?',
      permalink: typeof row.permalink === 'string' ? row.permalink : '—'
    })
  }

  return out
}

/**
 * The media to interrogate: the newest Reel AND the newest feed post.
 *
 * Two, because of how the API refused on 18/08/2026 — "does not support the
 * follows metric FOR THIS MEDIA PRODUCT TYPE". That wording says the refusal
 * is about REELS specifically, not about the metric existing at all, and a
 * probe that only ever asks a Reel can never tell those apart.
 *
 * A Reel is picked deliberately rather than just taking the first row: the
 * `ig_reels_*` metrics are refused on a photo, and half the list would come
 * back "unavailable" for a reason that has nothing to do with the question.
 */
function pickTargets (rows: MediaRow[]): MediaRow[] {
  const reel = rows.find(r => r.productType === 'REELS')
  const feed = rows.find(r => r.productType === 'FEED')
  const chosen = [reel, feed].filter((r): r is MediaRow => r !== undefined)

  /* Neither kind present: probe whatever is there rather than nothing. */
  if (chosen.length === 0) return rows.slice(0, 1)
  return chosen
}

/** A single number out of either insight envelope shape, or null. */
function readValue (payload: unknown): number | null {
  if (typeof payload !== 'object' || payload === null) return null
  const data = (payload as Record<string, unknown>).data
  if (!Array.isArray(data) || data.length === 0) return null

  const first = data[0]
  if (typeof first !== 'object' || first === null) return null
  const entry = first as Record<string, unknown>

  const total = entry.total_value
  if (typeof total === 'object' && total !== null) {
    const value = (total as Record<string, unknown>).value
    if (typeof value === 'number') return value
  }

  const values = entry.values
  if (Array.isArray(values) && values.length > 0) {
    const point = values[0]
    if (typeof point === 'object' && point !== null) {
      const value = (point as Record<string, unknown>).value
      if (typeof value === 'number') return value
    }
  }

  return null
}

function reason (error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Asks for one metric, twice if needed.
 *
 * The second attempt adds `metric_type=total_value`, which some metrics require
 * and others reject. Without it a metric that exists would be reported as
 * absent — the exact wrong answer, and the one that would kill a feature that
 * was in fact possible.
 */
async function probe (api: IgClient, mediaId: string, metric: string): Promise<Verdict> {
  try {
    const payload = await api.get(`${mediaId}/insights`, { metric })
    return { metric, state: 'ok', value: readValue(payload), detail: null }
  } catch (plain) {
    /* An auth failure is not a verdict about the metric — it ends the run. */
    if (plain instanceof IgAuthError) throw plain

    try {
      const payload = await api.get(`${mediaId}/insights`, {
        metric,
        metric_type: 'total_value'
      })
      return { metric, state: 'ok_total_value', value: readValue(payload), detail: null }
    } catch (withType) {
      if (withType instanceof IgAuthError) throw withType
      return { metric, state: 'unavailable', value: null, detail: reason(plain) }
    }
  }
}

const MARK: Record<Verdict['state'], string> = {
  ok: 'YES',
  ok_total_value: 'YES (needs metric_type=total_value)',
  unavailable: 'no '
}

/**
 * What one target's answers mean, said out loud rather than left to be inferred.
 *
 * Reported per target because the refusal is per media product type: `follows`
 * absent on a Reel and present on a feed post is a real possible outcome, and
 * one combined verdict would hide it.
 */
function conclude (target: MediaRow, verdicts: Verdict[]): void {
  const label = `${target.productType} ${target.id}`
  const controlsOk = verdicts
    .filter(v => v.metric === 'reach' || v.metric === 'views')
    .every(v => v.state !== 'unavailable')
  const follows = verdicts.find(v => v.metric === 'follows')

  if (!controlsOk) {
    console.log(
      `  ${label}: CONTROLS FAILED. \`reach\`/\`views\` are read by the daily sync,\n` +
      '  so their failure here means the call, the token or this media is the\n' +
      '  problem \u2014 draw no conclusion about `follows` from this run.\n'
    )
    return
  }

  if (follows !== undefined && follows.state !== 'unavailable') {
    console.log(
      `  ${label}: \`follows\` IS available. Follower conversion can be measured\n` +
      '  here instead of typed in \u2014 see post.non_follower_pct.\n'
    )
    return
  }

  console.log(
    `  ${label}: \`follows\` is NOT available. Conversion on this surface keeps\n` +
    '  depending on a number she types.\n'
  )
}

/**
 * Every feed post in the window, as one table.
 *
 * WHY THIS EXISTS: a single carousel answered `follows = 8` on 76.742 reach,
 * which is a startling rate and an n of 1. This project's own rule is seven
 * posts or fourteen days before a number becomes a reading, and the ids are
 * already on screen — so the sweep is the difference between an anecdote and
 * a measurement, at the cost of one more run.
 *
 * `follows/reach` is printed with its denominator beside it and NOT called a
 * conversion rate. Reach here mixes people who already follow her with people
 * who do not, and only the second group could have converted. The honest
 * denominator is non-follower reach, which no endpoint reports.
 */
async function feedSweep (api: IgClient, media: MediaRow[]): Promise<void> {
  const feed = media.filter(r => r.productType === 'FEED')

  console.log(`SWEEP \u2014 every FEED post in the window (${feed.length}):\n`)
  if (feed.length === 0) {
    console.log('  (none)\n')
    return
  }

  console.log(
    `  ${'date'.padEnd(12)}${'reach'.padStart(9)}${'views'.padStart(10)}` +
    `${'follows'.padStart(9)}${'visits'.padStart(8)}${'saved'.padStart(8)}` +
    `${'shares'.padStart(8)}   follows/reach`
  )

  let totalReach = 0
  let totalFollows = 0

  for (const row of feed) {
    const read = new Map<string, number | null>()
    for (const metric of FEED_SWEEP_METRICS) {
      const verdict = await probe(api, row.id, metric)
      read.set(metric, verdict.value)
    }

    const reach = read.get('reach') ?? null
    const follows = read.get('follows') ?? null
    const rate = reach !== null && reach > 0 && follows !== null
      ? `${(follows / reach * 100).toFixed(4)}%`
      : '\u2014'

    if (reach !== null) totalReach += reach
    if (follows !== null) totalFollows += follows

    console.log(
      `  ${row.timestamp.slice(0, 10).padEnd(12)}${cell(reach, 9)}${cell(read.get('views') ?? null, 10)}` +
      `${cell(follows, 9)}${cell(read.get('profile_visits') ?? null, 8)}` +
      `${cell(read.get('saved') ?? null, 8)}${cell(read.get('shares') ?? null, 8)}` +
      `   ${rate}`
    )
  }

  const pooled = totalReach > 0
    ? `${(totalFollows / totalReach * 100).toFixed(4)}%`
    : '\u2014'

  console.log(
    `\n  ${feed.length} post(s): ${totalFollows} follower(s) on ${totalReach} reach ` +
    `= ${pooled}\n` +
    '  Reach mixes followers and non-followers, so this is NOT the conversion\n' +
    '  rate \u2014 the honest denominator is non-follower reach and no endpoint\n' +
    '  reports it. It is comparable BETWEEN feed posts, which is the point.\n'
  )
}

/** Right-aligned cell; an absent number prints as a dash, never as zero. */
function cell (value: number | null, width: number): string {
  return (value === null ? '\u2014' : String(value)).padStart(width)
}

async function main (): Promise<void> {
  const slug = process.env.TENANT_SLUG?.trim()
  if (slug === undefined || slug === '') {
    console.error('\nTENANT_SLUG is not set. See .env.exemplo.\n')
    process.exitCode = 1
    return
  }

  const limit = Number(arg('--limit') ?? '25')
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    console.error('\n--limit must be an integer between 1 and 50.\n')
    process.exitCode = 1
    return
  }

  await waitForDatabase()

  const rows = await orm()
    .select({ id: client.id, name: client.name })
    .from(client)
    .where(eq(client.slug, slug))
    .limit(1)

  const found = rows[0]
  if (found === undefined) {
    console.error(`\nNo client with slug "${slug}".\n`)
    process.exitCode = 1
    return
  }

  const stored = await tokenFor(found.id)
  if (stored === null) {
    console.error(`\n${found.name}: no usable Instagram credential. Nothing to probe.\n`)
    process.exitCode = 1
    return
  }

  const api = createClient(stored.token)

  console.log(`\n${found.name} — probing media insights\n`)

  const page = await api.get(`${stored.igUserId}/media`, {
    fields: LIST_FIELDS,
    limit: String(limit)
  })
  const media = readMediaList(page)

  console.log(`QUESTION 2 — what /media lists right now (${media.length} item(s)):\n`)
  if (media.length === 0) console.log('  (nothing)')
  for (const row of media) {
    console.log(
      `  ${row.timestamp}  ${row.productType.padEnd(7)} ${row.mediaType.padEnd(15)} ` +
      `${row.id.padEnd(19)} ${row.permalink}`
    )
  }
  console.log(
    '\n  Compare this list against what she knows is in TRIAL right now.\n' +
    '  A trial that is running and absent here means the API cannot see it.\n' +
    '  If nothing is in trial today, this list proves nothing either way.\n'
  )

  if (process.argv.includes('--feed-sweep')) {
    await feedSweep(api, media)
    console.log(`  ${api.calls} API call(s). Nothing was written.\n`)
    return
  }

  const explicit = arg('--media')
  const targets = explicit === undefined
    ? pickTargets(media)
    : [{ id: explicit, mediaType: '?', productType: '?', timestamp: '?', permalink: '\u2014' }]

  if (targets.length === 0) {
    console.error('No media to probe. Stopping.\n')
    process.exitCode = 1
    return
  }

  const runs: Array<{ target: MediaRow; verdicts: Verdict[] }> = []

  for (const target of targets) {
    console.log(
      `QUESTION 1 \u2014 per-media metrics on ${target.id} ` +
      `(${target.productType}, ${target.timestamp}):\n`
    )

    const verdicts: Verdict[] = []
    for (const metric of CANDIDATE_METRICS) {
      const verdict = await probe(api, target.id, metric)
      verdicts.push(verdict)

      const value = verdict.value === null ? '' : `  = ${verdict.value}`
      console.log(`  ${MARK[verdict.state].padEnd(34)} ${metric}${value}`)
      if (verdict.detail !== null) console.log(`     ${verdict.detail}`)
    }

    console.log('')
    runs.push({ target, verdicts })
  }

  for (const { target, verdicts } of runs) conclude(target, verdicts)

  console.log(`  ${api.calls} API call(s). Nothing was written.\n`)
}

main()
  .catch((error: unknown) => {
    if (error instanceof IgAuthError) {
      console.error(`\nThe credential is no longer valid: ${error.message}`)
      console.error('She has to reconnect from Conta.\n')
    } else {
      console.error(`\nFailed: ${reason(error)}\n`)
    }
    process.exitCode = 1
  })
  .finally(() => { void db().end() })
