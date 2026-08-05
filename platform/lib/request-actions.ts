'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { orm } from '@/db/client'
import { auditLog, request as requestTable, requestEvent } from '@/db/schema'
import { requireSession } from './dal.ts'
import { canReach } from './scope.ts'

/**
 * Moving a request along.
 *
 * Every change lands as an event with an author and a time, and the row's own
 * `state` is a projection of the last one. Keeping only the current state would
 * answer "where is this" and never "when did I ask, and when did she see it" —
 * which is the question the whole intake exists to answer.
 */

export type RequestState = 'open' | 'in_progress' | 'delivered' | 'dropped'

const STATES: readonly RequestState[] = ['open', 'in_progress', 'delivered', 'dropped']

export interface RequestResult {
  ok: boolean
  error?: string
}

const MAX_COMMENT = 4000

async function resolve (publicCode: string) {
  const identity = await requireSession()

  const rows = await orm()
    .select({
      id: requestTable.id,
      clientId: requestTable.clientId,
      state: requestTable.state
    })
    .from(requestTable)
    .where(eq(requestTable.publicCode, publicCode))
    .limit(1)

  const found = rows[0]
  if (found === undefined || !canReach(identity, found.clientId)) return null

  return { identity, ...found }
}

async function callerIp (): Promise<string | undefined> {
  const value = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim()
  return value === undefined || value === '' ? undefined : value
}

export async function setRequestState (
  publicCode: string,
  state: RequestState
): Promise<RequestResult> {
  if (!STATES.includes(state)) return { ok: false, error: 'Estado inválido.' }

  const target = await resolve(publicCode)
  if (target === null) return { ok: false, error: 'Esse pedido não está mais aqui.' }

  if (target.state === state) return { ok: true }

  const now = new Date()

  await orm()
    .update(requestTable)
    .set({
      state,
      updatedAt: now,
      /* Cleared when it reopens, so a request closed and reopened does not keep
         claiming it was finished last week. */
      closedAt: state === 'delivered' || state === 'dropped' ? now : null
    })
    .where(eq(requestTable.id, target.id))

  await orm().insert(requestEvent).values({
    requestId: target.id,
    userId: target.identity.userId,
    kind: 'state_change',
    fromState: target.state,
    toState: state,
    createdAt: now
  })

  const ip = await callerIp()
  await orm().insert(auditLog).values({
    action: `request_${state}`,
    entity: 'request',
    entityId: target.id,
    userId: target.identity.userId,
    clientId: target.clientId,
    createdAt: now,
    ...(ip === undefined ? {} : { ip })
  })

  revalidatePath('/pedidos')
  revalidatePath('/')

  return { ok: true }
}

export async function addRequestComment (
  publicCode: string,
  text: string
): Promise<RequestResult> {
  const trimmed = text.trim().slice(0, MAX_COMMENT)
  if (trimmed === '') return { ok: false, error: 'Escreva alguma coisa antes de enviar.' }

  const target = await resolve(publicCode)
  if (target === null) return { ok: false, error: 'Esse pedido não está mais aqui.' }

  const now = new Date()

  await orm().insert(requestEvent).values({
    requestId: target.id,
    userId: target.identity.userId,
    kind: 'comment',
    body: trimmed,
    createdAt: now
  })

  /* A comment on an untouched request means she has engaged with it. Moving it
     to in_progress here saves her a second deliberate action to say so. */
  if (target.state === 'open') {
    await orm()
      .update(requestTable)
      .set({ state: 'in_progress', updatedAt: now })
      .where(eq(requestTable.id, target.id))

    await orm().insert(requestEvent).values({
      requestId: target.id,
      userId: target.identity.userId,
      kind: 'state_change',
      fromState: 'open',
      toState: 'in_progress',
      createdAt: now
    })
  } else {
    await orm()
      .update(requestTable)
      .set({ updatedAt: now })
      .where(eq(requestTable.id, target.id))
  }

  revalidatePath('/pedidos')

  return { ok: true }
}
