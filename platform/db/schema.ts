import {
  bigint, char, date, datetime, decimal, index, json, mysqlEnum, mysqlTable,
  smallint, text, tinyint, uniqueIndex, varchar
} from 'drizzle-orm/mysql-core'

/**
 * Transcription of `db/migrations/001-initial-schema.sql`.
 *
 * The SQL is the source of truth — it is what runs against the database. This
 * file only puts types on what already exists there. A new column lands as a
 * migration first and only then here; the other way round produces code that
 * compiles and queries a column that does not exist.
 *
 * `mode: 'number'` on BIGINT: this application's ids never approach 2^53.
 * `DECIMAL` stays a string on purpose — see `connection.ts`.
 */

const id = () => bigint({ mode: 'number', unsigned: true }).autoincrement().primaryKey()

/**
 * Foreign key. The column name is spelled out whenever it differs from the
 * property, rather than relying on `casing: 'snake_case'` when the Drizzle
 * client is built. Forgetting that option would generate queries against
 * columns that do not exist, and the error would surface far from its cause.
 * `test/schema.test.ts` checks every name against information_schema.
 */
const fk = (name?: string) => name === undefined
  ? bigint({ mode: 'number', unsigned: true })
  : bigint(name, { mode: 'number', unsigned: true })

/* DATE columns are strings, not Dates. A calendar day has no time and no zone;
   `new Date('2026-08-04')` is UTC midnight, which renders as 3 August in
   America/Sao_Paulo. That off-by-one-day bug is invisible until a report is
   wrong by one row. */
const createdAt = () => datetime('created_at').notNull()
const updatedAt = () => datetime('updated_at').notNull()

// ------------------------------------------------------------------ identity

export const client = mysqlTable('client', {
  id: id(),
  publicCode: char('public_code', { length: 26 }).notNull(),
  slug: varchar({ length: 60 }).notNull(),
  name: varchar({ length: 120 }).notNull(),
  brand: varchar({ length: 120 }),
  instagramHandle: varchar('instagram_handle', { length: 60 }),
  website: varchar({ length: 255 }),
  niche: varchar({ length: 40 }).notNull().default('lifestyle'),
  timezone: varchar({ length: 40 }).notNull().default('America/Sao_Paulo'),
  archivedAt: datetime('archived_at'),
  createdAt: createdAt(),
  updatedAt: updatedAt()
}, t => [
  uniqueIndex('uq_client_slug').on(t.slug),
  uniqueIndex('uq_client_code').on(t.publicCode)
])

/** `clientId` null = consultant: sees everything. Set = sees only their own. */
export const user = mysqlTable('user', {
  id: id(),
  publicCode: char('public_code', { length: 26 }).notNull(),
  clientId: fk('client_id'),
  email: varchar({ length: 190 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }),
  name: varchar({ length: 120 }).notNull(),
  /**
   * What this person does — "assessora de conteúdo". Descriptive, never a
   * permission: the access rule is still `clientId` and nothing else, and the
   * one thing an assistant may not do is decided from
   * `instagram_connection.connectedBy`, a fact that already existed.
   */
  jobTitle: varchar('job_title', { length: 80 }),
  role: mysqlEnum(['consultant', 'client']).notNull(),
  active: tinyint().notNull().default(1),
  lastSeenAt: datetime('last_seen_at'),
  /* When this user last opened the activity screen. Distinct from
     `lastSeenAt`, which advances on every sign-in and would mark everything
     read just for opening the app. */
  newsSeenAt: datetime('news_seen_at'),
  createdAt: createdAt(),
  updatedAt: updatedAt()
}, t => [
  uniqueIndex('uq_user_email').on(t.email),
  uniqueIndex('uq_user_code').on(t.publicCode),
  index('ix_user_client').on(t.clientId)
])

/** `id` is the SHA-256 of the cookie token — a leak yields no usable session. */
export const session = mysqlTable('session', {
  id: char({ length: 64 }).primaryKey(),
  userId: fk('user_id').notNull(),
  expiresAt: datetime('expires_at').notNull(),
  ip: varchar({ length: 45 }),
  userAgent: varchar('user_agent', { length: 255 }),
  createdAt: createdAt(),
  usedAt: datetime('used_at').notNull()
}, t => [
  index('ix_session_user').on(t.userId),
  index('ix_session_expires').on(t.expiresAt)
])

