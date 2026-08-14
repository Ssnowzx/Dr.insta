import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  authorizeUrl, credentialsFromEnv, exchangeCode, exchangeForLongLived,
  newState, OAuthError, refreshLongLived, SCOPES
} from '../lib/instagram/oauth.ts'

/**
 * The authorisation flow.
 *
 * The assertions that matter most are about what we do NOT ask for. Scope creep
 * here is invisible in code review and very visible on the screen where the
 * client decides whether to trust the connection.
 */

const CREDS = {
  appId: '1234567890',
  appSecret: 'segredo',
  redirectUri: 'https://plataforma.exemplo/conta/instagram/retorno'
}

afterEach(() => { vi.unstubAllGlobals() })

/** Stubs one fetch response. */
function stubFetch (body: unknown, ok = true): void {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok,
    json: async () => body
  })))
}

describe('authorizeUrl', () => {
  it('should ask for read scopes and nothing else', () => {
    // ARRANGE / ACT
    const url = new URL(authorizeUrl(CREDS, 'estado'))
    const scopes = (url.searchParams.get('scope') ?? '').split(',')

    // ASSERT — publishing, messaging and comments must not be in here
    expect(scopes).toEqual(['instagram_business_basic', 'instagram_business_manage_insights'])
    expect(scopes).not.toContain('instagram_business_content_publish')
    expect(scopes).not.toContain('instagram_business_manage_messages')
    expect(scopes).not.toContain('instagram_business_manage_comments')
  })

  it('should point at Instagram and not at Facebook', () => {
    // ARRANGE / ACT
    const url = new URL(authorizeUrl(CREDS, 'estado'))

    // ASSERT — this flow needs no Facebook Page and no Facebook account
    expect(url.origin).toBe('https://www.instagram.com')
    expect(url.pathname).toBe('/oauth/authorize/')
    expect(url.searchParams.get('enable_fb_login')).toBe('0')
  })

  it('should keep the trailing slash that stops iOS opening the app', () => {
    // ARRANGE — the Instagram app claims www.instagram.com links; the flow is
    // excluded as `/oauth/authorize/*`, and a path without the slash does not
    // match that exclusion. Without it, tapping "Continuar" on an iPhone leaves
    // Safari for the app, which has no consent screen and shows an error.
    // ACT
    const url = new URL(authorizeUrl(CREDS, 'estado'))

    // ASSERT
    expect(url.pathname.endsWith('/')).toBe(true)
  })

  it('should carry the required parameters', () => {
    // ARRANGE / ACT
    const url = new URL(authorizeUrl(CREDS, 'estado-abc'))

    // ASSERT
    expect(url.searchParams.get('client_id')).toBe(CREDS.appId)
    expect(url.searchParams.get('redirect_uri')).toBe(CREDS.redirectUri)
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('state')).toBe('estado-abc')
  })

  it('should never expose the app secret', () => {
    // ARRANGE / ACT — the browser follows this URL; the secret stays server-side
    const url = authorizeUrl(CREDS, 'estado')

    // ASSERT
    expect(url).not.toContain(CREDS.appSecret)
  })

  it('should export exactly two scopes', () => {
    // ARRANGE / ACT / ASSERT — a guard against quietly growing the list
    expect(SCOPES).toHaveLength(2)
  })
})

describe('newState', () => {
  it('should produce a different value each time', () => {
    // ARRANGE / ACT
    const valores = new Set(Array.from({ length: 50 }, newState))

    // ASSERT — a predictable state defeats the point of having one
    expect(valores.size).toBe(50)
  })

  it('should be url safe', () => {
    // ARRANGE / ACT
    const state = newState()

    // ASSERT — it travels in a query string and comes back in one
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/)
  })
})

