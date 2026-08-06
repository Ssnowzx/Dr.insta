import type { Metadata } from 'next'
import { AuthShell } from '@/components/auth-shell'
import { FormConvite } from '@/components/auth-forms'
import { resolveToken } from '@/lib/tokens'
import '../../auth.css'

export const metadata: Metadata = { title: 'Criar minha senha' }

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
      <AuthShell>
        <h1>Esse convite não vale mais.</h1>
        <p className="auth-lead">
          Convites valem por sete dias e só podem ser usados uma vez. Me chama
          que eu mando outro na hora — não tem problema nenhum.
        </p>
        <p className="auth-rodape">
          Já criou a sua senha antes? <a href="/entrar">Entre por aqui</a>.
        </p>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <h1>Oi, {holder.name.split(' ')[0]}.</h1>
      {/* The consultant and the client get different sentences. Telling a
          consultant that this is where "what I need to ask you" will live is
          addressing the wrong person. */}
      <p className="auth-lead">
        {holder.role === 'consultant'
          ? 'Escolha uma senha e o acesso de consultor fica pronto: o painel, o plano e o retorno dela num lugar só.'
          : 'Escolha uma senha e a sua área fica pronta. É onde vão viver o plano, os números e o que eu precisar te pedir — tudo num lugar só, sem link novo a cada vez.'}
      </p>

      <FormConvite token={token} />
    </AuthShell>
  )
}
