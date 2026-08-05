import { format } from '@/lib/format'
import type { Unit } from '@/lib/format'

/**
 * A monthly series, as a line.
 *
 * One measure per chart. Two measures of different scale on one plot needs two
 * y-axes, and a dual-axis chart lets the author decide which line looks like it
 * leads the other by choosing the scales. Views and posts are two charts.
 *
 * Server-rendered SVG: it arrives with the HTML, costs no JavaScript, and there
 * are twelve points at most. Direct labels on the first and last only — a number
 * on every point turns a line into a table that is hard to read as either.
 */

export interface SeriesPoint {
  period: string
  value: number
  /** The window is still open, so this month is not comparable with the others. */
  partial?: boolean
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function monthAbbrev (period: string): string {
  const index = Number(period.slice(5, 7)) - 1
  return MONTHS[index] ?? period.slice(5, 7)
}

const W = 720
const H = 220
const PAD = { top: 24, right: 16, bottom: 30, left: 16 }

export function Series ({
  points,
  unit,
  decimals = 0,
  label
}: {
  points: SeriesPoint[]
  unit: Unit
  decimals?: number
  label: string
}) {
  if (points.length < 2) {
    return (
      <p className="serie-vazia">
        Um mês só ainda. Uma linha precisa de dois pontos para dizer alguma coisa.
      </p>
    )
  }

  const values = points.map(p => p.value)
  const max = Math.max(...values)
  /* The baseline is zero, not the minimum. Starting a count axis at the lowest
     value magnifies every wobble into a cliff — the single most common way a
     chart lies without a false number anywhere in it. */
  const min = 0
  const span = max - min || 1

  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom

  const x = (i: number): number => PAD.left + (i / (points.length - 1)) * plotW
  const y = (v: number): number => PAD.top + plotH - ((v - min) / span) * plotH

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const area = `${line} L${x(points.length - 1).toFixed(1)},${(PAD.top + plotH).toFixed(1)} L${x(0).toFixed(1)},${(PAD.top + plotH).toFixed(1)} Z`

  const first = points[0]
  const last = points[points.length - 1]
  const partialCount = points.filter(p => p.partial === true).length

  return (
    <figure className="serie">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="serie-svg"
        role="img"
        aria-label={
          `${label} por mês, de ${monthAbbrev(first?.period ?? '')} a ${monthAbbrev(last?.period ?? '')}. ` +
          points.map(p => `${monthAbbrev(p.period)}: ${format(p.value, unit, decimals)}`).join('; ')
        }
      >
        {/* Three horizontal rules, recessive. No vertical grid: the month labels
            already mark the columns, and a full grid competes with the line. */}
        {[0, 0.5, 1].map(t => (
          <line
            key={t}
            x1={PAD.left} x2={W - PAD.right}
            y1={PAD.top + plotH * t} y2={PAD.top + plotH * t}
            className="serie-grade"
          />
        ))}

        <path d={area} className="serie-area" />
        <path d={line} className="serie-linha" />

        {points.map((p, i) => (
          <circle
            key={p.period}
            cx={x(i)} cy={y(p.value)} r={i === points.length - 1 ? 5 : 3.5}
            className={p.partial === true ? 'serie-ponto serie-ponto-parcial' : 'serie-ponto'}
          >
            <title>{`${monthAbbrev(p.period)}: ${format(p.value, unit, decimals)}`}</title>
          </circle>
        ))}

        {points.map((p, i) => (
          <text key={p.period} x={x(i)} y={H - 10} textAnchor="middle" className="serie-mes">
            {monthAbbrev(p.period)}
          </text>
        ))}
      </svg>

      <div className="serie-extremos">
        <span>
          <span className="serie-extremo-mes">{monthAbbrev(first?.period ?? '')}</span>{' '}
          <span className="numero">{format(first?.value, unit, decimals)}</span>
        </span>
        <span>
          <span className="serie-extremo-mes">{monthAbbrev(last?.period ?? '')}</span>{' '}
          <span className="numero">{format(last?.value, unit, decimals)}</span>
          {last?.partial === true && <span className="serie-parcial"> · mês ainda correndo</span>}
        </span>
      </div>

      {partialCount > 0 && (
        <figcaption className="serie-nota">
          O último ponto é de um mês que ainda não terminou — ele vai subir. Não
          compare com os meses fechados.
        </figcaption>
      )}
    </figure>
  )
}
