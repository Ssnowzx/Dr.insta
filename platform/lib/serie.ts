/**
 * The pure half of the series chart's interaction.
 *
 * It lives apart from `components/series.tsx` because that file is a client
 * component full of pointer plumbing and SVG, and none of that can be tested
 * without a browser. The arithmetic that decides WHICH point a finger is on is
 * the part that can be wrong in a way nobody notices — an off-by-one at the
 * edges, or a value that reads the month before the one being touched — so it
 * is separated out and pinned down here.
 */

/** Geometry of the plot, shared with the component so the two cannot drift. */
export interface Plot {
  /** viewBox width. */
  width: number
  /** Left inset of the plotting area, in viewBox units. */
  padLeft: number
  /** Right inset of the plotting area, in viewBox units. */
  padRight: number
}

/**
 * Which point a pointer at `clientX` is nearest to.
 *
 * The SVG is drawn in viewBox units and displayed at whatever width the column
 * happens to be, so the pointer's page coordinate has to be mapped back through
 * the element's rendered box before it means anything. Reading `clientX`
 * against viewBox units directly is the bug this function exists to prevent:
 * it works at exactly one screen width and is wrong everywhere else.
 *
 * The result is clamped rather than left out of range. A finger that slides
 * past the last month should hold the last month, not report nothing — on a
 * phone the plot is a couple of hundred pixels wide and overshooting it is the
 * normal case, not the exception.
 *
 * @param clientX  Pointer position, in CSS pixels, from the viewport's left.
 * @param box      The SVG's rendered box, from `getBoundingClientRect()`.
 * @param total    How many points the series has.
 * @returns The index, or `null` when there is nothing to point at.
 */
export function pontoMaisProximo (
  clientX: number,
  box: { left: number; width: number },
  total: number,
  plot: Plot
): number | null {
  if (total <= 0 || box.width <= 0) return null
  if (total === 1) return 0

  /* Page pixels -> viewBox units. */
  const emViewBox = ((clientX - box.left) / box.width) * plot.width

  const larguraPlot = plot.width - plot.padLeft - plot.padRight
  if (larguraPlot <= 0) return null

  const fracao = (emViewBox - plot.padLeft) / larguraPlot
  const indice = Math.round(fracao * (total - 1))

  return Math.min(total - 1, Math.max(0, indice))
}

/**
 * Change from one point to the next, as a ratio.
 *
 * `null` when there is no previous point, and also when the previous value is
 * zero: a jump from nothing to something is not a percentage, and rendering it
 * as one produces "+∞%" or a silent division that shows up as `NaN` on screen.
 */
export function variacao (anterior: number | undefined, atual: number): number | null {
  if (anterior === undefined || anterior === 0) return null
  return (atual - anterior) / anterior
}
