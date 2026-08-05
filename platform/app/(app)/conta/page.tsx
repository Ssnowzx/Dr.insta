import type { Metadata } from 'next'
import { signOut } from '@/lib/auth-actions'
import { clientProfile } from '@/lib/dashboard'
import { requireSession } from '@/lib/dal'

export const metadata: Metadata = { title: 'Conta — My Favorite' }
export const dynamic = 'force-dynamic'

export default async function Conta () {
  const identity = await requireSession()
  const profile = identity.clientId === null ? null : await clientProfile(identity.clientId)

  return (
    <>
      <header className="pagina-cab">
        <p className="sobrancelha">Sua conta</p>
        <h1 className="display">{identity.name}</h1>
      </header>

      <dl className="ficha">
        <div>
          <dt>E-mail</dt>
          <dd>{identity.email}</dd>
        </div>
        <div>
          <dt>{identity.role === 'consultant' ? 'Acesso' : 'Conta'}</dt>
          <dd>
            {identity.role === 'consultant'
              ? 'Consultor — todos os clientes'
              : profile?.name ?? '—'}
          </dd>
        </div>
        {profile?.instagramHandle != null && (
          <div>
            <dt>Instagram</dt>
            <dd>@{profile.instagramHandle}</dd>
          </div>
        )}
      </dl>

      <form action={signOut}>
        <button className="btn-sair" type="submit">Sair desta conta</button>
      </form>

      <p className="rodape-nota">
        Sua senha some de vista assim que você a cria — nem eu consigo ver.
        Se esquecer, dá para criar outra pela tela de entrar.
      </p>
    </>
  )
}
