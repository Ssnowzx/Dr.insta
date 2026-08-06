import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AuthShell } from '@/components/auth-shell'
import { FormRecuperar } from '@/components/auth-forms'
import { currentSession } from '@/lib/dal'
import '../auth.css'

export const metadata: Metadata = { title: 'Criar uma senha nova' }

export default async function Recuperar () {
  /* Same reasoning as `/entrar`: the database decides, not the cookie. */
  if (await currentSession() !== null) redirect('/')

  return (
    <AuthShell>
      <h1>Sem problema.</h1>
      {/* The truth, not a promise of an email that never comes. This product
          sends none — the consultant mints a link and passes it on. */}
      <p className="auth-lead">
        Escreva o e-mail que você usa aqui. Eu aviso o Rodrigo e ele te manda
        um link novo por onde vocês conversam — normalmente no mesmo dia.
      </p>

      <FormRecuperar />

      <p className="auth-rodape">
        Lembrou a senha? <a href="/entrar">Voltar para entrar</a>.
      </p>
    </AuthShell>
  )
}
