import type { Metadata } from 'next'
import { FormNovaSenha } from '@/components/auth-forms'
import { resolveToken } from '@/lib/tokens'
import '../../auth.css'

export const metadata: Metadata = { title: 'Senha nova — My Favorite' }

export const dynamic = 'force-dynamic'

export default async function NovaSenha ({
  params
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const holder = await resolveToken(token, 'reset')

  if (holder === null) {
    return (
      <div className="auth-wrap">
        <main className="auth-card">
          <p className="auth-mark">My Favorite</p>
          <h1>Esse link já passou da hora.</h1>
          <p className="auth-lead">
            Links para trocar senha valem por uma hora, por segurança. Peça outro
            e ele chega em instantes.
          </p>
          <p className="auth-rodape">
            <a href="/recuperar">Pedir um link novo</a>
          </p>
        </main>
      </div>
    )
  }

  return (
    <div className="auth-wrap">
      <main className="auth-card">
        <p className="auth-mark">My Favorite</p>

        <h1>Escolha a senha nova.</h1>
        <p className="auth-lead">
          Assim que você salvar, entro com você automaticamente. Se alguém mais
          estava usando a sua conta, essa troca desconecta essa pessoa.
        </p>

        <FormNovaSenha token={token} />
      </main>
    </div>
  )
}
