import 'server-only'
import { and, desc, eq, gte, inArray, isNotNull, lt } from 'drizzle-orm'
import { orm } from '@/db/client'
import {
  auditLog, client, delivery, file, instagramConnection, request, requestEvent,
  step, stepStatus, user
} from '@/db/schema'
import { shortDate } from './format.ts'

/**
 * What a client did in a window, for the daily summary.
 *
 * The consultant is not notified of anything today: if she marks "travou" at
 * 11pm on a Sunday, he finds out by opening the page. This closes that.
 *
 * The window is a parameter, never derived from the clock here, so the caller
 * decides the cadence and the query is testable.
 */

export interface DigestItem {
  title: string
  detail: string | null
  at: Date
  who: string
}

export interface Digest {
  clientId: number
  clientName: string
  since: Date
  until: Date
  /** Blocked first, because it is the only one that changes what he does today. */
  blocked: DigestItem[]
  done: DigestItem[]
  files: DigestItem[]
  comments: DigestItem[]
  delivered: DigestItem[]
  /** Someone tried to sign in and could not. There is no reset email, so this is how he finds out. */
  askedForAccess: DigestItem[]
  /**
   * The Instagram connection stopped working.
   *
   * Not bounded by the window, unlike everything else here: a broken connection
   * is a state, not an event. Reporting it only on the day it broke would mean
   * the one notice scrolls away and the numbers go on not arriving — which is
   * the failure this whole feature has to avoid, because it looks identical to
   * a quiet month.
   */
  connection: DigestItem[]
  total: number
}

/**
 * Blank when there is nothing to say.
 *
 * A digest that arrives every day whether or not anything happened is a digest
 * that gets filtered, and then the one that mattered is filtered too. The
 * caller must check `total` before sending.
 */
export async function digestFor (
  clientId: number,
  since: Date,
  until: Date
): Promise<Digest | null> {
  const [c] = await orm()
    .select({ id: client.id, name: client.name })
    .from(client)
    .where(eq(client.id, clientId))
    .limit(1)

  if (c === undefined) return null

  // ------------------------------------------------------------- steps
  const stepRows = await orm()
    .select({
      state: stepStatus.state,
      comment: stepStatus.comment,
      at: stepStatus.updatedAt,
      who: user.name,
      title: step.title,
      delivery: delivery.title
    })
    .from(stepStatus)
    .innerJoin(step, eq(step.id, stepStatus.stepId))
    .innerJoin(delivery, eq(delivery.id, step.deliveryId))
    .innerJoin(user, eq(user.id, stepStatus.userId))
    .where(and(
      eq(step.clientId, clientId),
      gte(stepStatus.updatedAt, since),
      lt(stepStatus.updatedAt, until),
      /* Only what the client herself answered. The consultant's own edits
         should not arrive as news about the client. */
      eq(user.role, 'client')
    ))
    .orderBy(desc(stepStatus.updatedAt))

  const blocked: DigestItem[] = []
  const done: DigestItem[] = []

  for (const r of stepRows) {
    const item: DigestItem = { title: r.title, detail: r.comment, at: r.at, who: r.who }
    if (r.state === 'blocked') blocked.push(item)
    else if (r.state === 'done') done.push(item)
  }

  // ------------------------------------------------- request activity
  const eventRows = await orm()
    .select({
      kind: requestEvent.kind,
      body: requestEvent.body,
      toState: requestEvent.toState,
      at: requestEvent.createdAt,
      who: user.name,
      requestTitle: request.title,
      fileName: file.originalName
    })
    .from(requestEvent)
    .innerJoin(request, eq(request.id, requestEvent.requestId))
    .innerJoin(user, eq(user.id, requestEvent.userId))
    .leftJoin(file, eq(file.id, requestEvent.fileId))
    .where(and(
      eq(request.clientId, clientId),
      gte(requestEvent.createdAt, since),
      lt(requestEvent.createdAt, until),
      eq(user.role, 'client')
    ))
    .orderBy(desc(requestEvent.createdAt))

  const files: DigestItem[] = []
  const comments: DigestItem[] = []
  const delivered: DigestItem[] = []

  for (const r of eventRows) {
    const base = { title: r.requestTitle, at: r.at, who: r.who }
    if (r.kind === 'file') {
      files.push({ ...base, detail: r.fileName ?? r.body })
    } else if (r.kind === 'comment') {
      comments.push({ ...base, detail: r.body })
    } else if (r.kind === 'state_change' && r.toState === 'delivered') {
      delivered.push({ ...base, detail: null })
    }
    /* `in_progress` transitions are deliberately dropped: they fire
       automatically on the first upload or comment, so reporting them would
       double-count the very event that caused them. */
  }

  // ------------------------------------------------ asked for access
  /* With no reset email, a client who cannot get in has no self-service path.
     The sign-in screen records the attempt and it surfaces here — otherwise the
     only signal would be her remembering to message him. */
  const accessRows = await orm()
    .select({ at: auditLog.createdAt, who: user.name })
    .from(auditLog)
    .innerJoin(user, eq(user.id, auditLog.userId))
    .where(and(
      eq(auditLog.clientId, clientId),
      eq(auditLog.action, 'asked_for_access'),
      gte(auditLog.createdAt, since),
      lt(auditLog.createdAt, until)
    ))
    .orderBy(desc(auditLog.createdAt))

  const askedForAccess: DigestItem[] = accessRows.map(r => ({
    title: 'não conseguiu entrar',
    detail: 'Ela pediu um link novo. Gere um em Conta e mande.',
    at: r.at,
    who: r.who
  }))

  // ------------------------------------------------------ connection
  const connection = await connectionTrouble(clientId, until)

  const total = blocked.length + done.length + files.length +
    comments.length + delivered.length + askedForAccess.length + connection.length

  return {
    clientId: c.id,
    clientName: c.name,
    since,
    until,
    blocked,
    done,
    files,
    comments,
    delivered,
    askedForAccess,
    connection,
    total
  }
}

