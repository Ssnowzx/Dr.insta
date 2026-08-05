import type { Metadata } from 'next'
import { requests } from '@/lib/dashboard'
import { requireSession } from '@/lib/dal'
import { shortDate } from '@/lib/format'

export const metadata: Metadata = { title: 'Pedidos — My Favorite' }
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

/**
 * Intake.
 *
 * Every ask carries why it matters, because an ask without a reason is a chore.
 * Four of these five are just "send me the data" — saying so up front is what
 * keeps the list from reading as five pieces of homework.
 */
export default async function Pedidos () {
  const identity = await requireSession()
  if (identity.clientId === null) {
    return (
      <header className="pagina-cab">
        <p className="sobrancelha">Consultor</p>
        <h1 className="display">Escolha um cliente.</h1>
      </header>
    )
  }

  const lista = await requests(identity.clientId)
  const abertos = lista.filter(p => p.state === 'open' || p.state === 'in_progress')
  const fechados = lista.filter(p => p.state === 'delivered' || p.state === 'dropped')
  const soDado = abertos.filter(p => p.kind === 'data').length

  return (
    <>
      <header className="pagina-cab">
        <p className="sobrancelha">O que falta de você</p>
        <h1 className="display">Pedidos</h1>
        <p className="lead">
          {abertos.length === 0
            ? 'Nada pendente. Quando eu precisar de alguma coisa, aparece aqui.'
            : soDado === abertos.length
              ? `São ${abertos.length} pedidos, e todos são só me mandar um dado — nada de gravar ou produzir.`
              : `São ${abertos.length} pedidos, e ${soDado} deles são só me mandar um dado.`}
        </p>
      </header>

      <ul className="pedidos">
        {abertos.map(p => {
          const estado = ESTADO[p.state] ?? ESTADO.open
          return (
            <li className="pedido" key={p.id}>
              <div className="pedido-cab">
                <span className="pedido-tipo">{TIPO[p.kind]}</span>
                <span className={`selo ${estado?.classe ?? ''}`}>{estado?.rot}</span>
              </div>

              <h2 className="pedido-titulo">{p.title}</h2>
              {p.description !== null && <p className="pedido-desc">{p.description}</p>}

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
            </li>
          )
        })}
      </ul>

      {fechados.length > 0 && (
        <section className="secao">
          <div className="secao-cab">
            <h2 className="titulo-secao">Já resolvidos</h2>
          </div>
          <ul className="lista-simples">
            {fechados.map(p => (
              <li key={p.id}>
                <span className="lista-item">
                  <span className="lista-titulo">{p.title}</span>
                  <span className="lista-meta">{ESTADO[p.state]?.rot}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
