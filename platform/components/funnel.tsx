import type { FunnelStage } from '@/lib/dashboard'
import { format, smallRatio } from '@/lib/format'

/**
 * The funnel, drawn to true scale.
 *
 * Every bar's width is its real fraction of the top stage — not of the stage
 * above it, and not normalised to be comfortable. At this client's numbers that
 * makes the last two bars thinner than a hair, which is the honest picture and
 * the entire argument of the cycle: the attention is enormous and almost none
 * of it reaches the store.
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

export function Funnel ({ stages }: { stages: FunnelStage[] }) {
  if (stages.length === 0) return null

  const pinned = stages.filter(s => s.ofTotal > 0 && s.ofTotal < VISIBLE_THRESHOLD)

  return (
    <figure className="funil">
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
        Cada barra é a fatia real do topo — a mesma régua para as quatro.{' '}
        {pinned.length > 0 && (
          <>
            As {pinned.length === 1 ? 'última' : `${pinned.length} últimas`} são finas
            demais para desenhar nesta escala e estão marcadas com um traço mínimo.
            Não é falha de desenho: é o tamanho real do problema.
          </>
        )}
      </figcaption>
    </figure>
  )
}
