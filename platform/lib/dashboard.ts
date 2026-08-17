import 'server-only'
import { cache } from 'react'
import { and, desc, eq, inArray, isNotNull, lt, or, sql } from 'drizzle-orm'
import { orm } from '@/db/client'
import {
  benchmark, client, cycle, delivery, deliverySection, experiment,
  instagramConnection, metricDef, metricTarget, metricValue, file, pillar, post,
  request, requestEvent, requestField, step, stepStatus, user
} from '@/db/schema'
import { mediana } from './acervo.ts'
import { ORIGENS_MEDIDAS, resolverPorChave } from './precedencia.ts'
import { VERIFY_INSTAGRAM } from './verificacao.ts'
import type { ObservedFacts, TeamAnswer } from './verificacao.ts'
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
    .select({ key: metricDef.metricKey, value: metricValue.value, source: metricValue.source })
    .from(metricValue)
    .innerJoin(metricDef, eq(metricDef.id, metricValue.metricDefId))
    .where(and(
      eq(metricValue.clientId, clientId),
      eq(metricValue.period, period),
      inArray(metricDef.metricKey, [...FUNNEL_KEYS]),
      /* Only measured sources. A funnel mixing a measured number with a value
         someone typed into a form would look identical and mean nothing. */
      inArray(metricValue.source, [...ORIGENS_MEDIDAS])
    ))

  /* Resolved by precedence, not by whichever row arrived last. Building the map
     straight from the rows would let a step of the funnel take the transcribed
     figure or the collected one depending on the order MySQL happened to
     return — an unstable funnel that looks stable. */
  const byKey = new Map(
    resolverPorChave(
      rows.map(r => ({ ...r, value: Number.parseFloat(r.value) })),
      r => r.key
    ).map(({ escolhido }) => [escolhido.key, escolhido.value])
  )
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
  /** Whether THIS cycle is decided by this metric. Not the catalogue's tier. */
  isNorthStar: boolean
  targetNote: string | null
  benchmark: number | null
  benchmarkSource: string | null
  benchmarkUpdatedOn: string | null
  /**
   * Measurements that lost to precedence AND disagree with the one shown.
   *
   * Empty when the sources agree, or when there is only one. Two figures that
   * differ say something about how far to trust the number, and dropping the
   * loser turns disagreement into false certainty.
   */
  divergences: Array<{ source: string | null; value: number }>
}

/**
 * Metrics with their baseline, target and niche reference.
 *
 * `contaminated` and `sampleSize` travel with the number rather than being
 * looked up later, because the screen is required to show them. A baseline the
 * interface presents as clean when it is not produces a fictional target, and
 * that is the exact mistake the schema was shaped to prevent.
 *
 * Sources are NOT filtered in the join. They used to be, and that was safe only
 * while no measured metric had two of them: a `leftJoin` matching twice returns
 * two rows for one definition, and the panel renders the card twice. The
 * Instagram collection makes that collision routine, so the choice is made
 * after reading, by declared precedence — see `lib/precedencia.ts`.
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
      isNorthStar: metricTarget.isNorthStar,
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
      /* Measured sources only. `manual` and `public` are kept in the table as
         the record of what someone reported, and `public` counts looping views
         — neither is a figure to decide on. Which of the measured ones wins is
         settled below, not here. */
      inArray(metricValue.source, [...ORIGENS_MEDIDAS])
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

  /* One card per definition. `resolverPorChave` keeps the order each key first
     appeared in, so the query's ordering survives. */
  const cartoes = resolverPorChave(
    rows.map(r => ({ ...r, value: num(r.value) })),
    r => r.key
  ).map(({ escolhido: r, divergentes }) => ({
    key: r.key,
    label: r.label,
    shortLabel: r.shortLabel,
    description: r.description,
    unit: r.unit,
    decimals: r.decimals,
    tier: r.tier,
    howToMeasure: r.howToMeasure,
    value: r.value,
    sampleSize: r.sampleSize,
    note: r.note,
    source: r.source,
    baseline: num(r.baseline),
    target: num(r.target),
    contaminated: r.contaminated === 1,
    isNorthStar: r.isNorthStar === 1,
    targetNote: r.targetNote,
    benchmark: num(r.benchmarkValue),
    benchmarkSource: r.benchmarkSource,
    benchmarkUpdatedOn: r.benchmarkUpdatedOn,
    divergences: divergentes
      .filter((d): d is typeof d & { value: number } => d.value !== null)
      .map(d => ({ source: d.source, value: d.value }))
  }))

  return derivarTaxas(cartoes, period)
}

