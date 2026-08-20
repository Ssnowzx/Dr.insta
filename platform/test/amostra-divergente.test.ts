import { describe, expect, it } from 'vitest'
import { amostraDe } from '../components/metric-bar.tsx'

/**
 * The sentence that tells a reader how much to trust the losing reading.
 *
 * July's four guard-rails were calibrated on a screenshot of six Reels and the
 * API measured the whole account: 1,32% against 5,45% on the same metric, same
 * month. The card printed both and left them looking like two opinions.
 */
describe('amostraDe', () => {
  it('should say nothing beyond the full stop when the sample is unknown', () => {
    // ARRANGE / ACT
    const fim = amostraDe(null)

    // ASSERT — an invented sample is worse than an absent one
    expect(fim).toBe('.')
  })

  it('should name the sample in the plural when there is more than one post', () => {
    // ARRANGE / ACT
    const fim = amostraDe(6)

    // ASSERT
    expect(fim).toBe(', de uma amostra de 6 posts.')
  })

  it('should say post in the singular when the sample is one', () => {
    // ARRANGE / ACT
    const fim = amostraDe(1)

    // ASSERT — the product ships a one-Reel baseline today (product_reel_retention)
    expect(fim).toBe(', de uma amostra de 1 post.')
  })

  it('should end in a full stop in every branch, so the next sentence starts clean', () => {
    // ARRANGE
    const casos = [null, 1, 6, 58]

    // ACT
    const fins = casos.map(amostraDe)

    // ASSERT
    for (const fim of fins) expect(fim.endsWith('.')).toBe(true)
  })
})
