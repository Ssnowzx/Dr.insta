import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { orm } from '../db/client.ts'
import { db } from '../db/connection.ts'
import { client, request, requestEvent, user } from '../db/schema.ts'
import { clientDigestFor, digestFor } from '../lib/digest.ts'
import { findRequest, moveRequest, promoteOnDelivery } from '../lib/pedido-store.ts'
import { canMove, hasOutcome, turnOf } from '../lib/pedido.ts'
import { ulid } from '../lib/ulid.ts'

/**
 * The request lifecycle, and the summary that reads it.
 *
 * These tests exist because `digest.ts` compares `toState` against a string
 * literal in two places and nothing covered either one. A migration that
 * renames the state would leave both comparisons matching nothing: the summary
 * would quietly stop reporting closed requests, no test would fail, and the
 * first person to notice would be whoever wondered why the screen went empty.
 */

const MARK = 'pedido-test'
let clientId = 0
let clientUser = 0
let consultantUser = 0
let requestId = 0
let publicCode = ''

const at = (iso: string): Date => new Date(iso)
const janela = (): [Date, Date] => [at('2026-03-10T00:00:00Z'), at('2026-03-11T00:00:00Z')]

beforeAll(async () => {
  const now = new Date()

  const [c] = await orm().insert(client).values({
    publicCode: ulid(), slug: MARK, name: 'Cliente do pedido',
    createdAt: now, updatedAt: now
  }).$returningId()
  clientId = c?.id ?? 0

  const [cu] = await orm().insert(user).values({
    publicCode: ulid(), clientId, email: `${MARK}-cliente@example.invalid`,
    name: 'Cliente Pessoa', role: 'client', createdAt: now, updatedAt: now
  }).$returningId()
  clientUser = cu?.id ?? 0

  const [su] = await orm().insert(user).values({
    publicCode: ulid(), email: `${MARK}-consultor@example.invalid`,
    name: 'Consultor Pessoa', role: 'consultant', createdAt: now, updatedAt: now
  }).$returningId()
  consultantUser = su?.id ?? 0

  publicCode = ulid()
  const [r] = await orm().insert(request).values({
    publicCode, clientId, title: 'Me manda a planilha',
    kind: 'data', raisedBySide: 'consultant', state: 'open',
    createdAt: at('2026-03-09T09:00:00Z'), updatedAt: at('2026-03-09T09:00:00Z')
  }).$returningId()
  requestId = r?.id ?? 0
})

beforeEach(async () => {
  await orm().delete(requestEvent).where(eq(requestEvent.requestId, requestId))
})

afterAll(async () => {
  await orm().delete(requestEvent).where(eq(requestEvent.requestId, requestId))
  await orm().delete(request).where(eq(request.id, requestId))
  await orm().delete(user).where(eq(user.id, clientUser))
  await orm().delete(user).where(eq(user.id, consultantUser))
  await orm().delete(client).where(eq(client.id, clientId))
  await db().end()
})

async function evento (
  userId: number,
  kind: 'comment' | 'state_change',
  when: Date,
  extra: { body?: string; fromState?: string; toState?: string } = {}
): Promise<void> {
  await orm().insert(requestEvent).values({
    requestId, userId, kind, createdAt: when, ...extra
  })
}

describe('o resumo do consultor lê o fim do pedido', () => {
  it('should report a request she closed', async () => {
    // ARRANGE — the literal that `digestFor` matches on. If a migration renames
    // the state and this string is not renamed with it, the group goes empty.
    await evento(clientUser, 'state_change', at('2026-03-10T14:00:00Z'), {
      fromState: 'in_progress', toState: 'concluded'
    })

    // ACT
    const dele = await digestFor(clientId, ...janela())

    // ASSERT
    expect(dele?.delivered).toHaveLength(1)
    expect(dele?.delivered[0]?.title).toBe('Me manda a planilha')
  })

  it('should report what she wrote on a request', async () => {
    // ARRANGE
    await evento(clientUser, 'comment', at('2026-03-10T15:00:00Z'), {
      body: 'Exportei desde fevereiro'
    })

    // ACT
    const dele = await digestFor(clientId, ...janela())

    // ASSERT
    expect(dele?.comments).toHaveLength(1)
    expect(dele?.comments[0]?.detail).toBe('Exportei desde fevereiro')
  })

  it('should ignore an intermediate transition', async () => {
    // ARRANGE — the automatic promotion fires on her first upload, so reporting
    // it would double-count the very upload that caused it
    await evento(clientUser, 'state_change', at('2026-03-10T14:00:00Z'), {
      fromState: 'open', toState: 'answered'
    })

    // ACT
    const dele = await digestFor(clientId, ...janela())

    // ASSERT
    expect(dele?.total).toBe(0)
  })
})