/**
 * Rates that are two stored numbers divided, recomputed when the panel is read.
 *
 * `profile_visits_reach` was a stored figure with a hand-written note —
 * "347.482 visitas ÷ 5.413.754 contas alcançadas em julho" — and both went stale
 * the moment the API started measuring reach. On 14/08/2026 the panel showed
 * 5.584.671 as July's reach in one card and 5.413.754 inside the note of the
 * card below it: two answers to "how many accounts did she reach in July" on one
 * screen. Fixing the note would have bought a month; the numerator or the
 * denominator moves again and it is stale once more.
 *
 * Only the ratio is derived. The numerator still arrives by hand —
 * `profile_visits` has no counterpart in the Instagram API, only per media —
 * so this does not remove the monthly screenshot, it just stops the division
 * from being frozen.
 *
 * `follows_reach` is deliberately NOT here, even though it looks identical. Its
 * denominator is reach summed per post, which double-counts whoever saw two
 * posts, and is a different quantity from account reach. Deriving it from
 * `reach` would silently change what the number means.
 */
const TAXAS_DERIVADAS = [
  {
    key: 'profile_visits_reach',
    numerador: 'profile_visits',
    denominador: 'reach',
    nota: (n: number, d: number, mes: string): string =>
      `Derivado: ${inteiro(n)} visitas ÷ ${inteiro(d)} contas alcançadas em ${mes}.`
  }
] as const

export function derivarTaxas (cartoes: MetricCard[], period: string): MetricCard[] {
  const valor = new Map(cartoes.map(c => [c.key, c.value]))
  const mes = mesDe(period)

  return cartoes.map(cartao => {
    const regra = TAXAS_DERIVADAS.find(t => t.key === cartao.key)
    if (regra === undefined) return cartao

    const n = valor.get(regra.numerador) ?? null
    const d = valor.get(regra.denominador) ?? null

    /* Both parts, or nothing changes. A period without one of them keeps the
       stored value — an older figure is worth more than an empty card, and the
       note that comes with it still says where it came from. */
    if (n === null || d === null || d === 0) return cartao

    return { ...cartao, value: n / d, note: regra.nota(n, d, mes) }
  })
}

/** "julho", from a `YYYY-MM-01`. UTC, matching how periods are stamped. */
function mesDe (period: string): string {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' })
    .format(new Date(`${period}T00:00:00Z`))
}

const inteiro = (n: number): string =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(n)

export interface CycleSummary {
  id: number
  title: string
  goal: string | null
  /** What this cycle knowingly gives up. Agreed up front or it is not agreed. */
  tradeOff: string | null
  northStarMetric: string | null
  startsOn: string
  /** The cycle's deadline — for this cycle, the 1M-by-December date. */
  endsOn: string | null
}

export async function activeCycle (clientId: number): Promise<CycleSummary | null> {
  const rows = await orm()
    .select({
      id: cycle.id, title: cycle.title, goal: cycle.goal,
      tradeOff: cycle.tradeOff,
      northStarMetric: cycle.northStarMetric, startsOn: cycle.startsOn,
      endsOn: cycle.endsOn
    })
    .from(cycle)
    .where(and(eq(cycle.clientId, clientId), eq(cycle.state, 'active')))
    .orderBy(desc(cycle.startsOn))
    .limit(1)

  return rows[0] ?? null
}

export interface PillarRow {
  id: number
  key: string
  name: string
  sharePct: number | null
  perWeek: string | null
  thesis: string | null
  roleNote: string | null
  evidence: string | null
  /** Resolved from `metric_def`, so the screen names the metric the way the
      panel names it and the two cannot drift apart. */
  metricLabel: string | null
  successLabel: string | null
  isControl: boolean
}

/**
 * The editorial mix for a cycle.
 *
 * This is the reasoning the plan was missing. Five adjustments arrived as five
 * chores; which pillar each one serves, how much of the week it should take and
 * what result would settle it lived in a markdown file she has never opened. A
 * plan she can only obey is a plan she cannot disagree with, and disagreeing is
 * what turns it into hers.
 *
 * The join to `metric_def` is a LEFT one on purpose: a pillar naming a metric
 * that does not exist yet is a draft, not an error, and should still render.
 */
