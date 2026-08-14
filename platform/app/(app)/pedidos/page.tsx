import type { Metadata } from 'next'
import Link from 'next/link'
import { NovoPedido } from '@/components/novo-pedido'
import { RequestText } from '@/components/request-text'
import { requests, workQueue } from '@/lib/dashboard'
import type { RequestRow } from '@/lib/dashboard'
import { clientScope, requireSession } from '@/lib/dal'
import { shortDate } from '@/lib/format'
import { diasParados, DIAS_ATE_COBRAR, LABEL, turnOf } from '@/lib/pedido'

export const metadata: Metadata = { title: 'Pedidos' }
export const dynamic = 'force-dynamic'

const TIPO: Record<string, string> = {
  data: 'me mandar um dado',
  action: 'uma ação',
  question: 'só responder',
  material: 'um material'
}

/** How long a request has been sitting, in whole days. See `diasParados`. */
function diasParado (row: RequestRow): number {
  return diasParados(row.updatedAt, new Date())
}

/**
 * Intake, in two versions, because the two sides ask opposite questions.
 *
 * Hers is "what does he still need from me, and what came back". His is "what
 * landed and have I looked at it". This screen used to be one list written
 * entirely in her voice — the heading said "O que falta de você" — and served
 * unchanged to him, so the consultant had no work queue anywhere in the product
 * and she had no way to see that anything she sent had been read.
 */
export default async function Pedidos () {
  const identity = await requireSession()
  const clientId = await clientScope()

  return identity.role === 'consultant'
    ? <Dele clientId={clientId} />
    : <Dela clientId={clientId} />
}

// --------------------------------------------------------------------- dela