export const credentialToken = mysqlTable('credential_token', {
  id: id(),
  userId: fk('user_id').notNull(),
  tokenHash: char('token_hash', { length: 64 }).notNull(),
  purpose: mysqlEnum(['invite', 'reset']).notNull(),
  expiresAt: datetime('expires_at').notNull(),
  usedAt: datetime('used_at'),
  createdAt: createdAt()
}, t => [
  uniqueIndex('uq_credential_hash').on(t.tokenHash),
  index('ix_credential_user').on(t.userId, t.purpose)
])

// ---------------------------------------------------------------------- work

export const cycle = mysqlTable('cycle', {
  id: id(),
  publicCode: char('public_code', { length: 26 }).notNull(),
  clientId: fk('client_id').notNull(),
  title: varchar({ length: 160 }).notNull(),
  goal: text(),
  /** What this cycle knowingly gives up, agreed before it starts. */
  tradeOff: text('trade_off'),
  northStarMetric: varchar('north_star_metric', { length: 160 }),
  startsOn: date('starts_on', { mode: 'string' }).notNull(),
  endsOn: date('ends_on', { mode: 'string' }),
  state: mysqlEnum(['draft', 'active', 'closed']).notNull().default('draft'),
  createdAt: createdAt(),
  updatedAt: updatedAt()
}, t => [
  uniqueIndex('uq_cycle_code').on(t.publicCode),
  uniqueIndex('uq_cycle_client_title').on(t.clientId, t.title),
  index('ix_cycle_client').on(t.clientId, t.state)
])

export const delivery = mysqlTable('delivery', {
  id: id(),
  publicCode: char('public_code', { length: 26 }).notNull(),
  clientId: fk('client_id').notNull(),
  cycleId: fk('cycle_id'),
  slug: varchar({ length: 80 }).notNull(),
  title: varchar({ length: 200 }).notNull(),
  subtitle: text(),
  kind: mysqlEnum(['plan', 'analysis', 'report', 'audit']).notNull(),
  periodStart: date('period_start', { mode: 'string' }),
  periodEnd: date('period_end', { mode: 'string' }),
  readingMinutes: smallint('reading_minutes', { unsigned: true }),
  position: smallint({ unsigned: true }).notNull().default(0),
  publishedAt: datetime('published_at'),
  archivedAt: datetime('archived_at'),
  createdAt: createdAt(),
  updatedAt: updatedAt()
}, t => [
  uniqueIndex('uq_delivery_code').on(t.publicCode),
  uniqueIndex('uq_delivery_client_slug').on(t.clientId, t.slug),
  index('ix_delivery_cycle').on(t.cycleId)
])

export const step = mysqlTable('step', {
  id: id(),
  deliveryId: fk('delivery_id').notNull(),
  clientId: fk('client_id').notNull(),
  /**
   * The request this chore IS, when it is one.
   *
   * Step `c1` and request #32 were the same job on two screens with nothing
   * joining them: she sent the prints in Pedidos and Plano went on asking. With
   * this set, the step is done the moment the request leaves `open`.
   *
   * No foreign key — see `db/migrations/010`. A dangling id degrades to "this
   * step verifies nothing", which is how a step with neither column behaves.
   */
  requestId: fk('request_id'),
  /**
   * A fact the platform can observe on its own, by name.
   *
   * Today the only value is `instagram_connected`. The verifiers live in
   * `lib/verificacao.ts`; a string rather than an enum so adding one is code
   * plus a seed line, not a migration.
   */
  verifyKey: varchar('verify_key', { length: 40 }),
  code: varchar({ length: 12 }).notNull(),
  title: varchar({ length: 200 }).notNull(),
  summary: text(),
  deadlineLabel: varchar('deadline_label', { length: 40 }),
  urgency: mysqlEnum(['today', 'this_week', 'ongoing']).notNull().default('this_week'),
  evidenceValue: varchar('evidence_value', { length: 60 }),
  evidenceLabel: varchar('evidence_label', { length: 160 }),
  /** The exact string she has to paste, where it goes, and what to know about it. */
  copyValue: text('copy_value'),
  copyLabel: varchar('copy_label', { length: 120 }),
  copyNote: text('copy_note'),
  position: smallint({ unsigned: true }).notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt()
}, t => [
  uniqueIndex('uq_step_delivery_code').on(t.deliveryId, t.code),
  index('ix_step_client').on(t.clientId),
  index('ix_step_request').on(t.requestId)
])