export async function pillars (clientId: number, cycleId: number): Promise<PillarRow[]> {
  const rows = await orm()
    .select({
      id: pillar.id,
      key: pillar.pillarKey,
      name: pillar.name,
      sharePct: pillar.sharePct,
      perWeek: pillar.perWeek,
      thesis: pillar.thesis,
      roleNote: pillar.roleNote,
      evidence: pillar.evidence,
      metricLabel: metricDef.label,
      successLabel: pillar.successLabel,
      isControl: pillar.isControl
    })
    .from(pillar)
    .leftJoin(metricDef, eq(metricDef.metricKey, pillar.metricKey))
    .where(and(eq(pillar.clientId, clientId), eq(pillar.cycleId, cycleId)))
    .orderBy(pillar.position)

  return rows.map(r => ({ ...r, isControl: r.isControl === 1 }))
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

/**
 * The client this instance serves.
 *
 * Memoised for the render pass because the brand is now read twice on every
 * page — once by `generateMetadata` for the browser tab and once by the layout
 * for the header. Without `cache()` that is two identical queries per load.
 */
export const clientProfile = cache(async (clientId: number) => {
  const rows = await orm()
    .select({
      id: client.id, name: client.name, brand: client.brand,
      slug: client.slug, niche: client.niche, instagramHandle: client.instagramHandle
    })
    .from(client)
    .where(eq(client.id, clientId))
    .limit(1)

  return rows[0] ?? null
})

export interface StepRow {
  id: number
  code: string
  title: string
  summary: string | null
  deadlineLabel: string | null
  urgency: 'today' | 'this_week' | 'ongoing'
  evidenceValue: string | null
  evidenceLabel: string | null
  /** The exact string to paste, and where it goes. Both or neither. */
  copyValue: string | null
  copyLabel: string | null
  copyNote: string | null
  /* How this step can prove itself, and the state of what would prove it. The
     row carries no `state` any more: the answer belongs to the team and to the
     facts, and it is `lib/verificacao.ts` that puts the two together. A `state`
     here would be a fourth place for the same question to be answered. */
  verifyKey: string | null
  requestId: number | null
  requestState: 'open' | 'answered' | 'analyzing' | 'concluded' | 'dropped' | null
  requestCode: string | null
  requestTitle: string | null
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
 * The published deliveries and their steps.
 *
 * It no longer takes a user, and that is the fix rather than a tidy-up. The join
 * to `step_status` used to carry the reader's own id, so with two people on the
 * client side — Bianca and her assistant — whatever one of them marked read
 * "a fazer" to the other, and the same chore would be done twice or by neither.
 *
 * What replaces it: `teamStepAnswers` for what the team said, `observedFacts`
 * for what the platform saw, and `lib/verificacao.ts` to put them together. One
 * state, for everyone who opens the screen.
 *
 * The `leftJoin` to `request` is how a chore stops being asked for once she has
 * answered it in Pedidos — the two used to be the same job on two screens with
 * nothing joining them.
 */
export async function deliveries (clientId: number): Promise<DeliveryWithSteps[]> {
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
      copyValue: step.copyValue,
      copyLabel: step.copyLabel,
      copyNote: step.copyNote,
      position: step.position,
      verifyKey: step.verifyKey,
      requestId: step.requestId,
      requestState: request.state,
      requestCode: request.publicCode,
      requestTitle: request.title
    })
    .from(delivery)
    /* `leftJoin` and not `inner`: a delivery with no steps is a delivery that is
       read rather than done, and an INNER JOIN made those invisible everywhere —
       no screen, no count, no summary. `delivery.kind` has offered 'analysis'
       since the first migration and nothing could ever render one. The callers
       now decide what to do with a step-less delivery; the JOIN no longer
       decides what exists. */
    .leftJoin(step, eq(step.deliveryId, delivery.id))
    /* Scoped by client as well as by id. Matching on `step.requestId` alone
       would be enough today — the ids come from the same seed — but every domain
       query here filters by client, and the one that does not is the one that
       leaks after a restored dump. */
    .leftJoin(request, and(
      eq(request.id, step.requestId),
      eq(request.clientId, clientId)
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

    /* Null on the left join, meaning this delivery has no steps at all. The
       entry above still exists — that is the whole point.

       The three columns are checked one by one rather than inferred from
       `stepId`, because the left join made each of them independently nullable
       and the compiler is right not to take one as proof of the others. They
       are `NOT NULL` in the schema, so in practice they are null together. */
    if (r.stepId === null || r.code === null || r.stepTitle === null || r.urgency === null) {
      continue
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
      copyValue: r.copyValue,
      copyLabel: r.copyLabel,
      copyNote: r.copyNote,
      verifyKey: r.verifyKey,
      requestId: r.requestId,
      requestState: r.requestState,
      requestCode: r.requestCode,
      requestTitle: r.requestTitle
    })
  }

  return [...map.values()]
}

