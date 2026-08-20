import 'server-only'
import { and, eq, inArray } from 'drizzle-orm'
import { orm } from '@/db/client'
import { metricDef, metricValue, post } from '@/db/schema'
import { createClient, IgAuthError } from './client.ts'
import type { IgClient } from './client.ts'
import { collectAccountMonth, collectProfile } from './collect.ts'
import type { Collected } from './collect.ts'
import { listRecentMedia, mediaInsights, retentionPct, WINDOW_DAYS } from './media.ts'
import {
  markFailure, markSynced, tokenFor, updateToken
} from './connection.ts'
import { refreshLongLived } from './oauth.ts'

/**
 * One run of the routine: refresh if needed, collect, store.
 *
 * Refresh happens with two weeks to spare rather than on the last day. A
 * long-lived token dies at sixty days and cannot be revived — only reissued by
 * her — so a routine that renews at the last moment turns one bad night into a
 * reconnection request. Fifteen days of slack absorbs a fortnight of failures.
 *
 * Every outcome is written to the connection row. A run that fails silently is
 * the worst outcome this feature has: the numbers simply stop changing, and
 * that looks exactly like a month where nothing happened.
 */

/** Refresh when the credential has less than this left. */
export const REFRESH_WHEN_UNDER_MS = 15 * 24 * 60 * 60 * 1000

export interface SyncResult {
  ok: boolean
  /** Rows written. Zero is legitimate: the API may have nothing for the period. */
  stored: number
  /** Posts whose measured numbers were updated. */
  posts: number
  /**
   * Posts that did not exist in the archive and now do.
   *
   * Reported apart from `posts` because they answer different questions. "12
   * updated" every day is the routine working; "3 created" is content that was
   * invisible until this run — and a run that quietly created 40 of them means
   * something upstream had been broken for a month.
   */
  created: number
  /**
   * Her follower total at this run, or null when the account node did not
   * answer.
   *
   * Reported so the log says whether the daily series got a point. A gap in it
   * cannot be backfilled — the API answers "how many now" and never "how many
   * on the 14th" — so a silent failure here costs a day forever.
   */
  followers: number | null
  refreshed: boolean
  calls: number
  /** Present only on failure. */
  error?: string
  /** True when the credential is the problem and only she can fix it. */
  needsReconnect?: boolean
}

/**
 * @param period The month to collect, as `YYYY-MM-01`. Passed in rather than
 *               derived from the clock, so a run is reproducible and a backfill
 *               is the same code path.
 */
export async function syncClient (
  clientId: number,
  period: string,
  now: Date = new Date()
): Promise<SyncResult> {
  const stored0 = { ok: false, stored: 0, posts: 0, created: 0, followers: null, refreshed: false, calls: 0 }

  const credential = await tokenFor(clientId)
  if (credential === null) {
    return { ...stored0, error: 'sem conexão ativa' }
  }

  let token = credential.token
  let refreshed = false

  /* Refresh first. Collecting with a credential about to lapse would work
     today and leave tomorrow's run with nothing. */
  if (needsRefresh(credential.expiresAt, now)) {
    try {
      const renovado = await refreshLongLived(token, now)
      await updateToken(clientId, renovado.token, renovado.expiresAt, now)
      token = renovado.token
      refreshed = true
    } catch (error) {
      /* A failed refresh on a credential that still works is not a failure of
         this run: collection proceeds, and tomorrow tries again. Only a
         credential that has actually lapsed stops us. */
      if (credential.expiresAt !== null && credential.expiresAt.getTime() <= now.getTime()) {
        const reason = message(error)
        await markFailure(clientId, 'expired', reason, now)
        return { ...stored0, error: reason, needsReconnect: true }
      }
    }
  }

  const client = createClient(token)

  try {
    const collected = await collectAccountMonth(client, credential.igUserId, period)
    const stored = await storeCollected(clientId, period, collected, now)
    const followers = await storeFollowerTotal(client, clientId, credential.igUserId, now)
    const media = await collectMedia(client, clientId, credential.igUserId, now)

    await markSynced(clientId, now)
    return {
      ok: true,
      stored,
      posts: media.updated,
      created: media.created,
      followers,
      refreshed,
      calls: client.calls
    }
  } catch (error) {
    const reason = message(error)
    const isAuth = error instanceof IgAuthError

    await markFailure(clientId, isAuth ? 'expired' : 'failing', reason, now)

    return {
      ...stored0,
      refreshed,
      calls: client.calls,
      error: reason,
      ...(isAuth ? { needsReconnect: true } : {})
    }
  }
}

/**
 * Whether the credential should be renewed on this run.
 *
 * Exported for its test: it is the one decision here that is pure, and getting
 * it wrong is invisible until the day a token lapses and she has to reconnect.
 */
export function needsRefresh (expiresAt: Date | null, now: Date): boolean {
  /* No recorded expiry means we do not know how long it has. Refreshing is the
     safe guess: at worst it is a wasted request. */
  if (expiresAt === null) return true
  return expiresAt.getTime() - now.getTime() < REFRESH_WHEN_UNDER_MS
}

