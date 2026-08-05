import 'server-only'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { orm } from '@/db/client'
import {
  benchmark, client, cycle, delivery, metricDef, metricTarget, metricValue,
  request, step, stepStatus, user
} from '@/db/schema'
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

/** The latest period with any measured value. Beats hardcoding a month. */
export async function latestPeriod (clientId: number): Promise<string | null> {
  const rows = await orm()
    .select({ period: metricValue.period })
    .from(metricValue)
    .where(eq(metricValue.clientId, clientId))
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

/** Clients a consultant may open. Used by the picker until a real one exists. */
export async function listClients () {
  return await orm()
    .select({ id: client.id, slug: client.slug, name: client.name, brand: client.brand })
    .from(client)
    .where(sql`${client.archivedAt} IS NULL`)
    .orderBy(client.name)
}

export async function clientBySlug (slug: string) {
  const rows = await orm()
    .select({ id: client.id, name: client.name })
    .from(client)
    .where(eq(client.slug, slug))
    .limit(1)
  return rows[0] ?? null
}