/**
 * The facts the platform can see for itself, keyed by `step.verify_key`.
 *
 * One query per verifier, and there is one verifier. Adding a second means
 * adding a query here and a case in `proofFor` — deliberately not a registry
 * with dynamic dispatch, which would be machinery for a list of two.
 */
export async function observedFacts (clientId: number): Promise<ObservedFacts> {
  const rows = await orm()
    .select({ connectedAt: instagramConnection.connectedAt })
    .from(instagramConnection)
    .where(and(
      eq(instagramConnection.clientId, clientId),
      /* `active` only. `failing` still counts as connected — the credential is
         valid and she did the thing — but `expired` and `revoked` do not, and
         the rule in `resolveStep` keeps a step that was already done from
         reverting when one of those arrives. */
      inArray(instagramConnection.state, ['active', 'failing'])
    ))
    .limit(1)

  const row = rows[0]
  return row === undefined ? {} : { [VERIFY_INSTAGRAM]: row.connectedAt }
}

export interface RequestRow {
  id: number
  publicCode: string
  title: string
  description: string | null
  whyItMatters: string | null
  kind: 'data' | 'action' | 'question' | 'material'
  priority: 'low' | 'medium' | 'high'
  state: 'open' | 'answered' | 'analyzing' | 'concluded' | 'dropped'
  raisedBySide: 'consultant' | 'client'
  outcome: string | null
  dueOn: string | null
  createdAt: Date
  updatedAt: Date
}

/**
 * The SQL form of `turnOf()`: rows whose turn belongs to `role`.
 *
 * Kept as one expression reused by every caller rather than repeated per query.
 * The two definitions — this one and the function in `request-actions.ts` —
 * have to agree, and the badge disagreeing with the screen behind it is exactly
 * how a counter teaches people to stop trusting it.
 */
function turnBelongsTo (role: 'consultant' | 'client') {
  const outro = role === 'consultant' ? 'client' : 'consultant'

  return or(
    /* Someone else asked and this side still owes the answer. */
    and(eq(request.raisedBySide, outro), eq(request.state, 'open')),
    /* This side asked, the material arrived, and now it is on them. */
    and(
      eq(request.raisedBySide, role),
      inArray(request.state, ['answered', 'analyzing'])
    )
  )
}

/**
 * How many requests are waiting on whoever is reading.
 *
 * This exists because the product had no way of telling HER anything. The
 * consultant has `/novidades` and a bell; she had neither, and no email is sent
 * by design — so a request opened for her sat there until she happened to look,
 * or until he messaged her outside the platform.
 *
 * It now counts for both sides, and that is the point: the badge used to count
 * only her homework, so his own backlog was invisible to him inside the product
 * and visible to her only as silence.
 */
export async function openRequestCount (
  clientId: number,
  role: 'consultant' | 'client'
): Promise<number> {
  const [row] = await orm()
    .select({ n: sql<number>`COUNT(*)` })
    .from(request)
    .where(and(eq(request.clientId, clientId), turnBelongsTo(role)))

  /* `sql<number>` is an assertion, not a conversion — MySQL hands COUNT back as
     a string, and `"0" > 0` is false while `"0"` is truthy. */
  const parsed = Number(row?.n)
  return Number.isFinite(parsed) ? parsed : 0
}

const CAMPOS_PEDIDO = {
  id: request.id,
  publicCode: request.publicCode,
  title: request.title,
  description: request.description,
  whyItMatters: request.whyItMatters,
  kind: request.kind,
  priority: request.priority,
  state: request.state,
  raisedBySide: request.raisedBySide,
  outcome: request.outcome,
  dueOn: request.dueOn,
  createdAt: request.createdAt,
  updatedAt: request.updatedAt
}