/**
 * Writes what was collected, as `api`.
 *
 * Idempotent by the table's own unique key on
 * `(client, metric_def, period, granularity, source)`: a second run for the
 * same month updates in place. Running twice must not create a duplicate, and
 * must not produce a step in the series that never happened.
 *
 * A metric with no definition is skipped rather than invented. `metric_def`
 * carries the label, the unit and the decimals a screen needs; a row pointing
 * at nothing would be a number with no name.
 */
async function storeCollected (
  clientId: number,
  period: string,
  collected: Collected[],
  now: Date
): Promise<number> {
  if (collected.length === 0) return 0

  const defs = await orm()
    .select({ id: metricDef.id, key: metricDef.metricKey })
    .from(metricDef)

  const byKey = new Map(defs.map(d => [d.key, d.id]))
  let written = 0

  for (const item of collected) {
    const defId = byKey.get(item.key)
    if (defId === undefined) continue

    const value = item.value.toFixed(6)

    await orm()
      .insert(metricValue)
      .values({
        clientId,
        metricDefId: defId,
        period,
        granularity: 'month',
        value,
        source: 'api',
        createdAt: now,
        updatedAt: now
      })
      .onDuplicateKeyUpdate({ set: { value, updatedAt: now } })

    written += 1
  }

  return written
}

/**
 * Her follower total, filed under the day it was read.
 *
 * A DAY, NOT A MONTH — and that is the whole point
 *
 * Every other metric here describes a closed calendar month, which is right for
 * them: reach in a month is a fact about that month. A follower total is a fact
 * about a moment, and the moment is the only one the API will ever give — there
 * is no endpoint for "how many did she have on the 14th". So a day missed is a
 * day missing forever, which is why the caller reports whether this worked
 * instead of letting it fail quietly.
 *
 * Five runs a day write the same row five times; the unique key is
 * (client, metric, period, granularity, source) and the last read of the day
 * wins. That is the honest reading for a running total.
 *
 * Swallows its own failure, like `funnelInsights` and for the same reason: by
 * the time this runs the month's metrics are already in hand, and losing them
 * because the account node changed shape would be a bad trade.
 */
async function storeFollowerTotal (
  client: IgClient,
  clientId: number,
  igUserId: string,
  now: Date
): Promise<number | null> {
  try {
    const perfil = await collectProfile(client, igUserId)
    if (perfil === null) return null

    const [def] = await orm()
      .select({ id: metricDef.id })
      .from(metricDef)
      .where(eq(metricDef.metricKey, 'followers_total'))
      .limit(1)

    /* No definition means the seed has not run with it yet. Writing the row
       anyway is impossible — `metric_def_id` is not nullable — and inventing a
       definition here would put a metric on her panel that no seed authored. */
    if (def === undefined) return null

    const value = perfil.followersTotal.toFixed(6)
    /* UTC, like `currentPeriod`. A run at 21:40 in Brazil belongs to the day the
       rest of the collection files it under, or the series grows a duplicate
       every evening. */
    const day = now.toISOString().slice(0, 10)

    await orm()
      .insert(metricValue)
      .values({
        clientId,
        metricDefId: def.id,
        period: day,
        granularity: 'day',
        value,
        source: 'api',
        createdAt: now,
        updatedAt: now
      })
      .onDuplicateKeyUpdate({ set: { value, updatedAt: now } })

    return perfil.followersTotal
  } catch {
    return null
  }
}

/**
 * Per-post insights for the recent window, written onto `post`.
 *
 * IT CREATES WHAT IT DOES NOT FIND — changed 17/08/2026
 *
 * It used to update only posts already in the archive, on the argument that a
 * row created here would have measured numbers and no duration. The argument was
 * sound and the conclusion was wrong, because it left a hole nobody could see:
 * the archive grows ONLY through the public browser export, so between 9 and 17
 * August she published and the product showed nothing. The screens read fine,
 * the collection reported success, and eight days of content did not exist.
 *
 * Worse, the hole is self-sealing. The insight window is 30 days: a post absent
 * from the archive when its window closes never gets reach at all, from any
 * route. Waiting for the next manual export does not recover it.
 *
 * So a missing post is created from what the media edge does give — timestamp,
 * permalink, caption, likes, comments and type — with `duration_sec` NULL,
 * because no endpoint reports a Reel's length. That absence is carried honestly
 * rather than guessed: `/conteudo` counts those posts and says so, since the
 * cycle's cut is <=20s against 90s+ and a post with no duration belongs to
 * neither side of it. Importing a public export later FILLS the duration —
 * `db/import-reels.ts` keys on the same shortcode — so the export stops being
 * required and becomes enriching.
 *
 * `reach` comes from its own field and is never derived from `views`; see
 * `lib/instagram/media.ts`. A row that already carried public counts becomes
 * `mixed`; one born here is `insights`, because that is all it has ever held.
 */
export interface MediaResult {
  updated: number
  created: number
}

