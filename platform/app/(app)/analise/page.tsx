import type { Metadata } from 'next'
import { RequestText } from '@/components/request-text'
import { Series } from '@/components/series'
import { activeCycle, northStarProgress, readingDeliveries } from '@/lib/dashboard'
import type { Progresso } from '@/lib/dashboard'
import { clientScope } from '@/lib/dal'
import { format, longDate, monthLabel } from '@/lib/format'

export const metadata: Metadata = { title: 'Análise' }
export const dynamic = 'force-dynamic'

/**
 * What was found out about the profile, written for her to read.
 *
 * This screen exists because the strongest finding this project has produced —
 * her long, opinionated content converts strangers at forty-one times the rate
 * of the brand series, and almost never reaches a stranger — lived in the
 * consultant's notes and in one line of a request outcome. She had nowhere to
 * read it.
 *
 * Separate from /plano on purpose. Plano answers "what do I do"; this answers
 * "what did you find out". Putting them together is how the plan became the
 * 1.500-word page that had to be taken apart.
 */
export default async function Analise () {
  const clientId = await clientScope()
  const ciclo = await activeCycle(clientId)

  const [entregas, progresso] = await Promise.all([
    readingDeliveries(clientId),
    ciclo === null ? Promise.resolve(null) : northStarProgress(clientId, ciclo.id)
  ])

  if (entregas.length === 0) {
    return (
      <header className="pagina-cab">
        <p className="sobrancelha">Análise</p>
        <h1 className="display">Ainda não.</h1>
        <p className="lead">
          Quando eu terminar de ler os seus números, o que eu encontrar aparece
          aqui — com o que muda no que você faz.
        </p>
      </header>
    )
  }

  const [primeira, ...anteriores] = entregas

  return (
    <>
      <header className="pagina-cab">
        <p className="sobrancelha">
          {primeira?.periodEnd !== null && primeira?.periodEnd !== undefined
            ? `Dados até ${longDate(primeira.periodEnd)}`
            : 'Análise'}
        </p>
        <h1 className="display">{primeira?.title}</h1>
        {primeira?.subtitle !== null && primeira?.subtitle !== undefined && (
          <p className="lead">{primeira.subtitle}</p>
        )}
      </header>

      {primeira !== undefined && <Blocos secoes={primeira.sections} />}

      {progresso !== null && <Progressao p={progresso} />}

      {anteriores.length > 0 && (
        <section className="secao">
          <div className="secao-cab">
            <h2 className="titulo-secao">Antes disso</h2>
          </div>
          {anteriores.map(e => (
            <details className="grupo grupo-neutro" key={e.id}>
              <summary className="grupo-titulo">
                {e.title}
                {e.publishedAt !== null && (
                  <span className="grupo-quem"> · {longDate(e.publishedAt.toISOString().slice(0, 10))}</span>
                )}
              </summary>
              <Blocos secoes={e.sections} />
            </details>
          ))}
        </section>
      )}
    </>
  )
}

/**
 * Real paragraphs, from blank lines.
 *
 * `RequestText` only turns URLs into links — it does not break paragraphs, and
 * HTML collapses newlines, so every `\n\n` written into a body was rendering as
 * a single space. Five blocks of analysis arrived as five walls of text.
 */
function Paragrafos ({ texto }: { texto: string }) {
  const blocos = texto.split(/\n{2,}/).map(t => t.trim()).filter(t => t !== '')

  return (
    <>
      {blocos.map((t, i) => (
        <p className="analise-corpo" key={i}><RequestText text={t} /></p>
      ))}
    </>
  )
}

function Blocos ({ secoes }: { secoes: Array<{
  id: number
  title: string | null
  body: string
  highlight: string | null
  highlightLabel: string | null
}> }) {
  return (
    <>
      {secoes.map(s => (
        /* Not `.secao`. That class carries a rule under its heading and the
           rhythm of a dashboard section; this screen is prose, and the border
           was part of what made each title read as a floating label rather than
           the opening of something. */
        <section className="analise-bloco" key={s.id}>
          {s.title !== null && <h2 className="analise-titulo">{s.title}</h2>}

          {/* The number above the paragraph it carries, not inside it: a figure
              found mid-sentence reads with the weight of a sentence. */}
          {s.highlight !== null && (
            <p className="achado-numero">
              <span className="numero numero-grande">{s.highlight}</span>
              {s.highlightLabel !== null && (
                <span className="achado-rot">{s.highlightLabel}</span>
              )}
            </p>
          )}

          <Paragrafos texto={s.body} />
        </section>
      ))}
    </>
  )
}

/**
 * The north-star metric over the months.
 *
 * The distance to the target is written out, not only drawn. Read on a phone,
 * at low brightness, in motion, two shades of the same bar are not reliably
 * distinguishable — and the difference between "almost there" and "three times
 * to go" is the whole message.
 */
function Progressao ({ p }: { p: Progresso }) {
  const atual = p.points.at(-1) ?? null
  const falta = atual !== null && p.target !== null ? p.target - atual.value : null

  return (
    <section className="secao">
      <div className="secao-cab">
        <h2 className="titulo-secao">Como isso vem mudando</h2>
        <p className="secao-nota">{p.label.toLowerCase()}</p>
      </div>

      {p.points.length === 0
        ? (
          <p className="rodape-nota">
            Ainda não dá para desenhar: não há nenhum mês medido desta conta.
            Assim que a conexão com o Instagram trouxer o primeiro mês fechado,
            esta linha começa.
          </p>
          )
        : (
          <>
            <Series
              points={p.points}
              unit={p.unit}
              decimals={p.decimals}
              label={p.label}
            />

            <div className="grupo grupo-dado">
              {p.baseline !== null && (
                <p className="grupo-item">
                  Começamos em{' '}
                  <strong>{format(p.baseline, p.unit, p.decimals)}</strong>
                  {p.baselineOn !== null && <>, medido em {longDate(p.baselineOn)}</>}.
                </p>
              )}

              {atual !== null && (
                <p className="grupo-item">
                  Em {monthLabel(atual.period)} está em{' '}
                  <strong>{format(atual.value, p.unit, p.decimals)}</strong>.
                </p>
              )}

              {falta !== null && (
                <p className="grupo-detalhe">
                  {falta <= 0
                    ? 'O alvo do ciclo já foi passado.'
                    : <>Falta <strong>{format(falta, p.unit, p.decimals)}</strong> para
                        o alvo de {format(p.target ?? 0, p.unit, p.decimals)}.</>}
                </p>
              )}

              {/* The "not a trend yet" caveat is NOT repeated here: the chart
                  component already says it above, and hearing it twice in one
                  screen reads as the product not knowing what it told you. */}
            </div>
          </>
          )}
    </section>
  )
}