export interface ReadingSection {
  id: number
  title: string | null
  body: string
  highlight: string | null
  highlightLabel: string | null
}

export interface ReadingDelivery {
  id: number
  slug: string
  title: string
  subtitle: string | null
  kind: 'plan' | 'analysis' | 'report' | 'audit'
  periodStart: string | null
  periodEnd: string | null
  readingMinutes: number | null
  publishedAt: Date | null
  sections: ReadingSection[]
}

/**
 * The deliveries that are read rather than done, newest first.
 *
 * Separate from `deliveries()` because the questions differ: that one answers
 * "what is left for her to do" and needs per-user step state, this one answers
 * "what did you find out" and needs prose. They agree on what "published" means
 * by both reading the same two columns, which is the only part worth sharing.
 */
export async function readingDeliveries (clientId: number): Promise<ReadingDelivery[]> {
  const rows = await orm()
    .select({
      id: delivery.id,
      slug: delivery.slug,
      title: delivery.title,
      subtitle: delivery.subtitle,
      kind: delivery.kind,
      periodStart: delivery.periodStart,
      periodEnd: delivery.periodEnd,
      readingMinutes: delivery.readingMinutes,
      publishedAt: delivery.publishedAt,
      sectionId: deliverySection.id,
      sectionTitle: deliverySection.title,
      body: deliverySection.body,
      highlight: deliverySection.highlight,
      highlightLabel: deliverySection.highlightLabel
    })
    .from(delivery)
    /* `leftJoin`, for the same reason `deliveries()` stopped using an inner one
       three hundred lines up: an analysis published before its blocks are
       written would not exist, and the JOIN would be deciding that — which is
       the one thing the spec for this feature says it must never do. Written
       inner on the first pass, in the same change that forbade it. */
    .leftJoin(deliverySection, eq(deliverySection.deliveryId, delivery.id))
    .where(and(
      eq(delivery.clientId, clientId),
      inArray(delivery.kind, ['analysis', 'report', 'audit']),
      isNotNull(delivery.publishedAt),
      sql`${delivery.archivedAt} IS NULL`
    ))
    .orderBy(desc(delivery.publishedAt), deliverySection.position)

  const mapa = new Map<number, ReadingDelivery>()

  for (const r of rows) {
    let entrada = mapa.get(r.id)
    if (entrada === undefined) {
      entrada = {
        id: r.id,
        slug: r.slug,
        title: r.title,
        subtitle: r.subtitle,
        kind: r.kind,
        periodStart: r.periodStart,
        periodEnd: r.periodEnd,
        readingMinutes: r.readingMinutes,
        publishedAt: r.publishedAt,
        sections: []
      }
      mapa.set(r.id, entrada)
    }
    /* Null on the left join: a delivery with no blocks yet. The entry above
       still exists, and the screen decides what to say about it. */
    if (r.sectionId === null || r.body === null) continue

    entrada.sections.push({
      id: r.sectionId,
      title: r.sectionTitle,
      body: r.body,
      highlight: r.highlight,
      highlightLabel: r.highlightLabel
    })
  }

  return [...mapa.values()]
}

export interface Progresso {
  key: string
  label: string
  unit: Unit
  decimals: number
  /** Registered at the start of the cycle. Never recomputed from the series. */
  baseline: number | null
  baselineOn: string | null
  target: number | null
  points: Array<{ period: string; value: number }>
}

/**
 * The cycle's north-star metric over the months, with where it started.
 *
 * The baseline comes from `metric_target`, not from the first point in the
 * series. Deriving it would move it every time an older month is imported, and
 * a baseline that moves with the result turns any performance into progress —
 * the quietest way a panel can lie.
 */
