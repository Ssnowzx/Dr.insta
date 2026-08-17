'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { orm } from '@/db/client'
import { auditLog, idea, ideaNote } from '@/db/schema'
import { requireSession } from './dal.ts'
import { canReach } from './scope.ts'
import type { IdeaState } from './agenda.ts'

/**
 * Moving a pauta and writing back about it.
 *
 * TWO ACTIONS, AND THE SECOND ONE IS THE POINT
 *
 * Marking a script as recorded or published is bookkeeping — useful, and what
 * keeps the working list from filling up with things already done. The note is
 * what makes the next batch better: "gravei e ficou longo demais", "essa pauta
 * não é minha voz", "esse foi o que mais rendeu comentário". A script written
 * from a spreadsheet and never argued with is a script that gets ignored by
 * week three.
 *
 * Unlike `step_status`, `idea.state` is a single column and not one row per
 * person. There is no private version of "this video is out": either it was
 * published or it was not, and the two people running the profile need to be
 * looking at the same answer.
 */

const STATES: readonly IdeaState[] = [
  'proposed', 'scheduled', 'recorded', 'published', 'dropped'
]

export interface IdeaResult {
  ok: boolean
  error?: string
}

/** `idea_note.body` is TEXT; this bound keeps a paste from becoming a database error. */
const MAX_NOTE = 4000
const MAX_CODE = 40

/**
 * Reads the pauta's own client before writing anything.
 *
 * Trusting a client id that arrived with the request would let one client move
 * another client's pautas by editing a number in the payload — the rule
 * `step-actions.ts` already follows, repeated here rather than shared, because
 * the two do different things afterwards and a shared helper would have to
 * return everything either might need.
 */
async function alcancavel (ideaId: number): Promise<
  { clientId: number; state: IdeaState; code: string } | null
> {
  const identity = await requireSession()

  const rows = await orm()
    .select({ clientId: idea.clientId, state: idea.state, code: idea.publicCode })
    .from(idea)
    .where(eq(idea.id, ideaId))
    .limit(1)

  const found = rows[0]
  /* Absent and out-of-scope answer the same way. A distinct "you may not touch
     that" would confirm the pauta exists, and ids are sequential. */
  if (found === undefined || !canReach(identity, found.clientId)) return null
  return found
}

export async function setIdeaState (
  ideaId: number,
  state: IdeaState,
  publishedCode?: string
): Promise<IdeaResult> {
  const identity = await requireSession()

  if (!STATES.includes(state)) return { ok: false, error: 'Estado inválido.' }

  const found = await alcancavel(ideaId)
  if (found === null) {
    return { ok: false, error: 'Essa pauta não está mais aqui. Recarregue a página.' }
  }

  const now = new Date()
  const code = publishedCode?.trim().slice(0, MAX_CODE) ?? ''

  await orm()
    .update(idea)
    .set({
      state,
      updatedAt: now,
      /* Cleared when it stops being published, so a pauta marked out and then
         un-marked does not keep pointing at a post it is no longer about. */
      publishedCode: state === 'published' && code !== '' ? code : null
    })
    .where(eq(idea.id, ideaId))

  const forwarded = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim()
  await orm().insert(auditLog).values({
    action: `idea_${state}`,
    entity: 'idea',
    entityId: ideaId,
    userId: identity.userId,
    clientId: found.clientId,
    details: { from: found.state, to: state },
    createdAt: now,
    ...(forwarded === undefined || forwarded === '' ? {} : { ip: forwarded })
  })

  revalidatePath('/ideias')
  revalidatePath(`/ideias/${found.code}`)

  return { ok: true }
}

/**
 * Writes a note on a pauta, from either side.
 *
 * Appended, never replaced. The value of this table is the sequence — "achei
 * longo", "encurtei e rendeu", "esse eu não faria" — and a single editable field
 * would keep only the last thing anyone thought.
 */
export async function addIdeaNote (ideaId: number, body: string): Promise<IdeaResult> {
  const identity = await requireSession()

  const found = await alcancavel(ideaId)
  if (found === null) {
    return { ok: false, error: 'Essa pauta não está mais aqui. Recarregue a página.' }
  }

  const texto = body.trim().slice(0, MAX_NOTE)
  if (texto === '') return { ok: false, error: 'Escreva alguma coisa antes de enviar.' }

  const now = new Date()

  await orm().insert(ideaNote).values({
    ideaId,
    userId: identity.userId,
    body: texto,
    createdAt: now
  })

  /* The pauta's own timestamp moves too. `/novidades` reads notes directly, but
     a pauta that was discussed and never touched would otherwise sort as if
     nothing had happened on it. */
  await orm().update(idea).set({ updatedAt: now }).where(eq(idea.id, ideaId))

  revalidatePath('/ideias')
  revalidatePath(`/ideias/${found.code}`)

  return { ok: true }
}
