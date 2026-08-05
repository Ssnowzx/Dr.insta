import type { Metadata } from 'next'
import { ClientPicker } from '@/components/client-picker'
import { StepControl } from '@/components/step-control'
import { clientBySlug, clientStepAnswers, deliveries } from '@/lib/dashboard'
import { requireSession } from '@/lib/dal'
import { longDate, shortDate } from '@/lib/format'

export const metadata: Metadata = { title: 'Plano — My Favorite' }
export const dynamic = 'force-dynamic'

const URGENCIA: Record<string, string> = {
  today: 'hoje, se der',
  this_week: 'esta semana',
  ongoing: 'a partir de já'
}

/**
 * The plan: what she does, with the number that motivated each item.
 *
 * The client marks; the consultant reads what she marked. Two views of the same
 * rows, because `step_status` is keyed by user — the consultant never marked
 * anything, so reading it through their own id would show an empty plan and
 * suggest she had not started.
 */
export default async function Plano ({
  searchParams
}: {
  searchParams: Promise<{ cliente?: string }>
}) {
  const identity = await requireSession()
  const { cliente } = await searchParams

  /* A client user's own id always wins; the query string is only consulted for
     a consultant, who has none. Reading the parameter first would let a client
     open another client by editing the URL. */
  const clientId = identity.clientId
    ?? (cliente === undefined ? null : (await clientBySlug(cliente))?.id ?? null)

  if (clientId === null) return <ClientPicker base="/plano" />

  const ehConsultor = identity.role === 'consultant'

  const [lista, respostas] = await Promise.all([
    deliveries(clientId, identity.userId),
    ehConsultor ? clientStepAnswers(clientId) : Promise.resolve([])
  ])

  const porEtapa = new Map(respostas.map(r => [r.stepId, r]))

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
          Cada item traz o número que o motivou. Marque conforme for fazendo — não
          precisa esperar terminar tudo. E se algum travar, me conta o que travou:
          isso é tão útil quanto o que deu certo.
        </p>
      </header>

      {lista.map(entrega => {
        const feitos = entrega.steps.filter(s => s.state === 'done').length
        const travados = entrega.steps.filter(s => s.state === 'blocked').length
        const total = entrega.steps.length
        const parte = total === 0 ? 0 : (feitos / total) * 100

        return (
          <section className="secao" key={entrega.id}>
            <div className="secao-cab">
              <h2 className="titulo-secao">{entrega.title}</h2>
            </div>

            {entrega.subtitle !== null && (
              <p className="entrega-sub">{entrega.subtitle}</p>
            )}

            {/* Blocked is counted apart rather than folded into "not done".
                Five pending and five blocked are different situations, and only
                one of them is mine to fix. */}
            <div className="placar">
              <p className="placar-conta">
                <span className="numero placar-n">{feitos}</span>
                <span className="placar-de">de {total} marcados</span>
                {travados > 0 && (
                  <span className="placar-travou">
                    · <span className="numero">{travados}</span>{' '}
                    {travados === 1 ? 'travou' : 'travaram'}
                  </span>
                )}
              </p>
              <div
                className="placar-trilho"
                role="img"
                aria-label={`${feitos} de ${total} itens marcados como feitos`}
              >
                <div className="placar-barra" style={{ width: `${parte.toFixed(1)}%` }} />
              </div>
            </div>

            <ol className="etapas">
              {entrega.steps.map(etapa => {
                const resposta = porEtapa.get(etapa.id)
                const selo = etapa.state === 'done'
                  ? 'ok'
                  : etapa.state === 'blocked' ? 'critico' : 'neutro'

                return (
                  <li className={`etapa etapa-${etapa.state}`} key={etapa.id}>
                    <div className="etapa-cab">
                      <span className="etapa-prazo">
                        {etapa.deadlineLabel ?? URGENCIA[etapa.urgency]}
                      </span>
                    </div>

                    <h3 className="etapa-titulo">{etapa.title}</h3>
                    {etapa.summary !== null && <p className="etapa-resumo">{etapa.summary}</p>}

                    {etapa.evidenceValue !== null && (
                      <p className="etapa-dado">
                        <span className="numero etapa-dado-valor">{etapa.evidenceValue}</span>
                        <span className="etapa-dado-rot">{etapa.evidenceLabel}</span>
                      </p>
                    )}

                    {ehConsultor
                      ? (
                        <div className="resposta">
                          {resposta === undefined
                            ? <p className="resposta-vazia">Ela ainda não marcou este.</p>
                            : (
                              <>
                                <p className="resposta-linha">
                                  <span className={`selo selo-${
                                    resposta.state === 'done'
                                      ? 'ok'
                                      : resposta.state === 'blocked' ? 'critico' : 'neutro'
                                  }`}
                                  >
                                    {resposta.state === 'done'
                                      ? 'feito'
                                      : resposta.state === 'blocked' ? 'travou' : 'a fazer'}
                                  </span>
                                  <span className="resposta-quem">
                                    {resposta.userName} · {shortDate(resposta.updatedAt)}
                                  </span>
                                </p>
                                {resposta.comment !== null && (
                                  <p className="resposta-nota">{resposta.comment}</p>
                                )}
                              </>
                              )}
                        </div>
                        )
                      : (
                        <>
                          <span className={`selo selo-${selo} etapa-selo`}>
                            {etapa.state === 'done'
                              ? 'feito'
                              : etapa.state === 'blocked' ? 'travou' : 'a fazer'}
                          </span>
                          <StepControl
                            stepId={etapa.id}
                            estado={etapa.state}
                            comentario={etapa.comment}
                          />
                        </>
                        )}
                  </li>
                )
              })}
            </ol>

            {entrega.publishedAt !== null && (
              <p className="rodape-nota">
                Entregue em {longDate(entrega.publishedAt)}
                {entrega.readingMinutes !== null && (
                  <> · leva ~{entrega.readingMinutes} minutos de leitura</>
                )}
              </p>
            )}
          </section>
        )
      })}
    </>
  )
}
