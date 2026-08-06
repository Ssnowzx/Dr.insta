import type { Metadata } from 'next'
import { CopyValue } from '@/components/copy-value'
import { StepControl } from '@/components/step-control'
import { activeCycle, clientStepAnswers, deliveries, experiments, pillars } from '@/lib/dashboard'
import type { PillarRow } from '@/lib/dashboard'
import { clientScope, requireSession } from '@/lib/dal'
import { longDate, shortDate } from '@/lib/format'

export const metadata: Metadata = { title: 'Plano' }
export const dynamic = 'force-dynamic'

const URGENCIA: Record<string, string> = {
  today: 'hoje, se der',
  this_week: 'esta semana',
  ongoing: 'a partir de já'
}

/**
 * The mix as one bar, before the four cards that explain it.
 *
 * A stacked bar and not four separate ones: the question this answers is "how
 * is my week divided", which is about the parts against each other. Four bars
 * side by side answer "how big is each", and the reader has to add them up to
 * get back to the only fact that matters — that the total does not grow.
 *
 * Widths are the real shares, normalised by their own sum rather than assumed to
 * reach 100. A mix that adds to 95 while someone is mid-edit should render as a
 * full bar of correct proportions, not as a bar with a gap at the end that looks
 * like a rendering fault.
 */
function MixBarra ({ pilares }: { pilares: PillarRow[] }) {
  const total = pilares.reduce((soma, p) => soma + (p.sharePct ?? 0), 0)
  if (total === 0) return null

  return (
    <div className="mix">
      <div
        className="mix-trilho"
        role="img"
        aria-label={`Divisão do conteúdo: ${pilares
          .filter(p => p.sharePct !== null)
          .map(p => `${p.name}, ${p.sharePct}%`)
          .join('; ')}`}
      >
        {pilares.map((p, i) => (
          <div
            key={p.id}
            className={`mix-faixa mix-faixa-${i + 1}`}
            style={{ width: `${(((p.sharePct ?? 0) / total) * 100).toFixed(2)}%` }}
          />
        ))}
      </div>

      <ul className="mix-legenda">
        {pilares.map((p, i) => (
          <li key={p.id}>
            <span className={`mix-ponto mix-faixa-${i + 1}`} aria-hidden="true" />
            {p.name} <span className="numero">{p.sharePct}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
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

  const [lista, respostas, ensaios, mix] = await Promise.all([
    deliveries(clientId, identity.userId),
    ehConsultor ? clientStepAnswers(clientId) : Promise.resolve([]),
    ciclo === null ? Promise.resolve([]) : experiments(clientId, ciclo.id),
    ciclo === null ? Promise.resolve([]) : pillars(clientId, ciclo.id)
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

      {/* The mix comes BEFORE the chores.

          The five adjustments are what to do; the pillars are what they are for.
          Presented after, they read as an appendix nobody reaches; presented
          first, each chore below arrives already belonging to something. This
          whole section lived in a markdown file she has never opened. */}
      {mix.length > 0 && (
        <section className="secao">
          <div className="secao-cab">
            <h2 className="titulo-secao">Como o seu conteúdo se divide</h2>
            <p className="secao-nota">o mesmo volume, outra proporção</p>
          </div>

          <p className="rodape-nota" style={{ marginTop: 0, marginBottom: '1.25rem' }}>
            Você publica cerca de 8 Reels por semana e escreve tudo sozinha. Isto
            aqui <strong>não pede nada a mais</strong> — é a mesma quantidade,
            dividida de outro jeito.
          </p>

          <MixBarra pilares={mix} />

          <ol className="pilares">
            {mix.map(p => (
              <li className={p.isControl ? 'pilar pilar-controle' : 'pilar'} key={p.id}>
                <div className="pilar-cab">
                  <h3 className="pilar-nome">{p.name}</h3>
                  {p.sharePct !== null && (
                    <span className="numero pilar-share">{p.sharePct}%</span>
                  )}
                  {p.isControl && <span className="selo selo-neutro">não mexer</span>}
                </div>

                {p.perWeek !== null && <p className="pilar-ritmo">{p.perWeek}</p>}
                {p.thesis !== null && <p className="pilar-tese">{p.thesis}</p>}
                {p.roleNote !== null && <p className="pilar-papel">{p.roleNote}</p>}
                {p.evidence !== null && <p className="pilar-prova">{p.evidence}</p>}

                <dl className="pilar-regras">
                  {p.metricLabel !== null && (
                    <div>
                      <dt>move</dt>
                      <dd>{p.metricLabel}</dd>
                    </div>
                  )}
                  {p.successLabel !== null && (
                    <div>
                      <dt>dá certo se</dt>
                      <dd>{p.successLabel}</dd>
                    </div>
                  )}
                </dl>
              </li>
            ))}
          </ol>

          {/* The price of the mix, on the same screen as the mix and not in a
              footnote. Reallocating trades reach for arrival, and for the first
              weeks the fall is the only visible half of that trade — which is
              how someone concludes they broke it and reverts a week before the
              reading window closes. */}
          {ciclo?.tradeOff != null && (
            <p className="troca">
              <span className="troca-rot">o que isso custa</span>
              {ciclo.tradeOff}
            </p>
          )}
        </section>
      )}

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

                    {/* The step hands over what it asks her to paste. It used to
                        name the thing and let her build it, and she built the
                        wrong one — see `components/copy-value.tsx`. */}
                    {etapa.copyValue !== null && etapa.copyLabel !== null && (
                      <CopyValue
                        valor={etapa.copyValue}
                        rotulo={etapa.copyLabel}
                        {...(etapa.copyNote === null ? {} : { nota: etapa.copyNote })}
                      />
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
