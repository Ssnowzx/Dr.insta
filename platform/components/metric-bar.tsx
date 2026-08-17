import type { MetricCard } from '@/lib/dashboard'
import { descreverOrigem } from '@/lib/origem'
import { format } from '@/lib/format'

/**
 * One metric against its references — a bullet chart.
 *
 * The job is "one value against reference points", which is what a bullet chart
 * is for. Four bars side by side would turn three reference points into three
 * competing series and invite the eye to compare them with each other instead of
 * with the measure.
 *
 * Reference marks are ticks in ink, not fills in colour: only the measure gets
 * the data colour. Status is carried by a word, never by hue alone.
 *
 * A contaminated baseline is stated on the card. So is a sample below the
 * project's reading minimum. Hiding either would let the screen present a
 * number as a trend when it is an indication.
 */

type Status = 'ok' | 'atencao' | 'critico' | 'neutro'

/**
 * A floor is judged in floor words. The panel's "O que não pode cair" section
 * already says "piso, não alvo" — and then every card inside it said "alvo do
 * ciclo" and "no alvo", which is the exact misreading the section exists to
 * prevent: a number the cycle only asks not to fall, presented as an
 * achievement.
 */
function statusOf (m: MetricCard, piso: boolean): { status: Status; label: string } {
  if (m.value === null) return { status: 'neutro', label: 'sem dado' }
  if (m.target === null) return { status: 'neutro', label: 'sem alvo ainda' }
  if (piso) {
    if (m.value >= m.target) return { status: 'ok', label: 'não caiu' }
    if (m.value >= m.target * 0.9) return { status: 'atencao', label: 'raspando o piso' }
    return { status: 'critico', label: 'abaixo do piso' }
  }
  if (m.value >= m.target) return { status: 'ok', label: 'no alvo' }
  if (m.value >= m.target * 0.6) return { status: 'atencao', label: 'perto do alvo' }
  return { status: 'critico', label: 'longe do alvo' }
}

/** Bare number for a metric that has no reference to compare against. */
export function MetricStat ({ metric }: { metric: MetricCard }) {
  return (
    <div className="stat">
      <p className="stat-rot">{metric.shortLabel ?? metric.label}</p>
      <p className="numero stat-valor">
        {format(metric.value, metric.unit, metric.decimals)}
      </p>
    </div>
  )
}

/**
 * @param destaque The north-star metric. It gets the full width and a much
 *   larger value, because "the one the cycle is decided on" has to be legible
 *   as a rank and not only as a position in a list.
 */