describe('credentialsFromEnv', () => {
  const ORIGINAL = { id: process.env.IG_APP_ID, secret: process.env.IG_APP_SECRET }

  afterEach(() => {
    if (ORIGINAL.id === undefined) delete process.env.IG_APP_ID
    else process.env.IG_APP_ID = ORIGINAL.id
    if (ORIGINAL.secret === undefined) delete process.env.IG_APP_SECRET
    else process.env.IG_APP_SECRET = ORIGINAL.secret
  })

  it('should return null when the app is not configured', () => {
    // ARRANGE
    delete process.env.IG_APP_ID
    delete process.env.IG_APP_SECRET

    // ACT
    const creds = credentialsFromEnv('https://plataforma.exemplo')

    // ASSERT — absent is a state, not an error: the button is simply not offered
    expect(creds).toBeNull()
  })

  it('should build the redirect from the public address', () => {
    // ARRANGE
    process.env.IG_APP_ID = '999'
    process.env.IG_APP_SECRET = 'x'

    // ACT — trailing slash must not produce a double slash Meta would reject
    const creds = credentialsFromEnv('https://plataforma.exemplo/')

    // ASSERT
    expect(creds?.redirectUri).toBe('https://plataforma.exemplo/conta/instagram/retorno')
  })
})

describe('exchangeCode', () => {
  it('should return the token and the account id', async () => {
    // ARRANGE
    stubFetch({ access_token: 'curto', user_id: 17841400000000000 })

    // ACT
    const result = await exchangeCode(CREDS, 'codigo')

    // ASSERT — user_id arrives as a number here and as a string elsewhere
    expect(result.token).toBe('curto')
    expect(result.igUserId).toBe('17841400000000000')
  })

  it('should accept a string account id too', async () => {
    // ARRANGE
    stubFetch({ access_token: 'curto', user_id: '17841400000000000' })

    // ACT
    const result = await exchangeCode(CREDS, 'codigo')

    // ASSERT
    expect(result.igUserId).toBe('17841400000000000')
  })

  it('should throw when Instagram refuses the code', async () => {
    // ARRANGE
    stubFetch({ error_message: 'Invalid authorization code' }, false)

    // ACT
    const act = async (): Promise<unknown> => await exchangeCode(CREDS, 'gasto')

    // ASSERT
    await expect(act).rejects.toBeInstanceOf(OAuthError)
  })

  it('should throw when the response has no token', async () => {
    // ARRANGE — a 200 with an unexpected shape must not become an empty token
    stubFetch({ unexpected: true })

    // ACT
    const act = async (): Promise<unknown> => await exchangeCode(CREDS, 'codigo')

    // ASSERT
    await expect(act).rejects.toBeInstanceOf(OAuthError)
  })
})

describe('exchangeForLongLived', () => {
  it('should compute the expiry from expires_in', async () => {
    // ARRANGE
    stubFetch({ access_token: 'longo', expires_in: 60 * 24 * 60 * 60 })
    const now = new Date('2026-08-06T00:00:00Z')

    // ACT
    const result = await exchangeForLongLived(CREDS, 'curto', now)

    // ASSERT
    expect(result.token).toBe('longo')
    expect(result.expiresAt.toISOString()).toBe('2026-10-05T00:00:00.000Z')
  })

  it('should fall back to sixty days when expires_in is missing', async () => {
    // ARRANGE — keeps a working token usable if the field ever disappears
    stubFetch({ access_token: 'longo' })
    const now = new Date('2026-08-06T00:00:00Z')

    // ACT
    const result = await exchangeForLongLived(CREDS, 'curto', now)

    // ASSERT
    expect(result.expiresAt.getTime()).toBeGreaterThan(now.getTime())
  })

  it('should throw when the exchange fails', async () => {
    // ARRANGE
    stubFetch({ error: { type: 'OAuthException', message: 'expired' } }, false)

    // ACT
    const act = async (): Promise<unknown> => await exchangeForLongLived(CREDS, 'curto')

    // ASSERT
    await expect(act).rejects.toBeInstanceOf(OAuthError)
  })
})

describe('refreshLongLived', () => {
  it('should return a token with a new expiry', async () => {
    // ARRANGE
    stubFetch({ access_token: 'renovado', expires_in: 5184000 })
    const now = new Date('2026-08-06T00:00:00Z')

    // ACT
    const result = await refreshLongLived('antigo', now)

    // ASSERT
    expect(result.token).toBe('renovado')
    expect(result.expiresAt.getTime()).toBe(now.getTime() + 5184000 * 1000)
  })

  it('should throw when the token is past saving', async () => {
    // ARRANGE — once it lapses there is no way back; she has to authorise again
    stubFetch({ error: { message: 'Error validating access token' } }, false)

    // ACT
    const act = async (): Promise<unknown> => await refreshLongLived('morto')

    // ASSERT
    await expect(act).rejects.toBeInstanceOf(OAuthError)
  })
})
