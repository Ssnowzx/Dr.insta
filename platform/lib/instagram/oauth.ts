import { randomBytes } from 'node:crypto'

/**
 * Business Login for Instagram — the authorisation half.
 *
 * No Facebook Page and no Facebook account in the loop: the client signs in to
 * Instagram itself. She never types a credential into this platform, and this
 * platform never sees one.
 *
 * Read-only, decided on 06/08/2026. The scope list is the whole permission
 * surface, and it is short on purpose: the authorisation screen is read at the
 * exact moment she decides whether to trust us, and asking for powers we do not
 * exercise spends that trust for nothing.
 *
 * Pure except for `randomBytes`. Everything else — app id, secret, redirect —
 * arrives as an argument, so the flow is testable without environment.
 */

const AUTHORIZE_URL = 'https://www.instagram.com/oauth/authorize'
const TOKEN_URL = 'https://api.instagram.com/oauth/access_token'
const GRAPH_URL = 'https://graph.instagram.com'

/**
 * What we ask for, and nothing else.
 *
 * `instagram_business_manage_insights` is the one that returns reach, saves,
 * shares and profile_links_taps. It does not appear on the product overview
 * page — only in the `/insights` reference — and the similarly named
 * `instagram_manage_insights` belongs to the older Facebook Login flow.
 */
export const SCOPES = ['instagram_business_basic', 'instagram_business_manage_insights'] as const

export interface AppCredentials {
  /** The **Instagram** App ID. Not the Facebook App ID — the dashboard shows both. */
  appId: string
  appSecret: string
  /** Must match one registered on the app, character for character. */
  redirectUri: string
}

/** Reads the app credentials, or explains what is missing. */
export function credentialsFromEnv (appUrl: string): AppCredentials | null {
  const appId = process.env.IG_APP_ID?.trim() ?? ''
  const appSecret = process.env.IG_APP_SECRET?.trim() ?? ''

  /* Absent is a legitimate state, not an error: without an app configured the
     connect button is simply not offered, and every other screen works. */
  if (appId === '' || appSecret === '') return null

  return { appId, appSecret, redirectUri: `${appUrl.replace(/\/+$/, '')}/conta/instagram/retorno` }
}

/** An unguessable value tying the redirect back to the request that started it. */
export function newState (): string {
  return randomBytes(24).toString('base64url')
}

/**
 * The URL that opens Instagram's authorisation screen.
 *
 * `state` is not optional here even though the API treats it as optional. A
 * callback that accepts any request it receives is a callback anyone can use to
 * plant a connection.
 */
export function authorizeUrl (creds: AppCredentials, state: string): string {
  const url = new URL(AUTHORIZE_URL)
  url.searchParams.set('client_id', creds.appId)
  url.searchParams.set('redirect_uri', creds.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', SCOPES.join(','))
  url.searchParams.set('state', state)
  /* Hide the "continue with Facebook" option: this flow does not use it, and
     offering it leads her into an account that has nothing to do with this. */
  url.searchParams.set('enable_fb_login', '0')

  return url.toString()
}

export interface ShortLivedToken {
  token: string
  igUserId: string
}

export interface LongLivedToken {
  token: string
  expiresAt: Date
}

/** Anything the authorisation flow can fail at, in a form a screen can read. */
export class OAuthError extends Error {
  constructor (message: string, readonly detail?: string) {
    super(message)
    this.name = 'OAuthError'
  }
}

/**
 * Trades the one-hour, single-use code for a short-lived token.
 *
 * `FormData` because every example in Meta's documentation is `curl -F`, which
 * is multipart. Measured against the live endpoint, url-encoded works too —
 * this follows the documented shape rather than betting on the undocumented one.
 *
 * A TRAP WORTH KNOWING, found against the live endpoint on 06/08/2026:
 * an app id that does not exist comes back as
 * `"Missing required field client_id"` — not "invalid", not "unknown app".
 * The field is right there in the body. If this error appears with a real app
 * configured, suspect the Facebook App ID being used in place of the Instagram
 * one before suspecting the request shape.
 */
export async function exchangeCode (
  creds: AppCredentials,
  code: string
): Promise<ShortLivedToken> {
  const body = new FormData()
  body.set('client_id', creds.appId)
  body.set('client_secret', creds.appSecret)
  body.set('grant_type', 'authorization_code')
  body.set('redirect_uri', creds.redirectUri)
  body.set('code', code)

  const response = await fetch(TOKEN_URL, { method: 'POST', body })
  const payload: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    throw new OAuthError('Não consegui confirmar a autorização com o Instagram.', describe(payload))
  }

  const token = readString(payload, 'access_token')
  const userId = readUserId(payload)

  if (token === null || userId === null) {
    throw new OAuthError('O Instagram respondeu sem o token esperado.', describe(payload))
  }

  return { token, igUserId: userId }
}