/**
 * The editorial pillars: the mix, and the argument for it.
 *
 * Scoped to a cycle, because a pillar is a bet with an expiry date — see
 * `db/migrations/003-pillars-and-copy-value.sql`.
 */
export const pillar = mysqlTable('pillar', {
  id: id(),
  clientId: fk('client_id').notNull(),
  cycleId: fk('cycle_id').notNull(),
  pillarKey: varchar('pillar_key', { length: 40 }).notNull(),
  name: varchar({ length: 80 }).notNull(),
  sharePct: tinyint('share_pct', { unsigned: true }),
  perWeek: varchar('per_week', { length: 40 }),
  thesis: text(),
  roleNote: text('role_note'),
  evidence: text(),
  /** By `metric_def.metric_key`, not by id — the seed writes both in one run. */
  metricKey: varchar('metric_key', { length: 60 }),
  successLabel: varchar('success_label', { length: 200 }),
  /** The pillar that must NOT change: the control the reallocation is read against. */
  isControl: tinyint('is_control').notNull().default(0),
  position: smallint({ unsigned: true }).notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt()
}, t => [
  uniqueIndex('uq_pillar_cycle_key').on(t.cycleId, t.pillarKey),
  index('ix_pillar_client').on(t.clientId)
])

/**
 * Prose inside a delivery, for the ones that are read rather than done.
 *
 * `highlight` is text, not a decimal: it holds "41×", "0,025%", "3.131" —
 * already formatted, in the unit the sentence uses. A number column would make
 * the screen re-decide formatting the writer had already decided, and "41×" is
 * not a quantity in any unit this schema knows.
 */
export const deliverySection = mysqlTable('delivery_section', {
  id: id(),
  deliveryId: fk('delivery_id').notNull(),
  position: smallint({ unsigned: true }).notNull().default(0),
  /** Absent means this block continues the one above rather than opening. */
  title: varchar({ length: 200 }),
  body: text().notNull(),
  highlight: varchar({ length: 40 }),
  highlightLabel: varchar('highlight_label', { length: 160 }),
  createdAt: createdAt(),
  updatedAt: updatedAt()
}, t => [
  uniqueIndex('uq_section_position').on(t.deliveryId, t.position),
  index('ix_section_delivery').on(t.deliveryId, t.position)
])

/** Three states, not two: `blocked` is what a checkbox threw away. */
export const stepStatus = mysqlTable('step_status', {
  id: id(),
  stepId: fk('step_id').notNull(),
  userId: fk('user_id').notNull(),
  state: mysqlEnum(['pending', 'done', 'blocked']).notNull().default('pending'),
  comment: text(),
  completedAt: datetime('completed_at'),
  updatedAt: updatedAt(),
  createdAt: createdAt()
}, t => [
  uniqueIndex('uq_step_status').on(t.stepId, t.userId),
  index('ix_step_status_user').on(t.userId)
])

export const request = mysqlTable('request', {
  id: id(),
  publicCode: char('public_code', { length: 26 }).notNull(),
  clientId: fk('client_id').notNull(),
  deliveryId: fk('delivery_id'),
  cycleId: fk('cycle_id'),
  title: varchar({ length: 200 }).notNull(),
  description: text(),
  whyItMatters: text('why_it_matters'),
  kind: mysqlEnum(['data', 'action', 'question', 'material']).notNull().default('data'),
  raisedBySide: mysqlEnum('raised_by_side', ['consultant', 'client']).notNull().default('consultant'),
  priority: mysqlEnum(['low', 'medium', 'high']).notNull().default('medium'),
  /* In the order the baton travels. `analyzing` is the only one that promises
     human attention, which is why nothing sets it automatically. */
  state: mysqlEnum(['open', 'answered', 'analyzing', 'concluded', 'dropped'])
    .notNull().default('open'),
  /** What came out of it. Required to conclude — see `lib/pedido-store.ts`. */
  outcome: text(),
  dueOn: date('due_on', { mode: 'string' }),
  openedBy: fk('opened_by'),
  closedAt: datetime('closed_at'),
  position: smallint({ unsigned: true }).notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt()
}, t => [
  uniqueIndex('uq_request_code').on(t.publicCode),
  index('ix_request_client_state').on(t.clientId, t.state, t.dueOn),
  index('ix_request_delivery').on(t.deliveryId)
])

