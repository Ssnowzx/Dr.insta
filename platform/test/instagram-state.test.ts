import { describe, expect, it } from 'vitest'
import { STATE_TTL_MS, verificarRetorno } from '../lib/instagram/state.ts'

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
