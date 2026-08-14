import 'server-only'
import { eq } from 'drizzle-orm'
import { orm } from '@/db/client'
import { auditLog, request as requestTable, requestEvent } from '@/db/schema'
import { canMove, hasOutcome, STATES, turnOf } from './pedido.ts'
import type { RequestState, Side } from './pedido.ts'
import { ulid } from './ulid.ts'

/**
 * Writing to a request, with the actor passed in rather than read from a cookie.
 *
 * This layer exists because the same rules have to hold on two paths that
 * cannot share a session. The screen has one; the terminal does not — and the
 * terminal is the path that matters most here, since the person who writes the
 * requests and the outcomes is the assistant, not the consultant sitting at the
 * form.
 *
 * Keeping the rules here rather than in `request-actions.ts` is what makes
 * "concluding needs an outcome" true of both. A copy of the check in the CLI
 * would be a copy that drifts, and the first thing to drift would be the rule
 * that stops a request closing in silence.
 *
 * Authorisation is NOT done here. The caller proves who it is: the server
 * action from the session, the script from an explicit e-mail.
 */

export interface Actor {
  userId: number
  role: Side
}

export interface StoreResult {
  ok: boolean
  error?: string
  clientId?: number
}

const MAX_OUTCOME = 8000
const MAX_TITLE = 200
const MAX_BODY = 4000

export interface RequestTarget {
  id: number
  clientId: number
  state: RequestState
  outcome: string | null
  raisedBySide: Side
}

export async function findRequest (publicCode: string): Promise<RequestTarget | null> {
  const rows = await orm()
    .select({
      id: requestTable.id,
      clientId: requestTable.clientId,
      state: requestTable.state,
      outcome: requestTable.outcome,
      raisedBySide: requestTable.raisedBySide
    })
    .from(requestTable)
    .where(eq(requestTable.publicCode, publicCode))
    .limit(1)

  return rows[0] ?? null
}

/**
 * Moves a request and records who moved it.
 *
 * `outcome` travels with the transition instead of being a separate call, so a
 * request cannot reach `concluded` and then fail to save its text — which would
 * produce exactly the silence this chain was rebuilt to remove.
 */
export async function moveRequest (
  target: RequestTarget,
  state: RequestState,
  actor: Actor,
  outcome?: string,
  ip?: string
): Promise<StoreResult> {
  if (!STATES.includes(state)) return { ok: false, error: 'Estado inválido.' }

  if (!canMove(target.state, state, target.raisedBySide, actor.role)) {
    return {
      ok: false,
      error: 'Esse movimento não é seu para fazer agora — recarregue a página e veja de quem é a vez.'
    }
  }

  const written = outcome?.trim().slice(0, MAX_OUTCOME) ?? ''
  const kept = written === '' ? target.outcome : written

  if (state === 'concluded' && !hasOutcome(kept)) {
    return {
      ok: false,
      error: 'Escreva o que saiu desse pedido antes de concluir. Quem mandou o material precisa saber se serviu.'
    }
  }

  if (target.state === state && written === '') return { ok: true, clientId: target.clientId }

  const now = new Date()

  await orm()
    .update(requestTable)
    .set({
      state,
      updatedAt: now,
      ...(written === '' ? {} : { outcome: written }),
      /* Cleared when it reopens, so a request closed and reopened does not keep
         claiming it was finished last week. */
      closedAt: state === 'concluded' || state === 'dropped' ? now : null
    })
    .where(eq(requestTable.id, target.id))

  await orm().insert(requestEvent).values({
    requestId: target.id,
    userId: actor.userId,
    kind: 'state_change',
    fromState: target.state,
    toState: state,
    createdAt: now
  })

  await orm().insert(auditLog).values({
    action: `request_${state}`,
    entity: 'request',
    entityId: target.id,
    userId: actor.userId,
    clientId: target.clientId,
    createdAt: now,
    ...(ip === undefined ? {} : { ip })
  })

  return { ok: true, clientId: target.clientId }
}

export interface CreateResult extends StoreResult {
  publicCode?: string
}

/**
 * Opens a request from either side.
 *
 * Only a title is required. Everything else has a default and is editable
 * afterwards — a form with five fields is how you get her to close the tab and
 * send a WhatsApp message instead, which is the behaviour this replaces.
 */
export async function createRequest (
  clientId: number,
  actor: Actor,
  title: string,
  description?: string,
  ip?: string
): Promise<CreateResult> {
  const trimmed = title.trim().slice(0, MAX_TITLE)
  if (trimmed === '') return { ok: false, error: 'Escreva um título para o pedido.' }

  const body = description?.trim().slice(0, MAX_BODY) ?? ''
  const now = new Date()
  const publicCode = ulid()

  const [row] = await orm().insert(requestTable).values({
    publicCode,
    clientId,
    title: trimmed,
    raisedBySide: actor.role,
    openedBy: actor.userId,
    state: 'open',
    createdAt: now,
    updatedAt: now,
    ...(body === '' ? {} : { description: body })
  }).$returningId()

  await orm().insert(auditLog).values({
    action: 'request_opened',
    entity: 'request',
    entityId: row?.id,
    userId: actor.userId,
    clientId,
    createdAt: now,
    ...(ip === undefined ? {} : { ip })
  })

  return { ok: true, clientId, publicCode }
}

/**
 * The automatic promotion that fires when the material arrives.
 *
 * Only when the person acting is the one who owed the answer. Before both sides
 * could raise a request this was safe to assume; now a consultant clarifying
 * his own open request would otherwise flip it to `answered` and tell her the
 * material had arrived when nothing had.
 *
 * It never reaches `analyzing`. That state promises a person is reading, and a
 * promise made by a trigger is the promise that teaches everyone to ignore the
 * label — which is precisely what happened on 13/08/2026.
 */
export async function promoteOnDelivery (
  target: RequestTarget,
  actor: Actor,
  when: Date
): Promise<void> {
  const devia = turnOf('open', target.raisedBySide) === actor.role
  if (target.state !== 'open' || !devia) {
    await orm()
      .update(requestTable)
      .set({ updatedAt: when })
      .where(eq(requestTable.id, target.id))
    return
  }

  await orm()
    .update(requestTable)
    .set({ state: 'answered', updatedAt: when })
    .where(eq(requestTable.id, target.id))

  await orm().insert(requestEvent).values({
    requestId: target.id,
    userId: actor.userId,
    kind: 'state_change',
    fromState: 'open',
    toState: 'answered',
    createdAt: when
  })
}
