import type { Metadata } from 'next'
import { FormTrocarSenha } from '@/components/auth-forms'
import { InstagramSection } from '@/components/instagram-section'
import { AccessLink, AddPerson } from '@/components/news'
import { signOut } from '@/lib/auth-actions'
import { clientProfile, clientUsers } from '@/lib/dashboard'
import { clientScope, requireSession } from '@/lib/dal'
import { shortDate } from '@/lib/format'
import { connectionFor, failedAttempts } from '@/lib/instagram/connection'
import { credentialsFromEnv } from '@/lib/instagram/oauth'

export const metadata: Metadata = { title: 'Conta' }
export const dynamic = 'force-dynamic'

export default async function Conta ({
  searchParams
}: {
  searchParams: Promise<{ instagram?: string }>
}) {
  const identity = await requireSession()
  const consultor = identity.role === 'consultant'

  const clientId = await clientScope()
  const profile = await clientProfile(clientId)

  /* This product sends no email, so a client who cannot get in has no
     self-service path. The consultant mints a link here and relays it. */
  const pessoas = consultor ? await clientUsers(clientId) : []

  const [conexao, falhas] = await Promise.all([
    connectionFor(clientId),
    failedAttempts(clientId)
  ])
  /* `searchParams` is a Promise in Next 16 — reading it as a plain object
     silently yields undefined. */
  const { instagram } = await searchParams

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

      {/* Rendered whenever a consultant is reading, including when nobody has
          access yet. Hiding the section on an empty list made the first invite
          — the only one that decides whether the client ever gets in —
          impossible to even find: `.env.exemplo` points here for access links,
          and the screen answered with nothing at all. An empty section that
          says where the first one comes from beats a section that is not
          there. */}
      {consultor && (
        <section className="secao">
          <div className="secao-cab">
            {/* "Acesso dela" while there was exactly one person. The profile is
                run by two now, and a heading in the singular is the first place
                a product stops matching what it holds. */}
            <h2 className="titulo-secao">Quem tem acesso</h2>
            <p className="secao-nota">nenhum e-mail sai daqui</p>
          </div>
          {pessoas.length === 0
            ? (
              <>
                <p className="rodape-nota" style={{ marginTop: 0, marginBottom: '.75rem' }}>
                  Ninguém desta conta tem acesso ainda. O primeiro é criado no
                  terminal; a partir dele, os links seguintes saem daqui.
                </p>
                <p className="comando">
                  npm run invite -- --email &lt;e-mail&gt; --name &quot;&lt;nome&gt;&quot;
                </p>
              </>
              )
            : (
              <>
                <p className="rodape-nota" style={{ marginTop: 0, marginBottom: '1rem' }}>
                  A plataforma não manda e-mail. Se alguém não conseguir entrar, gere um
                  link aqui e mande por onde vocês conversam. Gerar um novo invalida o
                  anterior.
                </p>
                <ul className="pessoas">
                  {pessoas.map(u => (
                    <li className="pessoa" key={u.id}>
                      {/* The two badges are one group, not two siblings. As
                          siblings, `.selo` carries `flex-shrink: 0` and
                          `nowrap`, so at 390px the row could not shrink: the
                          name wrapped onto two lines AND the second badge still
                          burst past the card's right edge. Grouped, they wrap
                          together onto a second line when they have to. */}
                      <div className="pessoa-cab">
                        <span className="pessoa-nome">{u.name}</span>
                        <span className="pessoa-selos">
                          {u.jobTitle !== null && (
                            <span className="selo selo-neutro">{u.jobTitle}</span>
                          )}
                          <span className={u.hasPassword ? 'selo selo-ok' : 'selo selo-atencao'}>
                            {u.hasPassword ? 'já entrou' : 'ainda não entrou'}
                          </span>
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
              </>
              )}

          <AddPerson />

          {/* The one thing that is not shared. Said on the screen where someone
              is being given access, not discovered later by whoever presses the
              button and gets refused. */}
          <p className="rodape-nota">
            Quem entra por aqui vê tudo o que ela vê e pode marcar tarefa,
            responder pedido e anexar arquivo. <strong>Só a dona da conta
            desconecta o Instagram</strong> — a autorização é dela e ninguém mais
            desfaz.
          </p>
        </section>
      )}

      <InstagramSection
        conexao={conexao}
        falhas={falhas}
        configurado={credentialsFromEnv(process.env.APP_URL ?? '') !== null}
        ehCliente={!consultor}
        usuarioId={identity.userId}
        {...(instagram === undefined ? {} : { resultado: instagram })}
      />

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
