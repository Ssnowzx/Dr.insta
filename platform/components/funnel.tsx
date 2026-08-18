import type { FunnelStage } from '@/lib/dashboard'
import { format, smallRatio } from '@/lib/format'

/**
 * The funnel, drawn to true scale.
 *
 * Every bar's width is its real fraction of the top stage — not of the stage
 * above it, and not normalised to be comfortable. At this client's numbers that
 * makes the last two bars thinner than a hair, which is the honest picture and
 * the entire argument of the cycle: the attention is enormous and almost none
 * of it turns into someone deciding to follow.
 *
 * A conventional funnel chart normalises each stage against the previous one,
 * so every stage looks substantial and the collapse disappears. That version
 * would be prettier and would say nothing.
 *
 * Bars below the visible threshold are pinned to a minimum width and marked, so
 * a sliver reads as "too small to draw" rather than as a rendering bug. The
 * number beside it carries the real value either way.
 *
 * Built from CSS percentages rather than SVG: it stays sharp and responsive at
 * any container width with no viewBox arithmetic, and the rounded data-end
 * survives without a distorting preserveAspectRatio.
 */

/** Below this share of the track, a bar is drawn at a fixed sliver width. */
const VISIBLE_THRESHOLD = 0.004

/**
 * Small counts spelled out, because this is prose and not a figure.
 *
 * The version that interpolated the number read "As última são finas demais"
 * when exactly one bar was pinned — the singular branch dropped the count and
 * left the article and the verb in the plural. Three stages instead of four is
 * what made it happen, and it went out to production.
 */
const EXTENSO = ['zero', 'uma', 'duas', 'três', 'quatro', 'cinco', 'seis']

export function porExtenso (n: number): string {
  return EXTENSO[n] ?? String(n)
}

/**
 * `resumo` draws the top-to-bottom statement above the bars.
 *
 * Off when the page already states those two numbers — the panel's plate does,
 * and two identical collapse blocks one under the other read as a rendering
 * bug rather than as emphasis.
 */
export function Funnel (
  { stages, resumo = true }: { stages: FunnelStage[]; resumo?: boolean }
) {
  if (stages.length === 0) return null

  const pinned = stages.filter(s => s.ofTotal > 0 && s.ofTotal < VISIBLE_THRESHOLD)

  /* The whole argument in one line, before any bar is read: how many arrived at
     the top, how many reached the bottom. The bars below prove it; this states
     it. Without it the reader has to hold two numbers eight lines apart and do
     the division, and most people simply do not. */
  const top = stages[0]
  const bottom = stages[stages.length - 1]

  return (
    <figure className="funil">
      {resumo && top !== undefined && bottom !== undefined && stages.length > 1 && (
        <div className="colapso">
          <div className="colapso-lado">
            <span className="numero numero-grande colapso-n">{format(top.value, 'count')}</span>
            <span className="colapso-rot">{top.label}</span>
          </div>

          <div className="colapso-meio" aria-hidden="true">
            <span className="colapso-regua" />
            <span className="numero colapso-taxa">{smallRatio(bottom.ofTotal)}</span>
          </div>

          <div className="colapso-lado colapso-lado-fim">
            <span className="numero numero-grande colapso-n">{format(bottom.value, 'count')}</span>
            <span className="colapso-rot">{bottom.label}</span>
          </div>
        </div>
      )}

      <ol className="funil-lista">
        {stages.map(stage => {
          const tooSmall = stage.ofTotal > 0 && stage.ofTotal < VISIBLE_THRESHOLD
          const width = tooSmall ? VISIBLE_THRESHOLD : stage.ofTotal

          return (
            <li key={stage.key} className="funil-etapa">
              <div className="funil-cab">
                <span className="funil-rot">{stage.label}</span>
                <span className="numero funil-valor">
                  {format(stage.value, 'count')}
                </span>
              </div>

              <div className="funil-trilho">
                <div
                  className={tooSmall ? 'funil-barra funil-barra-fina' : 'funil-barra'}
                  style={{ width: `${(width * 100).toFixed(4)}%` }}
                />
              </div>

              <div className="funil-pe">
                <span className="numero funil-parte">{smallRatio(stage.ofTotal)}</span>
                <span className="funil-parte-rot">de quem viu você</span>
                {stage.survival !== null && (
                  <span className="funil-sobrevida">
                    {smallRatio(stage.survival)} do passo acima
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      <figcaption className="funil-nota">
        Cada barra é a fatia real do topo — a mesma régua para as {porExtenso(stages.length)}.{' '}
        {pinned.length === 1 && (
          <>
            A última é fina demais para desenhar nesta escala e está marcada com um
            traço mínimo. Não é falha de desenho: é o tamanho real do problema.
          </>
        )}
        {pinned.length > 1 && (
          <>
            As {porExtenso(pinned.length)} últimas são finas demais para desenhar
            nesta escala e estão marcadas com um traço mínimo. Não é falha de
            desenho: é o tamanho real do problema.
          </>
        )}
      </figcaption>
    </figure>
  )
}
