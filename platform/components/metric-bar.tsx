import type { MetricCard } from '@/lib/dashboard'
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

function statusOf (m: MetricCard): { status: Status; label: string } {
  if (m.value === null) return { status: 'neutro', label: 'sem dado' }
  if (m.target === null) return { status: 'neutro', label: 'sem alvo ainda' }
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

export function MetricBar ({ metric }: { metric: MetricCard }) {
  const { status, label } = statusOf(metric)

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
    <article className="metrica">
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
        (metric.target === null ? '' : `, alvo ${format(metric.target, metric.unit, metric.decimals)}`) +
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
            <dt>alvo do ciclo</dt>
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
