import { describe, expect, it } from 'vitest'
import { pontoMaisProximo, variacao } from '../lib/serie.ts'
import type { Plot } from '../lib/serie.ts'

/**
 * Which month the finger is on.
 *
 * The chart is drawn in viewBox units and displayed at whatever width the
 * column happens to be, so this mapping is the one place a reading can be
 * silently wrong: it would work perfectly at the width it was written against
 * and report the wrong month everywhere else. On a phone — which is where this
 * interaction was asked for — the plot is a few hundred pixels wide and every
 * one of these cases is the normal case.
 */

/* Matches the component: a 720-unit viewBox with 16 units of inset each side. */
const PLOT: Plot = { width: 720, padLeft: 16, padRight: 16 }

/** A chart rendered 350px wide starting 20px from the viewport's left edge. */
const NO_CELULAR = { left: 20, width: 350 }

describe('pontoMaisProximo', () => {
  it('should map the left edge of the plot to the first point', () => {
    // ARRANGE — 16 of 720 viewBox units is 2.2% across, so 7.8px into a 350px box
    const x = NO_CELULAR.left + (16 / 720) * NO_CELULAR.width

    // ACT / ASSERT
    expect(pontoMaisProximo(x, NO_CELULAR, 8, PLOT)).toBe(0)
  })

  it('should map the right edge of the plot to the last point', () => {
    // ARRANGE
    const x = NO_CELULAR.left + ((720 - 16) / 720) * NO_CELULAR.width

    // ACT / ASSERT
    expect(pontoMaisProximo(x, NO_CELULAR, 8, PLOT)).toBe(7)
  })

  it('should land on the middle point at the middle of the plot', () => {
    // ARRANGE — nine points means index 4 sits exactly halfway
    const x = NO_CELULAR.left + NO_CELULAR.width / 2

    // ACT / ASSERT
    expect(pontoMaisProximo(x, NO_CELULAR, 9, PLOT)).toBe(4)
  })

  it('should give the same month at any rendered width', () => {
    // ARRANGE — the same relative position on a phone and on a desktop. Reading
    // clientX against viewBox units without the box would pass on one and fail
    // on the other, which is exactly how this breaks in production.
    const noDesktop = { left: 300, width: 980 }
    const fracao = 0.5

    // ACT
    const celular = pontoMaisProximo(
      NO_CELULAR.left + NO_CELULAR.width * fracao, NO_CELULAR, 8, PLOT)
    const desktop = pontoMaisProximo(
      noDesktop.left + noDesktop.width * fracao, noDesktop, 8, PLOT)

    // ASSERT
    expect(celular).toBe(desktop)
  })

  it('should hold the ends when the finger slides past them', () => {
    // ARRANGE — overshooting a 350px plot is the normal case with a thumb, not
    // an edge case: the reading has to stick, never disappear
    // ACT / ASSERT
    expect(pontoMaisProximo(NO_CELULAR.left - 200, NO_CELULAR, 8, PLOT)).toBe(0)
    expect(pontoMaisProximo(NO_CELULAR.left + 900, NO_CELULAR, 8, PLOT)).toBe(7)
  })

  it('should refuse a series with nothing in it', () => {
    // ARRANGE / ACT / ASSERT
    expect(pontoMaisProximo(100, NO_CELULAR, 0, PLOT)).toBeNull()
  })

  it('should refuse a box that has not been laid out yet', () => {
    // ARRANGE — `getBoundingClientRect()` returns zeros before layout, and
    // dividing by that width yields Infinity, which rounds to a nonsense index
    // ACT / ASSERT
    expect(pontoMaisProximo(100, { left: 0, width: 0 }, 8, PLOT)).toBeNull()
  })

  it('should answer zero for a single-point series', () => {
    // ARRANGE — with one point the denominator `total - 1` is zero
    // ACT / ASSERT
    expect(pontoMaisProximo(200, NO_CELULAR, 1, PLOT)).toBe(0)
  })
})

describe('variacao', () => {
  it('should give the change against the previous month', () => {
    // ARRANGE / ACT / ASSERT
    expect(variacao(200, 250)).toBeCloseTo(0.25)
    expect(variacao(200, 150)).toBeCloseTo(-0.25)
  })

  it('should give nothing for the first point', () => {
    // ARRANGE / ACT / ASSERT — there is no month before the first one
    expect(variacao(undefined, 500)).toBeNull()
  })

  it('should give nothing when the previous month was zero', () => {
    // ARRANGE — going from nothing to something is not a percentage. Dividing
    // anyway yields Infinity, and the screen would read "+∞%".
    // ACT / ASSERT
    expect(variacao(0, 500)).toBeNull()
  })
})