/**
 * A number a request asks for, and where the answer lands.
 *
 * This is what stops an integer travelling as a screenshot. `metric_value` is
 * written by three things and none of them reads an upload, so before this a
 * figure she could type in four seconds waited for someone to open a PNG.
 *
 * `target` is an enum and not a column name: a stored column name is an
 * injection surface and a magic value nobody validates, and the day one said
 * `reach` the archive would hold a reach that was typed instead of measured.
 */
export const requestField = mysqlTable('request_field', {
  id: id(),
  requestId: fk('request_id').notNull(),
  /**
   * What this field ASKS FOR, stable across every rewording of the label.
   *
   * The identity used to be the label, and rewriting five of them turned five
   * fields into nine — the screen would have asked for the same number twice,
   * in two sentences. Not keyed on `(metricKey, postCode)`, which is what the
   * field really is, because both are nullable and MySQL lets a UNIQUE index
   * repeat rows containing NULL: the constraint would be absent for exactly
   * the rows most likely to collide.
   */
  slug: varchar({ length: 60 }),
  position: smallint({ unsigned: true }).notNull().default(0),
  label: varchar({ length: 160 }).notNull(),
  /** The path inside Instagram, handed over rather than described. */
  hint: varchar({ length: 255 }),
  unit: mysqlEnum(['count', 'ratio']).notNull().default('count'),
  target: mysqlEnum(['metric', 'post_share']).notNull().default('metric'),
  metricKey: varchar('metric_key', { length: 60 }),
  /** `YYYY-MM-01`. Null means the month it is answered in. */
  period: date({ mode: 'string' }),
  /** The shortcode, for `post_share`. */
  postCode: varchar('post_code', { length: 40 }),
  /** What she typed, in stored form. Null means unanswered. */
  value: decimal({ precision: 16, scale: 6 }),
  answeredAt: datetime('answered_at'),
  answeredBy: fk('answered_by'),
  createdAt: createdAt(),
  updatedAt: updatedAt()
}, t => [
  uniqueIndex('uq_field_request_slug').on(t.requestId, t.slug),
  index('ix_field_request').on(t.requestId, t.position)
])

export const requestEvent = mysqlTable('request_event', {
  id: id(),
  requestId: fk('request_id').notNull(),
  userId: fk('user_id'),
  kind: mysqlEnum(['comment', 'state_change', 'file', 'view']).notNull(),
  body: text(),
  fromState: varchar('from_state', { length: 20 }),
  toState: varchar('to_state', { length: 20 }),
  fileId: fk('file_id'),
  createdAt: createdAt()
}, t => [
  index('ix_event_request').on(t.requestId, t.createdAt)
])

export const file = mysqlTable('file', {
  id: id(),
  publicCode: char('public_code', { length: 26 }).notNull(),
  clientId: fk('client_id').notNull(),
  requestId: fk('request_id'),
  originalName: varchar('original_name', { length: 255 }).notNull(),
  path: varchar({ length: 400 }).notNull(),
  mime: varchar({ length: 100 }).notNull(),
  bytes: bigint({ mode: 'number', unsigned: true }).notNull(),
  sha256: char({ length: 64 }).notNull(),
  uploadedBy: fk('uploaded_by'),
  createdAt: createdAt()
}, t => [
  uniqueIndex('uq_file_code').on(t.publicCode),
  index('ix_file_client').on(t.clientId, t.createdAt),
  index('ix_file_request').on(t.requestId),
  index('ix_file_sha').on(t.clientId, t.sha256)
])

// -------------------------------------------------------------------- pautas

/**
 * A pauta with a date, a script and a state.
 *
 * The cycle's finding is that ONE kind of video converts — long, her opinion,
 * her subject — and that is the one that needs a script. The other five or six
 * Reels of her week are the spontaneous distribution engine, and scripting them
 * would break exactly what works. So this table is deliberately small per week.
 *
 * `hook` is written out and never described, the lesson `step.copyValue`
 * already paid for.
 */
