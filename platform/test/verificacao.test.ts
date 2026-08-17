import { describe, expect, it } from 'vitest'
import {
  newestPerStep, proofFor, requestDelivered, resolveStep, stillPending,
  VERIFY_INSTAGRAM
} from '../lib/verificacao.ts'
import type { TeamAnswer, Verifiable } from '../lib/verificacao.ts'

/**
 * The rule that decides whether the plan goes on asking for something.
 *
 * It is worth testing on its own because every one of its failure modes is
 * silent: a step that stays "a fazer" after she did it looks exactly like a step
 * she has not done, and a step that flips to "feito" by mistake looks exactly
 * like a step she finished.
 */

const EM = (iso: string): Date => new Date(iso)

const passo = (over: Partial<Verifiable> = {}): Verifiable => ({
  id: 1,
  verifyKey: null,
  requestId: null,
  requestState: null,
  requestCode: null,
  ...over
})

const resposta = (over: Partial<TeamAnswer> = {}): TeamAnswer => ({
  stepId: 1,
  userId: 1,
  userName: 'Bianca',
  state: 'pending',
  comment: null,
  updatedAt: EM('2026-08-15T12:00:00Z'),
  ...over
})

describe('requestDelivered', () => {
  it('should treat anything past open as delivered', () => {
    // ARRANGE — waiting for `concluded` would keep asking her for something she
    // sent a week ago, because concluding is HIS act and not hers
    // ACT / ASSERT
    expect(requestDelivered('answered')).toBe(true)
    expect(requestDelivered('analyzing')).toBe(true)
    expect(requestDelivered('concluded')).toBe(true)
  })

  it('should treat dropped as delivered too', () => {
    // ARRANGE — the chore is off her plate either way, and why it was dropped
    // belongs on the request, not in a checkbox she is still staring at
    // ACT / ASSERT
    expect(requestDelivered('dropped')).toBe(true)
  })

  it('should not treat open or absent as delivered', () => {
    // ARRANGE / ACT / ASSERT
    expect(requestDelivered('open')).toBe(false)
    expect(requestDelivered(null)).toBe(false)
  })
})

describe('newestPerStep', () => {
  it('should keep the newest answer when two people marked the same step', () => {
    // ARRANGE — this is the bug that shipped once: `new Map(pairs)` keeps the
    // LAST pair for a repeated key, so building the map straight from a list
    // sorted newest-first hands back the OLDEST answer
    const antiga = resposta({ userName: 'Bianca', updatedAt: EM('2026-08-10T09:00:00Z') })
    const nova = resposta({ userName: 'Cris', updatedAt: EM('2026-08-16T09:00:00Z'), state: 'done' })

    // ACT — deliberately passed newest-first, the order the query returns
    const mapa = newestPerStep([nova, antiga])

    // ASSERT
    expect(mapa.get(1)?.userName).toBe('Cris')
    expect(mapa.get(1)?.state).toBe('done')
  })

  it('should keep the newest whichever order the list arrives in', () => {
    // ARRANGE
    const antiga = resposta({ userName: 'Bianca', updatedAt: EM('2026-08-10T09:00:00Z') })
    const nova = resposta({ userName: 'Cris', updatedAt: EM('2026-08-16T09:00:00Z') })

    // ACT
    // ASSERT — a rule that depends on the caller's ORDER BY is a rule that
    // breaks the day someone adds a second sort column
    expect(newestPerStep([antiga, nova]).get(1)?.userName).toBe('Cris')
    expect(newestPerStep([nova, antiga]).get(1)?.userName).toBe('Cris')
  })
})

describe('proofFor', () => {
  it('should prove a connected Instagram', () => {
    // ARRANGE
    const step = passo({ verifyKey: VERIFY_INSTAGRAM })

    // ACT
    const prova = proofFor(step, { [VERIFY_INSTAGRAM]: EM('2026-08-14T10:00:00Z') })

    // ASSERT
    expect(prova?.kind).toBe('connection')
    expect(prova?.href).toBe('/conta')
  })

  it('should not prove a connection that has not happened', () => {
    // ARRANGE / ACT / ASSERT
    expect(proofFor(passo({ verifyKey: VERIFY_INSTAGRAM }), {})).toBeNull()
  })

  it('should ignore a verifier this build does not know', () => {
    // ARRANGE — a seed naming a verifier from a newer build must leave the step
    // behaving exactly as before, not break the plan screen
    const step = passo({ verifyKey: 'algo_que_nao_existe' })

    // ACT / ASSERT
    expect(proofFor(step, { [VERIFY_INSTAGRAM]: EM('2026-08-14T10:00:00Z') })).toBeNull()
  })

  it('should prove a step whose linked request has been answered', () => {
    // ARRANGE — step c1 and the request "A aba Público de cinco Reels" are one
    // job that lived on two screens with nothing joining them
    const step = passo({ requestId: 9, requestState: 'answered', requestCode: 'ABC' })

    // ACT
    const prova = proofFor(step, {})

    // ASSERT
    expect(prova?.kind).toBe('request')
    expect(prova?.href).toBe('/pedidos/ABC')
  })

  it('should still point somewhere when the request has no code', () => {
    // ARRANGE
    const step = passo({ requestId: 9, requestState: 'concluded', requestCode: null })

    // ACT / ASSERT — a proof with a dead link is worse than a proof with a
    // general one: she taps it and lands nowhere
    expect(proofFor(step, {})?.href).toBe('/pedidos')
  })

  it('should not prove a step whose linked request is still open', () => {
    // ARRANGE / ACT / ASSERT
    expect(proofFor(passo({ requestId: 9, requestState: 'open' }), {})).toBeNull()
  })

  it('should prove nothing for a step that declares no verifier', () => {
    // ARRANGE / ACT / ASSERT — most steps, and they must behave as they always did
    expect(proofFor(passo(), { [VERIFY_INSTAGRAM]: EM('2026-08-14T10:00:00Z') })).toBeNull()
  })

  it('should speak to the reader, not about them', () => {
    // ARRANGE — "você já respondeu isso em Pedidos" is right on her screen and
    // wrong on his: he did not answer it, she did. The product keeps two voices
    // in the digest and in the requests screen for the same reason.
    const step = passo({ requestId: 9, requestState: 'answered', requestCode: 'ABC' })

    // ACT
    const dela = proofFor(step, {}, 'cliente')
    const dele = proofFor(step, {}, 'consultor')

    // ASSERT
    expect(dela?.label).toContain('você')
    expect(dele?.label).toContain('ela')
    // The link is the same fact either way — only the sentence changes
    expect(dele?.href).toBe(dela?.href)
  })
})

