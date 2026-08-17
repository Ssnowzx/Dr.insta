'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { orm } from '@/db/client'
import {
  auditLog, metricDef, metricValue, post, request, requestEvent, requestField
} from '@/db/schema'
import { requireSession } from './dal.ts'
import { lerNumero, escreverNumero } from './numero.ts'
import { periodOf } from './dashboard.ts'
import { promoteOnDelivery } from './pedido-store.ts'
import { canReach } from './scope.ts'

/**
 * Answering a request with a number instead of a screenshot.
 *
 * The whole point is that the figure reaches the panel without a person in the
 * middle. Before this, `metric_value` was written by the seed, the Reels
 * importer and the Instagram sync — none of which reads an upload — so a single
 * integer travelled as a PNG and waited for someone to open it.
 *
 * The parse is the dangerous part and lives in `lib/numero.ts`, tested on its
 * own: "347.482" is 347 thousand to her and 347,482 to `Number()`.
 */

export interface CampoResult {
  ok: boolean
  error?: string
  /** What was stored, written back the way she would write it. */
  eco?: string
}

export async function answerField (fieldId: number, bruto: string): Promise<CampoResult> {
  const identity = await requireSession()

  /* The field, its request and the client that owns it, in one read. Trusting a
     client id that arrived with the request would let one client write numbers
     onto another's metrics. */
  const rows = await orm()
    .select({
      id: requestField.id,
      unit: requestField.unit,
      target: requestField.target,
      metricKey: requestField.metricKey,
      period: requestField.period,
      postCode: requestField.postCode,
      label: requestField.label,
      requestId: request.id,
      requestCode: request.publicCode,
      clientId: request.clientId,
      state: request.state,
      raisedBySide: request.raisedBySide,
      outcome: request.outcome
    })
    .from(requestField)
    .innerJoin(request, eq(request.id, requestField.requestId))
    .where(eq(requestField.id, fieldId))
    .limit(1)

  const campo = rows[0]
  /* Absent and out-of-scope answer identically, like everywhere else here: a
     distinct "not yours" turns an id into a way to test what exists. */
  if (campo === undefined || !canReach(identity, campo.clientId)) {
    return { ok: false, error: 'Esse campo não está mais aqui. Recarregue a página.' }
  }

  const lido = lerNumero(bruto, campo.unit)
  if (!lido.ok || lido.valor === undefined) {
    return { ok: false, error: lido.erro ?? 'Não consegui ler esse número.' }
  }

  const valor = lido.valor
  const now = new Date()

  await orm()
    .update(requestField)
    .set({
      value: valor.toFixed(6),
      answeredAt: now,
      answeredBy: identity.userId,
      updatedAt: now
    })
    .where(eq(requestField.id, fieldId))

  const destino = campo.target === 'metric'
    ? await gravarMetrica(campo.clientId, campo.metricKey, campo.period, valor, now)
    : await gravarPost(campo.clientId, campo.postCode, valor, now)

  await orm().insert(auditLog).values({
    action: 'request_field_answered',
    entity: 'request_field',
    entityId: fieldId,
    userId: identity.userId,
    clientId: campo.clientId,
    details: { label: campo.label, value: valor, landed: destino },
    createdAt: now
  })

  /* An event on the request, so the number appears on its timeline beside the
     comments and the uploads — and so the digest reports it. A figure that
     changes the panel and leaves no trace on the thread it came from is a
     figure nobody can audit later. */
  await orm().insert(requestEvent).values({
    requestId: campo.requestId,
    userId: identity.userId,
    kind: 'comment',
    body: `${campo.label}: ${escreverNumero(valor, campo.unit)}`,
    createdAt: now
  })

  /* The same promotion an upload triggers. Answering with a number IS answering
     — leaving the request `open` would keep asking her for something the panel
     has already used. */
  await promoteOnDelivery(
    {
      id: campo.requestId,
      clientId: campo.clientId,
      state: campo.state,
      outcome: campo.outcome,
      raisedBySide: campo.raisedBySide
    },
    { userId: identity.userId, role: identity.role === 'consultant' ? 'consultant' : 'client' },
    now
  )

  revalidatePath('/pedidos')
  revalidatePath(`/pedidos/${campo.requestCode}`)
  revalidatePath('/')
  revalidatePath('/plano')

  return { ok: true, eco: escreverNumero(valor, campo.unit) }
}

/**
 * Writes an account metric, as `insights`.
 *
 * NOT as `api`: this is a person reading a screen and typing, and the source
 * column exists so the panel can tell those apart and resolve them by declared
 * precedence. Marking a typed figure as collected would erase the distinction
 * the whole `metric_value` unique key was designed around.
 *
 * A metric with no definition is skipped rather than invented — the rule
 * `lib/instagram/sync.ts` already follows. It returns what happened so the
 * audit row records whether the number actually landed anywhere.
 */
async function gravarMetrica (
  clientId: number,
  metricKey: string | null,
  period: string | null,
  valor: number,
  now: Date
): Promise<string> {
  if (metricKey === null) return 'nenhum destino'

  const [def] = await orm()
    .select({ id: metricDef.id })
    .from(metricDef)
    .where(eq(metricDef.metricKey, metricKey))
    .limit(1)

  if (def === undefined) return `métrica desconhecida: ${metricKey}`

  /* A monthly ask with no fixed period lands in the month it is answered in.
     Pinning it in the seed would mean editing the file every month, and a
     stale period silently overwrites the wrong month. */
  const alvo = period ?? periodOf(now)

  await orm()
    .insert(metricValue)
    .values({
      clientId,
      metricDefId: def.id,
      period: alvo,
      granularity: 'month',
      value: valor.toFixed(6),
      source: 'insights',
      note: 'Informado por ela no app.',
      createdAt: now,
      updatedAt: now
    })
    .onDuplicateKeyUpdate({
      set: { value: valor.toFixed(6), note: 'Informado por ela no app.', updatedAt: now }
    })

  return `${metricKey} em ${alvo}`
}

/**
 * Writes the non-follower share onto one post.
 *
 * Keyed by the shortcode, the identifier the archive and the collector already
 * agree on — matching against the API's numeric id is the mistake that made the
 * whole sync report "0 posts updated" for a week.
 *
 * A post that is not in the archive is reported rather than created: this
 * action's job is to record a share of a reach, and inventing a row with a
 * percentage and no reach would put a denominator in the archive with no
 * numerator.
 */
async function gravarPost (
  clientId: number,
  postCode: string | null,
  valor: number,
  now: Date
): Promise<string> {
  if (postCode === null) return 'nenhum destino'

  const atualizado = await orm()
    .update(post)
    .set({ nonFollowerPct: valor.toFixed(5), updatedAt: now })
    .where(and(eq(post.clientId, clientId), eq(post.igCode, postCode)))

  /* mysql2 reports affected rows; zero means the shortcode is not in the
     archive, which is worth recording rather than swallowing. */
  const linhas = (atualizado as unknown as { affectedRows?: number }).affectedRows ?? 0
  return linhas > 0 ? `post ${postCode}` : `post ${postCode} não está no acervo`
}
