import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requireSession } from '@/lib/dal'
import { authorizeUrl, credentialsFromEnv, newState } from '@/lib/instagram/oauth'
import { STATE_COOKIE, STATE_TTL_MS } from '@/lib/instagram/state'

/**
 * Starts the authorisation.
 *
 * A GET and not a Server Action because the browser has to LEAVE for
 * instagram.com; an action can only answer, not navigate away.
 *
 * The state lives in a cookie rather than a table. It is worth ten minutes and
 * belongs to one browser, so a table would mean a migration and a cleanup job
 * for a value shorter-lived than the request that made it. `SameSite=Lax` is
 * what lets it survive the return trip: the redirect back from Instagram is a
 * top-level GET navigation, which Lax permits and Strict would drop — silently,
 * and only in production, where the flow finally runs.
 */
export const dynamic = 'force-dynamic'

export async function GET (): Promise<NextResponse> {
  const identity = await requireSession()

  const appUrl = process.env.APP_URL ?? ''
  const creds = credentialsFromEnv(appUrl)

  /* No app configured is not an error worth a stack trace: the button that
     leads here is not even rendered. Someone reaching the URL by hand gets sent
     back to the screen that explains the state. */
  if (creds === null) {
    return NextResponse.redirect(new URL('/conta?instagram=indisponivel', appUrl))
  }

  /* Only the client authorises. The token belongs to whoever sat in front of
     the Instagram login screen, and a consultant connecting "for her" would
     store a credential under a consent she never gave. */
  if (identity.role !== 'client') {
    return NextResponse.redirect(new URL('/conta?instagram=so-cliente', appUrl))
  }

  const state = newState()
  const jar = await cookies()

  jar.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: appUrl.startsWith('https://'),
    path: '/conta/instagram',
    maxAge: Math.floor(STATE_TTL_MS / 1000)
  })

  return NextResponse.redirect(authorizeUrl(creds, state))
}
