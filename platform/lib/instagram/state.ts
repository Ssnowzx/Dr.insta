/**
 * The anti-CSRF value that ties a callback to the request that started it.
 *
 * In its own module, and free of `server-only`, so both routes and the tests
 * can read the same constants without either importing the other's route
 * handler.
 */

export const STATE_COOKIE = 'ig_oauth_state'

/**
 * The version of the agreement she accepted, carried across the round trip.
 *
 * Separate from the state so the callback records what she actually read,
 * rather than whatever the current text happens to be when she comes back.
 */
export const TERMS_COOKIE = 'ig_terms'

/** Long enough to read an authorisation screen, short enough to be worthless later. */
export const STATE_TTL_MS = 10 * 60 * 1000

/**
 * Every way the callback route can end without a connection.
 *
 * Two lists rather than one because they fail at different moments: the first
 * three are verdicts on what came back from Instagram, the last two are this
 * side refusing to proceed at all. `MOTIVOS_RECUSA` is derived from both, so a
 * verdict added below has to be named here or it does not typecheck — which is
 * the shape the original bug had. The route redirected on three of these and
 * wrote nothing, so diagnosing 13/08/2026 needed a screenshot from her to rule
 * out what our own log should have said.
 */
export const MOTIVOS_CALLBACK = ['recusado', 'sem-codigo', 'estado-invalido'] as const
export const MOTIVOS_CONFIG = ['indisponivel', 'so-cliente'] as const
export const MOTIVOS_RECUSA = [...MOTIVOS_CALLBACK, ...MOTIVOS_CONFIG] as const

export type MotivoCallback = (typeof MOTIVOS_CALLBACK)[number]
export type MotivoRecusa = (typeof MOTIVOS_RECUSA)[number]

/**
 * The audit action for a callback we turned away.
 *
 * Deliberately NOT `instagram_auth_failed`. That one means the code exchange
 * broke inside Instagram after she left this app, and it is what `failedAttempts`
 * counts and what the screen narrates to her in exactly those words. A callback
 * we refused is a different event with a different cause, and filing the two
 * together would make the screen tell her something false about where it broke.
 */
export const ACAO_RECUSA = 'instagram_auth_rejected'

export type CallbackVerdict =
  | { ok: true; code: string }
  | { ok: false; motivo: MotivoCallback }

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