export async function northStarProgress (
  clientId: number,
  cycleId: number
): Promise<Progresso | null> {
  const [alvo] = await orm()
    .select({
      key: metricDef.metricKey,
      label: metricDef.label,
      unit: metricDef.unit,
      decimals: metricDef.decimals,
      baseline: metricTarget.baseline,
      baselineOn: metricTarget.baselineOn,
      target: metricTarget.target
    })
    .from(metricTarget)
    .innerJoin(metricDef, eq(metricDef.id, metricTarget.metricDefId))
    .where(and(
      eq(metricTarget.clientId, clientId),
      eq(metricTarget.cycleId, cycleId),
      /* The per-cycle flag. `metric_def.tier` classifies the catalogue and now
         matches two rows; which one decides THIS cycle is a fact about the
         cycle. A unique index keeps it at one. */
      eq(metricTarget.isNorthStar, 1)
    ))
    .limit(1)

  if (alvo === undefined) return null

  const valores = await orm()
    .select({ period: metricValue.period, value: metricValue.value })
    .from(metricValue)
    .innerJoin(metricDef, eq(metricDef.id, metricValue.metricDefId))
    .where(and(
      eq(metricValue.clientId, clientId),
      eq(metricValue.granularity, 'month'),
      eq(metricDef.metricKey, alvo.key),
      inArray(metricValue.source, [...ORIGENS_MEDIDAS])
    ))
    .orderBy(metricValue.period)

  return {
    key: alvo.key,
    label: alvo.label,
    unit: alvo.unit,
    decimals: alvo.decimals,
    baseline: alvo.baseline === null ? null : Number.parseFloat(alvo.baseline),
    baselineOn: alvo.baselineOn,
    target: alvo.target === null ? null : Number.parseFloat(alvo.target),
    points: valores.map(v => ({ period: v.period, value: Number.parseFloat(v.value) }))
  }
}

export async function requests (clientId: number): Promise<RequestRow[]> {
  return await orm()
    .select(CAMPOS_PEDIDO)
    .from(request)
    .where(eq(request.clientId, clientId))
    .orderBy(request.state, request.position)
}

/**
 * The consultant's work queue: what is on him, oldest first.
 *
 * Ordered by `updatedAt` ascending and not by position, because the question
 * this list answers is "what has been waiting longest", not "what did I decide
 * matters most". A queue sorted by my own priority is a queue that never
 * surfaces the thing I quietly avoided.
 */
export async function workQueue (clientId: number): Promise<RequestRow[]> {
  return await orm()
    .select(CAMPOS_PEDIDO)
    .from(request)
    .where(and(eq(request.clientId, clientId), turnBelongsTo('consultant')))
    .orderBy(request.updatedAt)
}

/**
 * Requests that arrived and were never opened.
 *
 * `answered` and older than the cutoff — `analyzing` is excluded on purpose:
 * once he has said he is reading it, the clock stops. That is the whole reward
 * for pressing the button, and without it the state would never be used.
 */
export async function staleRequests (
  clientId: number,
  cutoff: Date
): Promise<RequestRow[]> {
  return await orm()
    .select(CAMPOS_PEDIDO)
    .from(request)
    .where(and(
      eq(request.clientId, clientId),
      /* Whose turn it is, not the state alone. Filtering on `answered` by
         itself inverted the meaning for anything SHE raised: there, `answered`
         means HE replied and the ball is hers — and the digest was reporting
         her own pending item to him as "ela respondeu e ninguém abriu".

         Through the same expression the work queue uses, so the two screens
         that print this group under the same title cannot disagree about what
         belongs in it. It also widens correctly: a request she opened and he
         never answered is his debt too, and the old filter missed it. */
      turnBelongsTo('consultant'),
      lt(request.updatedAt, cutoff)
    ))
    .orderBy(request.updatedAt)
}

/**
 * The latest period the panel can actually show: the most recent CLOSED month.
 *
 * Restricted to measured sources, and that restriction was the first half of
 * this. The Reels importer writes monthly `views` under `source: 'public'`, so a
 * plain "latest period" jumped to the current month the moment anything was
 * imported, and the panel announced August while the funnel rendered empty.
 *
 * The second half arrived on 14/08/2026, when she connected her account and the
 * sync began writing `source: 'api'` — measured, and therefore past the first
 * guard. The panel jumped to August on its fourteenth day and read it as a whole
 * month: "contas alcançadas 2.668.572, longe do alvo" against a target of
 * 5.413.754, which is July's full month. Half a month can never reach a monthly
 * target, so the screen told her the reach had collapsed on the day the
 * connection started working. The two cycle cards vanished at the same time,
 * because `profile_visits` has no API counterpart and the partial month has no
 * row for it.
 *
 * So the rule is not "measured" but "measured AND finished". A month still being
 * lived is not comparable to a target set for a whole one, and every judgement
 * on this screen — no alvo, longe do alvo, the progress bars — is exactly that
 * comparison. The running month is not lost: `series()` already returns it
 * flagged `partial`, which is where an incomplete number belongs.
 *
 * Falls back to the current month only when there is nothing else, because an
 * imperfect panel beats a blank one for someone who just connected.
 *
 * `hoje` is a parameter so the boundary is testable without waiting for a month
 * to end.
 */
