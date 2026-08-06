import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { proxy } from '../proxy.ts'
import { SESSION_COOKIE } from '../lib/constants.ts'

/**
 * The optimistic gate.
 *
 * It exists to save a visitor the flash of a protected screen, and it is
 * allowed to be wrong in exactly one direction: it may send someone to sign in
 * who turns out to be signed in, and the page will correct it. It may never
 * send someone AWAY from a public screen, because the only evidence it has is
 * that a cookie exists — and a cookie proves nothing about the session behind
 * it.
 *
 * That distinction is not academic. The file used to bounce `/entrar` → `/` on
 * cookie presence while `requireSession()` bounced `/` → `/entrar` when the
 * cookie failed to resolve, and the pair produced an unrecoverable
 * ERR_TOO_MANY_REDIRECTS. Deactivating a user was enough to trigger it, and the
 * product sends no email, so the person locked out had no way back.
 */

const at = (path: string, cookie?: string): NextRequest => new NextRequest(
  new URL(path, 'https://plataforma.example.invalid'),
  cookie === undefined ? {} : { headers: { cookie } }
)

const live = `${SESSION_COOKIE}=any-opaque-token`

/** Where a redirecting response points, or `null` when it lets the request pass. */
const sentTo = (path: string, cookie?: string): string | null => {
  const response = proxy(at(path, cookie))
  const location = response.headers.get('location')
  return location === null ? null : new URL(location).pathname +
    new URL(location).search
}

describe('proxy', () => {
  it('should send a visitor with no cookie to sign in', () => {
    // ARRANGE / ACT / ASSERT
    expect(sentTo('/plano')).toBe('/entrar?destino=%2Fplano')
  })

  it('should remember where she was heading', () => {
    // ARRANGE — she followed a link to a specific request and had no session;
    // losing the destination would drop her on the panel and make her navigate
    // back by hand
    // ACT / ASSERT
    expect(sentTo('/pedidos/01ABC?aba=historico'))
      .toBe('/entrar?destino=%2Fpedidos%2F01ABC%3Faba%3Dhistorico')
  })

  it('should not add a destination for the root', () => {
    // ARRANGE / ACT / ASSERT — `destino=/` is where she lands anyway
    expect(sentTo('/')).toBe('/entrar')
  })

  it('should let a cookie-less visitor reach the public routes', () => {
    // ARRANGE / ACT / ASSERT — redirecting these would be the loop in reverse
    expect(sentTo('/entrar')).toBeNull()
    expect(sentTo('/recuperar')).toBeNull()
    expect(sentTo('/convite/abc')).toBeNull()
    expect(sentTo('/nova-senha/abc')).toBeNull()
  })

  it('should let a request with a cookie through to the real check', () => {
    // ARRANGE / ACT / ASSERT
    expect(sentTo('/plano', live)).toBeNull()
  })

  it('should never redirect away from sign-in, cookie or not', () => {
    // ARRANGE — THE REGRESSION. A cookie whose session is gone, expired, or
    // owned by a deactivated user still looks exactly like a live one here.
    // Bouncing it to `/` hands it to `requireSession()`, which bounces it back,
    // and the browser dies between the two.
    // ACT / ASSERT
    expect(sentTo('/entrar', live)).toBeNull()
    expect(sentTo('/recuperar', live)).toBeNull()
  })

  it('should not mistake a lookalike path for a public one', () => {
    // ARRANGE — `isPublic` matches the exact path or a `/`-separated child, so
    // a route merely starting with the same letters stays protected
    // ACT / ASSERT
    expect(sentTo('/entrar-em-contato')).toBe('/entrar?destino=%2Fentrar-em-contato')
    expect(sentTo('/conviteiro')).toBe('/entrar?destino=%2Fconviteiro')
  })
})
