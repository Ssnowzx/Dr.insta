import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ACAO_RECUSA, MOTIVOS_CALLBACK, MOTIVOS_RECUSA, STATE_TTL_MS, verificarRetorno
} from '../lib/instagram/state.ts'

/**
 * The gate between a redirect and a stored credential.
 *
 * Every rejection here is a way someone could plant a connection on her account
 * or burn one she is in the middle of making. The rules are dull; the
 * consequence of skipping one is not.
 */

const params = (query: string): URLSearchParams => new URLSearchParams(query)

describe('verificarRetorno', () => {
  it('should accept a callback that matches the request we started', () => {
    // ARRANGE
    const veredito = verificarRetorno(params('code=abc&state=xyz'), 'xyz')

    // ACT / ASSERT
    expect(veredito.ok).toBe(true)
    expect(veredito.ok && veredito.code).toBe('abc')
  })

  it('should refuse a callback with no cookie behind it', () => {
    // ARRANGE — a URL anyone could construct and hand to a signed-in person
    const veredito = verificarRetorno(params('code=abc&state=xyz'), undefined)

    // ACT / ASSERT
    expect(veredito.ok).toBe(false)
    expect(!veredito.ok && veredito.motivo).toBe('estado-invalido')
  })

  it('should refuse a state that does not match the cookie', () => {
    // ARRANGE
    const veredito = verificarRetorno(params('code=abc&state=outro'), 'xyz')

    // ACT / ASSERT
    expect(!veredito.ok && veredito.motivo).toBe('estado-invalido')
  })

  it('should refuse a callback with no state at all', () => {
    // ARRANGE
    const veredito = verificarRetorno(params('code=abc'), 'xyz')

    // ACT / ASSERT
    expect(!veredito.ok && veredito.motivo).toBe('estado-invalido')
  })

  it('should treat an empty cookie as no cookie', () => {
    // ARRANGE — an empty string must not match an empty state parameter
    const veredito = verificarRetorno(params('code=abc&state='), '')

    // ACT / ASSERT
    expect(!veredito.ok && veredito.motivo).toBe('estado-invalido')
  })

  it('should give the same verdict for missing and mismatched state', () => {
    // ARRANGE
    const semCookie = verificarRetorno(params('code=a&state=s'), undefined)
    const cookieErrado = verificarRetorno(params('code=a&state=s'), 'outro')

    // ACT / ASSERT — distinguishing them tells an attacker which half they got right
    expect(!semCookie.ok && semCookie.motivo).toBe(!cookieErrado.ok && cookieErrado.motivo)
  })

  it('should report a refusal from the authorisation screen as such', () => {
    // ARRANGE — she pressed cancel; nothing was created and nothing was lost
    const veredito = verificarRetorno(params('error=access_denied&state=xyz'), 'xyz')

    // ACT / ASSERT
    expect(!veredito.ok && veredito.motivo).toBe('recusado')
  })

  it('should check the refusal before the state', () => {
    // ARRANGE — a cancel with no cookie left is still a cancel, not an attack
    const veredito = verificarRetorno(params('error=access_denied'), undefined)

    // ACT / ASSERT
    expect(!veredito.ok && veredito.motivo).toBe('recusado')
  })

  it('should refuse a valid state with no code', () => {
    // ARRANGE
    const veredito = verificarRetorno(params('state=xyz'), 'xyz')

    // ACT / ASSERT
    expect(!veredito.ok && veredito.motivo).toBe('sem-codigo')
  })
})

describe('STATE_TTL_MS', () => {
  it('should be long enough to read a screen and short enough to be worthless', () => {
    // ARRANGE / ACT / ASSERT
    expect(STATE_TTL_MS).toBeGreaterThanOrEqual(5 * 60 * 1000)
    expect(STATE_TTL_MS).toBeLessThanOrEqual(15 * 60 * 1000)
  })
})

/**
 * The audit trail of a connection that did not happen.
 *
 * The route redirected on five of these and wrote nothing, so a failed attempt
 * was indistinguishable from never having tried. These are the two rules that
 * make the trail worth having: it has to reach every motive, and it must not
 * pollute the counter the screen reads.
 */
describe('motivos de recusa', () => {
  it('should carry every callback verdict into the logged list', () => {
    // ARRANGE — the verdicts `verificarRetorno` can actually return
    const vereditos = [
      verificarRetorno(params('error=access_denied'), 'xyz'),
      verificarRetorno(params('code=abc&state=outro'), 'xyz'),
      verificarRetorno(params('state=xyz'), 'xyz')
    ]

    // ACT
    const motivos = vereditos.map(v => (v.ok ? null : v.motivo))

    // ASSERT — as a set: the list is what the route logs by, and the order it
    // is written in is not a rule anybody should have to preserve
    expect([...motivos].sort()).toEqual([...MOTIVOS_CALLBACK].sort())
    for (const motivo of motivos) {
      expect(MOTIVOS_RECUSA).toContain(motivo)
    }
  })

  it('should not file a refusal as an Instagram failure', () => {
    // ARRANGE / ACT / ASSERT — `failedAttempts` counts the other action and the
    // screen narrates it as "broke inside Instagram", which a refusal is not
    expect(ACAO_RECUSA).not.toBe('instagram_auth_failed')
  })

  it('should give every refusal reason a message on screen', () => {
    // ARRANGE — read as text: the component pulls in React and Next, and the
    // rule under test is that the map has a key, not how it renders
    const tela = readFileSync(
      join(import.meta.dirname, '..', 'components', 'instagram-section.tsx'),
      'utf8'
    )
    const mapa = tela.slice(tela.indexOf('const RESULTADOS'), tela.indexOf('export function'))

    // ACT
    const semTexto = MOTIVOS_RECUSA.filter(
      motivo => !mapa.includes(`${motivo}:`) && !mapa.includes(`'${motivo}':`)
    )

    // ASSERT — a motive with no entry renders no warning at all: she comes back
    // from Instagram, something went wrong, and the screen says nothing
    expect(semTexto).toEqual([])
  })
})
