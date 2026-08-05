import { describe, expect, it } from 'vitest'
import { format, longDate, monthLabel, shortDate, smallRatio, toNumber } from '../lib/format.ts'

/**
 * Formatting, per unit.
 *
 * The database hands back DECIMAL as a string, and ratios are stored as ratios.
 * The ×100 lives in exactly one place, and these tests are what keep a second
 * one from appearing — a value multiplied twice still renders as a plausible
 * percentage.
 */

describe('format', () => {
  it('should render a ratio as a percentage in pt-BR', () => {
    // ARRANGE — 0.23% is stored as 0.0023, never as 0.23
    // ACT / ASSERT
    expect(format('0.002300', 'ratio', 2)).toBe('0,23%')
    expect(format('0.014000', 'ratio', 2)).toBe('1,40%')
  })

  it('should honour the decimals the metric declares', () => {
    // ARRANGE / ACT / ASSERT — retention is shown whole, rates with two places
    expect(format('0.080000', 'ratio', 0)).toBe('8%')
    expect(format('0.080000', 'ratio', 2)).toBe('8,00%')
  })

  it('should render currency in Brazilian reais', () => {
    // ARRANGE / ACT / ASSERT
    expect(format('10583.280000', 'currency')).toMatch(/^R\$\s?10\.583,28$/)
  })

  it('should render counts with thousands separators', () => {
    // ARRANGE / ACT / ASSERT
    expect(format('5413754', 'count')).toBe('5.413.754')
    expect(format(23, 'count')).toBe('23')
  })

  it('should render seconds as minutes and seconds', () => {
    // ARRANGE — the losing Reel was 1min37, and "97s" is not how anyone says it
    // ACT / ASSERT
    expect(format(97, 'seconds')).toBe('1min37')
    expect(format(9, 'seconds')).toBe('9s')
    expect(format(120, 'seconds')).toBe('2min00')
  })

  it('should render a dash for an absent value rather than NaN', () => {
    // ARRANGE — reach is absent from the public export, and "NaN%" on a client
    // screen reads as broken software
    // ACT / ASSERT
    expect(format(null, 'count')).toBe('—')
    expect(format(undefined, 'ratio')).toBe('—')
    expect(format('nao-e-numero', 'currency')).toBe('—')
  })

  it('should not round a money value into a different number', () => {
    // ARRANGE / ACT / ASSERT — DECIMAL arrives as a string precisely so this
    // stays exact
    expect(format('0.010000', 'currency')).toMatch(/0,01$/)
    expect(format('99999.990000', 'currency')).toMatch(/99\.999,99$/)
  })
})

describe('toNumber', () => {
  it('should parse a decimal string', () => {
    // ARRANGE / ACT / ASSERT
    expect(toNumber('0.002300')).toBeCloseTo(0.0023, 10)
  })

  it('should return null instead of NaN', () => {
    // ARRANGE / ACT / ASSERT
    expect(toNumber(null)).toBeNull()
    expect(toNumber('')).toBeNull()
    expect(toNumber('abc')).toBeNull()
  })
})

describe('smallRatio', () => {
  it('should keep enough decimals for a very small share to stop being zero', () => {
    // ARRANGE — 23 purchases out of 5,413,754 reached is 0.00042%. Two decimals
    // would render "0,00%", which reads as no data instead of almost nobody
    // ACT / ASSERT
    expect(smallRatio(23 / 5413754)).toBe('0,0004%')
  })

  it('should use fewer decimals as the share grows', () => {
    // ARRANGE / ACT / ASSERT
    expect(smallRatio(1)).toBe('100,0%')
    expect(smallRatio(0.0642)).toBe('6,4%')
    expect(smallRatio(0.00147)).toBe('0,15%')
  })

  it('should render a true zero plainly', () => {
    // ARRANGE / ACT / ASSERT — "0,0000%" would suggest a measurement too small
    // to show rather than nothing at all
    expect(smallRatio(0)).toBe('0%')
  })
})

describe('dates', () => {
  it('should keep a calendar day on its own day in Sao Paulo', () => {
    // ARRANGE — a bare DATE parsed as UTC midnight renders as the day before in
    // America/Sao_Paulo, and a report is then wrong by one row
    // ACT / ASSERT
    expect(longDate('2026-08-04')).toBe('4 de agosto de 2026')
    expect(shortDate('2026-08-04')).toBe('4 ago')
    expect(shortDate('2026-01-01')).toBe('1 jan')
  })

  it('should label a month from a period column', () => {
    // ARRANGE / ACT / ASSERT
    expect(monthLabel('2026-07-01')).toBe('julho de 2026')
  })

  it('should accept a Date as well as a string', () => {
    // ARRANGE — DATETIME columns come back as Date, DATE columns as string
    // ACT / ASSERT
    expect(longDate(new Date('2026-08-04T15:00:00Z'))).toBe('4 de agosto de 2026')
  })
})
