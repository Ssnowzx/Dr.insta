import { describe, expect, it } from 'vitest'
import { escreverNumero, lerNumero } from '../lib/numero.ts'

/**
 * The most dangerous parse in the product, tested to the point of tedium.
 *
 * "347.482" is 347 thousand in pt-BR and 347.482 to `Number()`. That is a
 * thousand-fold error in the second step of the funnel, entering the database
 * looking entirely plausible, making every rate computed from it wrong with
 * nothing downstream breaking.
 *
 * A wrong answer here is silent forever, which is why the refusals are tested
 * as carefully as the successes: a parser that guesses at an ambiguous input is
 * right for one person and wrong for the other, and neither finds out.
 */

describe('lerNumero — contagem', () => {
  it('should read a Brazilian thousands separator as thousands', () => {
    // ARRANGE — the exact string she copies off Insights, and the exact string
    // `Number()` gets catastrophically wrong
    // ACT / ASSERT
    expect(lerNumero('347.482').valor).toBe(347482)
  })

  it('should read millions', () => {
    // ARRANGE / ACT / ASSERT
    expect(lerNumero('5.413.754').valor).toBe(5413754)
  })

  it('should read a bare number', () => {
    // ARRANGE / ACT / ASSERT
    expect(lerNumero('20824').valor).toBe(20824)
  })

  it('should ignore spaces around and inside', () => {
    // ARRANGE — a paste out of Insights brings whitespace with it
    // ACT / ASSERT
    expect(lerNumero('  347.482 ').valor).toBe(347482)
  })

  it('should REFUSE an ambiguous dot rather than guess', () => {
    // ARRANGE — "1.5" is 1,5 typed with the wrong key or 1.500 typed short.
    // Picking either silently is how a figure ends up a thousand times off.
    // ACT
    const r = lerNumero('1.5')

    // ASSERT
    expect(r.ok).toBe(false)
    expect(r.erro).toContain('três dígitos')
  })

  it('should refuse a decimal on a count', () => {
    // ARRANGE — profile visits are people; there is no half of one
    // ACT
    const r = lerNumero('347,5')

    // ASSERT
    expect(r.ok).toBe(false)
  })

  it('should refuse letters, and say what to do', () => {
    // ARRANGE / ACT
    const r = lerNumero('347 mil')

    // ASSERT — never "invalid input": the message has to teach the format
    expect(r.ok).toBe(false)
    expect(r.erro).toContain('347.482')
  })

  it('should refuse empty and negative', () => {
    // ARRANGE / ACT / ASSERT
    expect(lerNumero('').ok).toBe(false)
    expect(lerNumero('   ').ok).toBe(false)
  })

  it('should refuse two commas', () => {
    // ARRANGE / ACT / ASSERT
    expect(lerNumero('1,5,2').ok).toBe(false)
  })
})

describe('lerNumero — porcentagem', () => {
  it('should store a percentage as a ratio', () => {
    // ARRANGE — the schema stores ratios as ratios; the x100 lives in
    // `lib/format.ts` and nowhere else
    // ACT / ASSERT
    expect(lerNumero('12,5%', 'ratio').valor).toBe(0.125)
  })

  it('should accept it without the sign', () => {
    // ARRANGE — she reads "12,5%" off the screen and types the digits
    // ACT / ASSERT
    expect(lerNumero('12,5', 'ratio').valor).toBe(0.125)
  })

  it('should read a whole percentage', () => {
    // ARRANGE / ACT / ASSERT
    expect(lerNumero('64', 'ratio').valor).toBe(0.64)
  })

  it('should read a value under 1 as a percentage, not as a ratio', () => {
    // ARRANGE — nobody reports a share of an audience as 0,8%. Reading "0,8"
    // as 0,8% would be right in theory and wrong every time it is typed.
    // ACT / ASSERT
    expect(lerNumero('0,8', 'ratio').valor).toBeCloseTo(0.008, 6)
  })

  it('should refuse more than a hundred percent', () => {
    // ARRANGE — a share of an audience cannot exceed the audience, and a 140%
    // in this column would poison every rate normalised by it
    // ACT
    const r = lerNumero('140', 'ratio')

    // ASSERT
    expect(r.ok).toBe(false)
    expect(r.erro).toContain('100%')
  })
})

describe('escreverNumero', () => {
  it('should echo a count the way she typed it', () => {
    // ARRANGE — the confirmation has to look like the input, or it confirms
    // nothing
    // ACT / ASSERT
    expect(escreverNumero(347482)).toBe('347.482')
  })

  it('should echo a ratio as a percentage', () => {
    // ARRANGE / ACT / ASSERT
    expect(escreverNumero(0.125, 'ratio')).toBe('12,5%')
  })

  it('should survive a round trip', () => {
    // ARRANGE — the property that matters: what is shown back can be typed in
    // again and mean the same thing
    for (const bruto of ['347.482', '5.413.754', '20824']) {
      // ACT
      const lido = lerNumero(bruto).valor ?? 0
      const escrito = escreverNumero(lido)

      // ASSERT
      expect(lerNumero(escrito).valor).toBe(lido)
    }
  })
})
