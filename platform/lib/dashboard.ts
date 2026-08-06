import 'server-only'
import { and, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm'
import { orm } from '@/db/client'
import {
  benchmark, client, cycle, delivery, experiment, metricDef, metricTarget,
  metricValue, file, post, request, requestEvent, step, stepStatus, user
} from '@/db/schema'
import { mediana } from './acervo.ts'
import type { Unit } from './format.ts'

/**
 * Everything the dashboard reads, in one place.
 *
 * Every function takes `clientId` as its first argument and filters on it. No
 * default, no optional — a domain query that can run without a client is a
 * cross-client leak waiting for someone to forget an argument.
 */

export interface FunnelStage {
  key: string
  label: string
  value: number
  /** Share of the stage above. `null` on the first one. */
  survival: number | null
  /** Share of the very top. This is what the bar width encodes. */
  ofTotal: number
}

/**
 * The four steps between being seen and being paid.
 *
 * Ordered on purpose: reach → profile visits → store sessions → purchases. It
 * is the cycle's whole thesis in four rows, and the collapse between the second
 * and the fourth is the reason the cycle exists.
 */
const FUNNEL_KEYS = ['reach', 'profile_visits', 'tracked_sessions', 'transactions'] as const

const FUNNEL_LABELS: Record<string, string> = {
  reach: 'viram você',
  profile_visits: 'abriram seu perfil',
  tracked_sessions: 'chegaram na loja',
  transactions: 'compraram'
}

export async function funnel (clientId: number, period: string): Promise<FunnelStage[]> {
  const rows = await orm()
    .select({ key: metricDef.metricKey, value: metricValue.value })
    .from(metricValue)
    .innerJoin(metricDef, eq(metricDef.id, metricValue.metricDefId))
    .where(and(
      eq(metricValue.clientId, clientId),
      eq(metricValue.period, period),
      inArray(metricDef.metricKey, [...FUNNEL_KEYS]),
      /* Only measured sources. A funnel mixing a measured number with a value
         someone typed into a form would look identical and mean nothing. */
      inArray(metricValue.source, ['insights', 'ga4', 'store'])
    ))

  const byKey = new Map(rows.map(r => [r.key, Number.parseFloat(r.value)]))
  const top = byKey.get('reach') ?? 0

  const stages: FunnelStage[] = []
  let previous: number | null = null

  for (const key of FUNNEL_KEYS) {
    const value = byKey.get(key)
    if (value === undefined) continue

    stages.push({
      key,
      label: FUNNEL_LABELS[key] ?? key,
      value,
      survival: previous === null || previous === 0 ? null : value / previous,
      ofTotal: top === 0 ? 0 : value / top
    })
    previous = value
  }

  return stages
}

export interface MetricCard {
  key: string
  label: string
  shortLabel: string | null
  description: string | null
  unit: Unit
  decimals: number
  tier: 'north_star' | 'decision' | 'monitor'
  /* Where the number is read from, in the client's own tools. It lived in the
     database and never reached the screen — see `lib/origem.ts`. */
  howToMeasure: string | null
  value: number | null
  sampleSize: number | null
  note: string | null
  source: string | null
  baseline: number | null
  target: number | null
  contaminated: boolean
  targetNote: string | null
  benchmark: number | null
  benchmarkSource: string | null
  benchmarkUpdatedOn: string | null
}

/**
 * Metrics with their baseline, target and niche reference.
 *
 * `contaminated` and `sampleSize` travel with the number rather than being
 * looked up later, because the screen is required to show them. A baseline the
 * interface presents as clean when it is not produces a fictional target, and
 * that is the exact mistake the schema was shaped to prevent.
 */
export async function metrics (
  clientId: number,
  cycleId: number,
  period: string,
  niche: string
): Promise<MetricCard[]> {
  const rows = await orm()
    .select({
      key: metricDef.metricKey,
      label: metricDef.label,
      shortLabel: metricDef.shortLabel,
      description: metricDef.description,
      unit: metricDef.unit,
      decimals: metricDef.decimals,
      tier: metricDef.tier,
      howToMeasure: metricDef.howToMeasure,
      value: metricValue.value,
      sampleSize: metricValue.sampleSize,
      note: metricValue.note,
      source: metricValue.source,
      baseline: metricTarget.baseline,
      target: metricTarget.target,
      contaminated: metricTarget.contaminated,
      targetNote: metricTarget.note,
      benchmarkValue: benchmark.value,
      benchmarkSource: benchmark.source,
      benchmarkUpdatedOn: benchmark.updatedOn
    })
    .from(metricDef)
    .leftJoin(metricValue, and(
      eq(metricValue.metricDefId, metricDef.id),
      eq(metricValue.clientId, clientId),
      eq(metricValue.period, period),
      /* The store panel is what counts for revenue; the form answer is kept in
         the table as the record of a disagreement, not shown as the number. */
      inArray(metricValue.source, ['insights', 'ga4', 'store'])
    ))
    .leftJoin(metricTarget, and(
      eq(metricTarget.metricDefId, metricDef.id),
      eq(metricTarget.cycleId, cycleId)
    ))
    .leftJoin(benchmark, and(
      eq(benchmark.metricDefId, metricDef.id),
      eq(benchmark.niche, niche)
    ))

  const num = (v: string | null): number | null =>
    v === null ? null : Number.parseFloat(v)

  return rows.map(r => ({
    key: r.key,
    label: r.label,
    shortLabel: r.shortLabel,
    description: r.description,
    unit: r.unit,
    decimals: r.decimals,
    tier: r.tier,
    howToMeasure: r.howToMeasure,
    value: num(r.value),
    sampleSize: r.sampleSize,
    note: r.note,
    source: r.source,
    baseline: num(r.baseline),
    target: num(r.target),
    contaminated: r.contaminated === 1,
    targetNote: r.targetNote,
    benchmark: num(r.benchmarkValue),
    benchmarkSource: r.benchmarkSource,
    benchmarkUpdatedOn: r.benchmarkUpdatedOn
  }))
}

export interface CycleSummary {
  id: number
  title: string
  goal: string | null
  northStarMetric: string | null
  startsOn: string
}

export async function activeCycle (clientId: number): Promise<CycleSummary | null> {
  const rows = await orm()
    .select({
      id: cycle.id, title: cycle.title, goal: cycle.goal,
      northStarMetric: cycle.northStarMetric, startsOn: cycle.startsOn
    })
    .from(cycle)
    .where(and(eq(cycle.clientId, clientId), eq(cycle.state, 'active')))
    .orderBy(desc(cycle.startsOn))
    .limit(1)

  return rows[0] ?? null
}

export interface ExperimentRow {
  id: number
  name: string
  hypothesis: string
  isolatedVariable: string | null
  metricLabel: string | null
  successLabel: string | null
  minSample: number | null
  minDays: number | null
  state: 'not_started' | 'running' | 'read' | 'inconclusive' | 'abandoned'
  outcome: string | null
}

/**
 * The cycle's experiments.
 *
 * Four rows existed in the database from the first seed and no screen ever read
 * them — `experiment` was referenced in zero files outside the schema. They are
 * the part of the method that makes it falsifiable: a hypothesis, the ONE
 * variable being changed, and the number that would settle it. A plan without
 * them is a list of chores; with them it is an argument someone can disagree
 * with.
 */
export async function experiments (clientId: number, cycleId: number): Promise<ExperimentRow[]> {
  const rows = await orm()
    .select({
      id: experiment.id,
      name: experiment.name,
      hypothesis: experiment.hypothesis,
      isolatedVariable: experiment.isolatedVariable,
      metricLabel: metricDef.label,
      successLabel: experiment.successLabel,
      minSample: experiment.minSample,
      minDays: experiment.minDays,
      state: experiment.state,
      outcome: experiment.outcome
    })
    .from(experiment)
    .leftJoin(metricDef, eq(metricDef.id, experiment.metricDefId))
    .where(and(eq(experiment.clientId, clientId), eq(experiment.cycleId, cycleId)))
    .orderBy(experiment.position)

  return rows
}

export async function clientProfile (clientId: number) {
  const rows = await orm()
    .select({
      id: client.id, name: client.name, brand: client.brand,
      slug: client.slug, niche: client.niche, instagramHandle: client.instagramHandle
    })
    .from(client)
    .where(eq(client.id, clientId))
    .limit(1)

  return rows[0] ?? null
}

export interface StepRow {
  id: number
  code: string
  title: string
  summary: string | null
  deadlineLabel: string | null
  urgency: 'today' | 'this_week' | 'ongoing'
  evidenceValue: string | null
  evidenceLabel: string | null
  state: 'pending' | 'done' | 'blocked'
  comment: string | null
}

export interface DeliveryWithSteps {
  id: number
  slug: string
  title: string
  subtitle: string | null
  readingMinutes: number | null
  publishedAt: Date | null
  steps: StepRow[]
}

/**
 * The published deliveries and their steps, with this user's own state.
 *
 * The join to `step_status` carries `userId` so two people following the same
 * delivery each see their own answers. Joining on the step alone would show
 * whichever of them wrote last.
 */
export async function deliveries (clientId: number, userId: number): Promise<DeliveryWithSteps[]> {
  const rows = await orm()
    .select({
      deliveryId: delivery.id,
      slug: delivery.slug,
      title: delivery.title,
      subtitle: delivery.subtitle,
      readingMinutes: delivery.readingMinutes,
      publishedAt: delivery.publishedAt,
      stepId: step.id,
      code: step.code,
      stepTitle: step.title,
      summary: step.summary,
      deadlineLabel: step.deadlineLabel,
      urgency: step.urgency,
      evidenceValue: step.evidenceValue,
      evidenceLabel: step.evidenceLabel,
      position: step.position,
      state: stepStatus.state,
      comment: stepStatus.comment
    })
    .from(delivery)
    .innerJoin(step, eq(step.deliveryId, delivery.id))
    .leftJoin(stepStatus, and(
      eq(stepStatus.stepId, step.id),
      eq(stepStatus.userId, userId)
    ))
    .where(and(
      eq(delivery.clientId, clientId),
      sql`${delivery.publishedAt} IS NOT NULL`,
      sql`${delivery.archivedAt} IS NULL`
    ))
    .orderBy(delivery.position, step.position)

  const map = new Map<number, DeliveryWithSteps>()
  for (const r of rows) {
    let entry = map.get(r.deliveryId)
    if (entry === undefined) {
      entry = {
        id: r.deliveryId,
        slug: r.slug,
        title: r.title,
        subtitle: r.subtitle,
        readingMinutes: r.readingMinutes,
        publishedAt: r.publishedAt,
        steps: []
      }
      map.set(r.deliveryId, entry)
    }
    entry.steps.push({
      id: r.stepId,
      code: r.code,
      title: r.stepTitle,
      summary: r.summary,
      deadlineLabel: r.deadlineLabel,
      urgency: r.urgency,
      evidenceValue: r.evidenceValue,
      evidenceLabel: r.evidenceLabel,
      state: r.state ?? 'pending',
      comment: r.comment
    })
  }

  return [...map.values()]
}

export interface RequestRow {
  id: number
  publicCode: string
  title: string
  description: string | null
  whyItMatters: string | null
  kind: 'data' | 'action' | 'question' | 'material'
  priority: 'low' | 'medium' | 'high'
  state: 'open' | 'in_progress' | 'delivered' | 'dropped'
  dueOn: string | null
  createdAt: Date
}

export async function requests (clientId: number): Promise<RequestRow[]> {
  return await orm()
    .select({
      id: request.id,
      publicCode: request.publicCode,
      title: request.title,
      description: request.description,
      whyItMatters: request.whyItMatters,
      kind: request.kind,
      priority: request.priority,
      state: request.state,
      dueOn: request.dueOn,
      createdAt: request.createdAt
    })
    .from(request)
    .where(eq(request.clientId, clientId))
    .orderBy(request.state, request.position)
}

/**
 * The latest period the panel can actually show.
 *
 * Restricted to measured sources, and that restriction is the whole point. The
 * Reels importer writes monthly `views` under `source: 'public'`, so a plain
 * "latest period" jumps to the current month the moment anything is imported —
 * and the panel then announces August while the funnel, which reads only
 * measured sources, renders empty. Caught by looking at the screen.
 */
export async function latestPeriod (clientId: number): Promise<string | null> {
  const rows = await orm()
    .select({ period: metricValue.period })
    .from(metricValue)
    .where(and(
      eq(metricValue.clientId, clientId),
      inArray(metricValue.source, ['insights', 'ga4', 'store'])
    ))
    .orderBy(desc(metricValue.period))
    .limit(1)

  return rows[0]?.period ?? null
}

export interface StepAnswer {
  stepId: number
  userName: string
  state: 'pending' | 'done' | 'blocked'
  comment: string | null
  updatedAt: Date
}

/**
 * Every answer on this client's steps, whoever gave it.
 *
 * The consultant view needs this because `deliveries()` filters `step_status` by
 * the reader's own user id — and the consultant never marked anything. Without
 * a separate query the consultant would see an empty plan and conclude she has
 * not started.
 */
export async function clientStepAnswers (clientId: number): Promise<StepAnswer[]> {
  return await orm()
    .select({
      stepId: stepStatus.stepId,
      userName: user.name,
      state: stepStatus.state,
      comment: stepStatus.comment,
      updatedAt: stepStatus.updatedAt
    })
    .from(stepStatus)
    .innerJoin(step, eq(step.id, stepStatus.stepId))
    .innerJoin(user, eq(user.id, stepStatus.userId))
    .where(eq(step.clientId, clientId))
    .orderBy(desc(stepStatus.updatedAt))
}

/** Resolves the tenant slug this instance serves — see `lib/tenant.ts`. */
export async function clientBySlug (slug: string) {
  const rows = await orm()
    .select({ id: client.id, name: client.name })
    .from(client)
    .where(eq(client.slug, slug))
    .limit(1)
  return rows[0] ?? null
}

export interface RequestEventRow {
  id: number
  kind: 'comment' | 'state_change' | 'file' | 'view'
  body: string | null
  fromState: string | null
  toState: string | null
  userName: string | null
  createdAt: Date
  fileCode: string | null
  fileName: string | null
  fileBytes: number | null
}

export interface RequestDetail extends RequestRow {
  clientId: number
  events: RequestEventRow[]
}

/**
 * One request with its whole history.
 *
 * Looked up by `public_code` rather than by id: the code is what appears in the
 * URL, and a sequential id there would publish how many requests exist.
 *
 * Returns `null` for both "does not exist" and "belongs to someone else" — the
 * caller must not be able to tell those apart, or the URL becomes a way to test
 * whether a request exists.
 */
export async function requestDetail (
  publicCode: string,
  reachable: (clientId: number) => boolean
): Promise<RequestDetail | null> {
  const rows = await orm()
    .select({
      id: request.id,
      publicCode: request.publicCode,
      clientId: request.clientId,
      title: request.title,
      description: request.description,
      whyItMatters: request.whyItMatters,
      kind: request.kind,
      priority: request.priority,
      state: request.state,
      dueOn: request.dueOn,
      createdAt: request.createdAt
    })
    .from(request)
    .where(eq(request.publicCode, publicCode))
    .limit(1)

  const found = rows[0]
  if (found === undefined || !reachable(found.clientId)) return null

  const events = await orm()
    .select({
      id: requestEvent.id,
      kind: requestEvent.kind,
      body: requestEvent.body,
      fromState: requestEvent.fromState,
      toState: requestEvent.toState,
      userName: user.name,
      createdAt: requestEvent.createdAt,
      fileCode: file.publicCode,
      fileName: file.originalName,
      fileBytes: file.bytes
    })
    .from(requestEvent)
    .leftJoin(user, eq(user.id, requestEvent.userId))
    .leftJoin(file, eq(file.id, requestEvent.fileId))
    .where(eq(requestEvent.requestId, found.id))
    .orderBy(requestEvent.createdAt, requestEvent.id)

  return { ...found, events }
}

export interface Series {
  key: string
  label: string
  unit: Unit
  decimals: number
  description: string | null
  points: Array<{ period: string; value: number; partial?: boolean }>
}

/**
 * Monthly series for the given metric keys.
 *
 * `today` is a parameter rather than a call to the clock, so the "this month is
 * still running" flag is testable and the domain never reaches for the time
 * implicitly.
 */
export async function monthlySeries (
  clientId: number,
  keys: readonly string[],
  today: Date = new Date()
): Promise<Series[]> {
  if (keys.length === 0) return []

  const rows = await orm()
    .select({
      key: metricDef.metricKey,
      label: metricDef.label,
      unit: metricDef.unit,
      decimals: metricDef.decimals,
      description: metricDef.description,
      period: metricValue.period,
      value: metricValue.value
    })
    .from(metricValue)
    .innerJoin(metricDef, eq(metricDef.id, metricValue.metricDefId))
    .where(and(
      eq(metricValue.clientId, clientId),
      eq(metricValue.granularity, 'month'),
      inArray(metricDef.metricKey, [...keys])
    ))
    .orderBy(metricValue.period)

  const current = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-01`

  const byKey = new Map<string, Series>()
  for (const r of rows) {
    let entry = byKey.get(r.key)
    if (entry === undefined) {
      entry = {
        key: r.key, label: r.label, unit: r.unit,
        decimals: r.decimals, description: r.description, points: []
      }
      byKey.set(r.key, entry)
    }
    entry.points.push({
      period: r.period,
      value: Number.parseFloat(r.value),
      /* The running month is not comparable with the closed ones. Drawing it
         unmarked shows a cliff that is just the calendar. */
      ...(r.period === current ? { partial: true } : {})
    })
  }

  /* Returned in the order the caller asked for, not in whatever order the rows
     arrived — the page decides which chart comes first. */
  return keys.map(k => byKey.get(k)).filter((s): s is Series => s !== undefined)
}

export interface PostRow {
  id: number
  igCode: string
  publishedAt: Date
  url: string | null
  caption: string | null
  durationSec: number | null
  pillar: string | null
  mentionsBrand: boolean | null
  views: number | null
  likes: number | null
  comments: number | null
  /* A REPOST count, not a share count. Measured against July's Insights the
     public field read 1.986 where Insights said 48.000 shares — it is the weak
     signal, and the label on screen says so. */
  reposts: number | null
  reach: number | null
  provenance: 'public' | 'insights' | 'mixed'
}

export interface PostFilter {
  /** `curto` is <= 20s, the limit the cycle set for product content. */
  duration?: 'curto' | 'longo'
  brand?: 'marca' | 'pessoal'
}

export async function posts (
  clientId: number,
  filter: PostFilter = {},
  limit = 60
): Promise<PostRow[]> {
  const conditions = [eq(post.clientId, clientId)]

  if (filter.duration === 'curto') conditions.push(sql`${post.durationSec} <= 20`)
  if (filter.duration === 'longo') conditions.push(sql`${post.durationSec} > 20`)
  if (filter.brand === 'marca') conditions.push(eq(post.mentionsBrand, 1))
  if (filter.brand === 'pessoal') conditions.push(eq(post.mentionsBrand, 0))

  const rows = await orm()
    .select({
      id: post.id, igCode: post.igCode, publishedAt: post.publishedAt,
      url: post.url, caption: post.caption, durationSec: post.durationSec,
      pillar: post.pillar, mentionsBrand: post.mentionsBrand,
      views: post.views, likes: post.likes, comments: post.comments,
      reposts: post.reposts, reach: post.reach, provenance: post.provenance
    })
    .from(post)
    .where(and(...conditions))
    .orderBy(desc(post.publishedAt))
    .limit(limit)

  return rows.map(r => ({
    ...r,
    mentionsBrand: r.mentionsBrand === null ? null : r.mentionsBrand === 1
  }))
}

export interface PostCounts {
  total: number
  curtos: number
  longos: number
  marca: number
  pessoal: number
  marcaCurto: number
}

/**
 * Counts for the filter chips, so a filter never leads to an empty screen
 * unannounced.
 *
 * Every value is passed through `Number()`. MySQL returns `COUNT` and `SUM` as
 * strings, and `sql<number>` is a type assertion rather than a conversion — so
 * TypeScript believes these are numbers while the runtime hands back `"0"`.
 * That mismatch already hid the empty-cell callout once: `"0" === 0` is false,
 * and the finding silently never rendered.
 */
/**
 * The middle of her archive, for reading one post against the rest.
 *
 * Deliberately unfiltered: the ruler must not move when the reader clicks
 * "até 20s". A median that follows the filter would make every post in every
 * cut look average, which is the one thing a comparison must never do.
 */
export async function archiveMedian (clientId: number): Promise<number | null> {
  const rows = await orm()
    .select({ views: post.views })
    .from(post)
    .where(and(eq(post.clientId, clientId), isNotNull(post.views)))

  return mediana(rows.map(r => Number(r.views)).filter(v => v > 0))
}

export async function postCounts (clientId: number): Promise<PostCounts> {
  const [row] = await orm()
    .select({
      total: sql<number>`COUNT(*)`,
      curtos: sql<number>`SUM(${post.durationSec} <= 20)`,
      longos: sql<number>`SUM(${post.durationSec} > 20)`,
      marca: sql<number>`SUM(${post.mentionsBrand} = 1)`,
      pessoal: sql<number>`SUM(${post.mentionsBrand} = 0)`,
      /* The empty cell the Reels analysis found: brand content never shipped in
         20 seconds or less. Counted here so the screen can state it. */
      marcaCurto: sql<number>`SUM(${post.mentionsBrand} = 1 AND ${post.durationSec} <= 20)`
    })
    .from(post)
    .where(eq(post.clientId, clientId))

  const n = (v: unknown): number => {
    const parsed = Number(v)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return {
    total: n(row?.total),
    curtos: n(row?.curtos),
    longos: n(row?.longos),
    marca: n(row?.marca),
    pessoal: n(row?.pessoal),
    marcaCurto: n(row?.marcaCurto)
  }
}

/**
 * When the archive was last imported, and how recent its newest post is.
 *
 * The `sql<Date>` is a type assertion, not a conversion — the same trap as
 * `sql<number>` over COUNT. MySQL returns an aggregate as a string, so what
 * arrives is "2026-08-04 12:00:00" while TypeScript is certain it is a Date.
 * Coerced here, at the boundary, because a `new Date` on that string further
 * downstream produced an Invalid Date and a 500 on a client screen.
 */
export async function archiveAge (
  clientId: number
): Promise<{ importedAt: Date; lastPostAt: Date } | null> {
  const [row] = await orm()
    .select({
      importedAt: sql<string | Date | null>`MAX(${post.updatedAt})`,
      lastPostAt: sql<string | Date | null>`MAX(${post.publishedAt})`
    })
    .from(post)
    .where(eq(post.clientId, clientId))

  const toDate = (v: string | Date | null | undefined): Date | null => {
    if (v == null) return null
    /* MySQL's "YYYY-MM-DD HH:MM:SS" has no zone marker; the space needs to be a
       T and the zone made explicit, or the parse is implementation-defined. */
    const d = v instanceof Date ? v : new Date(`${v.replace(' ', 'T')}Z`)
    return Number.isNaN(d.getTime()) ? null : d
  }

  const importedAt = toDate(row?.importedAt)
  const lastPostAt = toDate(row?.lastPostAt)

  if (importedAt === null || lastPostAt === null) return null
  return { importedAt, lastPostAt }
}

export interface ClientUser {
  id: number
  name: string
  email: string
  hasPassword: boolean
  lastSeenAt: Date | null
}

/**
 * The client-side people a consultant can mint an access link for.
 *
 * Consultants are excluded: a consultant minting a link for another consultant
 * is a privilege path, not a support one, and it has no use case here.
 */
export async function clientUsers (clientId: number): Promise<ClientUser[]> {
  const rows = await orm()
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      passwordHash: user.passwordHash,
      lastSeenAt: user.lastSeenAt
    })
    .from(user)
    /* Scoped by `client_id` like every other query here. On a dedicated
       instance this is the same set either way, but a listing that ignores the
       scope is one restored database dump away from minting an access link for
       somebody else's client. */
    .where(and(
      eq(user.clientId, clientId),
      eq(user.role, 'client'),
      eq(user.active, 1)
    ))
    .orderBy(user.name)

  return rows.map(r => ({
    id: r.id,
    name: r.name,
    email: r.email,
    hasPassword: r.passwordHash !== null,
    lastSeenAt: r.lastSeenAt
  }))
}