export async function latestPeriod (
  clientId: number,
  hoje: Date = new Date()
): Promise<string | null> {
  const corrente = periodOf(hoje)

  /* DISTINCT, and that is not a tidiness detail. `metric_value` holds one row
     per metric per period — August alone has nine — so a plain `limit(2)`
     returns August twice and the search for an older month finds nothing. The
     first version of this fix did exactly that and changed the screen not at
     all. */
  const rows = await orm()
    .selectDistinct({ period: metricValue.period })
    .from(metricValue)
    .where(and(
      eq(metricValue.clientId, clientId),
      inArray(metricValue.source, [...ORIGENS_MEDIDAS])
    ))
    .orderBy(desc(metricValue.period))
    .limit(2)

  return escolherPeriodo(rows.map(r => r.period), corrente)
}

/**
 * Which of the known periods the panel should show, newest first.
 *
 * Separate from the query so the rule has a test: the rule is the part that was
 * wrong, and it is one line that reads as obviously correct in both versions.
 *
 * Tolerates repeats in the input. The caller asks for DISTINCT periods, but
 * `metric_value` has one row per metric per period, and the first version of
 * this fix received `['2026-08-01', '2026-08-01']` and concluded there was no
 * closed month to fall back to. Deduplicating here means the rule holds however
 * the caller happens to query.
 */
export function escolherPeriodo (periodos: string[], corrente: string): string | null {
  const unicos = [...new Set(periodos)]
  return unicos.find(p => p !== corrente) ?? unicos[0] ?? null
}

/**
 * The month a date falls in, as `YYYY-MM-01`.
 *
 * UTC, matching how the collector stamps its periods — reading this in local
 * time would put the last hours of a Brazilian month into the next one.
 */
