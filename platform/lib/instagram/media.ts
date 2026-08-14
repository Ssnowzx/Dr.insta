import type { IgClient } from './client.ts'

/**
 * Per-post insights.
 *
 * THE INVARIANT THIS MUST NOT BREAK: `reach` is never derived from `views`.
 *
 * The public export carries `views`, which counts every loop of a video, and
 * `test/import.test.ts` asserts that a post whose provenance is `public` has no
 * reach at all. That rule exists because every rate in this project divides by
 * reach — a `views` copied into `reach` would make every percentage wrong and
 * nothing would look broken.
 *
 * This file is allowed to write `reach`, and that is not a loosening of the
 * rule: the number comes from `/{media}/insights`, which is the real thing.
 * What it must never do is fill the column from the `views` it also reads. The
 * two arrive as separate fields and stay separate.
 *
 * A post touched here becomes `mixed` — public counts plus measured insights —
 * or `insights` when it had no public numbers to begin with.
 */

/** How far back to fetch insights. Older posts no longer move. */
export const WINDOW_DAYS = 30

/** Fields worth reading off the media list itself. */
const MEDIA_FIELDS = [
  'id', 'media_type', 'media_product_type', 'timestamp', 'permalink',
  'caption', 'like_count', 'comments_count'
].join(',')

/**
 * Insight metrics per post.
 *
 * `views` is here alongside `reach` precisely so the difference is visible at
 * the point of use: one counts plays, the other counts accounts.
 */
const MEDIA_METRICS = ['reach', 'views', 'saved', 'shares', 'likes', 'comments'].join(',')
const REEL_METRICS = [...MEDIA_METRICS.split(','), 'ig_reels_avg_watch_time'].join(',')

export interface MediaSummary {
  /** The API's own media id. What `/{id}/insights` needs, and nothing else. */
  igCode: string
  /**
   * The shortcode out of the permalink — `Db0cDD4BO1D` in
   * `instagram.com/reel/Db0cDD4BO1D/`. This is what `post.ig_code` holds,
   * because the archive was built from the public export, which has no access
   * to the API's numeric id. The two identify the same post and never look
   * alike, so matching one against the other silently finds nothing.
   *
   * Null when the API gives no permalink — such a post cannot be matched to the
   * archive at all, and is skipped rather than guessed at.
   */
  shortcode: string | null
  publishedAt: Date
  isReel: boolean
  permalink: string | null
  caption: string | null
  likes: number | null
  comments: number | null
}

/**
 * The shortcode inside a permalink, or null.
 *
 * Handles `/reel/`, `/p/` and `/tv/` — the three forms Instagram has used for
 * something that ends up in this archive.
 */
export function shortcodeOf (permalink: string | null): string | null {
  if (permalink === null) return null

  const match = /\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/.exec(permalink)
  return match?.[1] ?? null
}

export interface MediaInsights {
  igCode: string
  /** From the insights endpoint. NEVER copied from `views`. */
  reach: number | null
  views: number | null
  saves: number | null
  sends: number | null
  /** Milliseconds, as the API reports it. */
  avgWatchMs: number | null
}

/**
 * Lists recent media.
 *
 * Paginates only as far as the window: the archive holds 205 Reels and every
 * one of them would otherwise be re-read daily for numbers that stopped moving
 * months ago.
 */