describe('o resumo dela lê o que ele fechou', () => {
  it('should report a request he closed', async () => {
    // ARRANGE — the second literal, in `clientDigestFor`. Same failure mode.
    await evento(consultantUser, 'state_change', at('2026-03-10T14:00:00Z'), {
      fromState: 'analyzing', toState: 'concluded'
    })

    // ACT
    const dela = await clientDigestFor(clientId, ...janela())

    // ASSERT
    expect(dela.answered).toHaveLength(1)
    expect(dela.answered[0]?.detail).toBe('Fechado.')
  })

  it('should report what he wrote back to her', async () => {
    // ARRANGE
    await evento(consultantUser, 'comment', at('2026-03-10T16:00:00Z'), {
      body: 'Recebi os dezesseis, começo hoje'
    })

    // ACT
    const dela = await clientDigestFor(clientId, ...janela())

    // ASSERT
    expect(dela.answered).toHaveLength(1)
    expect(dela.answered[0]?.detail).toBe('Recebi os dezesseis, começo hoje')
  })

  it('should keep her own actions out of her summary', async () => {
    // ARRANGE — what she did is not news to her
    await evento(clientUser, 'state_change', at('2026-03-10T14:00:00Z'), {
      fromState: 'analyzing', toState: 'concluded'
    })

    // ACT
    const dela = await clientDigestFor(clientId, ...janela())

    // ASSERT
    expect(dela.answered).toHaveLength(0)
  })
})

describe('de quem é a vez', () => {
  it('should wait on her when he asked and nobody answered', () => {
    // ARRANGE / ACT / ASSERT
    expect(turnOf('open', 'consultant')).toBe('client')
  })

  it('should wait on him when she asked and nobody answered', () => {
    // ARRANGE — the chain has to read correctly backwards too. Hardcoding the
    // consultant as the responder is what would make a request she raised sit
    // on her own list, waiting for herself.
    // ACT / ASSERT
    expect(turnOf('open', 'client')).toBe('consultant')
  })

  it('should pass the turn to whoever asked once the material arrives', () => {
    // ARRANGE / ACT / ASSERT
    expect(turnOf('answered', 'consultant')).toBe('consultant')
    expect(turnOf('answered', 'client')).toBe('client')
  })

  it('should keep the turn with whoever asked while they read it', () => {
    // ARRANGE / ACT / ASSERT
    expect(turnOf('analyzing', 'consultant')).toBe('consultant')
  })

  it('should belong to nobody once it is over', () => {
    // ARRANGE — nobody's turn is not the same as either person's, and a screen
    // that resolves it to a side would keep showing closed work as pending
    // ACT / ASSERT
    expect(turnOf('concluded', 'consultant')).toBeNull()
    expect(turnOf('dropped', 'client')).toBeNull()
  })
})

describe('o desfecho obrigatório', () => {
  it('should reject an empty outcome', () => {
    // ARRANGE / ACT / ASSERT
    expect(hasOutcome('')).toBe(false)
    expect(hasOutcome(null)).toBe(false)
    expect(hasOutcome(undefined)).toBe(false)
  })

  it('should reject whitespace', () => {
    // ARRANGE — a field holding three spaces passes every "is it filled in"
    // check and reads to her exactly like no answer at all
    // ACT / ASSERT
    expect(hasOutcome('   ')).toBe(false)
    expect(hasOutcome('\n\t ')).toBe(false)
  })

  it('should accept written words', () => {
    // ARRANGE / ACT / ASSERT
    expect(hasOutcome('Os 16 prints mostram que o longo não chega em estranho')).toBe(true)
  })
})

