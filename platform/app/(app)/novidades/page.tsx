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
  const dela = consultor ? null : await clientDigestFor(clientId, since, until, identity.userId)
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
          {/* Right after what needs her, and before what I published. Two
              people work this profile: knowing that the other one already
              answered a request is what stops it being answered twice, and it
              is more urgent than a new delivery to read. */}
          <Grupo
            titulo="Sua equipe"
            itens={dela.team}
            tom="neutro"
          />
          <Grupo
            titulo="Roteiro novo"
            itens={dela.ideas}
            tom="dado"
            acao={{ href: '/ideias', rotulo: 'abrir as ideias' }}
          />
          <Grupo titulo="Novo por aqui" itens={dela.published} tom="dado" />
          {/* With a way through: the detail here is only the opening of the
              outcome, and the whole text lives on the request itself. */}
          <Grupo
            titulo="Te respondi"
            itens={dela.answered}
            tom="neutro"
            acao={{ href: '/pedidos', rotulo: 'ler as respostas inteiras' }}
          />
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
          {/* Second, and above everything she did: this is not news about her,
              it is a debt of his. The product cheerfully counted her homework
              and never once counted his — and his silence was invisible here
              while being perfectly visible to her, as no answer. */}
          <Grupo
            titulo="Ela respondeu e ninguém abriu"
            itens={digest.stale}
            tom="critico"
            acao={{ href: '/pedidos', rotulo: 'ver a fila' }}
          />
          <Grupo
            titulo="Não conseguiu entrar"
            itens={digest.askedForAccess}
            tom="critico"
            acao={{ href: '/conta', rotulo: 'gerar link de acesso' }}
          />
          <Grupo
            titulo="Ela pediu uma coisa"
            itens={digest.raisedByHer}
            tom="critico"
            acao={{ href: '/pedidos', rotulo: 'abrir o pedido' }}
          />
          <Grupo titulo="Travou" itens={digest.blocked} tom="critico" />
          {/* Above the files and the comments: this is the only group that tells
              him whether a script worked, and it is what the next batch is
              written from. Buried under uploads it becomes a thing he reads
              after having already written them. */}
          <Grupo
            titulo="Falou sobre uma pauta"
            itens={digest.ideaTalk}
            tom="dado"
            acao={{ href: '/ideias', rotulo: 'ler nas ideias' }}
          />
          <Grupo titulo="Mandou arquivo" itens={digest.files} tom="dado" />
          <Grupo titulo="Escreveu" itens={digest.comments} tom="neutro" />
          <Grupo titulo="Marcou como feito" itens={digest.done} tom="ok" />
          <Grupo
            titulo="Mexeu numa pauta"
            itens={digest.ideaMoved}
            tom="ok"
            acao={{ href: '/ideias', rotulo: 'ver a fila' }}
          />
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

  const primeiro = itens[0] as DigestItem

  /* When every line would repeat the same detail and the same byline, they are
     not information — they are the same sentence printed N times. Five new
     requests used to render fifteen lines: five titles, five identical "Novo
     pedido para você", five identical "Rodrigo · 12 ago". Said once at the top,
     the group becomes five lines and the titles are what the eye lands on. */
  const detalheIgual = itens.length > 1 &&
    itens.every(i => i.detail === primeiro.detail) &&
    primeiro.detail !== null && primeiro.detail !== ''

  const assinaturaIgual = itens.length > 1 && itens.every(
    i => i.who === primeiro.who && shortDate(i.at) === shortDate(primeiro.at)
  )

  return (
    <div className={`grupo grupo-${tom}`}>
      <p className="grupo-titulo">
        {titulo} <span className="numero grupo-n">{itens.length}</span>
      </p>

      {detalheIgual && <p className="grupo-detalhe">{primeiro.detail}</p>}
      {assinaturaIgual && (
        <p className="grupo-quem">{primeiro.who} · {shortDate(primeiro.at)}</p>
      )}

      <ul className="grupo-lista">
        {itens.map((i, n) => (
          <li key={`${i.title}-${n}`}>
            <p className="grupo-item">
              {i.title}
              {i.count !== undefined && (
                <> <span className="numero grupo-n">{i.count}</span></>
              )}
            </p>
            {!detalheIgual && i.detail !== null && i.detail !== '' && (
              <p className="grupo-detalhe">{i.detail}</p>
            )}
            {!assinaturaIgual && (
              <p className="grupo-quem">{i.who} · {shortDate(i.at)}</p>
            )}
          </li>
        ))}
      </ul>
      {acao !== undefined && (
        <Link className="grupo-acao" href={acao.href}>{acao.rotulo} →</Link>
      )}
    </div>
  )
}
