import { describe, expect, it } from 'vitest'
import { posicao, resolver, resolverPorChave } from '../lib/precedencia.ts'

/**
 * The rule that keeps the dashboard from rendering a card twice.
 *
 * These tests exist before the collection that will make them matter. The bug
 * they prevent is not subtle in production — the same metric appears twice on
 * the panel — but it is invisible until a second source writes a row, which is
 * exactly the moment nobody will be looking at the dashboard.
 */

const linha = (source: string | null, value: number | null): { source: string | null; value: number | null } =>
  ({ source, value })

describe('posicao', () => {
  it('should rank an instrument above a person', () => {
    // ARRANGE / ACT / ASSERT — the whole point of the ordering
    expect(posicao('api')).toBeLessThan(posicao('insights'))
    expect(posicao('insights')).toBeLessThan(posicao('manual'))
  })

  it('should give every declared source a distinct rank', () => {
    // ARRANGE
    const fontes = ['api', 'store', 'ga4', 'insights', 'manual', 'public']

    // ACT
    const postos = fontes.map(posicao)

    // ASSERT — a tie would leave the winner to whatever the database returned first
    expect(new Set(postos).size).toBe(fontes.length)
  })

  it('should sort an unknown source last instead of throwing', () => {
    // ARRANGE / ACT / ASSERT — a row added by hand must not blank a screen
    expect(posicao('inventada')).toBeGreaterThan(posicao('manual'))
    expect(posicao(null)).toBeGreaterThan(posicao('manual'))
  })
})

describe('resolver', () => {
  it('should pick the automatic source over the transcribed one', () => {
    // ARRANGE — the exact collision the Instagram collection creates
    const linhas = [linha('insights', 5413754), linha('api', 5418002)]

    // ACT
    const resolvido = resolver(linhas)

    // ASSERT
    expect(resolvido?.escolhido.source).toBe('api')
    expect(resolvido?.escolhido.value).toBe(5418002)
  })

  it('should report the loser when the two disagree', () => {
    // ARRANGE
    const linhas = [linha('api', 100), linha('insights', 90)]

    // ACT
    const resolvido = resolver(linhas)

    // ASSERT — two measurements that disagree say something about confidence
    expect(resolvido?.divergentes).toHaveLength(1)
    expect(resolvido?.divergentes[0]?.value).toBe(90)
  })

  it('should not report a divergence when the sources agree', () => {
    // ARRANGE
    const linhas = [linha('api', 100), linha('insights', 100)]

    // ACT
    const resolvido = resolver(linhas)

    // ASSERT — agreement shown as divergence turns a confirmation into a doubt
    expect(resolvido?.divergentes).toEqual([])
  })

  it('should keep a lone low-precedence source', () => {
    // ARRANGE — revenue reported by hand, with nothing to compare against
    const linhas = [linha('manual', 12700)]

    // ACT
    const resolvido = resolver(linhas)

    // ASSERT
    expect(resolvido?.escolhido.source).toBe('manual')
    expect(resolvido?.escolhido.value).toBe(12700)
  })

  it('should prefer a value over an absent one regardless of rank', () => {
    // ARRANGE — the API answered "nothing for this period"
    const linhas = [linha('api', null), linha('insights', 347482)]

    // ACT
    const resolvido = resolver(linhas)

    // ASSERT — an absent number is not a number; it must not blank the screen
    expect(resolvido?.escolhido.source).toBe('insights')
    expect(resolvido?.escolhido.value).toBe(347482)
  })

  it('should return null for no rows at all', () => {
    // ARRANGE / ACT
    const resolvido = resolver([])

    // ASSERT
    expect(resolvido).toBeNull()
  })

  it('should not mutate the array it was given', () => {
    // ARRANGE
    const linhas = [linha('insights', 1), linha('api', 2)]
    const antes = [...linhas]

    // ACT
    resolver(linhas)

    // ASSERT
    expect(linhas).toEqual(antes)
  })
})

describe('resolverPorChave', () => {
  it('should return one row per metric even with two sources each', () => {
    // ARRANGE — what the dashboard will read once collection runs
    const linhas = [
      { key: 'reach', source: 'insights', value: 5413754 },
      { key: 'reach', source: 'api', value: 5418002 },
      { key: 'saves_reach', source: 'insights', value: 0.0023 },
      { key: 'saves_reach', source: 'api', value: 0.0024 }
    ]

    // ACT
    const resolvidos = resolverPorChave(linhas, l => l.key)

    // ASSERT — two rows in, two cards out. Not four.
    expect(resolvidos).toHaveLength(2)
    expect(resolvidos.map(r => r.escolhido.source)).toEqual(['api', 'api'])
  })

  it('should preserve the order the metrics first appeared in', () => {
    // ARRANGE
    const linhas = [
      { key: 'b', source: 'insights', value: 1 },
      { key: 'a', source: 'insights', value: 2 },
      { key: 'b', source: 'api', value: 3 }
    ]

    // ACT
    const resolvidos = resolverPorChave(linhas, l => l.key)

    // ASSERT — a caller that ordered its query keeps that order
    expect(resolvidos.map(r => r.escolhido.key)).toEqual(['b', 'a'])
  })

  it('should handle the revenue case already in the database', () => {
    // ARRANGE — July 2026, exactly as seeded: the store panel and her figure
    const linhas = [
      { key: 'revenue', source: 'store', value: 10583.28 },
      { key: 'revenue', source: 'manual', value: 12700 }
    ]

    // ACT
    const resolvidos = resolverPorChave(linhas, l => l.key)

    // ASSERT — the measured panel wins, and the disagreement stays visible
    expect(resolvidos).toHaveLength(1)
    expect(resolvidos[0]?.escolhido.value).toBe(10583.28)
    expect(resolvidos[0]?.divergentes[0]?.value).toBe(12700)
  })
})