/**
 * What SHE has to catch up on.
 *
 * Deliberately not the same list as his, and not a filtered copy of it: his
 * digest answers "what did she do", and a mirror of that would tell her what
 * she already knows. Hers answers "what changed here that I did not do".
 *
 * The asymmetry that made this necessary: the platform notified him about her
 * and never her about him. Publishing a delivery, opening a request or
 * answering one all landed silently, and she found out by opening the screen —
 * which is the same "depends on someone remembering" this product removed
 * everywhere else. Adding the connection made it sharper, because a broken
 * credential is a state only SHE can fix.
 */
export interface ClientDigest {
  /**
   * The connection, when it needs her. Its own group and not lumped with the
   * requests: they are resolved on different screens, and a single group with
   * one "resolve here" link would send her to the wrong one for most of its
   * items.
   */
  connection: DigestItem[]
  /** Requests he opened, waiting on her. */
  requests: DigestItem[]
  /** New deliveries she has not read. */
  published: DigestItem[]
  /** He answered something she was waiting on. */
  answered: DigestItem[]
  total: number
}

export async function clientDigestFor (
  clientId: number,
  since: Date,
  until: Date
): Promise<ClientDigest> {
  const connection: DigestItem[] = []

  // ----------------------------------------- connection that only she can fix
  /* `failing` is absent on purpose. The credential is fine and there is nothing
     for her to press — telling her would hand over worry without an action, and
     a notice she cannot act on is the one that teaches her to ignore the bell.
     That state stays on his screen, where it belongs. */
  const conexao = await orm()
    .select({ state: instagramConnection.state, lastSyncAt: instagramConnection.lastSyncAt })
    .from(instagramConnection)
    .where(and(
      eq(instagramConnection.clientId, clientId),
      inArray(instagramConnection.state, ['expired', 'revoked'])
    ))
    .limit(1)

  const quebrada = conexao[0]
  if (quebrada !== undefined) {
    connection.push({
      title: 'Seu Instagram desconectou',
      detail: quebrada.state === 'revoked'
        ? 'A conexão foi desligada. Enquanto isso, os números não atualizam.'
        : 'A autorização venceu — acontece de tempos em tempos. São dois cliques em Conta.',
      at: quebrada.lastSyncAt ?? until,
      who: 'Instagram'
    })
  }

  // ------------------------------------------------- requests waiting on her
  const abertos = await orm()
    .select({ title: request.title, at: request.createdAt, kind: request.kind })
    .from(request)
    .where(and(
      eq(request.clientId, clientId),
      /* Only what he asked of her. A request she raised herself is not news to
         her, and `dropped` is not waiting on anyone. */
      eq(request.raisedBySide, 'consultant'),
      inArray(request.state, ['open', 'in_progress']),
      gte(request.createdAt, since),
      lt(request.createdAt, until)
    ))
    .orderBy(desc(request.createdAt))

  const requests: DigestItem[] = abertos.map(r => ({
    title: r.title,
    detail: 'Novo pedido para você.',
    at: r.at,
    who: 'Rodrigo'
  }))

  // --------------------------------------------------------- new deliveries
  const entregas = await orm()
    .select({ title: delivery.title, subtitle: delivery.subtitle, at: delivery.publishedAt })
    .from(delivery)
    .where(and(
      eq(delivery.clientId, clientId),
      isNotNull(delivery.publishedAt),
      gte(delivery.publishedAt, since),
      lt(delivery.publishedAt, until)
    ))
    .orderBy(desc(delivery.publishedAt))

  const published: DigestItem[] = entregas.map(d => ({
    title: d.title,
    detail: d.subtitle,
    at: d.at ?? until,
    who: 'Rodrigo'
  }))

  // ---------------------------------------------------- his answers to her
  const respostas = await orm()
    .select({
      title: request.title,
      body: requestEvent.body,
      at: requestEvent.createdAt,
      kind: requestEvent.kind,
      toState: requestEvent.toState
    })
    .from(requestEvent)
    .innerJoin(request, eq(request.id, requestEvent.requestId))
    .innerJoin(user, eq(user.id, requestEvent.userId))
    .where(and(
      eq(request.clientId, clientId),
      /* The mirror of his rule: what she did is not news to her. */
      eq(user.role, 'consultant'),
      inArray(requestEvent.kind, ['comment', 'state_change']),
      gte(requestEvent.createdAt, since),
      lt(requestEvent.createdAt, until)
    ))
    .orderBy(desc(requestEvent.createdAt))

  const answered: DigestItem[] = []
  for (const r of respostas) {
    if (r.kind === 'comment') {
      answered.push({ title: r.title, detail: r.body, at: r.at, who: 'Rodrigo' })
    } else if (r.toState === 'delivered') {
      answered.push({ title: r.title, detail: 'Fechado.', at: r.at, who: 'Rodrigo' })
    }
  }

  return {
    connection,
    requests,
    published,
    answered,
    total: connection.length + requests.length + published.length + answered.length
  }
}

