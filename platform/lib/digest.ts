import 'server-only'
import { and, desc, eq, gte, lt } from 'drizzle-orm'
import { orm } from '@/db/client'
import {
  auditLog, client, delivery, file, request, requestEvent, step, stepStatus, user
} from '@/db/schema'

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

  const total = blocked.length + done.length + files.length +
    comments.length + delivered.length + askedForAccess.length

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
    total
  }
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
