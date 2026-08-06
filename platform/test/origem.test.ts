import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { descreverOrigem } from '../lib/origem.ts'

/**
 * Where a number came from.
 *
 * This exists because the consultant had to ask whether "23 purchases" was an
 * average. The answer was in the database and never on screen. What this file
 * guards is the next failure of the same kind: a source the schema allows and
 * this mapping forgets, which would render a metric with no provenance at all
 * and no error anywhere.
 */

describe('descreverOrigem', () => {
  it('should cover every source the schema allows', () => {
    // ARRANGE — read the enum from the schema instead of restating it here. A
    // second copy would drift, and the drift is exactly the silent gap: a new
    // source ships, this mapping returns null, and the card loses its address.
    const schema = readFileSync(join(import.meta.dirname, '..', 'db', 'schema.ts'), 'utf8')
    const bloco = schema.slice(schema.indexOf('export const metricValue'))
    const enumerados = bloco.match(/source:\s*mysqlEnum\(\[([^\]]+)\]/)?.[1] ?? ''
    const fontes = [...enumerados.matchAll(/'([a-z0-9_]+)'/g)].map(m => m[1] ?? '')

    // ACT / ASSERT
    expect(fontes.length).toBeGreaterThan(3)
    for (const fonte of fontes) {
      expect(descreverOrigem(fonte), `origem "${fonte}" sem descrição`).not.toBeNull()
    }
  })

  it('should mark a typed-in number as not measured', () => {
    // ARRANGE — a figure somebody typed is not the same kind of figure as one
    // an instrument counted, and the badge is what says so before anyone
    // decides on it
    // ACT / ASSERT
    expect(descreverOrigem('manual')?.medido).toBe(false)
    expect(descreverOrigem('ga4')?.medido).toBe(true)
    expect(descreverOrigem('store')?.medido).toBe(true)
    expect(descreverOrigem('insights')?.medido).toBe(true)
  })

  it('should warn about looping on the public source', () => {
    // ARRANGE — views count replays, and every screen that shows them is
    // required to say so
    // ACT / ASSERT
    expect(descreverOrigem('public')?.longo).toMatch(/looping/i)
  })

  it('should give nothing for an absent or unknown source', () => {
    // ARRANGE / ACT / ASSERT
    expect(descreverOrigem(null)).toBeNull()
    expect(descreverOrigem('inventada')).toBeNull()
  })
})
