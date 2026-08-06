import type { Metadata } from 'next'
import { StepControl } from '@/components/step-control'
import { activeCycle, clientStepAnswers, deliveries, experiments } from '@/lib/dashboard'
import { clientScope, requireSession } from '@/lib/dal'
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
export default async function Plano () {
  const identity = await requireSession()
  const clientId = await clientScope()

  const ehConsultor = identity.role === 'consultant'

  const ciclo = await activeCycle(clientId)

  const [lista, respostas, ensaios] = await Promise.all([
    deliveries(clientId, identity.userId),
    ehConsultor ? clientStepAnswers(clientId) : Promise.resolve([]),
    ciclo === null ? Promise.resolve([]) : experiments(clientId, ciclo.id)
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

            {/* The reading time used to be advertised here and there is
                nothing in the product to read: `delivery` holds no content and
                no link. Promising eight minutes of something that does not
                exist is worse than saying nothing, so only the date stays until
                the documents themselves live here. */}
            {entrega.publishedAt !== null && (
              <p className="rodape-nota">Entregue em {longDate(entrega.publishedAt)}</p>
            )}
          </section>
        )
      })}

      {/* The experiments. Four of them sat in the database from the first seed
          and no screen ever read them, so the plan arrived as a list of chores
          with the reasoning stripped out. Each one names the single variable
          being changed and the number that would settle it — which is what
          separates a test from an opinion, and what lets her disagree. */}
      {ensaios.length > 0 && (
        <section className="secao">
          <div className="secao-cab">
            <h2 className="titulo-secao">O que estamos testando</h2>
            <p className="secao-nota">e como vamos saber</p>
          </div>

          <p className="rodape-nota" style={{ marginTop: 0, marginBottom: '1.25rem' }}>
            Cada ajuste do plano existe para testar uma dessas ideias. Uma
            variável por vez — se mudar duas, o resultado não diz qual funcionou.
          </p>

          <ol className="ensaios">
            {ensaios.map((e, i) => (
              <li className="ensaio" key={e.id}>
                <div className="ensaio-cab">
                  <span className="numero ensaio-n">{String(i + 1).padStart(2, '0')}</span>
                  <h3 className="ensaio-nome">{e.name}</h3>
                  <span className={`selo selo-${e.state === 'read' ? 'ok' : e.state === 'running' ? 'atencao' : 'neutro'}`}>
                    {e.state === 'not_started' ? 'não começou'
                      : e.state === 'running' ? 'rodando'
                        : e.state === 'read' ? 'lido'
                          : e.state === 'inconclusive' ? 'inconclusivo' : 'abandonado'}
                  </span>
                </div>

                <p className="ensaio-hip">{e.hypothesis}</p>

                <dl className="ensaio-regras">
                  {e.isolatedVariable !== null && (
                    <div>
                      <dt>muda só</dt>
                      <dd>{e.isolatedVariable}</dd>
                    </div>
                  )}
                  {e.successLabel !== null && (
                    <div>
                      <dt>dá certo se</dt>
                      <dd>{e.successLabel}</dd>
                    </div>
                  )}
                  {/* The reading minimum is a rule this project holds itself to
                      and states out loud: below it, a result is an indication
                      and not a trend. Hiding it is how a lucky week becomes a
                      conclusion. */}
                  {(e.minSample !== null || e.minDays !== null) && (
                    <div>
                      <dt>só dá para ler com</dt>
                      <dd>
                        {e.minSample !== null && <>{e.minSample} posts</>}
                        {e.minSample !== null && e.minDays !== null && <> · </>}
                        {e.minDays !== null && <>{e.minDays} dias</>}
                      </dd>
                    </div>
                  )}
                </dl>

                {e.outcome !== null && <p className="ensaio-saida">{e.outcome}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  )
}
