'use client'

import { useRef, useState } from 'react'
import { format } from '@/lib/format'
import { pontoMaisProximo, variacao } from '@/lib/serie'
import type { Plot } from '@/lib/serie'
import type { Unit } from '@/lib/format'

/**
 * A monthly series, as a line, readable with a finger.
 *
 * One measure per chart. Two measures of different scale on one plot needs two
 * y-axes, and a dual-axis chart lets the author decide which line looks like it
 * leads the other by choosing the scales. Views and posts are two charts.
 *
 * WHY THE READOUT SITS ABOVE THE CHART AND NOT UNDER THE FINGER
 *
 * This is read on a phone. A tooltip that follows the pointer is a desktop
 * pattern: on a touch screen the hand covers it, so the one thing the gesture
 * exists to reveal is the one thing hidden. The reading goes into a fixed slot
 * above the plot instead, which is always visible and never moves.
 *
 * That slot is present even at rest — showing the latest month — so touching
 * the chart changes text in place instead of pushing the page down. A readout
 * that appears on touch would reflow everything below it under the thumb.
 *
 * WHY POINTER EVENTS
 *
 * One code path for finger, mouse and stylus. `setPointerCapture` keeps the
 * reading alive when the finger slides off the SVG, which on a 350px-wide plot
 * is most drags.
 *
 * It still renders on the server, so the chart and its numbers arrive with the
 * HTML. Without JavaScript it is exactly the chart it was before.
 */

export interface SeriesPoint {
  period: string
  value: number
  /** The window is still open, so this month is not comparable with the others. */
  partial?: boolean
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

const MESES_LONGOS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
]

function monthAbbrev (period: string): string {
  const index = Number(period.slice(5, 7)) - 1
  return MONTHS[index] ?? period.slice(5, 7)
}

function mesLongo (period: string): string {
  const index = Number(period.slice(5, 7)) - 1
  return MESES_LONGOS[index] ?? period.slice(5, 7)
}

const W = 720
const H = 220
const PAD = { top: 24, right: 16, bottom: 30, left: 16 }

const PLOT: Plot = { width: W, padLeft: PAD.left, padRight: PAD.right }

/** Signed, so a fall reads as a fall without the reader doing the subtraction. */
function sinal (r: number): string {
  const pct = (r * 100).toFixed(r >= 0.1 || r <= -0.1 ? 0 : 1).replace('.', ',')
  return `${r > 0 ? '+' : ''}${pct}%`
}

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
  const svgRef = useRef<SVGSVGElement>(null)
  /* Whether a finger is down, tracked here rather than read back from
     `hasPointerCapture`. Asking the browser produced a drag that set the first
     month and then never moved: when the capture does not take — and it can
     fail for reasons this component cannot see — the guard silently rejects
     every move and the gesture does nothing at all. Owning the flag makes the
     drag independent of whether the capture succeeded. */
  const arrastando = useRef(false)
  /* `null` means "nothing is being touched", which is not the same as index 0 —
     at rest the readout shows the latest month, and the guide line is hidden. */
  const [ativo, setAtivo] = useState<number | null>(null)

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

  /* At rest the slot reads the latest month — the one the page is about. */
  const lido = ativo ?? points.length - 1
  const ponto = points[lido]

  /* No delta on a month that has not finished. Four days of August against all
     of July reads as "-96%", which is not a fall — it is a month being compared
     with a fraction of another. The caption under this very chart says not to
     make that comparison, and a readout that makes it anyway is worse than no
     readout: it is the chart contradicting its own footnote. */
  const delta = ponto === undefined || ponto.partial === true
    ? null
    : variacao(points[lido - 1]?.value, ponto.value)

  function apontar (clientX: number): void {
    const svg = svgRef.current
    if (svg === null) return
    const i = pontoMaisProximo(clientX, svg.getBoundingClientRect(), points.length, PLOT)
    if (i !== null) setAtivo(i)
  }

  return (
    <figure className="serie">
      {/* aria-live so the reading is announced as the finger moves; `polite`
          rather than `assertive` because it must not interrupt anything. */}
      <div className="serie-leitura" aria-live="polite">
        <span className="serie-leitura-mes">
          {ponto === undefined ? '' : mesLongo(ponto.period)}
        </span>
        <span className="numero serie-leitura-valor">
          {format(ponto?.value, unit, decimals)}
        </span>
        {delta !== null && (
          <span className={delta >= 0 ? 'serie-delta serie-delta-sobe' : 'serie-delta serie-delta-cai'}>
            {sinal(delta)} <span className="serie-delta-rot">vs. mês anterior</span>
          </span>
        )}
        {ponto?.partial === true && (
          <span className="serie-parcial">mês ainda correndo</span>
        )}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="serie-svg"
        role="img"
        tabIndex={0}
        aria-label={
          `${label} por mês, de ${monthAbbrev(first?.period ?? '')} a ${monthAbbrev(last?.period ?? '')}. ` +
          points.map(p => `${monthAbbrev(p.period)}: ${format(p.value, unit, decimals)}`).join('; ')
        }
        onPointerDown={e => {
          arrastando.current = true
          /* Capture so a finger that leaves the plot keeps driving the reading.
             It is an improvement, not a requirement — hence the catch: on the
             browsers where it throws, the drag still works through the flag
             above instead of dying here before the first reading. */
          try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* segue sem captura */ }
          apontar(e.clientX)
        }}
        /* A mouse reads on hover, with no button held; a finger only reads while
           it is down. Same handler, and the difference is the input, not a
           second code path. */
        onPointerMove={e => { if (arrastando.current || e.pointerType === 'mouse') apontar(e.clientX) }}
        onPointerLeave={() => { arrastando.current = false; setAtivo(null) }}
        onPointerUp={() => { arrastando.current = false; setAtivo(null) }}
        onPointerCancel={() => { arrastando.current = false; setAtivo(null) }}
        onFocus={() => { setAtivo(points.length - 1) }}
        onBlur={() => { setAtivo(null) }}
        onKeyDown={e => {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
          e.preventDefault()
          const base = ativo ?? points.length - 1
          const passo = e.key === 'ArrowLeft' ? -1 : 1
          setAtivo(Math.min(points.length - 1, Math.max(0, base + passo)))
        }}
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

        {ativo !== null && (
          <line
            x1={x(ativo)} x2={x(ativo)}
            y1={PAD.top} y2={PAD.top + plotH}
            className="serie-guia"
          />
        )}

        {points.map((p, i) => (
          <circle
            key={p.period}
            cx={x(i)} cy={y(p.value)}
            r={i === ativo ? 7 : i === points.length - 1 ? 5 : 3.5}
            className={
              (p.partial === true ? 'serie-ponto serie-ponto-parcial' : 'serie-ponto') +
              (i === ativo ? ' serie-ponto-ativo' : '')
            }
          >
            <title>{`${monthAbbrev(p.period)}: ${format(p.value, unit, decimals)}`}</title>
          </circle>
        ))}

        {points.map((p, i) => (
          <text
            key={p.period}
            x={x(i)} y={H - 10}
            textAnchor="middle"
            className={i === ativo ? 'serie-mes serie-mes-ativo' : 'serie-mes'}
          >
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
