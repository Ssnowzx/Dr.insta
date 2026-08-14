import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { orm } from '@/db/client'
import { auditLog } from '@/db/schema'
import { clientScope, requireSession } from '@/lib/dal'
import { saveConnection } from '@/lib/instagram/connection'
import {
  credentialsFromEnv, exchangeCode, exchangeForLongLived, OAuthError
} from '@/lib/instagram/oauth'
import {
  ACAO_RECUSA, STATE_COOKIE, TERMS_COOKIE, verificarRetorno
} from '@/lib/instagram/state'
import type { MotivoRecusa } from '@/lib/instagram/state'

/**
 * Where Instagram sends her back.
 *
 * Three things happen here and the order matters: the callback is verified,
 * the code is spent, and the browser is sent to a clean URL. That last step is
 * not cosmetic — the authorisation code arrives in the query string, and a
 * redirect that kept it would leave a credential in her history, in the
 * Referer of anything the next page loads, and in any access log in front of
 * this app.
 */
export const dynamic = 'force-dynamic'

export async function GET (req: NextRequest): Promise<NextResponse> {
  const identity = await requireSession()
  const appUrl = process.env.APP_URL ?? ''

  /* Read then delete, before anything can fail. Single use is what stops a
     callback from being replayed out of someone's history. */
  const jar = await cookies()
  const cookieState = jar.get(STATE_COOKIE)?.value
  const termsVersion = jar.get(TERMS_COOKIE)?.value
  jar.delete({ name: STATE_COOKIE, path: '/conta/instagram' })
  jar.delete({ name: TERMS_COOKIE, path: '/conta/instagram' })

  const back = (resultado: string): NextResponse =>
    NextResponse.redirect(new URL(`/conta?instagram=${resultado}`, appUrl))

  const clientId = await clientScope()

  /**
   * Every exit through this route writes a row now.
   *
   * It used to write only when the code exchange threw, so the three verdicts
   * that reject a callback before that — and the two configuration refusals —
   * redirected in silence. On 13/08/2026 she tried three times and what ruled
   * the hypotheses out was a screenshot she sent, not our own log, because
   * these five motives left no trace at all.
   *
   * It does not close the whole hole, and it should not be read as if it did:
   * the three attempts that day broke INSIDE Instagram and never came back
   * here, so nothing in this file would have seen them. What this covers is
   * the case where she does come back and something is wrong on arrival.
   */
  const recusar = async (motivo: MotivoRecusa): Promise<NextResponse> => {
    await record(ACAO_RECUSA, identity.userId, clientId, motivo)
    return back(motivo)
  }

  const veredito = verificarRetorno(req.nextUrl.searchParams, cookieState)
  if (!veredito.ok) return await recusar(veredito.motivo)

  const creds = credentialsFromEnv(appUrl)
  if (creds === null) return await recusar('indisponivel')
  if (identity.role !== 'client') return await recusar('so-cliente')

  try {
    const curto = await exchangeCode(creds, veredito.code)
    const longo = await exchangeForLongLived(creds, curto.token)

    await saveConnection({
      clientId,
      igUserId: curto.igUserId,
      /* The account handle is not worth a second request and a failure mode of
         its own: the collection reads it on its first run. */
      username: null,
      token: longo.token,
      tokenExpiresAt: longo.expiresAt,
      connectedBy: identity.userId,
      /* The version she read, not the current one — see `TERMS_COOKIE`. */
      ...(termsVersion === undefined ? {} : { termsVersion })
    })

    await record('connected_instagram', identity.userId, clientId, null)
    return back('conectado')
  } catch (error) {
    /* The audit table and not stderr: this product keeps no log anyone reads,
       and a failure written where nobody looks is a failure nobody knows about.
       Only the provider's own description is kept — never the payload, because
       the token endpoints answer with the credential in the body. */
    const detail = error instanceof OAuthError ? error.detail ?? error.message : 'erro inesperado'
    await record('instagram_auth_failed', identity.userId, clientId, detail)

    return back('falhou')
  }
}

async function record (
  action: string,
  userId: number,
  clientId: number,
  detail: string | null
): Promise<void> {
  await orm().insert(auditLog).values({
    action,
    userId,
    clientId,
    createdAt: new Date(),
    ...(detail === null ? {} : { details: { detail: detail.slice(0, 500) } })
  })
}