export const idea = mysqlTable('idea', {
  id: id(),
  publicCode: char('public_code', { length: 26 }).notNull(),
  clientId: fk('client_id').notNull(),
  cycleId: fk('cycle_id'),
  /** By `pillar.pillarKey`, like `pillar.metricKey` — the seed writes both together. */
  pillarKey: varchar('pillar_key', { length: 40 }),
  title: varchar({ length: 200 }).notNull(),
  hook: text(),
  format: mysqlEnum(['reel', 'carrossel', 'story', 'foto']).notNull().default('reel'),
  targetSeconds: smallint('target_seconds', { unsigned: true }),
  why: text(),
  caption: text(),
  cta: varchar({ length: 200 }),
  /** The cronograma. Null means it is in the bank rather than on a day. */
  scheduledFor: date('scheduled_for', { mode: 'string' }),
  state: mysqlEnum(['proposed', 'scheduled', 'recorded', 'published', 'dropped'])
    .notNull().default('proposed'),
  /** The shortcode of the post it became, typed in when it goes out. */
  publishedCode: varchar('published_code', { length: 40 }),
  position: smallint({ unsigned: true }).notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt()
}, t => [
  uniqueIndex('uq_idea_code').on(t.publicCode),
  uniqueIndex('uq_idea_client_title').on(t.clientId, t.title),
  index('ix_idea_agenda').on(t.clientId, t.state, t.scheduledFor)
])

/**
 * The script, beat by beat.
 *
 * Rows and not one block of prose: she holds the phone and reads the next line.
 * `says` and `shows` are separate because they are instructions to different
 * people — the assistant behind the camera is not the one talking.
 */
export const ideaBeat = mysqlTable('idea_beat', {
  id: id(),
  ideaId: fk('idea_id').notNull(),
  position: smallint({ unsigned: true }).notNull().default(0),
  timeLabel: varchar('time_label', { length: 20 }),
  says: text().notNull(),
  shows: text(),
  note: varchar({ length: 255 })
}, t => [
  uniqueIndex('uq_beat_position').on(t.ideaId, t.position),
  index('ix_beat_idea').on(t.ideaId, t.position)
])

/**
 * What they write back about a pauta, from either side.
 *
 * Its own table for the reason `step_status` is one: `db/seed.ts` re-authors
 * every idea on every run, and a feedback column on `idea` would be erased by
 * the next `npm run db:seed` with no trace.
 */
export const ideaNote = mysqlTable('idea_note', {
  id: id(),
  ideaId: fk('idea_id').notNull(),
  userId: fk('user_id').notNull(),
  body: text().notNull(),
  createdAt: createdAt()
}, t => [
  index('ix_note_idea').on(t.ideaId, t.createdAt)
])

// ------------------------------------------------------------------- numbers

export const metricDef = mysqlTable('metric_def', {
  id: id(),
  metricKey: varchar('metric_key', { length: 60 }).notNull(),
  label: varchar({ length: 120 }).notNull(),
  shortLabel: varchar('short_label', { length: 40 }),
  unit: mysqlEnum(['ratio', 'count', 'currency', 'seconds']).notNull(),
  direction: mysqlEnum(['up', 'down']).notNull().default('up'),
  decimals: tinyint({ unsigned: true }).notNull().default(2),
  description: text(),
  howToMeasure: varchar('how_to_measure', { length: 255 }),
  tier: mysqlEnum(['north_star', 'decision', 'monitor']).notNull().default('monitor')
}, t => [
  uniqueIndex('uq_metric_key').on(t.metricKey)
])

/** Unique per SOURCE: Insights and GA4 disagree, and the disagreement is data. */
export const metricValue = mysqlTable('metric_value', {
  id: id(),
  clientId: fk('client_id').notNull(),
  metricDefId: fk('metric_def_id').notNull(),
  period: date({ mode: 'string' }).notNull(),
  granularity: mysqlEnum(['day', 'week', 'month']).notNull().default('month'),
  value: decimal({ precision: 16, scale: 6 }).notNull(),
  sampleSize: bigint('sample_size', { mode: 'number', unsigned: true }),
  /* `api` is collected by machine from the official source; `insights` is a
     person reading the app and typing. Both coexist for the same metric and
     period — the unique key includes `source` — so the screen resolves them by
     declared precedence. See `lib/precedencia.ts`. */
  source: mysqlEnum(['api', 'insights', 'ga4', 'store', 'public', 'manual']).notNull(),
  note: varchar({ length: 255 }),
  createdAt: createdAt(),
  updatedAt: updatedAt()
}, t => [
  uniqueIndex('uq_metric_value')
    .on(t.clientId, t.metricDefId, t.period, t.granularity, t.source),
  index('ix_metric_value_series').on(t.clientId, t.metricDefId, t.period)
])

