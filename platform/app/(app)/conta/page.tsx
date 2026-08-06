import type { Metadata } from 'next'
import { FormTrocarSenha } from '@/components/auth-forms'
import { AccessLink } from '@/components/news'
import { signOut } from '@/lib/auth-actions'
import { clientProfile, clientUsers } from '@/lib/dashboard'
import { clientScope, requireSession } from '@/lib/dal'
import { shortDate } from '@/lib/format'

export const metadata: Metadata = { title: 'Conta — My Favorite' }
export const dynamic = 'force-dynamic'

export default async function Conta () {
  const identity = await requireSession()
  const consultor = identity.role === 'consultant'

  const clientId = await clientScope()
  const profile = await clientProfile(clientId)

  /* This product sends no email, so a client who cannot get in has no
     self-service path. The consultant mints a link here and relays it. */
  const pessoas = consultor ? await clientUsers(clientId) : []

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
          <dt>Conta</dt>
          <dd>
            {/* Both roles are on the same client here, so the difference worth
                showing is what each may do — not which client they are on. */}
            {consultor
              ? <>{profile?.name ?? '—'} <span className="selo selo-neutro">consultor</span></>
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

      {consultor && pessoas.length > 0 && (
        <section className="secao">
          <div className="secao-cab">
            <h2 className="titulo-secao">Acesso dela</h2>
            <p className="secao-nota">nenhum e-mail sai daqui</p>
          </div>
          <p className="rodape-nota" style={{ marginTop: 0, marginBottom: '1rem' }}>
            A plataforma não manda e-mail. Se alguém não conseguir entrar, gere um
            link aqui e mande por onde vocês conversam. Gerar um novo invalida o
            anterior.
          </p>
          <ul className="pessoas">
            {pessoas.map(u => (
              <li className="pessoa" key={u.id}>
                <div className="pessoa-cab">
                  <span className="pessoa-nome">{u.name}</span>
                  <span className={u.hasPassword ? 'selo selo-ok' : 'selo selo-atencao'}>
                    {u.hasPassword ? 'já entrou' : 'ainda não entrou'}
                  </span>
                </div>
                <p className="pessoa-meta">
                  {u.email}
                  {u.lastSeenAt !== null && <> · último acesso em {shortDate(u.lastSeenAt)}</>}
                </p>
                <AccessLink userId={u.id} userName={u.name} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="secao">
        <div className="secao-cab">
          <h2 className="titulo-secao">Sua senha</h2>
          <p className="secao-nota">só você troca</p>
        </div>
        <FormTrocarSenha />
        <p className="rodape-nota">
          A senha some de vista assim que você a cria — nem eu consigo ver.
          Trocar aqui encerra as sessões abertas em outros aparelhos.
        </p>
      </section>

      <form action={signOut}>
        <button className="btn-sair" type="submit">Sair desta conta</button>
      </form>

      {/* The old copy here said a new password could be created from the
          sign-in screen. It cannot: `/recuperar` deliberately issues no token,
          because an unauthenticated request that could would let anyone burn
          the pending link of somebody mid-recovery. Telling her otherwise on
          the very screen she would read while locked out was the worst place
          in the product to be wrong. */}
      {!consultor && (
        <p className="rodape-nota">
          Esqueceu a senha e não consegue entrar? A plataforma não manda e-mail,
          então me chama e eu te mando um link novo — normalmente no mesmo dia.
        </p>
      )}
    </>
  )
}