export function periodOf (date: Date): string {
  const ano = date.getUTCFullYear()
  const mes = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${ano}-${mes}-01`
}

/**
 * Every answer the CLIENT'S TEAM gave on this client's steps.
 *
 * One list, read by both roles. It used to exist only for the consultant, as a
 * workaround for `deliveries()` joining on the reader's own id; now it is the
 * single source of "what did they say about this chore", and the per-user rows
 * behind it are what still answers "which of them said it".
 *
 * The `user.clientId` filter is what keeps a consultant's own marking out. He
 * can mark a step — the action allows it, and sometimes he does it on her behalf
 * after a call — but his answer must not become the team's, or the plan would
 * report her work back to her in her own screen.
 */
export async function teamStepAnswers (clientId: number): Promise<TeamAnswer[]> {
  return await orm()
    .select({
      stepId: stepStatus.stepId,
      /* Which of them, not just their name. The screen needs to tell the
         reader's OWN row apart from a teammate's: the note a control EDITS has
         to be the reader's, or saving copies one person's words into the
         other's row under the other's name. */
      userId: stepStatus.userId,
      userName: user.name,
      state: stepStatus.state,
      comment: stepStatus.comment,
      updatedAt: stepStatus.updatedAt
    })
    .from(stepStatus)
    .innerJoin(step, eq(step.id, stepStatus.stepId))
    .innerJoin(user, eq(user.id, stepStatus.userId))
    .where(and(
      eq(step.clientId, clientId),
      eq(user.clientId, clientId)
    ))
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

export interface RequestFieldRow {
  id: number
  label: string
  hint: string | null
  unit: 'count' | 'ratio'
  /** Null means unanswered — what the screen reads to know what is left. */
  value: number | null
  answeredAt: Date | null
}

export interface RequestDetail extends RequestRow {
  clientId: number
  events: RequestEventRow[]
  /** Numbers this request asks for, so an integer stops travelling as a PNG. */
  fields: RequestFieldRow[]
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
      raisedBySide: request.raisedBySide,
      outcome: request.outcome,
      dueOn: request.dueOn,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt
    })
    .from(request)
    .where(eq(request.publicCode, publicCode))
    .limit(1)

  const found = rows[0]
  if (found === undefined || !reachable(found.clientId)) return null

  const fields = await orm()
    .select({
      id: requestField.id,
      label: requestField.label,
      hint: requestField.hint,
      unit: requestField.unit,
      value: requestField.value,
      answeredAt: requestField.answeredAt
    })
    .from(requestField)
    .where(eq(requestField.requestId, found.id))
    .orderBy(requestField.position)

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

  return {
    ...found,
    events,
    /* DECIMAL comes back as a string on purpose — see `db/connection.ts`. The
       parse happens here, at the edge, once. */
    fields: fields.map(f => ({
      ...f,
      value: f.value === null ? null : Number.parseFloat(f.value)
    }))
  }
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
  /* What it is. The archive held only Reels while it was fed by the public
     export; the collector returns everything she publishes, so the screen has to
     be able to say which is which. */
  kind: 'reel' | 'carousel' | 'image' | 'story'
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
      id: post.id, igCode: post.igCode, kind: post.kind,
      publishedAt: post.publishedAt,
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
  /** The whole archive, never filtered — the "tudo" chip and the opening line. */
  total: number
  /* The two axes cross, so each one is counted INSIDE the other's current cut:
     with "até 20s" on, `marca` is how many brand posts are also short. That is
     what makes the empty cell visible on the chip itself rather than only in a
     sentence above it. */
  curtos: number
  longos: number
  marca: number
  pessoal: number
  /** Both cuts at once — how many posts the list is actually about. */
  noRecorte: number
  /**
   * Posts whose length nobody knows.
   *
   * They belong to NEITHER side of the duration cut, so the two chips no longer
   * add up to the total — and that is exactly why this has to be counted and
   * said. A post collected from the API arrives without a duration (no endpoint
   * reports a Reel's length), so silently dropping it from both chips would let
   * the archive quietly stop covering the newest content, which is the failure
   * that produced this whole change.
   */
  semDuracao: number
  /* Absolute, both of them: the callout is a claim about the whole archive
     ("none of the 18 brand Reels…"), and a claim that changed as she filtered
     would be a different claim every click. */
  marcaTotal: number
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

/**
 * @param filter The cut currently applied, so each axis can be counted inside
 *   the other. Passing nothing gives the plain archive-wide counts.
 */
export async function postCounts (
  clientId: number,
  filter: PostFilter = {}
): Promise<PostCounts> {
  /* `TRUE` rather than an omitted term: it keeps every expression below one
     shape, so the axis that has no filter reads the same as the one that does
     instead of needing a second query to fall back to. */
  const noBrandCut = filter.brand === undefined
  const brandCut = noBrandCut
    ? sql`TRUE`
    : sql`${post.mentionsBrand} = ${filter.brand === 'marca' ? 1 : 0}`

  const durationCut = filter.duration === undefined
    ? sql`TRUE`
    : filter.duration === 'curto'
      ? sql`${post.durationSec} <= 20`
      : sql`${post.durationSec} > 20`

  const [row] = await orm()
    .select({
      total: sql<number>`COUNT(*)`,
      curtos: sql<number>`SUM(${post.durationSec} <= 20 AND ${brandCut})`,
      longos: sql<number>`SUM(${post.durationSec} > 20 AND ${brandCut})`,
      marca: sql<number>`SUM(${post.mentionsBrand} = 1 AND ${durationCut})`,
      pessoal: sql<number>`SUM(${post.mentionsBrand} = 0 AND ${durationCut})`,
      noRecorte: sql<number>`SUM(${durationCut} AND ${brandCut})`,
      /* Counted inside the brand cut, like the two duration chips, so the three
         of them always describe the same slice of the archive. */
      semDuracao: sql<number>`SUM(${post.durationSec} IS NULL AND ${brandCut})`,
      marcaTotal: sql<number>`SUM(${post.mentionsBrand} = 1)`,
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
    noRecorte: n(row?.noRecorte),
    semDuracao: n(row?.semDuracao),
    marcaTotal: n(row?.marcaTotal),
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
  /** What she does, for the screen to say. Never a permission — see the schema. */
  jobTitle: string | null
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
      jobTitle: user.jobTitle,
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
    jobTitle: r.jobTitle,
    email: r.email,
    hasPassword: r.passwordHash !== null,
    lastSeenAt: r.lastSeenAt
  }))
}