async function Dela ({ clientId }: { clientId: number }) {
  const lista = await requests(clientId)

  const minhaVez = lista.filter(p => turnOf(p.state, p.raisedBySide) === 'client')
  const comigo = lista.filter(p => turnOf(p.state, p.raisedBySide) === 'consultant')
  const voltou = lista.filter(
    p => p.state === 'concluded' && p.outcome !== null && p.outcome !== ''
  )
  const soDado = minhaVez.filter(p => p.kind === 'data').length

  return (
    <>
      <header className="pagina-cab">
        <p className="sobrancelha">O que falta de você</p>
        <h1 className="display">Pedidos</h1>
        <p className="lead">
          {minhaVez.length === 0
            ? 'Nada pendente. Quando eu precisar de alguma coisa, aparece aqui.'
            : soDado === minhaVez.length
              ? `São ${minhaVez.length} pedidos, e todos são só me mandar um dado — nada de gravar ou produzir.`
              : `São ${minhaVez.length} pedidos, e ${soDado} deles são só me mandar um dado.`}
        </p>
      </header>

      <ul className="pedidos">
        {minhaVez.map(p => {
          const estado = LABEL[p.state]
          return (
            <li className="pedido" key={p.id}>
              <div className="pedido-cab">
                <span className="pedido-tipo">{TIPO[p.kind]}</span>
                <span className={`selo ${estado.classe}`}>esperando você</span>
              </div>

              <h2 className="pedido-titulo">
                <Link href={`/pedidos/${p.publicCode}`}>{p.title}</Link>
              </h2>
              {p.description !== null && (
                <p className="pedido-desc"><RequestText text={p.description} /></p>
              )}

              {p.whyItMatters !== null && (
                <p className="pedido-porque">
                  <span className="pedido-porque-rot">por que importa</span>
                  {p.whyItMatters}
                </p>
              )}

              <p className="pedido-pe">
                pedido em {shortDate(p.createdAt)}
                {p.priority === 'high' && <> · <strong>é o que mais destrava</strong></>}
              </p>

              <Link className="btn-abrir" href={`/pedidos/${p.publicCode}`}>
                Abrir e responder
              </Link>
            </li>
          )
        })}
      </ul>

      {/* The group this whole change exists for. She sent sixteen files on
          13/08 and had no screen that could ever tell her what they produced. */}
      {voltou.length > 0 && (
        <section className="secao">
          <div className="secao-cab">
            <h2 className="titulo-secao">O que voltou pra você</h2>
          </div>
          {voltou.map(p => (
            <div className="grupo grupo-ok" key={p.id}>
              <p className="grupo-titulo">
                <Link href={`/pedidos/${p.publicCode}`}>{p.title}</Link>
              </p>
              <p className="grupo-item"><RequestText text={p.outcome ?? ''} /></p>
              <p className="grupo-quem">respondido em {shortDate(p.updatedAt)}</p>
            </div>
          ))}
        </section>
      )}

      {comigo.length > 0 && (
        <section className="secao">
          <div className="secao-cab">
            <h2 className="titulo-secao">Está comigo</h2>
            <p className="secao-nota">você já respondeu — a vez é minha</p>
          </div>
          <ul className="lista-simples">
            {comigo.map(p => (
              <li key={p.id}>
                <Link className="lista-item" href={`/pedidos/${p.publicCode}`}>
                  <span className="lista-titulo">{p.title}</span>
                  <span className="lista-meta">{LABEL[p.state].rot}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <NovoPedido
        titulo="Precisa de alguma coisa?"
        dica="Escreve aqui e chega pra mim com histórico, em vez de sumir no WhatsApp."
      />
    </>
  )
}

// ---------------------------------------------------------------------- dele

async function Dele ({ clientId }: { clientId: number }) {
  const [fila, lista] = await Promise.all([workQueue(clientId), requests(clientId)])

  const paradas = fila.filter(
    p => p.state === 'answered' && diasParado(p) >= DIAS_ATE_COBRAR
  )
  const restante = fila.filter(p => !paradas.includes(p))
  const comEla = lista.filter(p => turnOf(p.state, p.raisedBySide) === 'client')

  return (
    <>
      <header className="pagina-cab">
        <p className="sobrancelha">Sua fila</p>
        <h1 className="display">
          {fila.length === 0 ? 'Nada com você.' : `${fila.length} com você.`}
        </h1>
        <p className="lead">
          {fila.length === 0
            ? 'Quando ela responder alguma coisa, cai aqui.'
            : 'O mais antigo primeiro — não o mais importante, porque a fila que eu ordeno é a fila onde some o que eu evitei.'}
        </p>
      </header>

      {paradas.length > 0 && (
        <section className="secao">
          <div className="secao-cab">
            <h2 className="titulo-secao">Ela respondeu e ninguém abriu</h2>
            <p className="secao-nota">
              <span className="numero">{paradas.length}</span> parado
            </p>
          </div>
          {paradas.map(p => (
            <div className="grupo grupo-critico" key={p.id}>
              <p className="grupo-titulo">
                <Link href={`/pedidos/${p.publicCode}`}>{p.title}</Link>
              </p>
              <p className="grupo-detalhe">há {diasParado(p)} dias</p>
            </div>
          ))}
        </section>
      )}

      {restante.length > 0 && (
        <section className="secao">
          <div className="secao-cab">
            <h2 className="titulo-secao">Na sua mão</h2>
          </div>
          <ul className="lista-simples">
            {restante.map(p => (
              <li key={p.id}>
                <Link className="lista-item" href={`/pedidos/${p.publicCode}`}>
                  <span className="lista-titulo">{p.title}</span>
                  <span className="lista-meta">
                    {LABEL[p.state].rot} · {diasParado(p)}d
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {comEla.length > 0 && (
        <section className="secao">
          <div className="secao-cab">
            <h2 className="titulo-secao">Esperando ela</h2>
          </div>
          <ul className="lista-simples">
            {comEla.map(p => (
              <li key={p.id}>
                <Link className="lista-item" href={`/pedidos/${p.publicCode}`}>
                  <span className="lista-titulo">{p.title}</span>
                  <span className="lista-meta">
                    {LABEL[p.state].rot} · {diasParado(p)}d
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <NovoPedido
        titulo="Abrir um pedido"
        dica="O texto normalmente vem pronto pelo terminal — aqui é para o que não pode esperar."
      />
    </>
  )
}
