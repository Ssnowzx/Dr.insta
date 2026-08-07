/**
 * Talking to the Graph API.
 *
 * The distinction this file exists to make is between "the credential is no
 * good" and "something went wrong just now". They demand opposite responses:
 * the first needs her to reconnect and must be said out loud, the second needs
 * patience and must NOT be said out loud, because a screen that cries
 * "reconnect" after one bad minute trains her to ignore it.
 *
 * No dependency: `fetch` and `URL`.
 */

const GRAPH_URL = 'https://graph.instagram.com'
const VERSION = 'v23.0'

/** The credential no longer works. Only she can fix it. */
export class IgAuthError extends Error {
  constructor (message: string) {
    super(message)
    this.name = 'IgAuthError'
  }
}

/** Something failed that may well work in an hour. Nobody needs to be told yet. */
export class IgTransientError extends Error {
  constructor (message: string) {
    super(message)
    this.name = 'IgTransientError'
  }
}

/**
 * Meta error codes that mean the token is done.
 *
 * 190 covers expired, revoked and invalidated-by-password-change. 102 is a
 * dead session, 10 and 200-299 are permission refusals — all of which survive a
 * retry, so retrying is exactly the wrong response.
 */
function isAuthFailure (code: number, subcode: number): boolean {
  if (code === 190 || code === 102 || code === 10) return true
  if (code >= 200 && code <= 299) return true
  /* 458-467 are the token subcodes: expired, revoked, changed password, and so
     on. They arrive under code 190 in practice, but not always. */
  return subcode >= 458 && subcode <= 467
}

export interface IgClient {
  get: (path: string, params?: Record<string, string>) => Promise<unknown>
  /** How many requests this run has made. Measured rather than assumed. */
  readonly calls: number
}

export function createClient (token: string, fetchImpl: typeof fetch = fetch): IgClient {
  let calls = 0

  return {
    get calls () { return calls },

    async get (path: string, params: Record<string, string> = {}): Promise<unknown> {
      const url = new URL(`${GRAPH_URL}/${VERSION}/${path.replace(/^\/+/, '')}`)
      for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
      /* Last, so a caller can never override it with a params entry. */
      url.searchParams.set('access_token', token)

      calls += 1

      let response: Response
      try {
        response = await fetchImpl(url)
      } catch (cause) {
        /* DNS, TLS, socket. Never an auth failure — we did not reach anyone to
           be refused by. */
        throw new IgTransientError(`não consegui falar com o Instagram: ${reason(cause)}`)
      }

      const payload: unknown = await response.json().catch(() => null)

      if (!response.ok) {
        const { code, subcode, message } = readError(payload)

        if (isAuthFailure(code, subcode)) {
          throw new IgAuthError(message ?? 'a autorização não vale mais')
        }

        throw new IgTransientError(
          `o Instagram respondeu ${response.status}${message === undefined ? '' : `: ${message}`}`
        )
      }

      return payload
    }
  }
}

function reason (cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

function readError (payload: unknown): { code: number; subcode: number; message?: string } {
  if (typeof payload !== 'object' || payload === null) return { code: 0, subcode: 0 }

  const error = (payload as Record<string, unknown>).error
  if (typeof error !== 'object' || error === null) return { code: 0, subcode: 0 }

  const e = error as Record<string, unknown>
  return {
    code: typeof e.code === 'number' ? e.code : 0,
    subcode: typeof e.error_subcode === 'number' ? e.error_subcode : 0,
    ...(typeof e.message === 'string' ? { message: e.message } : {})
  }
}
