import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { SESSION_COOKIE } from '@/lib/constants'

/**
 * Optimistic check. In Next 16 this file is called `proxy.ts` — the old
 * `middleware.ts` was renamed and the old name is ignored without warning.
 *
 * It runs on EVERY route, including the prefetches Next fires when a finger
 * hovers a link. That is why there is no database query here: it would be one
 * query per prefetched link. The only question answered here is "is there a
 * cookie?".
 *
 * The real decision belongs to `lib/dal.ts`, which checks the session against
 * the database on every page, action and route. If this file were deleted
 * nothing would leak — a visitor would just see the screen flash before being
 * redirected.
 *
 * WHAT THIS FILE MUST NEVER DO
 *
 * Send anyone AWAY from a public route on the strength of the cookie alone.
 * A cookie proves nothing: the session row may be gone, expired, or belong to a
 * deactivated user. This file used to bounce `/entrar` → `/` whenever a cookie
 * existed, while `requireSession()` bounced `/` → `/entrar` whenever that cookie
 * failed to resolve. The two rules fed each other and the browser died on
 * ERR_TOO_MANY_REDIRECTS, with no way back that did not involve clearing cookies
 * by hand — and deactivating a user was enough to trigger it.
 *
 * The "you are already signed in" redirect now lives in the sign-in and recovery
 * pages, which ask the database. An optimistic guess may only ever ADD a
 * restriction here, never lift one.
 *
 * Route paths stay in pt-BR: they are URLs the client sees and shares.
 */

/** Routes reachable without a session. Anything else requires signing in. */
const PUBLIC_PATHS = ['/entrar', '/convite', '/recuperar', '/nova-senha']

function isPublic (pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`))
}

export function proxy (req: NextRequest): NextResponse {
  const { pathname, search } = req.nextUrl
  const hasCookie = req.cookies.get(SESSION_COOKIE)?.value !== undefined

  if (!hasCookie && !isPublic(pathname)) {
    const target = req.nextUrl.clone()
    target.pathname = '/entrar'
    /* `clone()` carries the original query string, and `/entrar` reads only
       `destino` — leaving the rest would repeat every parameter twice, once
       loose and once inside the encoded destination. */
    target.search = ''
    /* Remember where she was heading, to send her back there after signing in.
       Internal path only — a `destino` coming from outside would be an open
       redirect, which is how credentials get stolen with a legitimate-looking
       link. */
    if (pathname !== '/') target.searchParams.set('destino', pathname + search)
    return NextResponse.redirect(target)
  }

  return NextResponse.next()
}

export const config = {
  /* Outside the proxy: Next assets, favicon and the health probe — which has
     to answer Docker before any session exists. */
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/health|fontes).*)']
}
