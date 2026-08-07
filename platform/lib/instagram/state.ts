/**
 * The anti-CSRF value that ties a callback to the request that started it.
 *
 * In its own module, and free of `server-only`, so both routes and the tests
 * can read the same constants without either importing the other's route
 * handler.
 */

export const STATE_COOKIE = 'ig_oauth_state'

/** Long enough to read an authorisation screen, short enough to be worthless later. */
export const STATE_TTL_MS = 10 * 60 * 1000

export type CallbackVerdict =
  | { ok: true; code: string }
  | { ok: false; motivo: 'recusado' | 'sem-codigo' | 'estado-invalido' }

/**
 * Decides whether a callback may become a connection.
 *
 * Pure, so every branch is testable without a browser — and each branch is a
 * way someone could plant a connection or burn a real one.
 *
 * The comparison is a plain `===` and not a timing-safe compare on purpose: the
 * secret is ours, it is single-use, and it dies in ten minutes. There is no
 * oracle to grind against.
 */
export function verificarRetorno (
  params: URLSearchParams,
  cookieState: string | undefined
): CallbackVerdict {
  /* She pressed cancel, or Meta refused. Not an error to shout about — nothing
     was created and nothing was lost. */
  if (params.get('error') !== null) return { ok: false, motivo: 'recusado' }

  const state = params.get('state')
  /* Missing cookie and mismatched cookie collapse into one verdict: both mean
     this callback did not come from a request we started. Distinguishing them
     on screen would only tell an attacker which half they got right. */
  if (cookieState === undefined || cookieState === '' || state !== cookieState) {
    return { ok: false, motivo: 'estado-invalido' }
  }

  const code = params.get('code')
  if (code === null || code === '') return { ok: false, motivo: 'sem-codigo' }

  return { ok: true, code }
}
