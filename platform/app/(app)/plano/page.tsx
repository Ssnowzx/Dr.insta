import type { Metadata } from 'next'
import Link from 'next/link'
import { CopyValue } from '@/components/copy-value'
import { StepControl } from '@/components/step-control'
import {
  activeCycle, deliveries, experiments, observedFacts, pillars, teamStepAnswers
} from '@/lib/dashboard'
import type { PillarRow } from '@/lib/dashboard'
import { clientScope, requireSession } from '@/lib/dal'
import { longDate, shortDate } from '@/lib/format'
import { newestPerStep, resolveStep, stillPending } from '@/lib/verificacao'
import type { Resolved } from '@/lib/verificacao'

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

/** The three words the interface uses for a state, and the badge that goes with it. */
const SELO: Record<string, { rot: string; classe: string }> = {
  done: { rot: 'feito', classe: 'ok' },
  blocked: { rot: 'travou', classe: 'critico' },
  pending: { rot: 'a fazer', classe: 'neutro' }
}

/**
 * The plan: what the two of them do, with the number that motivated each item.
 *
 * ONE STATE, FOR EVERYONE
 *
 * This screen used to compute the state twice — hers from `step_status` joined
 * on her id, his from a separate query — and the two disagreed on screen. With
 * an assistant on the client side it would have got worse rather than stayed
 * even: whatever Bianca marked would read "a fazer" to Cris, and the plan would
 * ask two people for the same chore.
 *
 * The state is now the team's, resolved once in `lib/verificacao.ts`, with the
 * name of whoever answered next to it. Both roles read the same rows, and a
 * chore the platform can see was done stops being asked for at all.
 */
