import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FileSize, RequestActions } from '@/components/request-detail'
import { requestDetail } from '@/lib/dashboard'
import { requireSession } from '@/lib/dal'
import { canReach } from '@/lib/scope'
import { longDate, shortDate } from '@/lib/format'

export const metadata: Metadata = { title: 'Pedido' }
export const dynamic = 'force-dynamic'

const TIPO: Record<string, string> = {
  data: 'me mandar um dado',
  action: 'uma ação',
  question: 'só responder',
  material: 'um material'
}

const ESTADO: Record<string, { rot: string; classe: string }> = {
  open: { rot: 'em aberto', classe: 'selo-atencao' },
  in_progress: { rot: 'em andamento', classe: 'selo-neutro' },
  delivered: { rot: 'entregue', classe: 'selo-ok' },
  dropped: { rot: 'dispensado', classe: 'selo-neutro' }
}

/** The state change, written the way a person would say it out loud. */
function narrar (de: string | null, para: string | null): string {
  if (para === 'in_progress') return 'começou a mexer nisso'
  if (para === 'delivered') return 'marcou como entregue'
  if (para === 'dropped') return 'dispensou este pedido'
  if (para === 'open') return de === null ? 'abriu o pedido' : 'reabriu o pedido'
  return 'mudou o estado'
}

/**
 * One request, with everything that happened to it.
 *
 * The timeline is the point. A current state answers "where is this"; only the
 * history answers "when did I ask, and when did she see it" — and that is the
 * question the intake exists for.
 */
export default async function Pedido ({
  params
}: {
  params: Promise<{ codigo: string }>
}) {
  const identity = await requireSession()
  const { codigo } = await params

  const pedido = await requestDetail(codigo, id => canReach(identity, id))

  /* `requestDetail` returns null for both "does not exist" and "not yours", and
     this turns both into the same 404. Distinguishing them would make the URL a
     way to test whether a request exists. */
  if (pedido === null) notFound()

  const estado = ESTADO[pedido.state] ?? ESTADO.open
  const arquivos = pedido.events.filter(e => e.kind === 'file' && e.fileCode !== null)

  return (
    <>
      <p className="volta">
        <Link href="/pedidos">← todos os pedidos</Link>
      </p>

      <header className="pagina-cab">
        <p className="sobrancelha">{TIPO[pedido.kind]}</p>
        <h1 className="display">{pedido.title}</h1>
      </header>

      <div className="pedido-topo">
        <span className={`selo ${estado?.classe ?? ''}`}>{estado?.rot}</span>
        <span className="pedido-quando">pedido em {longDate(pedido.createdAt)}</span>
      </div>

      {pedido.description !== null && (
        <p className="pedido-desc pedido-desc-solta">{pedido.description}</p>
      )}

      {pedido.whyItMatters !== null && (
        <p className="pedido-porque">
          <span className="pedido-porque-rot">por que importa</span>
          {pedido.whyItMatters}
        </p>
      )}

      {arquivos.length > 0 && (
        <section className="secao">
          <div className="secao-cab">
            <h2 className="titulo-secao">O que já chegou</h2>
          </div>
          <ul className="lista-simples">
            {arquivos.map(a => (
              <li key={a.id}>
                <a className="lista-item" href={`/api/arquivo/${a.fileCode}`}>
                  <span className="lista-titulo">{a.fileName}</span>
                  <span className="lista-meta">
                    {a.fileBytes !== null && <FileSize bytes={a.fileBytes} />}
                    {' · '}{shortDate(a.createdAt)}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="secao">
        <div className="secao-cab">
          <h2 className="titulo-secao">
            {identity.role === 'consultant' ? 'Responder por ela' : 'Sua vez'}
          </h2>
        </div>
        <RequestActions pedido={pedido.publicCode} estado={pedido.state} />
      </section>

      <section className="secao">
        <div className="secao-cab">
          <h2 className="titulo-secao">O que aconteceu</h2>
        </div>

        {pedido.events.length === 0
          ? <p className="rodape-nota">Nada ainda. O que você fizer aqui aparece nesta lista.</p>
          : (
            <ol className="linha-tempo">
              {pedido.events.map(e => (
                <li key={e.id} className={`evento evento-${e.kind}`}>
                  <div className="evento-marca" aria-hidden="true" />
                  <div className="evento-corpo">
                    <p className="evento-cab">
                      <span className="evento-quem">{e.userName ?? 'alguém'}</span>
                      <span className="evento-quando">{shortDate(e.createdAt)}</span>
                    </p>

                    {e.kind === 'state_change' && (
                      <p className="evento-texto">{narrar(e.fromState, e.toState)}</p>
                    )}

                    {e.kind === 'comment' && e.body !== null && (
                      <p className="evento-texto evento-fala">{e.body}</p>
                    )}

                    {e.kind === 'file' && (
                      <p className="evento-texto">
                        mandou{' '}
                        {e.fileCode === null
                          ? <strong>{e.body}</strong>
                          : (
                            <a href={`/api/arquivo/${e.fileCode}`}>
                              {e.fileName ?? e.body}
                            </a>
                            )}
                        {e.fileBytes !== null && <> · <FileSize bytes={e.fileBytes} /></>}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            )}
      </section>
    </>
  )
}
