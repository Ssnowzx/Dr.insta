import { describe, expect, it } from 'vitest'
import { porExtenso } from '../components/funnel.tsx'

/**
 * The funnel's caption is prose, and prose agrees.
 *
 * The version that interpolated the count read "As última são finas demais"
 * whenever exactly one bar was pinned: the singular branch dropped the number
 * and left the article and the verb plural. It shipped to production, and only
 * because the funnel went from four stages to three did the case ever occur.
 */

describe('porExtenso', () => {
  it('should spell out the counts a funnel can have', () => {
    // ARRANGE / ACT / ASSERT
    expect(porExtenso(1)).toBe('uma')
    expect(porExtenso(2)).toBe('duas')
    expect(porExtenso(3)).toBe('três')
  })

  it('should fall back to the digit rather than render undefined', () => {
    // ARRANGE — a funnel this long does not exist today, and the caption must
    // still be a sentence if one ever does
    // ACT / ASSERT
    expect(porExtenso(12)).toBe('12')
  })
})