export default async function Plano () {
  const identity = await requireSession()
  const clientId = await clientScope()

  const ehConsultor = identity.role === 'consultant'

  const ciclo = await activeCycle(clientId)

  const [todasEntregas, respostas, fatos, ensaios, mix] = await Promise.all([
    deliveries(clientId),
    teamStepAnswers(clientId),
    observedFacts(clientId),
    ciclo === null ? Promise.resolve([]) : experiments(clientId, ciclo.id),
    ciclo === null ? Promise.resolve([]) : pillars(clientId, ciclo.id)
  ])

  /* `deliveries()` stopped using an INNER JOIN on `step`, so it now returns the
     deliveries that are read rather than done. This screen is the chores; a
     step-less delivery here would render a heading, an empty score and nothing
     under it. They live in /analise. */
  const lista = todasEntregas.filter(e => e.steps.length > 0)

  const porEtapa = newestPerStep(respostas)

  /* Resolved once, into a map, rather than recomputed at each of the six places
     that ask. The old version called `estadoDe` inside the headline, the score,
     the badge and the row class, and the day one of those was left reading the
     raw column the consultant's plan painted every step as untouched. */
  const estado = new Map<number, Resolved>(
    lista.flatMap(e => e.steps).map(s => [
      s.id,
      resolveStep(s, porEtapa, fatos, ehConsultor ? 'consultor' : 'cliente')
    ])
  )

  const de = (id: number): Resolved =>
    estado.get(id) ?? { state: 'pending', by: null, at: null, comment: null, proof: null }

  /* Blocked does NOT count as pending. It is not waiting on them — they already
     said it stopped, and the next move is mine. */
  const pendentes = stillPending([...estado.values()])

  /* Chores that stopped being chores because the platform watched them happen.
     Counted so the screen can say so once, at the top, instead of leaving her to
     notice that three items look different. */
  const provados = [...estado.values()].filter(r => r.proof !== null).length

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
      {/* The lead answers "what is this screen", which she already knows by
          the time she has clicked Plano. What she does not know is how much is
          left — so that is what it says now, and the instructions moved to
          where the checkboxes actually are. */}
      <header className="pagina-cab">
        <p className="sobrancelha">O que fazer</p>
        <h1 className="display">
          {pendentes === 0
            ? 'Tudo marcado.'
            : pendentes === 1
              ? 'Falta um.'
              : `Faltam ${pendentes}.`}
        </h1>
        {/* Two voices, like the requests screen and the digest. The lead used to
            be written entirely in hers and served unchanged to him — an
            instruction to mark things, on a screen where he cannot mark. */}
        <p className="lead">
          {ehConsultor
            ? pendentes === 0
              ? 'Nada pendente com elas. O que você publicar em seguida aparece aqui.'
              : 'O que elas marcaram, como marcaram, e o que a plataforma conferiu sozinha.'
            : pendentes === 0
              ? 'Nada pendente aqui. Quando eu publicar o próximo passo, ele aparece nesta tela.'
              : 'Marque conforme for fazendo — não precisa terminar tudo. E se algum travar, me conta o que travou: isso é tão útil quanto o que deu certo.'}
        </p>
        {/* Said once, at the top, rather than left for her to infer from three
            rows that look different. The complaint this answers was literally
            "coisas que eu já fiz continuam aqui e me confundem" — so the screen
            has to state that it now checks, not just behave as if it does. */}
        {provados > 0 && (
          <p className="rodape-nota">
            {ehConsultor
              ? `${provados === 1 ? 'Um item' : `${provados} itens`} a plataforma conferiu sozinha, sem elas precisarem marcar.`
              : provados === 1
                ? 'Um item aqui eu já conferi sozinho e marquei como feito — você não precisa marcar de novo.'
                : `${provados} itens aqui eu já conferi sozinho e marquei como feitos — vocês não precisam marcar de novo.`}
          </p>
        )}
      </header>

      {lista.map(entrega => {
        const feitos = entrega.steps.filter(s => de(s.id).state === 'done').length
        const travados = entrega.steps.filter(s => de(s.id).state === 'blocked').length
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
                const r = de(etapa.id)
                const selo = SELO[r.state] ?? SELO.pending

                return (
                  <li className={`etapa etapa-${r.state}`} key={etapa.id}>
                    <div className="etapa-cab">
                      <span className="etapa-prazo">
                        {/* A deadline on something already done is a deadline
                            that has stopped being information. */}
                        {r.state === 'done'
                          ? 'concluído'
                          : etapa.deadlineLabel ?? URGENCIA[etapa.urgency]}
                      </span>
                      <span className={`selo selo-${selo?.classe} etapa-selo`}>
                        {selo?.rot}
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
                        wrong one — see `components/copy-value.tsx`.

                        Hidden once the chore is done: a link to paste into a bio
                        that already carries it is an instruction to redo work,
                        and it is the second half of the complaint that opened
                        this change — "ainda está lá no app os links e a tarefa". */}
                    {r.state !== 'done' && etapa.copyValue !== null && etapa.copyLabel !== null && (
                      <CopyValue
                        valor={etapa.copyValue}
                        rotulo={etapa.copyLabel}
                        {...(etapa.copyNote === null ? {} : { nota: etapa.copyNote })}
                      />
                    )}

                    {/* The platform proved it. No control, because there is
                        nothing to answer — and offering one would invite her to
                        contradict a fact, which the action then has to refuse. */}
                    {r.proof !== null
                      ? (
                        <p className="prova">
                          <span className="prova-marca" aria-hidden="true">✓</span>
                          <span className="prova-texto">
                            {r.by === null
                              ? <>{ehConsultor ? 'Conferido pela plataforma' : 'Conferido por aqui'}: {r.proof.label}.</>
                              : <>{r.by} marcou, e {ehConsultor ? 'a plataforma conferiu' : 'conferi por aqui'}: {r.proof.label}.</>}
                            {r.proof.at !== null && <> {shortDate(r.proof.at)}.</>}
                            {r.proof.href !== null && (
                              <> <Link href={r.proof.href}>ver</Link></>
                            )}
                          </span>
                        </p>
                        )
                      : (
                        <StepControl
                          stepId={etapa.id}
                          estado={r.state}
                          comentario={r.comment}
                          {...(r.by === null ? {} : { quem: r.by })}
                          {...(r.at === null ? {} : { quando: shortDate(r.at) })}
                          somenteLeitura={ehConsultor}
                        />
                        )}

                    {/* Kept even under a proof: what she wrote when it blocked is
                        the most useful sentence on this screen, and it does not
                        stop being true because the chore later got done. */}
                    {r.proof !== null && r.comment !== null && (
                      <p className="resposta-nota">{r.comment}</p>
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

      {/* The mix used to come BEFORE the chores, on the argument that a chore
          arrives better when it already belongs to something. Moved below them
          on 13/08/2026, after reading the rendered screen.

          The argument was right about reading order and wrong about who reads.
          She opens this with one question — what do I do — and answering it on
          line four of a 1.500-word page means the answer is reached by
          scrolling past the reasoning. The reasoning was not deleted; it moved
          to where reasoning belongs, after the thing it justifies. */}
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
