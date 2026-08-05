import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { readSession } from './session.ts'
import type { Identity } from './session.ts'

/**
 * Data Access Layer \u2014 the real authorisation boundary.
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
 * For a client user it is theirs, full stop. For the consultant it is whichever
 * one was asked for \u2014 which is why `wanted` exists: without it the consultant
 * could not open any client at all.
 *
 * Returns `null` when the consultant picked no client (overview). Returning an
 * arbitrary client's id in that case would be worse than returning nothing.
 */
export async function clientScope (wanted?: number): Promise<number | null> {
  const identity = await requireSession()

  if (identity.clientId !== null) {
    /* A client user asking for another client: the request is ignored, not
       denied. Denying with 403 would confirm that the other client exists. */
    return identity.clientId
  }

  return wanted ?? null
}

/**
 * Mandatory scope: fails when no client could be resolved.
 *
 * A domain query never runs without `client_id`. A function that defaulted to
 * "all clients" would turn one forgotten argument into a cross-client leak.
 */
export async function requireClientScope (wanted?: number): Promise<number> {
  const clientId = await clientScope(wanted)
  if (clientId === null) {
    throw new Error('Domain query with no resolved client.')
  }
  return clientId
}

/**
 * Whether an identity may reach a resource belonging to a given client.
 *
 * Callers must treat `false` as NOT FOUND, never as forbidden: an
 * access-denied response confirms the resource exists, and that is how a
 * consultancy's client list gets mapped by guessing.
 */
export function canReach (identity: Identity, clientId: number): boolean {
  return identity.clientId === null || identity.clientId === clientId
}
