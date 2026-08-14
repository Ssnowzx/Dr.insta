import 'server-only'
import { and, eq, inArray } from 'drizzle-orm'
import { orm } from '@/db/client'
import { metricDef, metricValue, post } from '@/db/schema'
import { createClient, IgAuthError } from './client.ts'
import type { IgClient } from './client.ts'
import { collectAccountMonth } from './collect.ts'
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
  const stored0 = { ok: false, stored: 0, posts: 0, refreshed: false, calls: 0 }

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
    const posts = await collectMedia(client, clientId, credential.igUserId, now)

    await markSynced(clientId, now)
    return { ok: true, stored, posts, refreshed, calls: client.calls }
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
 * Per-post insights for the recent window, written onto `post`.
 *
 * Only posts already in the archive are updated. Creating rows from here would
 * mean a post existing with measured numbers and no caption or duration, and
 * the archive screen reads all four — the public import is what creates them.
 *
 * `reach` comes from its own field and is never derived from `views`; see
 * `lib/instagram/media.ts`. Provenance moves to `mixed` because the row now
 * holds both public counts and measured insights.
 */
async function collectMedia (
  client: IgClient,
  clientId: number,
  igUserId: string,
  now: Date
): Promise<number> {
  const since = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const recentes = await listRecentMedia(client, igUserId, since)
  if (recentes.length === 0) return 0

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
  if (codigos.length === 0) return 0

  const existentes = await orm()
    .select({ igCode: post.igCode, durationSec: post.durationSec })
    .from(post)
    .where(and(
      eq(post.clientId, clientId),
      inArray(post.igCode, codigos)
    ))

  const duracao = new Map(existentes.map(p => [p.igCode, p.durationSec]))
  let atualizados = 0

  for (const media of recentes) {
    const codigo = media.shortcode
    if (codigo === null || !duracao.has(codigo)) continue

    /* Insights are still fetched by the API id — that is the only identifier
       `/{media}/insights` accepts. Only the archive is addressed by shortcode. */
    const insights = await mediaInsights(client, media)

    await orm()
      .update(post)
      .set({
        /* Each column from its own source field. Only written when the API
           answered — a null here means "not measured", which is the truth, and
           overwriting a previous measurement with it would lose data. */
        ...(insights.reach === null ? {} : { reach: insights.reach }),
        ...(insights.saves === null ? {} : { saves: insights.saves }),
        ...(insights.sends === null ? {} : { sends: insights.sends }),
        ...(insights.views === null ? {} : { views: insights.views }),
        ...(retencao(insights.avgWatchMs, duracao.get(codigo) ?? null)),
        provenance: 'mixed',
        updatedAt: now
      })
      .where(and(eq(post.clientId, clientId), eq(post.igCode, codigo)))

    atualizados += 1
  }

  return atualizados
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
