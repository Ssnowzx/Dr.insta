import { describe, expect, it } from 'vitest'
import { ageOf, endOfMonth } from '../lib/freshness.ts'

/**
 * How old the data is.
 *
 * Nothing in this product updates by itself, so the number on screen is only
 * safe while a date travels with it. The thresholds are tested because a
 * warning that fires too early gets ignored, and one that fires too late is not
 * a warning at all.
 */

const on = (iso: string): Date => new Date(`${iso}T12:00:00Z`)

describe('endOfMonth', () => {
  it('should give the last day of the period, not the first', () => {
    // ARRANGE — a metric filed under 2026-07-01 describes the whole of July, so
    // on 4 August it is four days old and not thirty-four
    // ACT / ASSERT
    expect(endOfMonth('2026-07-01').toISOString().slice(0, 10)).toBe('2026-07-31')
    expect(endOfMonth('2026-02-01').toISOString().slice(0, 10)).toBe('2026-02-28')
  })

  it('should handle December, where the next month is another year', () => {
    // ARRANGE / ACT / ASSERT
    expect(endOfMonth('2026-12-01').toISOString().slice(0, 10)).toBe('2026-12-31')
  })

  it('should handle a leap February', () => {
    // ARRANGE / ACT / ASSERT
    expect(endOfMonth('2028-02-01').toISOString().slice(0, 10)).toBe('2028-02-29')
  })
})

describe('ageOf', () => {
  it('should call July fresh in early August', () => {
    // ARRANGE — July's numbers on 4 August are current, and flagging them would
    // train her to ignore the flag
    // ACT
    const age = ageOf(endOfMonth('2026-07-01'), on('2026-08-04'))

    // ASSERT
    expect(age.days).toBe(4)
    expect(age.level).toBe('fresh')
  })

  it('should call July aging in mid September', () => {
    // ARRANGE — August has closed and its numbers have not arrived
    // ACT
    const age = ageOf(endOfMonth('2026-07-01'), on('2026-09-10'))

    // ASSERT
    expect(age.level).toBe('aging')
  })

  it('should call July stale in October', () => {
    // ARRANGE — two closed months have passed; these numbers cannot describe now
    // ACT
    const age = ageOf(endOfMonth('2026-07-01'), on('2026-10-05'))

    // ASSERT
    expect(age.level).toBe('stale')
  })

  it('should read the day it crosses each threshold', () => {
    // ARRANGE — the boundaries themselves, so a refactor cannot slide them
    const base = on('2026-01-01')
    const plus = (d: number): Date => new Date(base.getTime() + d * 24 * 60 * 60 * 1000)

    // ACT / ASSERT
    expect(ageOf(base, plus(34)).level).toBe('fresh')
    expect(ageOf(base, plus(35)).level).toBe('aging')
    expect(ageOf(base, plus(64)).level).toBe('aging')
    expect(ageOf(base, plus(65)).level).toBe('stale')
  })

  it('should never report a negative age', () => {
    // ARRANGE — a period that has not closed yet would otherwise read as
    // "-12 days", which looks like a bug on a client's screen
    // ACT / ASSERT
    expect(ageOf(on('2026-09-30'), on('2026-08-04')).days).toBe(0)
  })

  it('should word the age the way a person would say it', () => {
    // ARRANGE
    const base = on('2026-01-01')
    const plus = (d: number): Date => new Date(base.getTime() + d * 24 * 60 * 60 * 1000)

    // ACT / ASSERT
    expect(ageOf(base, plus(0)).label).toBe('de hoje')
    expect(ageOf(base, plus(1)).label).toBe('de ontem')
    expect(ageOf(base, plus(12)).label).toBe('de 12 dias atrás')
    expect(ageOf(base, plus(40)).label).toBe('de um mês atrás')
    expect(ageOf(base, plus(95)).label).toBe('de 3 meses atrás')
  })

  it('should accept a bare date string on its own calendar day', () => {
    // ARRANGE — parsing "2026-08-04" as UTC midnight lands on 3 August in
    // America/Sao_Paulo, and the age comes out a day wrong
    // ACT / ASSERT
    expect(ageOf('2026-08-04', on('2026-08-04')).days).toBe(0)
  })
})

describe('date shapes the database actually returns', () => {
  it('should accept an aggregate datetime string', () => {
    // ARRANGE — MAX(updated_at) comes back as "2026-08-04 12:00:00"
    // ACT / ASSERT
    expect(ageOf('2026-08-04 12:00:00', on('2026-08-09')).days).toBe(5)
  })

  it('should not turn an unparseable date into a NaN-day warning', () => {
    // ARRANGE / ACT
    const age = ageOf('nao-e-data', on('2026-08-04'))

    // ASSERT
    expect(Number.isNaN(age.days)).toBe(false)
    expect(age.label).toBe('sem data')
  })
})
