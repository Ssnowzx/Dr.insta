import { describe, expect, it } from 'vitest'
import {
  agendar, diaDaSemana, diasDeAtraso, grupoDe, hojeEm, manchete, somarDias
} from '../lib/agenda.ts'
import type { Agendavel } from '../lib/agenda.ts'

/**
 * The schedule's boundaries.
 *
 * Dates are the part of this product that has already been wrong once — a DATE
 * column read as `new Date('2026-08-04')` lands on 3 August in São Paulo, and
 * the report is off by one row with nothing looking broken. So the rule is
 * strings all the way through, and this is where that is pinned.
 */

const pauta = (over: Partial<Agendavel> = {}): Agendavel => ({
  scheduledFor: null,
  state: 'scheduled',
  ...over
})

const HOJE = '2026-08-17'
const ATE = somarDias(HOJE, 7)

describe('hojeEm', () => {
  it('should give the São Paulo day, not the UTC one', () => {
    // ARRANGE — 18 August at 01:30 UTC is still 17 August in Brazil. Reading
    // the UTC date would move every pauta forward a day for three hours every
    // night, which is exactly when she is on her phone.
    const madrugada = new Date('2026-08-18T01:30:00Z')

    // ACT / ASSERT
    expect(hojeEm(madrugada)).toBe('2026-08-17')
  })

  it('should format as the column does', () => {
    // ARRANGE / ACT / ASSERT — the whole scheme depends on comparing this
    // string against `scheduled_for` directly
    expect(hojeEm(new Date('2026-08-17T15:00:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('somarDias', () => {
  it('should cross a month boundary', () => {
    // ARRANGE / ACT / ASSERT
    expect(somarDias('2026-08-28', 7)).toBe('2026-09-04')
  })

  it('should cross a year boundary', () => {
    // ARRANGE / ACT / ASSERT
    expect(somarDias('2026-12-30', 3)).toBe('2027-01-02')
  })

  it('should handle a leap day', () => {
    // ARRANGE / ACT / ASSERT
    expect(somarDias('2028-02-28', 1)).toBe('2028-02-29')
  })
})

describe('grupoDe', () => {
  it('should put a published pauta out of the queue whatever its date says', () => {
    // ARRANGE — the rule this whole change is about: what is done stops asking.
    // Its date is still in the future and it must not sit in "esta semana".
    const item = pauta({ scheduledFor: '2026-08-20', state: 'published' })

    // ACT / ASSERT
    expect(grupoDe(item, HOJE, ATE)).toBe('publicada')
  })

  it('should put a dropped pauta out of the queue too', () => {
    // ARRANGE / ACT / ASSERT
    expect(grupoDe(pauta({ scheduledFor: '2026-08-20', state: 'dropped' }), HOJE, ATE))
      .toBe('descartada')
  })

  it('should send an undated pauta to the bank', () => {
    // ARRANGE / ACT / ASSERT
    expect(grupoDe(pauta({ scheduledFor: null }), HOJE, ATE)).toBe('banco')
  })

  it('should call yesterday late', () => {
    // ARRANGE — its own group, not folded into "hoje": a missed script needs a
    // decision, and a list that quietly re-dates it grows for ever
    // ACT / ASSERT
    expect(grupoDe(pauta({ scheduledFor: '2026-08-16' }), HOJE, ATE)).toBe('atrasada')
  })

  it('should call today today', () => {
    // ARRANGE / ACT / ASSERT
    expect(grupoDe(pauta({ scheduledFor: HOJE }), HOJE, ATE)).toBe('hoje')
  })

  it('should include the seventh day ahead in the week', () => {
    // ARRANGE — the window is inclusive, and the boundary is the part that
    // would be off by one without a test
    // ACT / ASSERT
    expect(grupoDe(pauta({ scheduledFor: '2026-08-24' }), HOJE, ATE)).toBe('semana')
  })

  it('should push the eighth day into depois', () => {
    // ARRANGE / ACT / ASSERT
    expect(grupoDe(pauta({ scheduledFor: '2026-08-25' }), HOJE, ATE)).toBe('depois')
  })

  it('should use a rolling week and not the calendar week', () => {
    // ARRANGE — opening the app on a Saturday with a calendar week would show
    // an almost empty week and hide Monday's shoot under "depois", which is the
    // one thing she needs to have already read
    const sabado = '2026-08-22'
    const ateDomingoQueVem = somarDias(sabado, 7)
    const segunda = pauta({ scheduledFor: '2026-08-24' })

    // ACT / ASSERT
    expect(grupoDe(segunda, sabado, ateDomingoQueVem)).toBe('semana')
  })
})

describe('agendar', () => {
  it('should count only what is still waiting on them', () => {
    // ARRANGE
    const lista = [
      pauta({ scheduledFor: '2026-08-16' }),                          // atrasada
      pauta({ scheduledFor: HOJE }),                                  // hoje
      pauta({ scheduledFor: '2026-08-21' }),                          // semana
      pauta({ scheduledFor: '2026-09-10' }),                          // depois
      pauta({ scheduledFor: null }),                                  // banco
      pauta({ scheduledFor: '2026-08-10', state: 'published' }),      // fora
      pauta({ scheduledFor: '2026-08-11', state: 'dropped' })         // fora
    ]

    // ACT
    const agenda = agendar(lista, HOJE)

    // ASSERT — the bank is NOT counted: it has no date and is not owed on any
    // day. A headline that counted it would never drop, and a number that never
    // drops is a number nobody reads.
    expect(agenda.aFazer).toBe(4)
    expect(agenda.banco).toHaveLength(1)
    expect(agenda.publicada).toHaveLength(1)
    expect(agenda.descartada).toHaveLength(1)
  })

  it('should return empty groups rather than undefined ones', () => {
    // ARRANGE / ACT — the screen indexes every group, and one missing key is a
    // crash on a client's page
    const agenda = agendar([], HOJE)

    // ASSERT
    expect(agenda.atrasada).toEqual([])
    expect(agenda.hoje).toEqual([])
    expect(agenda.semana).toEqual([])
    expect(agenda.depois).toEqual([])
    expect(agenda.banco).toEqual([])
    expect(agenda.aFazer).toBe(0)
  })
})

describe('diasDeAtraso', () => {
  it('should count whole days', () => {
    // ARRANGE / ACT / ASSERT
    expect(diasDeAtraso('2026-08-14', HOJE)).toBe(3)
  })

  it('should never go negative', () => {
    // ARRANGE — a future date reaching this function is a caller bug, and
    // "atrasada -4 dias" on a client screen is worse than zero
    // ACT / ASSERT
    expect(diasDeAtraso('2026-08-20', HOJE)).toBe(0)
  })
})

describe('diaDaSemana', () => {
  it('should render the day in São Paulo, not in UTC', () => {
    // ARRANGE — 2026-08-17 is a Monday. Parsing it as UTC midnight would render
    // Sunday for a client in Brazil.
    // ACT
    const rotulo = diaDaSemana('2026-08-17')

    // ASSERT
    expect(rotulo).toContain('seg')
    expect(rotulo).toContain('17')
  })
})

/**
 * The two lines she reads first.
 *
 * Pure because they are prose with five branches, and the version written
 * inline in the page had two of them wrong: a headline of "6 na fila" — a
 * number with no noun, counting today's shoot and one due in twelve days as
 * the same thing — and a lead that explained the feature on the one screen
 * where she already knows what it is.
 */
const pauta2 = (over: Partial<Agendavel & { title: string }> = {}) => ({
  scheduledFor: null,
  state: 'scheduled' as const,
  title: 'Uma pauta',
  ...over
})

describe('manchete', () => {
  it('should lead with what passed its date, and with the decision', () => {
    // ARRANGE — a missed script is the only group that needs a decision, so it
    // outranks everything even when today also has one
    const agenda = agendar([
      pauta2({ scheduledFor: '2026-08-16', title: 'Perfumes' }),
      pauta2({ scheduledFor: HOJE, title: 'Casamento' })
    ], HOJE)

    // ACT
    const m = manchete(agenda, HOJE)

    // ASSERT
    expect(m.titulo).toBe('Uma passou da data.')
    expect(m.lead).toContain('Perfumes')
    expect(m.lead).toContain('descarte')
  })

  it('should name the one to record today', () => {
    // ARRANGE
    const agenda = agendar([pauta2({ scheduledFor: HOJE, title: 'Perfumes' })], HOJE)

    // ACT
    const m = manchete(agenda, HOJE)

    // ASSERT
    expect(m.titulo).toBe('Uma para gravar hoje.')
    expect(m.lead).toContain('Perfumes')
  })

  it('should count the WEEK, not everything with a date', () => {
    // ARRANGE — this is the defect the old headline had. Two this week and two
    // a fortnight out is "2 nos próximos sete dias", never "4".
    const agenda = agendar([
      pauta2({ scheduledFor: '2026-08-19', title: 'A' }),
      pauta2({ scheduledFor: '2026-08-21', title: 'B' }),
      pauta2({ scheduledFor: '2026-09-01', title: 'C' }),
      pauta2({ scheduledFor: '2026-09-03', title: 'D' })
    ], HOJE)

    // ACT
    const m = manchete(agenda, HOJE)

    // ASSERT
    expect(m.titulo).toBe('2 nos próximos sete dias.')
    expect(m.lead).toContain('A')
  })

  it('should say the week is clear rather than invent a number', () => {
    // ARRANGE — only dated far out
    const agenda = agendar([pauta2({ scheduledFor: '2026-09-01', title: 'Setembro' })], HOJE)

    // ACT
    const m = manchete(agenda, HOJE)

    // ASSERT
    expect(m.titulo).toBe('Nada para esta semana.')
    expect(m.lead).toContain('Setembro')
  })

  it('should never put the bank in the headline count', () => {
    // ARRANGE — the bank has no date and is owed on no day. A headline that
    // counted it would never drop, and a number that never drops stops being
    // read.
    const agenda = agendar([
      pauta2({ title: 'Sem data 1' }),
      pauta2({ title: 'Sem data 2' })
    ], HOJE)

    // ACT
    const m = manchete(agenda, HOJE)

    // ASSERT
    expect(m.titulo).toBe('Sem data marcada.')
    expect(m.titulo).not.toContain('fila')
  })

  it('should say nothing is queued when nothing is', () => {
    // ARRANGE — published and dropped are not queued
    const agenda = agendar([
      pauta2({ scheduledFor: '2026-08-10', state: 'published' }),
      pauta2({ scheduledFor: '2026-08-11', state: 'dropped', title: 'Outra' })
    ], HOJE)

    // ACT
    const m = manchete(agenda, HOJE)

    // ASSERT
    expect(m.titulo).toBe('Nada na fila.')
  })
})
