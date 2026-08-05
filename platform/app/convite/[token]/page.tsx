import type { Metadata } from 'next'
import { FormConvite } from '@/components/auth-forms'
import { resolveToken } from '@/lib/tokens'
import '../../auth.css'

export const metadata: Metadata = { title: 'Criar minha senha — My Favorite' }

/* The token is checked against the database on every render, so this page can
   never be cached or prerendered. */
export const dynamic = 'force-dynamic'

/**
 * Invite acceptance: the client picks her password here.
 *
 * She never chooses a password at a signup form — she gets a single-use link
 * and sets it here. One fewer screen, and no account that exists before we
 * created it.
 */
export default async function Convite ({
  params
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const holder = await resolveToken(token, 'invite')

  if (holder === null) {
    return (
      <div className="auth-wrap">
        <main className="auth-card">
          <p className="auth-mark">My Favorite</p>
          <h1>Esse convite não vale mais.</h1>
          <p className="auth-lead">
            Convites valem por sete dias e só podem ser usados uma vez. Me chama
            que eu mando outro na hora — não tem problema nenhum.
          </p>
          <p className="auth-rodape">
            Já criou a sua senha antes? <a href="/entrar">Entre por aqui</a>.
          </p>
        </main>
      </div>
    )
  }

  return (
    <div className="auth-wrap">
      <main className="auth-card">
        <p className="auth-mark">My Favorite</p>

        <h1>Oi, {holder.name.split(' ')[0]}.</h1>
        <p className="auth-lead">
          Escolha uma senha e a sua área fica pronta. É onde vão viver o plano,
          os números e o que eu precisar te pedir — tudo num lugar só, sem link
          novo a cada vez.
        </p>

        <FormConvite token={token} />
      </main>
    </div>
  )
}
