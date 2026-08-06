import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { readSession } from './session.ts'
import { tenantId } from './tenant.ts'
import type { Identity } from './session.ts'


/**
 * Data Access Layer — the real authorisation boundary.
 *
 * `proxy.ts` runs on every route, including prefetches, so it only checks that
 * a cookie exists. The actual decision happens here, and this is called by every
 * page, Server Action and Route Handler before any domain query.
 *
 * React's `cache()` memoises within a single render pass: a page that calls
 * `requireSession()` in the layout and again in three components makes one
 * query, not four. The cache does not cross requests.
 */

/** Returns the identity, or `null`. Use where an absent session is expected. */
export const currentSession = cache(async (): Promise<Identity | null> => {
  return await readSession()
})

/** Requires a session. Redirects to sign-in when there is none. */
export async function requireSession (): Promise<Identity> {
  const identity = await currentSession()
  if (identity === null) redirect('/entrar')
  return identity
}

/** Requires the consultant role. An authenticated client lands on the root, not an error page. */
export async function requireConsultant (): Promise<Identity> {
  const identity = await requireSession()
  if (identity.role !== 'consultant') redirect('/')
  return identity
}

/**
 * The `client_id` this request is allowed to see.
 *
 * For a client user it is theirs, full stop. For the consultant — who has no
 * `client_id` — it is the one client this instance was deployed to serve.
 *
 * Never `null`: a domain query never runs without a `client_id`, and a function
 * that could return "no client" would turn one unhandled branch into a blank
 * screen or, worse, an unscoped query.
 *
 * It used to take the client as an argument, read from the query string, so the
 * consultant could pick one. That is gone with the picker: the tenant is a
 * property of the deployment now, not of the URL.
 */
export async function clientScope (): Promise<number> {
  const identity = await requireSession()

  /* A client user's own id always wins, and it is the only thing consulted for
     them — nothing a request can carry may widen a client's own scope. */
  if (identity.clientId !== null) return identity.clientId

  return await tenantId()
}

/* Re-exported so callers have one import for the whole access story. The rule
   itself lives in `scope.ts`, free of Next imports, so it can be tested alone. */
export { canReach } from './scope.ts'
