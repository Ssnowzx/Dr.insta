'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { and, eq } from 'drizzle-orm'
import { orm } from '@/db/client'
import { auditLog, request, step, stepStatus } from '@/db/schema'
import { requireSession } from './dal.ts'
import { observedFacts } from './dashboard.ts'
import { canReach } from './scope.ts'
import { proofFor } from './verificacao.ts'

/**
 * Marking a step.
 *
 * Three states, not a checkbox: `blocked` is the answer the old HTML threw
 * away, and what blocked her is what changes the next delivery.
 */

export type StepState = 'pending' | 'done' | 'blocked'

const STATES: readonly StepState[] = ['pending', 'done', 'blocked']

export interface StepResult {
  ok: boolean
  error?: string
}

/** Comment column is TEXT; this bound keeps a paste from becoming a database error. */
const MAX_COMMENT = 2000

export async function setStepState (
  stepId: number,
  state: StepState,
  comment: string | null
): Promise<StepResult> {
  const identity = await requireSession()

  if (!STATES.includes(state)) {
    return { ok: false, error: 'Estado inválido.' }
  }

  /* Read the step's own client before writing anything. Trusting a client_id
     that arrived with the request would let one client mark another client's
     steps by editing a number in the payload. */
  const rows = await orm()
    .select({
      id: step.id,
      clientId: step.clientId,
      verifyKey: step.verifyKey,
      requestId: step.requestId,
      requestState: request.state,
      requestCode: request.publicCode
    })
    .from(step)
    .leftJoin(request, eq(request.id, step.requestId))
    .where(eq(step.id, stepId))
    .limit(1)

  const found = rows[0]

  /* Absent and out-of-scope answer the same way. A distinct "you may not touch
     that" would confirm the step exists, and step ids are sequential. */
  if (found === undefined || !canReach(identity, found.clientId)) {
    return { ok: false, error: 'Esse item não está mais aqui. Recarregue a página.' }
  }

  /* A step the platform can see was done is not open to being marked undone.
     The screen does not offer the control in that case, so reaching this is
     either a stale tab or a crafted request — and a state written here would be
     ignored by every reader anyway, since `resolveStep` lets proof win. Failing
     loudly beats accepting a write that changes nothing on screen, which is how
     someone concludes the app does not save. */
  const proof = proofFor(found, await observedFacts(found.clientId))
  if (proof !== null && state !== 'done') {
    return {
      ok: false,
      error: `Este item eu já conferi por aqui — ${proof.label}. Se estiver errado, me conta em Pedidos que eu ajusto.`
    }
  }

  const trimmed = comment === null ? null : comment.trim().slice(0, MAX_COMMENT)
  const text = trimmed === null || trimmed === '' ? null : trimmed
  const now = new Date()

  /* One row per (step, user). Two people following the same delivery each keep
     their own answer — joining on the step alone would show whoever wrote last. */
  await orm()
    .insert(stepStatus)
    .values({
      stepId,
      userId: identity.userId,
      state,
      createdAt: now,
      updatedAt: now,
      ...(text === null ? {} : { comment: text }),
      ...(state === 'done' ? { completedAt: now } : {})
    })
    .onDuplicateKeyUpdate({
      set: {
        state,
        comment: text,
        updatedAt: now,
        /* Cleared when it stops being done, so a step marked, unmarked and
           marked again does not keep the first completion date. */
        completedAt: state === 'done' ? now : null
      }
    })

  const forwarded = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim()
  await orm().insert(auditLog).values({
    action: `step_${state}`,
    entity: 'step',
    entityId: stepId,
    userId: identity.userId,
    clientId: found.clientId,
    createdAt: now,
    ...(forwarded === undefined || forwarded === '' ? {} : { ip: forwarded })
  })

  revalidatePath('/plano')
  revalidatePath('/')

  return { ok: true }
}

/** Saves a note without touching the state, so she can annotate a step she has not decided on. */
export async function setStepComment (stepId: number, comment: string): Promise<StepResult> {
  const identity = await requireSession()

  /* This person's own row, deliberately. The state the SCREEN shows is the
     team's, but writing a note must not silently adopt someone else's answer as
     this person's — `step_status` stays one row per person, and a comment saved
     over an assistant's "travou" would rewrite what she reported. */
  const rows = await orm()
    .select({
      clientId: step.clientId,
      state: stepStatus.state
    })
    .from(step)
    .leftJoin(stepStatus, and(
      eq(stepStatus.stepId, step.id),
      eq(stepStatus.userId, identity.userId)
    ))
    .where(eq(step.id, stepId))
    .limit(1)

  const found = rows[0]
  if (found === undefined || !canReach(identity, found.clientId)) {
    return { ok: false, error: 'Esse item não está mais aqui. Recarregue a página.' }
  }

  return await setStepState(stepId, found.state ?? 'pending', comment)
}
