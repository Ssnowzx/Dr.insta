'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { orm } from '@/db/client'
import { request as requestTable, requestEvent } from '@/db/schema'
import { clientScope, requireSession } from './dal.ts'
import {
  createRequest, findRequest, moveRequest, promoteOnDelivery
} from './pedido-store.ts'
import type { Actor, RequestTarget } from './pedido-store.ts'
import type { RequestState } from './pedido.ts'
import { canReach } from './scope.ts'

/**
 * The authenticated half of moving a request along.
 *
 * The rules live in `pedido-store.ts`, not here, because they have to hold on a
 * path that has no session: the person who writes the requests and the outcomes
 * is the assistant, working through `npm run pedido`. A copy of the rules in
 * the CLI would be a copy that drifts, and the first one to drift would be the
 * one that stops a request closing without an explanation.
 *
 * What stays here is what only a request can know: who is signed in, whether
 * they may reach this client, the caller's IP, and which paths to revalidate.
 */

export interface RequestResult {
  ok: boolean
  error?: string
}

const MAX_COMMENT = 4000

async function resolve (
  publicCode: string
): Promise<{ actor: Actor; target: RequestTarget } | null> {
  const identity = await requireSession()
  const target = await findRequest(publicCode)

  if (target === null || !canReach(identity, target.clientId)) return null

  return { actor: { userId: identity.userId, role: identity.role }, target }
}

async function callerIp (): Promise<string | undefined> {
  const value = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim()
  return value === undefined || value === '' ? undefined : value
}

export async function setRequestState (
  publicCode: string,
  state: RequestState,
  outcome?: string
): Promise<RequestResult> {
  const found = await resolve(publicCode)
  if (found === null) return { ok: false, error: 'Esse pedido não está mais aqui.' }

  const r = await moveRequest(found.target, state, found.actor, outcome, await callerIp())
  if (!r.ok) return { ok: false, ...(r.error === undefined ? {} : { error: r.error }) }

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

  const found = await resolve(publicCode)
  if (found === null) return { ok: false, error: 'Esse pedido não está mais aqui.' }

  const now = new Date()

  await orm().insert(requestEvent).values({
    requestId: found.target.id,
    userId: found.actor.userId,
    kind: 'comment',
    body: trimmed,
    createdAt: now
  })

  /* A comment from whoever owed the answer IS the answer arriving, so the state
     moves without asking for a second deliberate action. */
  await promoteOnDelivery(found.target, found.actor, now)

  revalidatePath('/pedidos')

  return { ok: true }
}

export interface OpenRequestResult extends RequestResult {
  publicCode?: string
}

export async function openRequest (
  title: string,
  description?: string
): Promise<OpenRequestResult> {
  const identity = await requireSession()

  /* The consultant carries no client of his own, so a request he opens is
     scoped through `clientScope()`. Without a client there is nothing to attach
     it to and the insert would violate the foreign key. */
  const clientId = identity.clientId ?? await clientScope()

  const r = await createRequest(
    clientId,
    { userId: identity.userId, role: identity.role },
    title,
    description,
    await callerIp()
  )

  if (!r.ok) return { ok: false, ...(r.error === undefined ? {} : { error: r.error }) }

  revalidatePath('/pedidos')
  revalidatePath('/')

  return { ok: true, ...(r.publicCode === undefined ? {} : { publicCode: r.publicCode }) }
}

/**
 * Editing a request the other side raised.
 *
 * Deliberately consultant-only and deliberately narrow: the fields here are the
 * ones that frame the ask, and framing is his job. She writes what she needs in
 * the title and description when she opens it; he turns that into something the
 * screen can present.
 */
export async function editRequest (
  publicCode: string,
  fields: {
    title?: string
    description?: string
    whyItMatters?: string
    kind?: 'data' | 'action' | 'question' | 'material'
    priority?: 'low' | 'medium' | 'high'
  }
): Promise<RequestResult> {
  const identity = await requireSession()
  if (identity.role !== 'consultant') {
    return { ok: false, error: 'Só o consultor edita o enquadramento do pedido.' }
  }

  const target = await findRequest(publicCode)
  if (target === null || !canReach(identity, target.clientId)) {
    return { ok: false, error: 'Esse pedido não está mais aqui.' }
  }

  const title = fields.title?.trim()
  if (title !== undefined && title === '') {
    return { ok: false, error: 'O título não pode ficar vazio.' }
  }

  await orm()
    .update(requestTable)
    .set({
      updatedAt: new Date(),
      ...(title === undefined ? {} : { title: title.slice(0, 200) }),
      ...(fields.description === undefined ? {} : { description: fields.description.slice(0, MAX_COMMENT) }),
      ...(fields.whyItMatters === undefined ? {} : { whyItMatters: fields.whyItMatters.slice(0, MAX_COMMENT) }),
      ...(fields.kind === undefined ? {} : { kind: fields.kind }),
      ...(fields.priority === undefined ? {} : { priority: fields.priority })
    })
    .where(eq(requestTable.id, target.id))

  revalidatePath('/pedidos')

  return { ok: true }
}
