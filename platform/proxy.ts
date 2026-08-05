import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { SESSION_COOKIE } from '@/lib/constants'

/**
 * Optimistic check. In Next 16 this file is called `proxy.ts` \u2014 the old
 * `middleware.ts` was renamed and the old name is ignored without warning.
 *
 * It runs on EVERY route, including the prefetches Next fires when a finger
 * hovers a link. That is why there is no database query here: it would be one
 * query per prefetched link. The only question answered here is "is there a
 * cookie?".
 *
 * The real decision belongs to `lib/dal.ts`, which checks the session against
 * the database on every page, action and route. If this file were deleted
 * nothing would leak \u2014 a visitor would just see the screen flash before being
 * redirected.
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
    /* Remember where she was heading, to send her back there after signing in.
       Internal path only \u2014 a `destino` coming from outside would be an open
       redirect, which is how credentials get stolen with a legitimate-looking
       link. */
    if (pathname !== '/') target.searchParams.set('destino', pathname + search)
    return NextResponse.redirect(target)
  }

  if (hasCookie && (pathname === '/entrar' || pathname === '/recuperar')) {
    const target = req.nextUrl.clone()
    target.pathname = '/'
    target.search = ''
    return NextResponse.redirect(target)
  }

  return NextResponse.next()
}

export const config = {
  /* Outside the proxy: Next assets, favicon and the health probe \u2014 which has
     to answer Docker before any session exists. */
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/health|fontes).*)']
}
