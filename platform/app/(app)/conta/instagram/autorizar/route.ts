import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { orm } from '@/db/client'
import { auditLog } from '@/db/schema'
import { clientScope, requireSession } from '@/lib/dal'
import { authorizeUrl, credentialsFromEnv, newState } from '@/lib/instagram/oauth'
import { STATE_COOKIE, STATE_TTL_MS, TERMS_COOKIE } from '@/lib/instagram/state'
import { TERMS_VERSION } from '@/lib/instagram/termos'

/**
 * Records the agreement, then hands her over to Instagram.
 *
 * A POST because accepting has an effect that is written down, and an effect
 * behind a GET is one a link preload or a back button can repeat.
 *
 * The state cookie is what ties the callback to this request. `SameSite=Lax` is
 * what lets it survive the return trip: Instagram sends her back with a
 * top-level GET navigation, which Lax allows and Strict drops — silently, and
 * only over a real domain, which is where the flow finally runs.
 */
export const dynamic = 'force-dynamic'

export async function POST (req: NextRequest): Promise<NextResponse> {
  const identity = await requireSession()
  const appUrl = process.env.APP_URL ?? ''

  const back = (resultado: string): NextResponse =>
    /* 303, not 307: the browser must GET the next page rather than repeating
       this POST at it. */
    NextResponse.redirect(new URL(`/conta?instagram=${resultado}`, appUrl), 303)

  const creds = credentialsFromEnv(appUrl)
  if (creds === null) return back('indisponivel')

  /* Only the client authorises. The token belongs to whoever sat in front of
     Instagram's login screen; a consultant connecting "for her" would store a
     credential under consent she never gave. */
  if (identity.role !== 'client') return back('so-cliente')

  const form = await req.formData()
  const aceito = form.get('aceito')

  /* The checkbox carries the version it was rendered with, and it has to match
     what is current. A stale tab left open across a change to the terms would
     otherwise submit agreement to text she never saw. */
  if (aceito !== TERMS_VERSION) return back('termo-mudou')

  const clientId = await clientScope()

  await orm().insert(auditLog).values({
    action: 'accepted_instagram_terms',
    userId: identity.userId,
    clientId,
    details: { version: TERMS_VERSION },
    createdAt: new Date()
  })

  const state = newState()
  const jar = await cookies()
  const seguro = appUrl.startsWith('https://')

  jar.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: seguro,
    path: '/conta/instagram',
    maxAge: Math.floor(STATE_TTL_MS / 1000)
  })

  /* Carried across so the connection records the version she actually accepted,
     rather than whatever is current when the callback lands. */
  jar.set(TERMS_COOKIE, TERMS_VERSION, {
    httpOnly: true,
    sameSite: 'lax',
    secure: seguro,
    path: '/conta/instagram',
    maxAge: Math.floor(STATE_TTL_MS / 1000)
  })

  return NextResponse.redirect(authorizeUrl(creds, state), 303)
}