async function collectMedia (
  client: IgClient,
  clientId: number,
  igUserId: string,
  now: Date
): Promise<MediaResult> {
  const nada: MediaResult = { updated: 0, created: 0 }
  const since = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const recentes = await listRecentMedia(client, igUserId, since)
  if (recentes.length === 0) return nada

  /* Matched on the shortcode, NOT on `igCode`.

     `post.ig_code` holds the shortcode from the permalink — the archive came
     from the public export, which never sees the API's numeric media id. This
     matched `post.ig_code` against that numeric id, so it compared
     `Db0cDD4BO1D` with `179123…` and found nothing, every single run. The first
     sync after she connected on 14/08/2026 reported "0 post(s) updated" and
     looked like the API simply had nothing to say.

     Silent because both sides were populated and neither threw: an empty
     intersection is indistinguishable from "no recent posts" unless you know
     the two columns hold different things. */
  const codigos = recentes
    .map(m => m.shortcode)
    .filter((c): c is string => c !== null)
  if (codigos.length === 0) return nada

  const existentes = await orm()
    .select({ igCode: post.igCode, durationSec: post.durationSec })
    .from(post)
    .where(and(
      eq(post.clientId, clientId),
      inArray(post.igCode, codigos)
    ))

  const duracao = new Map(existentes.map(p => [p.igCode, p.durationSec]))
  const resultado: MediaResult = { updated: 0, created: 0 }

  for (const media of recentes) {
    const codigo = media.shortcode
    /* No permalink, no shortcode, no way to address the archive — and no way for
       a later public import to meet this row either. Skipped rather than filed
       under the API's numeric id, which would create the exact mismatch that
       made this whole routine report "0 posts updated" for a week. */
    if (codigo === null) continue

    const novo = !duracao.has(codigo)

    /* Insights are still fetched by the API id — that is the only identifier
       `/{media}/insights` accepts. Only the archive is addressed by shortcode. */
    const insights = await mediaInsights(client, media)

    /* Each column from its own source field. Only written when the API
       answered — a null here means "not measured", which is the truth, and
       overwriting a previous measurement with it would lose data. */
    const medido = {
      ...(insights.reach === null ? {} : { reach: insights.reach }),
      ...(insights.saves === null ? {} : { saves: insights.saves }),
      ...(insights.sends === null ? {} : { sends: insights.sends }),
      ...(insights.views === null ? {} : { views: insights.views }),
      /* Feed only — a Reel refuses both, and the refusal arrives as null.
         Written under the same rule as the rest: absent stays absent rather
         than overwriting a measurement with nothing. */
      ...(insights.follows === null ? {} : { follows: insights.follows }),
      ...(insights.profileVisits === null ? {} : { profileVisits: insights.profileVisits }),
      ...(retencao(insights.avgWatchMs, duracao.get(codigo) ?? null))
    }

    if (novo) {
      await orm().insert(post).values({
        clientId,
        igCode: codigo,
        kind: media.kind,
        publishedAt: media.publishedAt,
        url: media.permalink,
        caption: media.caption,
        /* NULL, and left that way. No endpoint reports a Reel's length, and a
           guessed duration would land the post on one side of the <=20s cut
           this cycle is decided by. */
        durationSec: null,
        likes: media.likes,
        comments: media.comments,
        ...medido,
        /* `insights` and not `mixed`: this row has never held a public count,
           and claiming otherwise would say the public export had been seen. */
        provenance: 'insights',
        createdAt: now,
        updatedAt: now
      })
        /* The unique key is (client_id, ig_code). Two runs overlapping — a cron
           and a hand-run backfill — must not race into a duplicate key error
           that fails the whole collection over a post already stored. */
        .onDuplicateKeyUpdate({ set: { ...medido, updatedAt: now } })

      resultado.created += 1
      continue
    }

    await orm()
      .update(post)
      .set({
        ...medido,
        provenance: 'mixed',
        updatedAt: now
      })
      .where(and(eq(post.clientId, clientId), eq(post.igCode, codigo)))

    resultado.updated += 1
  }

  return resultado
}

/** Retention as a stored decimal, or nothing at all. */
function retencao (avgWatchMs: number | null, durationSec: number | null): { retentionPct?: string; avgWatchSec?: string } {
  if (avgWatchMs === null) return {}

  const pct = retentionPct(avgWatchMs, durationSec)
  return {
    avgWatchSec: (avgWatchMs / 1000).toFixed(2),
    ...(pct === null ? {} : { retentionPct: pct.toFixed(3) })
  }
}

/** The current month, as the period key the table uses. */
export function currentPeriod (now: Date = new Date()): string {
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}-01`
}

function message (error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Whether a client has anything worth collecting. Used by the CLI to report. */
export async function hasStoredApiValues (clientId: number, period: string): Promise<number> {
  const rows = await orm()
    .select({ id: metricValue.id })
    .from(metricValue)
    .where(and(
      eq(metricValue.clientId, clientId),
      eq(metricValue.period, period),
      eq(metricValue.source, 'api')
    ))

  return rows.length
}