export async function listRecentMedia (
  client: IgClient,
  igUserId: string,
  since: Date,
  maxPages = 5
): Promise<MediaSummary[]> {
  const out: MediaSummary[] = []
  let path = `${igUserId}/media`
  let params: Record<string, string> = { fields: MEDIA_FIELDS, limit: '50' }

  for (let page = 0; page < maxPages; page++) {
    const payload = await client.get(path, params)
    const { items, next } = readMediaPage(payload)

    let reachedEnd = false
    for (const item of items) {
      if (item.publishedAt.getTime() < since.getTime()) { reachedEnd = true; continue }
      out.push(item)
    }

    /* The list comes back newest first, so the first item older than the window
       means everything after it is older too. */
    if (reachedEnd || next === null) break

    const url = new URL(next)
    path = url.pathname.replace(/^\/v\d+(\.\d+)?\//, '')
    params = Object.fromEntries(url.searchParams.entries())
    delete params.access_token
  }

  return out
}

/**
 * Reads insights for one post.
 *
 * Returns nulls rather than throwing when a metric is absent: Instagram does
 * not report every metric for every media type, and a missing one is not a
 * failed run.
 */
export async function mediaInsights (
  client: IgClient,
  media: MediaSummary
): Promise<MediaInsights> {
  const payload = await client.get(`${media.igCode}/insights`, {
    metric: media.isReel ? REEL_METRICS : MEDIA_METRICS
  })

  const totals = readTotals(payload)

  return {
    igCode: media.igCode,
    /* Read from its own key. If the API stops returning `reach`, this stays
       null — it does NOT fall back to `views`, which is the whole point. */
    reach: totals.get('reach') ?? null,
    views: totals.get('views') ?? null,
    saves: totals.get('saved') ?? null,
    sends: totals.get('shares') ?? null,
    avgWatchMs: totals.get('ig_reels_avg_watch_time') ?? null
  }
}

/**
 * Retention as a share of the video's length.
 *
 * Null when either side is missing or the duration is zero — a retention over
 * an unknown length is not a smaller retention, it is not a retention. Capped
 * at 1: average watch time can exceed duration when people loop, and a Reel
 * "180% watched" on screen would read as a bug rather than as loops.
 */
export function retentionPct (avgWatchMs: number | null, durationSec: number | null): number | null {
  if (avgWatchMs === null || durationSec === null || durationSec <= 0) return null
  return Math.min(1, avgWatchMs / 1000 / durationSec)
}

// ------------------------------------------------------------------ parsing

function isRecord (value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readMediaPage (payload: unknown): { items: MediaSummary[]; next: string | null } {
  const items: MediaSummary[] = []
  if (!isRecord(payload)) return { items, next: null }

  const data = payload.data
  if (Array.isArray(data)) {
    for (const raw of data) {
      if (!isRecord(raw)) continue

      const id = raw.id
      const timestamp = raw.timestamp
      if (typeof id !== 'string' || typeof timestamp !== 'string') continue

      const publishedAt = new Date(timestamp)
      if (Number.isNaN(publishedAt.getTime())) continue

      const permalink = typeof raw.permalink === 'string' ? raw.permalink : null

      items.push({
        igCode: id,
        shortcode: shortcodeOf(permalink),
        publishedAt,
        isReel: raw.media_product_type === 'REELS',
        permalink,
        caption: typeof raw.caption === 'string' ? raw.caption : null,
        likes: typeof raw.like_count === 'number' ? raw.like_count : null,
        comments: typeof raw.comments_count === 'number' ? raw.comments_count : null
      })
    }
  }

  const paging = payload.paging
  const next = isRecord(paging) && typeof paging.next === 'string' ? paging.next : null

  return { items, next }
}

/** `name` -> value, from either `total_value` or the single-value `values` form. */
function readTotals (payload: unknown): Map<string, number> {
  const out = new Map<string, number>()
  if (!isRecord(payload) || !Array.isArray(payload.data)) return out

  for (const item of payload.data) {
    if (!isRecord(item)) continue
    const name = item.name
    if (typeof name !== 'string') continue

    const total = item.total_value
    if (isRecord(total) && typeof total.value === 'number' && Number.isFinite(total.value)) {
      out.set(name, total.value)
      continue
    }

    /* Media insights still answer in the older `values: [{ value }]` shape for
       some metrics. Both are read rather than assuming one. */
    const values = item.values
    if (Array.isArray(values) && values.length > 0) {
      const first = values[0]
      if (isRecord(first) && typeof first.value === 'number' && Number.isFinite(first.value)) {
        out.set(name, first.value)
      }
    }
  }

  return out
}