/** `contaminated` is the "baseline before target" rule written in SQL. */
export const metricTarget = mysqlTable('metric_target', {
  id: id(),
  clientId: fk('client_id').notNull(),
  cycleId: fk('cycle_id').notNull(),
  metricDefId: fk('metric_def_id').notNull(),
  baseline: decimal({ precision: 16, scale: 6 }),
  baselineOn: date('baseline_on', { mode: 'string' }),
  target: decimal({ precision: 16, scale: 6 }),
  contaminated: tinyint().notNull().default(0),
  /**
   * Which metric decides THIS cycle.
   *
   * Not `metric_def.tier`: that classifies the catalogue, and a metric demoted
   * there would rewrite what a closed cycle claims it was steering by. A cycle
   * has exactly one, enforced by a unique index over a generated column — see
   * `db/migrations/009-norte-por-ciclo.sql`.
   */
  isNorthStar: tinyint('is_north_star').notNull().default(0),
  note: text(),
  createdAt: createdAt(),
  updatedAt: updatedAt()
}, t => [
  uniqueIndex('uq_target').on(t.cycleId, t.metricDefId),
  index('ix_target_client').on(t.clientId)
])

/** `source` and `updatedOn` are required: a benchmark with no provenance is a rumour. */
export const benchmark = mysqlTable('benchmark', {
  id: id(),
  niche: varchar({ length: 40 }).notNull(),
  metricDefId: fk('metric_def_id').notNull(),
  value: decimal({ precision: 16, scale: 6 }).notNull(),
  source: varchar({ length: 200 }).notNull(),
  updatedOn: date('updated_on', { mode: 'string' }).notNull()
}, t => [
  uniqueIndex('uq_benchmark').on(t.niche, t.metricDefId)
])

export const experiment = mysqlTable('experiment', {
  id: id(),
  publicCode: char('public_code', { length: 26 }).notNull(),
  clientId: fk('client_id').notNull(),
  cycleId: fk('cycle_id').notNull(),
  name: varchar({ length: 160 }).notNull(),
  hypothesis: text().notNull(),
  isolatedVariable: varchar('isolated_variable', { length: 160 }),
  metricDefId: fk('metric_def_id'),
  successValue: decimal('success_value', { precision: 16, scale: 6 }),
  successLabel: varchar('success_label', { length: 200 }),
  minSample: smallint('min_sample', { unsigned: true }),
  minDays: smallint('min_days', { unsigned: true }),
  position: smallint({ unsigned: true }).notNull().default(0),
  startsOn: date('starts_on', { mode: 'string' }),
  endsOn: date('ends_on', { mode: 'string' }),
  state: mysqlEnum(['not_started', 'running', 'read', 'inconclusive', 'abandoned'])
    .notNull().default('not_started'),
  outcome: text(),
  createdAt: createdAt(),
  updatedAt: updatedAt()
}, t => [
  uniqueIndex('uq_experiment_code').on(t.publicCode),
  uniqueIndex('uq_experiment_cycle_name').on(t.cycleId, t.name),
  index('ix_experiment_cycle').on(t.cycleId, t.position)
])

// ------------------------------------------------------------------- archive

/**
 * Public-source and Insights-source columns are separate and NULL by default.
 * A NULL `reach` is the truth when the source is public — filling it with
 * `views` would fabricate a denominator, and every rate here is reach-normalised.
 */