export function MetricBar ({ metric, destaque = false }: { metric: MetricCard; destaque?: boolean }) {
  /* The same rule the panel groups by: a target that IS the baseline is a
     floor. Derived from the numbers, so a new floor in the seed lands here
     without a code change. */
  const piso = metric.target !== null && metric.baseline !== null &&
    metric.target === metric.baseline

  const { status, label } = statusOf(metric, piso)

  /* A track needs something to compare against. With no target and no niche
     reference the ceiling is the value itself, so the bar fills to the same
     fraction whatever the number is — a shape that looks like data and carries
     none. Those metrics get the number and the caveats, and no bar. */
  const hasReference = metric.target !== null || metric.benchmark !== null

  /* The track ends past the largest reference, so a mark never sits on the edge
     where it stops reading as a position. */
  const ceiling = Math.max(
    metric.value ?? 0, metric.target ?? 0, metric.benchmark ?? 0, metric.baseline ?? 0
  ) * 1.12

  const pct = (v: number | null): number =>
    v === null || ceiling === 0 ? 0 : Math.min(100, (v / ceiling) * 100)

  const showSample = metric.sampleSize !== null && metric.sampleSize < 7

  /* A niche reference older than twelve months is a rule the project already
     holds itself to in the engine. Surfacing the age is what keeps a stale
     number from being read as current. */
  const benchmarkAge = metric.benchmarkUpdatedOn === null
    ? null
    : Math.floor(
        (Date.now() - new Date(`${metric.benchmarkUpdatedOn}T12:00:00Z`).getTime())
        / (1000 * 60 * 60 * 24 * 30.44)
      )
  const staleBenchmark = benchmarkAge !== null && benchmarkAge >= 12

  return (
    <article className={destaque ? 'metrica metrica-norte' : 'metrica'}>
      {destaque && <p className="metrica-posto">a métrica que decide o ciclo</p>}

      <div className="metrica-cab">
        <h3 className="metrica-nome">{metric.label}</h3>
        <span className={`selo selo-${status}`}>{label}</span>
      </div>

      <p className="numero metrica-valor">
        {format(metric.value, metric.unit, metric.decimals)}
      </p>

      {hasReference && (
      <div className="metrica-trilho" role="img" aria-label={
        `${metric.label}: ${format(metric.value, metric.unit, metric.decimals)}` +
        (metric.target === null ? '' : `, ${piso ? 'piso' : 'alvo'} ${format(metric.target, metric.unit, metric.decimals)}`) +
        (metric.benchmark === null ? '' : `, referência do nicho ${format(metric.benchmark, metric.unit, metric.decimals)}`)
      }>
        <div className="metrica-barra" style={{ width: `${pct(metric.value).toFixed(2)}%` }} />

        {metric.target !== null && (
          <span className="metrica-marca metrica-alvo" style={{ left: `${pct(metric.target).toFixed(2)}%` }} />
        )}
        {metric.benchmark !== null && (
          <span className="metrica-marca metrica-nicho" style={{ left: `${pct(metric.benchmark).toFixed(2)}%` }} />
        )}
      </div>
      )}

      <dl className="metrica-refs">
        {metric.target !== null && (
          <div>
            <dt>{piso ? 'piso — não pode cair de' : 'alvo do ciclo'}</dt>
            <dd className="numero">{format(metric.target, metric.unit, metric.decimals)}</dd>
          </div>
        )}
        {metric.benchmark !== null && (
          <div>
            <dt>média do nicho</dt>
            <dd className="numero">{format(metric.benchmark, metric.unit, metric.decimals)}</dd>
          </div>
        )}
        {/* The baseline is only worth showing when it differs from the current
            value. In the very period the baseline was taken from, repeating the
            same number twice reads as an error. */}
        {metric.baseline !== null && metric.target === null && metric.baseline !== metric.value && (
          <div>
            <dt>ponto de partida</dt>
            <dd className="numero">{format(metric.baseline, metric.unit, metric.decimals)}</dd>
          </div>
        )}
      </dl>

      {metric.description !== null && (
        <p className="metrica-desc">{metric.description}</p>
      )}

      {/* Provenance, on the card and not in a footnote. The consultant had to
          ask where "23 purchases" came from and whether it was an average; the
          answer was already in the database and invisible. A number arrives
          here from four different panels, two of them disagree about revenue on
          purpose, and one source is a person typing — none of which the reader
          could tell from the figure alone. */}
      {(() => {
        const origem = descreverOrigem(metric.source)
        if (origem === null && metric.note === null) return null

        return (
          <div className="metrica-origem">
            <p className="metrica-origem-linha">
              {origem !== null && (
                <span className={origem.medido ? 'origem-selo' : 'origem-selo origem-selo-informado'}>
                  {origem.curto}
                </span>
              )}
              <span className="metrica-origem-txt">
                {origem?.longo}
                {metric.howToMeasure !== null && origem?.medido === true && (
                  <>
                    {' '}
                    <span className="metrica-onde">{metric.howToMeasure}</span>
                  </>
                )}
              </span>
            </p>

            {/* On its own line, because it is about THIS value and not about
                the source. "No link in the bio during the period" is what turns
                a zero from a failure into a fact — and it was stored in the
                database and never shown. */}
            {metric.note !== null && (
              <p className="metrica-origem-nota">{metric.note}</p>
            )}

            {/* When two sources measured the same thing and got different
                answers, the reader is entitled to know. Showing only the winner
                turns a disagreement into a certainty the data does not support.
                Only real disagreements reach here — two sources agreeing is a
                confirmation, and rendering it as a divergence would read as
                doubt. */}
            {metric.divergences.map(d => {
              const outra = descreverOrigem(d.source)
              return (
                <p className="metrica-origem-nota" key={d.source ?? 'sem-origem'}>
                  {outra === null
                    ? 'Outra medição do mesmo período'
                    : `Pela leitura ${outra.medido ? 'do ' : 'de '}${outra.curto}`}
                  {' este número é '}
                  <strong>{format(d.value, metric.unit, metric.decimals)}</strong>.
                  {' As duas medições não batem — vale saber antes de decidir em cima.'}
                </p>
              )
            })}
          </div>
        )
      })()}

      {metric.contaminated && (
        <p className="ressalva ressalva-atencao">
          <strong>Ainda não dá para fixar meta com este número.</strong>{' '}
          {metric.targetNote}
        </p>
      )}

      {staleBenchmark && (
        <p className="ressalva">
          A média do nicho é de {benchmarkAge} meses atrás. Ainda serve de norte,
          mas trate como ordem de grandeza, não como número do mês.
        </p>
      )}

      {showSample && (
        <p className="ressalva">
          Apoiado em {metric.sampleSize} {metric.sampleSize === 1 ? 'post' : 'posts'} —
          abaixo do mínimo de 7 que a gente usa para chamar de tendência. Por
          enquanto é indício.
        </p>
      )}
    </article>
  )
}
