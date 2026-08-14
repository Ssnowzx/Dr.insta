import { describe, expect, it } from 'vitest'
import { escolherPeriodo, periodOf } from '../lib/dashboard.ts'

/**
 * Which month the panel presents as "the numbers".
 *
 * On 14/08/2026 she connected her Instagram, the sync wrote August under a
 * measured source, and the panel switched to August on its fourteenth day —
 * then judged it against targets set for a whole month. "Contas alcançadas
 * 2.668.572, longe do alvo", against 5.413.754, on the day the connection
 * started working. Half a month cannot reach a monthly target.
 */

describe('escolherPeriodo', () => {
  it('should show the last closed month rather than the one still running', () => {
    // ARRANGE — newest first, as the query returns them
    const periodos = ['2026-08-01', '2026-07-01']

    // ACT
    const escolhido = escolherPeriodo(periodos, '2026-08-01')

    // ASSERT — July is comparable to a monthly target; August-so-far is not
    expect(escolhido).toBe('2026-07-01')
  })

  it('should fall back to the running month when it is all there is', () => {
    // ARRANGE — a client who just connected has nothing else
    const periodos = ['2026-08-01']

    // ACT
    const escolhido = escolherPeriodo(periodos, '2026-08-01')

    // ASSERT — an imperfect panel beats a blank one
    expect(escolhido).toBe('2026-08-01')
  })

  it('should take the newest when none of them is the running month', () => {
    // ARRANGE — collection stopped two months ago
    const periodos = ['2026-06-01', '2026-05-01']

    // ACT / ASSERT
    expect(escolherPeriodo(periodos, '2026-08-01')).toBe('2026-06-01')
  })

  it('should have nothing to show when there is no measured period', () => {
    // ARRANGE / ACT / ASSERT
    expect(escolherPeriodo([], '2026-08-01')).toBeNull()
  })
})

describe('periodOf', () => {
  it('should stamp a date with the first day of its month', () => {
    // ARRANGE / ACT / ASSERT
    expect(periodOf(new Date('2026-08-14T13:20:00Z'))).toBe('2026-08-01')
  })

  it('should measure the month in UTC, like the collector', () => {
    // ARRANGE — 31/08 at 23:40 in Brasília is already 01/09 in UTC. Reading
    // this in local time would put the end of one month into the next.
    const virada = new Date('2026-09-01T02:40:00Z')

    // ACT / ASSERT
    expect(periodOf(virada)).toBe('2026-09-01')
  })

  it('should pad a single-digit month', () => {
    // ARRANGE / ACT / ASSERT — "2026-3-01" would match no stored period
    expect(periodOf(new Date('2026-03-09T12:00:00Z'))).toBe('2026-03-01')
  })
})