/** What each broken state means for him, in one line. */
const ESTADO: Record<string, string> = {
  expired: 'A autorização venceu. Ela precisa reconectar em Conta.',
  revoked: 'Ela desconectou a conta. Os números pararam de entrar.',
  failing: 'A coleta está falhando. A autorização segue válida — é outra coisa.'
}

/**
 * A connection that is not working, if there is one.
 *
 * Deliberately outside the time window. Everything else in this digest is
 * something that happened; this is something that is still true, and it stays
 * on the screen until it stops being true.
 */
async function connectionTrouble (clientId: number, until: Date): Promise<DigestItem[]> {
  const rows = await orm()
    .select({
      state: instagramConnection.state,
      lastSyncAt: instagramConnection.lastSyncAt,
      lastErrorAt: instagramConnection.lastErrorAt
    })
    .from(instagramConnection)
    .where(eq(instagramConnection.clientId, clientId))
    .limit(1)

  const row = rows[0]
  if (row === undefined || row.state === 'active') return []

  const detail = ESTADO[row.state] ?? 'A conexão com o Instagram não está funcionando.'

  return [{
    title: 'a conexão do Instagram parou',
    /* How stale the numbers are is the part that decides what he does today.
       Formatted, not ISO: this is read on a screen, in Brazil. */
    detail: row.lastSyncAt === null
      ? `${detail} Nenhum número chegou por ela ainda.`
      : `${detail} O último número entrou em ${shortDate(row.lastSyncAt)}.`,
    at: row.lastErrorAt ?? row.lastSyncAt ?? until,
    who: 'Instagram'
  }]
}

/**
 * Since when this user has not read the news.
 *
 * `newsSeenAt` and not `lastSeenAt`: the latter advances on every sign-in, so
 * opening the app would mark everything read without anyone having looked.
 * Never having opened the screen falls back to a week, which is long enough to
 * be useful on a first visit and short enough not to dump months of history.
 */
export async function newsSince (userId: number, fallbackDays = 7): Promise<Date> {
  const [row] = await orm()
    .select({ seenAt: user.newsSeenAt })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

  return row?.seenAt ?? new Date(Date.now() - fallbackDays * 24 * 60 * 60 * 1000)
}