export const post = mysqlTable('post', {
  id: id(),
  clientId: fk('client_id').notNull(),
  igCode: varchar('ig_code', { length: 40 }).notNull(),
  kind: mysqlEnum(['reel', 'carousel', 'image', 'story']).notNull(),
  publishedAt: datetime('published_at').notNull(),
  url: varchar({ length: 255 }),
  caption: text(),
  durationSec: smallint('duration_sec', { unsigned: true }),
  pillar: varchar({ length: 40 }),
  mentionsBrand: tinyint('mentions_brand'),
  namesProduct: tinyint('names_product'),
  hasCta: tinyint('has_cta'),
  boosted: tinyint(),

  views: bigint({ mode: 'number', unsigned: true }),
  likes: bigint({ mode: 'number', unsigned: true }),
  comments: bigint({ mode: 'number', unsigned: true }),
  reposts: bigint({ mode: 'number', unsigned: true }),

  reach: bigint({ mode: 'number', unsigned: true }),
  saves: bigint({ mode: 'number', unsigned: true }),
  sends: bigint({ mode: 'number', unsigned: true }),
  retentionPct: decimal('retention_pct', { precision: 6, scale: 3 }),
  /**
   * The share of this post's reach that was NOT already following her.
   *
   * The honest denominator for follower conversion — someone who already
   * follows cannot follow again — and the number the cycle's 41× finding rests
   * on. Neither the API nor the public export has it: it exists only on the
   * Público tab of each Reel, which is why a request asks for it and
   * `request_field` can write it.
   */
  nonFollowerPct: decimal('non_follower_pct', { precision: 6, scale: 5 }),
  avgWatchSec: decimal('avg_watch_sec', { precision: 8, scale: 2 }),

  provenance: mysqlEnum(['public', 'insights', 'mixed']).notNull().default('public'),
  createdAt: createdAt(),
  updatedAt: updatedAt()
}, t => [
  uniqueIndex('uq_post').on(t.clientId, t.igCode),
  index('ix_post_date').on(t.clientId, t.publishedAt),
  index('ix_post_pillar').on(t.clientId, t.pillar, t.durationSec)
])

// --------------------------------------------------------- external accounts

/**
 * The client's Instagram account, authorised by her.
 *
 * `accessToken` holds ciphertext, never the token — see `lib/crypto-box.ts`.
 * Anything that selects it must decrypt before use and must never put the
 * result in a response, a screen, or a log.
 *
 * `state` separates `expired` from `failing` on purpose: a credential can be
 * perfectly valid while collection keeps erroring, and telling her to reconnect
 * would fix nothing.
 */
export const instagramConnection = mysqlTable('instagram_connection', {
  id: id(),
  publicCode: char('public_code', { length: 26 }).notNull(),
  clientId: fk('client_id').notNull(),
  igUserId: varchar('ig_user_id', { length: 32 }).notNull(),
  username: varchar({ length: 80 }),
  accessToken: text('access_token'),
  tokenExpiresAt: datetime('token_expires_at'),
  scopes: varchar({ length: 255 }),
  /* The version of the agreement she accepted, not a boolean: a flag would go
     on reading "agreed" after the text was rewritten. */
  termsVersion: varchar('terms_version', { length: 20 }),
  termsAcceptedAt: datetime('terms_accepted_at'),
  connectedBy: fk('connected_by'),
  connectedAt: datetime('connected_at'),
  lastRefreshAt: datetime('last_refresh_at'),
  lastSyncAt: datetime('last_sync_at'),
  state: mysqlEnum(['active', 'expired', 'revoked', 'failing']).notNull().default('active'),
  lastError: varchar('last_error', { length: 255 }),
  lastErrorAt: datetime('last_error_at'),
  createdAt: createdAt(),
  updatedAt: updatedAt()
}, t => [
  uniqueIndex('uq_ig_connection_code').on(t.publicCode),
  /* One account per client, enforced here and not by whoever writes the insert.
     Two rows would mean two tokens and no rule about which one is current. */
  uniqueIndex('uq_ig_connection_client').on(t.clientId),
  index('ix_ig_connection_state').on(t.state, t.tokenExpiresAt)
])

// --------------------------------------------------------------------- audit

export const auditLog = mysqlTable('audit_log', {
  id: id(),
  userId: fk('user_id'),
  clientId: fk('client_id'),
  action: varchar({ length: 60 }).notNull(),
  entity: varchar({ length: 40 }),
  entityId: fk('entity_id'),
  details: json(),
  ip: varchar({ length: 45 }),
  createdAt: createdAt()
}, t => [
  index('ix_audit_client').on(t.clientId, t.createdAt),
  index('ix_audit_user').on(t.userId, t.createdAt)
])