describe('resolveStep', () => {
  it('should fall back to pending when nobody answered', () => {
    // ARRANGE / ACT
    const r = resolveStep(passo(), new Map(), {})

    // ASSERT
    expect(r.state).toBe('pending')
    expect(r.by).toBeNull()
  })

  it('should show one team answer to everyone, with a name on it', () => {
    // ARRANGE — the defect an assistant would have hit on day one: Bianca marks
    // it and Cris reads "a fazer"
    const answers = newestPerStep([resposta({ userName: 'Cris', state: 'done' })])

    // ACT
    const r = resolveStep(passo(), answers, {})

    // ASSERT
    expect(r.state).toBe('done')
    expect(r.by).toBe('Cris')
  })

  it('should let proof win over a step nobody marked', () => {
    // ARRANGE — she connected on 14/08 and the plan had no way of knowing
    const step = passo({ verifyKey: VERIFY_INSTAGRAM })

    // ACT
    const r = resolveStep(step, new Map(), { [VERIFY_INSTAGRAM]: EM('2026-08-14T10:00:00Z') })

    // ASSERT
    expect(r.state).toBe('done')
    expect(r.proof).not.toBeNull()
    expect(r.at).toEqual(EM('2026-08-14T10:00:00Z'))
  })

  it('should let proof win over a stale blocked', () => {
    // ARRANGE — "travei" plus "the platform saw it happen" means the block is
    // stale. She marked blocked on three failed attempts on 13/08 and connected
    // on the 14th.
    const answers = newestPerStep([
      resposta({ state: 'blocked', comment: 'deu erro na tela do Instagram' })
    ])
    const step = passo({ verifyKey: VERIFY_INSTAGRAM })

    // ACT
    const r = resolveStep(step, answers, { [VERIFY_INSTAGRAM]: EM('2026-08-14T10:00:00Z') })

    // ASSERT
    expect(r.state).toBe('done')
    // The note survives: what blocked her is the most useful sentence on the
    // screen and does not stop being true because it later got done
    expect(r.comment).toBe('deu erro na tela do Instagram')
  })

  it('should keep her credit when she also marked it herself', () => {
    // ARRANGE — a screen that answers "quem marcou?" with the platform, on a
    // step she marked, is a screen taking her work
    const marcado = EM('2026-08-14T11:00:00Z')
    const answers = newestPerStep([resposta({ userName: 'Bianca', state: 'done', updatedAt: marcado })])
    const step = passo({ verifyKey: VERIFY_INSTAGRAM })

    // ACT
    const r = resolveStep(step, answers, { [VERIFY_INSTAGRAM]: EM('2026-08-14T10:00:00Z') })

    // ASSERT
    expect(r.by).toBe('Bianca')
    expect(r.at).toEqual(marcado)
  })

  it('should NOT revert a done step when the proof stops holding', () => {
    // ARRANGE — she connected, marked it done, then disconnected. A verifier is
    // evidence of completion, never of incompletion: reverting would make her
    // plan flicker with the health of an API credential, and a broken
    // connection is already announced on its own screen and in the digest.
    const answers = newestPerStep([resposta({ userName: 'Bianca', state: 'done' })])
    const step = passo({ verifyKey: VERIFY_INSTAGRAM })

    // ACT — no facts at all: the connection is revoked
    const r = resolveStep(step, answers, {})

    // ASSERT
    expect(r.state).toBe('done')
    expect(r.by).toBe('Bianca')
  })
})

describe('stillPending', () => {
  it('should not count blocked as pending', () => {
    // ARRANGE — blocked is not waiting on her: she already said it stopped and
    // the next move is his. Counting it keeps the headline asking for something
    // she has finished asking about.
    const passos = [
      passo({ id: 1 }),
      passo({ id: 2 }),
      passo({ id: 3 })
    ]
    const answers = newestPerStep([
      resposta({ stepId: 2, state: 'blocked' }),
      resposta({ stepId: 3, state: 'done' })
    ])

    // ACT
    const n = stillPending(passos.map(p => resolveStep(p, answers, {})))

    // ASSERT — only step 1
    expect(n).toBe(1)
  })

  it('should not count a step the platform proved', () => {
    // ARRANGE — the whole complaint: "coisas que ela já fez continuam no app"
    const passos = [
      passo({ id: 1, verifyKey: VERIFY_INSTAGRAM }),
      passo({ id: 2, requestId: 5, requestState: 'answered' }),
      passo({ id: 3 })
    ]

    // ACT
    const n = stillPending(
      passos.map(p => resolveStep(p, new Map(), { [VERIFY_INSTAGRAM]: EM('2026-08-14T10:00:00Z') }))
    )

    // ASSERT
    expect(n).toBe(1)
  })
})