describe('mover pelo caminho sem sessão (o do script)', () => {
  it('should refuse to conclude with no outcome, from the CLI path too', async () => {
    // ARRANGE — the rule lives in the store precisely so that the terminal
    // cannot bypass it. A copy of the check in the script would be a copy that
    // drifts, and this is the one that must not.
    const alvo = await findRequest(publicCode)

    // ACT
    const r = await moveRequest(alvo!, 'concluded', { userId: consultantUser, role: 'consultant' })

    // ASSERT
    expect(r.ok).toBe(false)
    expect(r.error).toContain('Escreva o que saiu')
  })

  it('should conclude when the outcome is written', async () => {
    // ARRANGE
    const alvo = await findRequest(publicCode)

    // ACT
    const r = await moveRequest(
      alvo!, 'concluded',
      { userId: consultantUser, role: 'consultant' },
      'Os 16 prints mostram que o longo não chega em quem não te segue.'
    )

    // ASSERT
    expect(r.ok).toBe(true)
    const depois = await findRequest(publicCode)
    expect(depois?.state).toBe('concluded')
    expect(depois?.outcome).toContain('não chega em quem não te segue')

    // CLEANUP — this suite shares one request row across its tests
    await orm().update(request)
      .set({ state: 'open', outcome: null, closedAt: null })
      .where(eq(request.id, requestId))
  })

  it('should allow dropping with no outcome', async () => {
    // ARRANGE — saying why something was dropped is welcome, but requiring it
    // would mean a request nobody can explain can never be closed
    const alvo = await findRequest(publicCode)

    // ACT
    const r = await moveRequest(alvo!, 'dropped', { userId: consultantUser, role: 'consultant' })

    // ASSERT
    expect(r.ok).toBe(true)

    // CLEANUP
    await orm().update(request)
      .set({ state: 'open', closedAt: null }).where(eq(request.id, requestId))
  })

  it('should not promote when the asker comments on their own request', async () => {
    // ARRANGE — the bug two-way requests introduced. He raised it; a comment
    // from him is a clarification, not the material arriving. Promoting here
    // would tell her the answer had landed when nothing had.
    const alvo = await findRequest(publicCode)

    // ACT
    await promoteOnDelivery(alvo!, { userId: consultantUser, role: 'consultant' }, new Date())

    // ASSERT
    expect((await findRequest(publicCode))?.state).toBe('open')
  })

  it('should promote when the responder delivers', async () => {
    // ARRANGE
    const alvo = await findRequest(publicCode)

    // ACT
    await promoteOnDelivery(alvo!, { userId: clientUser, role: 'client' }, new Date())

    // ASSERT
    expect((await findRequest(publicCode))?.state).toBe('answered')

    // CLEANUP
    await orm().update(request).set({ state: 'open' }).where(eq(request.id, requestId))
  })
})

describe('quem pode fazer cada movimento', () => {
  it('should let only the responder say the material arrived', () => {
    // ARRANGE — ele pediu, então quem entrega é ela
    // ACT / ASSERT
    expect(canMove('open', 'answered', 'consultant', 'client')).toBe(true)
    expect(canMove('open', 'answered', 'consultant', 'consultant')).toBe(false)
  })

  it('should refuse the client declaring delivery on a request she raised', () => {
    // ARRANGE — o bug: o botão "Mandei tudo que dava" aparecia para ela em
    // qualquer pedido aberto, inclusive nos que ela mesma abriu. Um clique
    // tirava da fila dele um pedido que ninguém tinha respondido.
    // ACT / ASSERT
    expect(canMove('open', 'answered', 'client', 'client')).toBe(false)
    expect(canMove('open', 'answered', 'client', 'consultant')).toBe(true)
  })

  it('should refuse analysing something that has not arrived', () => {
    // ARRANGE — "Comecei a olhar" era oferecido a partir de `open`
    // ACT / ASSERT
    expect(canMove('open', 'analyzing', 'consultant', 'consultant')).toBe(false)
    expect(canMove('answered', 'analyzing', 'consultant', 'consultant')).toBe(true)
  })

  it('should let only the asker analyse and conclude', () => {
    // ARRANGE — quem pediu é quem sabe se o material serviu
    // ACT / ASSERT
    expect(canMove('answered', 'analyzing', 'consultant', 'client')).toBe(false)
    expect(canMove('answered', 'concluded', 'client', 'client')).toBe(true)
    expect(canMove('answered', 'concluded', 'client', 'consultant')).toBe(false)
  })

  it('should let either side drop or reopen', () => {
    // ARRANGE — os dois são formas de dizer "não vai acontecer assim", e
    // nenhum alega que alguém trabalhou
    // ACT / ASSERT
    expect(canMove('open', 'dropped', 'consultant', 'client')).toBe(true)
    expect(canMove('answered', 'dropped', 'client', 'consultant')).toBe(true)
    expect(canMove('concluded', 'open', 'consultant', 'client')).toBe(true)
  })
})