/**
 * Turns the short-lived token into the 60-day one.
 *
 * Always done immediately: the short-lived token expires in about an hour, and
 * a connection that stops working the same afternoon is worse than one that
 * never started.
 */
export async function exchangeForLongLived (
  creds: AppCredentials,
  shortLived: string,
  now: Date = new Date()
): Promise<LongLivedToken> {
  const url = new URL(`${GRAPH_URL}/access_token`)
  url.searchParams.set('grant_type', 'ig_exchange_token')
  url.searchParams.set('client_secret', creds.appSecret)
  url.searchParams.set('access_token', shortLived)

  const response = await fetch(url)
  const payload: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    throw new OAuthError('Não consegui obter o acesso de longa duração.', describe(payload))
  }

  return readTokenWithExpiry(payload, now, 'O Instagram respondeu sem o token de longa duração.')
}

/**
 * Extends a long-lived token.
 *
 * Meta requires the token to be at least 24 hours old and not yet expired.
 * Once it lapses there is no way back — the client has to authorise again —
 * which is why the routine refreshes with two weeks to spare rather than on the
 * last day.
 */
export async function refreshLongLived (
  token: string,
  now: Date = new Date()
): Promise<LongLivedToken> {
  const url = new URL(`${GRAPH_URL}/refresh_access_token`)
  url.searchParams.set('grant_type', 'ig_refresh_token')
  url.searchParams.set('access_token', token)

  const response = await fetch(url)
  const payload: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    throw new OAuthError('Não consegui renovar o acesso.', describe(payload))
  }

  return readTokenWithExpiry(payload, now, 'A renovação respondeu sem token.')
}

// ------------------------------------------------------------------ parsing

/* `unknown` and narrowed by hand rather than cast. The shape comes from someone
   else's server, and `as` here would turn a changed response into a runtime
   error somewhere far away. */

function isRecord (value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readString (payload: unknown, key: string): string | null {
  if (!isRecord(payload)) return null
  const value = payload[key]
  return typeof value === 'string' && value !== '' ? value : null
}

/** `user_id` arrives as a number in some responses and a string in others. */
function readUserId (payload: unknown): string | null {
  if (!isRecord(payload)) return null
  const value = payload.user_id
  if (typeof value === 'string' && value !== '') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

function readTokenWithExpiry (payload: unknown, now: Date, whenMissing: string): LongLivedToken {
  const token = readString(payload, 'access_token')
  if (token === null) throw new OAuthError(whenMissing, describe(payload))

  const seconds = isRecord(payload) && typeof payload.expires_in === 'number'
    ? payload.expires_in
    /* Meta documents 60 days. Falling back to it rather than throwing keeps a
       working token usable if the field ever goes missing; the refresh routine
       has two weeks of slack to absorb the difference. */
    : 60 * 24 * 60 * 60

  return { token, expiresAt: new Date(now.getTime() + seconds * 1000) }
}

/**
 * A short description of a failure, for the log.
 *
 * Only the error fields — never the whole payload, which on the token endpoints
 * is where the credential lives.
 */
function describe (payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined

  const error = payload.error
  if (isRecord(error)) {
    const message = typeof error.message === 'string' ? error.message : undefined
    const type = typeof error.type === 'string' ? error.type : undefined
    return [type, message].filter(Boolean).join(': ') || undefined
  }

  const message = payload.error_message
  return typeof message === 'string' ? message : undefined
}
