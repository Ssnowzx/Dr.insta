import 'server-only'
import { and, asc, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm'
import { orm } from '@/db/client'
import { auditLog, idea, ideaBeat, ideaNote, pillar, user } from '@/db/schema'

/**
 * The pautas and their scripts — everything the Ideias screen reads.
 *
 * Every function takes `clientId` first and filters on it, like `dashboard.ts`.
 * A domain query that can run without a client is a cross-client leak waiting
 * for someone to forget an argument.
 *
 * WHY THIS IS A SEPARATE MODULE
 *
 * `dashboard.ts` is 1.300 lines and answers "how is she doing". This answers
 * "what does she record next", which is a different screen with a different
 * cadence: the panel is read once a week, this is read on the days she films.
 */

export type IdeaState = 'proposed' | 'scheduled' | 'recorded' | 'published' | 'dropped'

export interface Beat {
  id: number
  timeLabel: string | null
  says: string
  shows: string | null
  note: string | null
}

export interface IdeaRow {
  id: number
  publicCode: string
  pillarKey: string | null
  /** Resolved from `pillar`, so the screen names it the way the plan names it. */
  pillarName: string | null
  title: string
  hook: string | null
  format: 'reel' | 'carrossel' | 'story' | 'foto'
  targetSeconds: number | null
  why: string | null
  caption: string | null
  cta: string | null
  scheduledFor: string | null
  state: IdeaState
  publishedCode: string | null
  /** How many beats the script has. Zero means a pauta without a script yet. */
  beats: number
  /** How many notes have been written on it, so the card can say there is talk. */
  notes: number
}

const CAMPOS = {
  id: idea.id,
  publicCode: idea.publicCode,
  pillarKey: idea.pillarKey,
  title: idea.title,
  hook: idea.hook,
  format: idea.format,
  targetSeconds: idea.targetSeconds,
  why: idea.why,
  caption: idea.caption,
  cta: idea.cta,
  scheduledFor: idea.scheduledFor,
  state: idea.state,
  publishedCode: idea.publishedCode
}

/**
 * Every pauta for a client, newest schedule first among the dated ones.
 *
 * The pillar name comes through a LEFT JOIN on `pillar_key` scoped to the same
 * cycle. A pauta naming a pillar the cycle does not have is a draft, not an
 * error, and must still render — the same call `pillars()` makes about
 * `metric_def`.
 *
 * The two counts are subqueries rather than joins. A join to `idea_beat` would
 * multiply the row by its beats, and the version of this that did returned the
 * same pauta nine times with the note count inflated by nine.
 */
export async function ideas (clientId: number): Promise<IdeaRow[]> {
  const rows = await orm()
    .select({
      ...CAMPOS,
      pillarName: pillar.name,
      beats: sql<number>`(SELECT COUNT(*) FROM idea_beat b WHERE b.idea_id = ${idea.id})`,
      notes: sql<number>`(SELECT COUNT(*) FROM idea_note n WHERE n.idea_id = ${idea.id})`
    })
    .from(idea)
    .leftJoin(pillar, and(
      eq(pillar.pillarKey, idea.pillarKey),
      eq(pillar.cycleId, idea.cycleId)
    ))
    .where(eq(idea.clientId, clientId))
    /* Undated pautas last: `scheduled_for` is NULL for the bank, and MySQL sorts
       NULL first ascending. The bank is the overflow, not the headline. */
    .orderBy(sql`${idea.scheduledFor} IS NULL`, asc(idea.scheduledFor), asc(idea.position))

  /* `sql<number>` is an assertion, not a conversion — MySQL hands COUNT back as
     a string, and `"0" > 0` is false while `"0"` is truthy. That mismatch has
     already hidden one finding in this codebase. */
  return rows.map(r => ({
    ...r,
    beats: Number(r.beats) || 0,
    notes: Number(r.notes) || 0
  }))
}

export interface IdeaNote {
  id: number
  body: string
  userName: string
  /** Whether it came from the client's side, so the screen can tell the voices apart. */
  fromClient: boolean
  createdAt: Date
}

export interface IdeaDetail extends IdeaRow {
  clientId: number
  script: Beat[]
  conversa: IdeaNote[]
}

/**
 * One pauta with its script and everything written about it.
 *
 * Looked up by `public_code`, like a request: the code is what appears in the
 * URL, and a sequential id there would publish how many pautas exist.
 *
 * Returns `null` for both "does not exist" and "belongs to someone else". The
 * caller must not be able to tell those apart, or the URL becomes a way to test
 * whether a pauta exists.
 */
export async function ideaDetail (
  publicCode: string,
  reachable: (clientId: number) => boolean
): Promise<IdeaDetail | null> {
  const rows = await orm()
    .select({
      ...CAMPOS,
      clientId: idea.clientId,
      pillarName: pillar.name
    })
    .from(idea)
    .leftJoin(pillar, and(
      eq(pillar.pillarKey, idea.pillarKey),
      eq(pillar.cycleId, idea.cycleId)
    ))
    .where(eq(idea.publicCode, publicCode))
    .limit(1)

  const found = rows[0]
  if (found === undefined || !reachable(found.clientId)) return null

  const [script, conversa] = await Promise.all([
    orm()
      .select({
        id: ideaBeat.id,
        timeLabel: ideaBeat.timeLabel,
        says: ideaBeat.says,
        shows: ideaBeat.shows,
        note: ideaBeat.note
      })
      .from(ideaBeat)
      .where(eq(ideaBeat.ideaId, found.id))
      .orderBy(asc(ideaBeat.position)),

    orm()
      .select({
        id: ideaNote.id,
        body: ideaNote.body,
        userName: user.name,
        userClientId: user.clientId,
        createdAt: ideaNote.createdAt
      })
      .from(ideaNote)
      .innerJoin(user, eq(user.id, ideaNote.userId))
      .where(eq(ideaNote.ideaId, found.id))
      .orderBy(asc(ideaNote.createdAt))
  ])

  return {
    ...found,
    beats: script.length,
    notes: conversa.length,
    script,
    conversa: conversa.map(n => ({
      id: n.id,
      body: n.body,
      userName: n.userName,
      fromClient: n.userClientId !== null,
      createdAt: n.createdAt
    }))
  }
}

/**
 * How many pautas are waiting to be recorded.
 *
 * `published` and `dropped` are out: one is finished and the other was refused,
 * and a badge that counts them would never reach zero — which is the fastest way
 * to teach someone that a number on a nav item means nothing.
 */
export async function pendingIdeaCount (clientId: number): Promise<number> {
  const [row] = await orm()
    .select({ n: sql<number>`COUNT(*)` })
    .from(idea)
    .where(and(
      eq(idea.clientId, clientId),
      inArray(idea.state, ['proposed', 'scheduled', 'recorded'])
    ))

  const parsed = Number(row?.n)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Notes written on pautas in a window, for the digest.
 *
 * `side` picks whose notes to report: the consultant wants what THEY wrote, and
 * they want what HE wrote. A shared list would tell each of them what they
 * already know — the rule `lib/digest.ts` follows everywhere else.
 */
export async function ideaNotesSince (
  clientId: number,
  since: Date,
  until: Date,
  side: 'client' | 'consultant',
  /**
   * Whose notes to leave out — the reader's own.
   *
   * Needed once the client side is two people: "what my teammate wrote" cannot
   * be expressed by role alone. Zero is no user, so the default excludes
   * nobody and the four callers that do not care are unaffected.
   */
  exceptUserId = 0
): Promise<Array<{ title: string; body: string; who: string; at: Date; code: string }>> {
  const rows = await orm()
    .select({
      title: idea.title,
      code: idea.publicCode,
      body: ideaNote.body,
      who: user.name,
      at: ideaNote.createdAt
    })
    .from(ideaNote)
    .innerJoin(idea, eq(idea.id, ideaNote.ideaId))
    .innerJoin(user, eq(user.id, ideaNote.userId))
    .where(and(
      eq(idea.clientId, clientId),
      side === 'client' ? eq(user.role, 'client') : eq(user.role, 'consultant'),
      ne(user.id, exceptUserId),
      sql`${ideaNote.createdAt} >= ${since}`,
      sql`${ideaNote.createdAt} < ${until}`
    ))
    .orderBy(desc(ideaNote.createdAt))

  return rows
}

/**
 * Pautas published in a window, for the consultant's digest.
 *
 * The one signal that closes the loop: a script went out, and whether it worked
 * is now a question the archive can answer. Without it he finds out by opening
 * the screen, which is the "depends on someone remembering" this product removed
 * everywhere else.
 */
/** The four transitions a person can perform, and nothing else. */
const ESTADO_AUDITADO: Record<string, IdeaState> = {
  idea_scheduled: 'scheduled',
  idea_recorded: 'recorded',
  idea_published: 'published',
  idea_dropped: 'dropped'
}

/**
 * Pautas a PERSON moved in the window — read from the audit log, not from a
 * row timestamp.
 *
 * THIS USED TO REPORT THE SEED RUN AS HER WORK
 *
 * It read `idea.updatedAt`, and `db/seed.ts` upserts every pauta with
 * `updatedAt: now` on every run. So each re-seed manufactured one "entrou na
 * fila" per scheduled pauta, dated that minute and shown under her name in
 * both digests. Eight phantom events per run, three runs in three days, and
 * they were indistinguishable from the real thing — which is worse than
 * useless, because the digest is what we read to find out whether anyone is
 * using this.
 *
 * The audit log carries only what a person did, with `userId` attached, so it
 * fixes the attribution in the same move: the old code named the account
 * because the row "does not record which of them last touched it". It does,
 * one table over.
 *
 * The cost, stated: transitions made before the audit log existed are not in
 * here. The alternative was keeping a query that invents events, and an empty
 * history is more honest than a fabricated one.
 */
export async function ideasMovedSince (
  clientId: number,
  since: Date,
  until: Date
): Promise<Array<{ title: string; state: IdeaState; at: Date; code: string; who: string | null }>> {
  const linhas = await orm()
    .select({
      title: idea.title,
      code: idea.publicCode,
      action: auditLog.action,
      at: auditLog.createdAt,
      who: user.name
    })
    .from(auditLog)
    .innerJoin(idea, eq(idea.id, auditLog.entityId))
    .leftJoin(user, eq(user.id, auditLog.userId))
    .where(and(
      eq(auditLog.clientId, clientId),
      eq(auditLog.entity, 'idea'),
      inArray(auditLog.action, Object.keys(ESTADO_AUDITADO)),
      sql`${auditLog.createdAt} >= ${since}`,
      sql`${auditLog.createdAt} < ${until}`
    ))
    .orderBy(desc(auditLog.createdAt))

  return linhas.flatMap(l => {
    const state = ESTADO_AUDITADO[l.action]
    /* `inArray` already filtered, so this only narrows the type — but an
       action added later without a label here must vanish rather than print
       its own database name on her screen. */
    return state === undefined ? [] : [{ title: l.title, code: l.code, state, at: l.at, who: l.who }]
  })
}

/** New pautas she has not seen, for her own digest. */
export async function ideasPublishedSince (
  clientId: number,
  since: Date,
  until: Date
): Promise<Array<{ title: string; at: Date }>> {
  return await orm()
    .select({ title: idea.title, at: idea.createdAt })
    .from(idea)
    .where(and(
      eq(idea.clientId, clientId),
      sql`${idea.createdAt} >= ${since}`,
      sql`${idea.createdAt} < ${until}`
    ))
    .orderBy(desc(idea.createdAt))
}

/** The pauta bank — everything with no date on it. Used by the empty states. */
export async function bankSize (clientId: number): Promise<number> {
  const [row] = await orm()
    .select({ n: sql<number>`COUNT(*)` })
    .from(idea)
    .where(and(
      eq(idea.clientId, clientId),
      isNull(idea.scheduledFor),
      inArray(idea.state, ['proposed', 'scheduled'])
    ))

  const parsed = Number(row?.n)
  return Number.isFinite(parsed) ? parsed : 0
}
