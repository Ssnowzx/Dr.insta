import { describe, expect, it } from 'vitest'
import { derivarTaxas } from '../lib/dashboard.ts'
import type { MetricCard } from '../lib/dashboard.ts'

/**
 * The rate that is two stored numbers divided.
 *
 * It used to be a stored figure with a hand-written note. When the API started
 * measuring reach on 14/08/2026, July's reach moved from 5.413.754 to 5.584.671
 * and the panel showed both: the new one on the reach card, the old one inside
 * the note of the card right below. Same screen, same month, two answers.
 */

const card = (over: Partial<MetricCard> & { key: string }): MetricCard => ({
  label: over.key,
  shortLabel: null,
  description: null,
  unit: 'count',
  decimals: 0,
  tier: 'monitor',
  howToMeasure: null,
  value: null,
  sampleSize: null,
  note: null,
  source: 'insights',
  baseline: null,
  target: null,
  contaminated: false,
  isNorthStar: false,
  targetNote: null,
  benchmark: null,
  benchmarkSource: null,
  benchmarkUpdatedOn: null,
  divergences: [],
  ...over
})

describe('derivarTaxas', () => {
  it('should divide the two current figures rather than trust the stored rate', () => {
    // ARRANGE — the stored rate is July's, computed against the old reach
    const cartoes = [
      card({ key: 'profile_visits', value: 347482 }),
      card({ key: 'reach', value: 5584671 }),
      card({ key: 'profile_visits_reach', value: 0.0642, note: 'nota velha' })
    ]

    // ACT
    const taxa = derivarTaxas(cartoes, '2026-07-01')
      .find(c => c.key === 'profile_visits_reach')

    // ASSERT — 347482 / 5584671, not the 0.0642 sitting in the table
    expect(taxa?.value).toBeCloseTo(0.062221, 6)
  })

  it('should rewrite the note with the numbers it actually divided', () => {
    // ARRANGE
    const cartoes = [
      card({ key: 'profile_visits', value: 347482 }),
      card({ key: 'reach', value: 5584671 }),
      card({ key: 'profile_visits_reach', value: 0.0642, note: 'Derivado: 347.482 visitas ÷ 5.413.754 contas alcançadas em julho.' })
    ]

    // ACT
    const taxa = derivarTaxas(cartoes, '2026-07-01')
      .find(c => c.key === 'profile_visits_reach')

    // ASSERT — a note naming a denominator the panel no longer shows is worse
    // than no note: it reads as a second, contradictory measurement
    expect(taxa?.note).toBe('Derivado: 347.482 visitas ÷ 5.584.671 contas alcançadas em julho.')
    expect(taxa?.note).not.toContain('5.413.754')
  })

  it('should keep the stored rate when a part is missing', () => {
    // ARRANGE — a partial month has reach but no profile_visits, which has no
    // API counterpart at all
    const cartoes = [
      card({ key: 'reach', value: 2668572 }),
      card({ key: 'profile_visits_reach', value: 0.0642, note: 'nota antiga' })
    ]

    // ACT
    const taxa = derivarTaxas(cartoes, '2026-08-01')
      .find(c => c.key === 'profile_visits_reach')

    // ASSERT — an older figure beats an empty card, and its note still says
    // where it came from
    expect(taxa?.value).toBe(0.0642)
    expect(taxa?.note).toBe('nota antiga')
  })

  it('should not divide by a zero reach', () => {
    // ARRANGE
    const cartoes = [
      card({ key: 'profile_visits', value: 100 }),
      card({ key: 'reach', value: 0 }),
      card({ key: 'profile_visits_reach', value: 0.0642 })
    ]

    // ACT
    const taxa = derivarTaxas(cartoes, '2026-07-01')
      .find(c => c.key === 'profile_visits_reach')

    // ASSERT — Infinity on a screen reads as a bug, which it would be
    expect(taxa?.value).toBe(0.0642)
  })

  it('should leave follows_reach alone', () => {
    // ARRANGE — same shape, different denominator: its reach is summed per
    // post, which double-counts whoever saw two posts
    const cartoes = [
      card({ key: 'reach', value: 5584671 }),
      card({ key: 'follows_reach', value: 0.0006, note: 'Derivado dos 58 posts de julho' })
    ]

    // ACT
    const taxa = derivarTaxas(cartoes, '2026-07-01')
      .find(c => c.key === 'follows_reach')

    // ASSERT — deriving it from account reach would silently change its meaning
    expect(taxa?.value).toBe(0.0006)
    expect(taxa?.note).toBe('Derivado dos 58 posts de julho')
  })

  it('should touch nothing else', () => {
    // ARRANGE
    const cartoes = [
      card({ key: 'profile_visits', value: 347482 }),
      card({ key: 'reach', value: 5584671, note: 'nota do alcance' })
    ]

    // ACT
    const saida = derivarTaxas(cartoes, '2026-07-01')

    // ASSERT
    expect(saida.find(c => c.key === 'reach')?.value).toBe(5584671)
    expect(saida.find(c => c.key === 'reach')?.note).toBe('nota do alcance')
  })

  it('should derive the visit-to-follower rate, the funnel step nobody measured', () => {
    // ARRANGE — July as stored: the second gap of the funnel
    const cartoes = [
      card({ key: 'followers_net', value: 20824 }),
      card({ key: 'profile_visits', value: 347482 }),
      card({ key: 'follows_per_visit', value: 0, note: null })
    ]

    // ACT
    const taxa = derivarTaxas(cartoes, '2026-07-01')
      .find(c => c.key === 'follows_per_visit')

    // ASSERT — ~6 in every 100 who open the profile follow. Seven feed posts
    // measured the same month gave 5,86% independently.
    expect(taxa?.value).toBeCloseTo(0.0599, 4)
    expect(taxa?.note).toContain('347.482 visitas ao perfil')
  })

  it('should keep the stored rate when a part of the division is missing', () => {
    // ARRANGE — no profile visits for this period
    const cartoes = [
      card({ key: 'followers_net', value: 20824 }),
      card({ key: 'follows_per_visit', value: 0.0599, note: 'nota antiga' })
    ]

    // ACT
    const taxa = derivarTaxas(cartoes, '2026-08-01')
      .find(c => c.key === 'follows_per_visit')

    // ASSERT — an older figure that says where it came from beats an empty card
    expect(taxa?.value).toBe(0.0599)
    expect(taxa?.note).toBe('nota antiga')
  })
})
