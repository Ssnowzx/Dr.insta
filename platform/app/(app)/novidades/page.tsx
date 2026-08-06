import type { Metadata } from 'next'
import Link from 'next/link'
import { MarkSeen } from '@/components/news'
import { activeClientIds, digestFor, newsSince } from '@/lib/digest'
import type { Digest, DigestItem } from '@/lib/digest'
import { requireConsultant } from '@/lib/dal'
import { shortDate } from '@/lib/format'

export const metadata: Metadata = { title: 'Novidades — My Favorite' }
export const dynamic = 'force-dynamic'

/**
 * What the clients did since he last looked.
 *
 * This replaced a daily email. Everything happens inside the platform now, so
 * the summary is a screen — which also removes a mail server as a dependency
 * that fails quietly at the worst moment.
 *
 * Blocked and "could not get in" come first, because they are the two that
 * change what he does today. Everything else is context.
 */
export default async function Novidades () {
  const identity = await requireConsultant()
  const since = await newsSince(identity.userId)
  const until = new Date()

  const ids = await activeClientIds()
  const digests = (await Promise.all(ids.map(id => digestFor(id, since, until))))
    .filter((d): d is Digest => d !== null && d.total > 0)

  const total = digests.reduce((n, d) => n + d.total, 0)

  return (
    <>
      <header className="pagina-cab">
        <p className="sobrancelha">desde {shortDate(since)}</p>
        <h1 className="display">
          {total === 0 ? 'Nada novo.' : total === 1 ? 'Uma novidade.' : `${total} novidades.`}
        </h1>
        <p className="lead">
          {total === 0
            ? 'Quando alguma cliente marcar, mandar arquivo ou escrever, aparece aqui.'
            : 'O que precisa de você vem primeiro. O resto é contexto.'}
        </p>
      </header>

      {digests.map(d => (
        <section className="secao" key={d.clientId}>
          <div className="secao-cab">
            <h2 className="titulo-secao">{d.clientName}</h2>
            <p className="secao-nota">
              <span className="numero">{d.total}</span>{' '}
              {d.total === 1 ? 'novidade' : 'novidades'}
            </p>
          </div>

          <Grupo
            titulo="Não conseguiu entrar"
            itens={d.askedForAccess}
            tom="critico"
            acao={{ href: '/conta', rotulo: 'gerar link de acesso' }}
          />
          <Grupo titulo="Travou" itens={d.blocked} tom="critico" />
          <Grupo titulo="Mandou arquivo" itens={d.files} tom="dado" />
          <Grupo titulo="Escreveu" itens={d.comments} tom="neutro" />
          <Grupo titulo="Marcou como feito" itens={d.done} tom="ok" />
          <Grupo titulo="Fechou pedido" itens={d.delivered} tom="ok" />
        </section>
      ))}

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
