import type { Metadata } from 'next'
import { FormRecuperar } from '@/components/auth-forms'
import '../auth.css'

export const metadata: Metadata = { title: 'Criar uma senha nova — My Favorite' }

export default function Recuperar () {
  return (
    <div className="auth-wrap">
      <main className="auth-card">
        <p className="auth-mark">My Favorite</p>

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
      </main>
    </div>
  )
}
