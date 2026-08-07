import type { Metadata } from 'next'
import Link from 'next/link'
import { MarkSeen } from '@/components/news'
import { clientDigestFor, digestFor, newsSince } from '@/lib/digest'
import type { DigestItem } from '@/lib/digest'
import { clientScope, requireSession } from '@/lib/dal'
import { shortDate } from '@/lib/format'

export const metadata: Metadata = { title: 'Novidades' }
export const dynamic = 'force-dynamic'

/**
 * What happened since this person last looked.
 *
 * One route, two screens, because the two sides have opposite questions. His is
 * "what did she do" — blocked steps and someone who could not sign in come
 * first, since those are what change his day. Hers is "what changed here that I
 * did not do", and what needs HER comes first for the same reason.
 *
 * This replaced a daily email. Everything happens inside the platform, which
 * also removes a mail server as a dependency that fails quietly at the worst
 * moment.
 */
export default async function Novidades () {
  const identity = await requireSession()
  const consultor = identity.role === 'consultant'
  const since = await newsSince(identity.userId)
  const until = new Date()
  const clientId = await clientScope()

  const digest = consultor ? await digestFor(clientId, since, until) : null
  const dela = consultor ? null : await clientDigestFor(clientId, since, until)
  const total = digest?.total ?? dela?.total ?? 0

  return (
    <>
      <header className="pagina-cab">
        <p className="sobrancelha">desde {shortDate(since)}</p>
        <h1 className="display">
          {total === 0 ? 'Nada novo.' : total === 1 ? 'Uma novidade.' : `${total} novidades.`}
        </h1>
        <p className="lead">
          {total === 0
            ? consultor
              ? 'Quando ela marcar, mandar arquivo ou escrever, aparece aqui.'
              : 'Quando eu publicar algo ou precisar de você, aparece aqui.'
            : 'O que precisa de você vem primeiro. O resto é contexto.'}
        </p>
      </header>

      {dela !== null && total > 0 && (
        <section className="secao">
          <div className="secao-cab">
            <h2 className="titulo-secao">Desde a sua última visita</h2>
            <p className="secao-nota">
              <span className="numero">{total}</span>{' '}
              {total === 1 ? 'novidade' : 'novidades'}
            </p>
          </div>

          {/* Each group points at the screen where its items are actually
              resolved. One combined group with a single link would send her to
              Conta for a request she answers in Pedidos. */}
          <Grupo
            titulo="Sua conexão"
            itens={dela.connection}
            tom="critico"
            acao={{ href: '/conta', rotulo: 'reconectar em Conta' }}
          />
          <Grupo
            titulo="Precisa de você"
            itens={dela.requests}
            tom="critico"
            acao={{ href: '/pedidos', rotulo: 'ver os pedidos' }}
          />
          <Grupo titulo="Novo por aqui" itens={dela.published} tom="dado" />
          <Grupo titulo="Te respondi" itens={dela.answered} tom="neutro" />
        </section>
      )}

      {digest !== null && total > 0 && (
        <section className="secao">
          <div className="secao-cab">
            <h2 className="titulo-secao">{digest.clientName}</h2>
            <p className="secao-nota">
              <span className="numero">{total}</span>{' '}
              {total === 1 ? 'novidade' : 'novidades'}
            </p>
          </div>

          {/* First, above even "could not sign in": while this is broken the
              numbers on every other screen are quietly standing still, and
              nothing else on this page would tell you that. */}
          <Grupo
            titulo="Instagram desconectado"
            itens={digest.connection}
            tom="critico"
            acao={{ href: '/conta', rotulo: 'ver a conexão' }}
          />
          <Grupo
            titulo="Não conseguiu entrar"
            itens={digest.askedForAccess}
            tom="critico"
            acao={{ href: '/conta', rotulo: 'gerar link de acesso' }}
          />
          <Grupo titulo="Travou" itens={digest.blocked} tom="critico" />
          <Grupo titulo="Mandou arquivo" itens={digest.files} tom="dado" />
          <Grupo titulo="Escreveu" itens={digest.comments} tom="neutro" />
          <Grupo titulo="Marcou como feito" itens={digest.done} tom="ok" />
          <Grupo titulo="Fechou pedido" itens={digest.delivered} tom="ok" />
        </section>
      )}

      {total > 0 && (
        <div className="novidades-pe">
          <MarkSeen />
          <p className="rodape-nota">
            Marcar como lido move o corte: a próxima visita mostra só o que
            aconteceu daqui em diante.
          </p>
        </div>
      )}

      {total === 0 && (
        <p className="rodape-nota">
          Nada aqui não quer dizer nada acontecendo — quer dizer nada desde{' '}
          {shortDate(since)}. Se quiser olhar mais para trás, o histórico completo
          de cada pedido está em <Link href="/pedidos">Pedidos</Link>.
        </p>
      )}
    </>
  )
}

function Grupo ({
  titulo,
  itens,
  tom,
  acao
}: {
  titulo: string
  itens: DigestItem[]
  tom: 'critico' | 'ok' | 'dado' | 'neutro'
  acao?: { href: string; rotulo: string }
}) {
  if (itens.length === 0) return null

  return (
    <div className={`grupo grupo-${tom}`}>
      <p className="grupo-titulo">
        {titulo} <span className="numero grupo-n">{itens.length}</span>
      </p>
      <ul className="grupo-lista">
        {itens.map((i, n) => (
          <li key={`${i.title}-${n}`}>
            <p className="grupo-item">{i.title}</p>
            {i.detail !== null && i.detail !== '' && (
              <p className="grupo-detalhe">{i.detail}</p>
            )}
            <p className="grupo-quem">{i.who} · {shortDate(i.at)}</p>
          </li>
        ))}
      </ul>
      {acao !== undefined && (
        <Link className="grupo-acao" href={acao.href}>{acao.rotulo} →</Link>
      )}
    </div>
  )
}
