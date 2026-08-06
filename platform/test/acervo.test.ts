import { describe, expect, it } from 'vitest'
import { compararComMediana, mediana, porMilViews } from '../lib/acervo.ts'

/**
 * Reading one post against the rest of her own work.
 *
 * The card used to show four raw numbers with no ruler beside them. These are
 * the calculations that turn them into a reading, so they are the ones that can
 * quietly lie to a client about whether a post did well.
 */

describe('mediana', () => {
  it('should take the middle of an odd set', () => {
    // ARRANGE / ACT / ASSERT
    expect(mediana([5, 1, 3])).toBe(3)
  })

  it('should average the two middle values of an even set', () => {
    // ARRANGE / ACT / ASSERT
    expect(mediana([1, 3, 5, 7])).toBe(4)
  })

  it('should not be dragged by a viral outlier', () => {
    // ARRANGE — her real archive has posts at 7.4M views next to posts at 84k.
    // The mean of this set is 1.6M and would make every ordinary post look
    // like a failure; the median says what a typical post actually is.
    const views = [100_000, 120_000, 150_000, 180_000, 7_400_000]

    // ACT
    const meio = mediana(views)
    const media = views.reduce((a, b) => a + b, 0) / views.length

    // ASSERT
    expect(meio).toBe(150_000)
    expect(media).toBeGreaterThan(1_500_000)
  })

  it('should give nothing for an empty archive', () => {
    // ARRANGE / ACT / ASSERT
    expect(mediana([])).toBeNull()
  })
})

describe('compararComMediana', () => {
  it('should read above-median posts as a multiplier', () => {
    // ARRANGE / ACT
    const c = compararComMediana(360_000, 150_000)

    // ASSERT
    expect(c?.texto).toBe('2,4× a mediana')
    expect(c?.nivel).toBe('acima')
  })

  it('should read below-median posts as a percentage, not a fraction', () => {
    // ARRANGE — "0,4× a mediana" gets read as a factor of four in the wrong
    // direction. A percentage says the same thing without the trap.
    // ACT
    const c = compararComMediana(60_000, 150_000)

    // ASSERT
    expect(c?.texto).toBe('40% da mediana')
    expect(c?.nivel).toBe('abaixo')
  })

  it('should call a post near the median typical', () => {
    // ARRANGE — a post 5% off the middle is noise. Labelling it "above" dresses
    // noise up as a finding, which is the whole failure mode of a dashboard.
    // ACT / ASSERT
    expect(compararComMediana(157_500, 150_000)?.nivel).toBe('tipico')
    expect(compararComMediana(142_500, 150_000)?.nivel).toBe('tipico')
  })

  it('should move off typical only past the band', () => {
    // ARRANGE / ACT / ASSERT — ±15%
    expect(compararComMediana(172_500, 150_000)?.nivel).toBe('acima')
    expect(compararComMediana(127_500, 150_000)?.nivel).toBe('abaixo')
  })

  it('should refuse to compare against a median of zero', () => {
    // ARRANGE — dividing by it yields Infinity, which renders as "∞× a mediana"
    // on a screen the client reads
    // ACT / ASSERT
    expect(compararComMediana(1000, 0)).toBeNull()
    expect(compararComMediana(1000, null)).toBeNull()
  })

  it('should refuse a post with no value', () => {
    // ARRANGE / ACT / ASSERT — a carousel has no views
    expect(compararComMediana(null, 150_000)).toBeNull()
  })
})

describe('porMilViews', () => {
  it('should make two posts of different size comparable', () => {
    // ARRANGE — 140 comments on 80.939 views against 1.838 on 7.452.024. The
    // raw numbers say the second won by a factor of thirteen; per thousand
    // views the first is nearly seven times denser.
    // ACT
    const novo = porMilViews(140, 80_939)
    const viral = porMilViews(1_838, 7_452_024)

    // ASSERT
    expect(novo).toBeCloseTo(1.73, 2)
    expect(viral).toBeCloseTo(0.25, 2)
    expect(novo ?? 0).toBeGreaterThan(viral ?? 0)
  })

  it('should refuse to divide by zero views', () => {
    // ARRANGE / ACT / ASSERT
    expect(porMilViews(10, 0)).toBeNull()
    expect(porMilViews(10, null)).toBeNull()
    expect(porMilViews(null, 1000)).toBeNull()
  })
})
