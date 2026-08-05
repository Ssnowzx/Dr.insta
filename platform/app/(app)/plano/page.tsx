import type { Metadata } from 'next'
import { deliveries } from '@/lib/dashboard'
import { requireSession } from '@/lib/dal'
import { longDate } from '@/lib/format'

export const metadata: Metadata = { title: 'Plano — My Favorite' }
export const dynamic = 'force-dynamic'

const URGENCIA: Record<string, string> = {
  today: 'hoje, se der',
  this_week: 'esta semana',
  ongoing: 'a partir de já'
}

const ESTADO: Record<string, { rot: string; classe: string }> = {
  pending: { rot: 'a fazer', classe: 'selo-neutro' },
  done: { rot: 'feito', classe: 'selo-ok' },
  blocked: { rot: 'travou', classe: 'selo-critico' }
}

/**
 * The plan: what she does, with the number that motivated each item.
 *
 * Read-only for now — marking a step lands with the rest of phase 4. What is
 * already true here is the rule the project holds itself to: no recommendation
 * appears without the observed number behind it.
 */
export default async function Plano () {
  const identity = await requireSession()
  if (identity.clientId === null) {
    return (
      <header className="pagina-cab">
        <p className="sobrancelha">Consultor</p>
        <h1 className="display">Escolha um cliente.</h1>
      </header>
    )
  }

  const lista = await deliveries(identity.clientId, identity.userId)

  if (lista.length === 0) {
    return (
      <header className="pagina-cab">
        <p className="sobrancelha">Plano</p>
        <h1 className="display">Nada por aqui ainda.</h1>
        <p className="lead">A primeira entrega aparece assim que estiver pronta.</p>
      </header>
    )
  }

  return (
    <>
      <header className="pagina-cab">
        <p className="sobrancelha">O que fazer</p>
        <h1 className="display">Seu plano</h1>
        <p className="lead">
          Cada item traz o número que o motivou. Se algum não fizer sentido, o
          problema é meu — me diz e eu troco o caminho.
        </p>
      </header>

      {lista.map(entrega => {
        const feitos = entrega.steps.filter(s => s.state === 'done').length
        const travados = entrega.steps.filter(s => s.state === 'blocked').length

        return (
          <section className="secao" key={entrega.id}>
            <div className="secao-cab">
              <h2 className="titulo-secao">{entrega.title}</h2>
              <p className="secao-nota">
                <span className="numero">{feitos}</span> de{' '}
                <span className="numero">{entrega.steps.length}</span> marcados
                {travados > 0 && <> · <span className="numero">{travados}</span> travados</>}
              </p>
            </div>

            {entrega.subtitle !== null && (
              <p className="entrega-sub">{entrega.subtitle}</p>
            )}

            <ol className="etapas">
              {entrega.steps.map(etapa => {
                const estado = ESTADO[etapa.state] ?? ESTADO.pending
                return (
                  <li className="etapa" key={etapa.id}>
                    <div className="etapa-cab">
                      <span className="etapa-prazo">
                        {etapa.deadlineLabel ?? URGENCIA[etapa.urgency]}
                      </span>
                      <span className={`selo ${estado?.classe ?? ''}`}>{estado?.rot}</span>
                    </div>

                    <h3 className="etapa-titulo">{etapa.title}</h3>
                    {etapa.summary !== null && <p className="etapa-resumo">{etapa.summary}</p>}

                    {etapa.evidenceValue !== null && (
                      <p className="etapa-dado">
                        <span className="numero etapa-dado-valor">{etapa.evidenceValue}</span>
                        <span className="etapa-dado-rot">{etapa.evidenceLabel}</span>
                      </p>
                    )}

                    {etapa.comment !== null && (
                      <p className="ressalva">Você anotou: {etapa.comment}</p>
                    )}
                  </li>
                )
              })}
            </ol>

            {entrega.publishedAt !== null && (
              <p className="rodape-nota">
                Entregue em {longDate(entrega.publishedAt)}
                {entrega.readingMinutes !== null && <> · leva ~{entrega.readingMinutes} minutos de leitura</>}
              </p>
            )}
          </section>
        )
      })}
    </>
  )
}
