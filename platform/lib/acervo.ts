/**
 * Reading a single post against the rest of her own work.
 *
 * The archive card used to show four raw numbers and nothing else. "110.933
 * views" does not tell anyone whether that post did well — it is a measurement
 * with no ruler beside it, and the person reading it has 205 posts to compare
 * against and no way to do it in her head.
 *
 * Everything here compares a post with HER OWN median, never with an outside
 * benchmark. Views are inflated by looping and the inflation is roughly the
 * same across her account, so the comparison holds inside it and would be
 * meaningless against anybody else's numbers.
 *
 * Pure and free of the database, so the arithmetic can be pinned by tests.
 */

/** How a post sits against the median of the archive. */
export interface Comparacao {
  /** The post's value divided by the median. */
  fator: number
  /** pt-BR, ready to render: `2,4× a mediana` or `40% da mediana`. */
  texto: string
  /** Above, below, or indistinguishable from the middle of her work. */
  nivel: 'acima' | 'tipico' | 'abaixo'
}

/**
 * A band around the median where a post is simply ordinary.
 *
 * Without it, a post 3% above the median would be labelled "above" and one 3%
 * below "below", which dresses noise up as a finding. ±15% is wide enough that
 * the label only appears when something actually happened.
 */
const BANDA_TIPICA = 0.15

/**
 * Where a post sits against the median.
 *
 * @returns `null` when there is nothing to compare — no value, or a median of
 *   zero. Dividing by a zero median yields Infinity, which renders as "∞× a
 *   mediana" on a screen a client reads.
 */
export function compararComMediana (valor: number | null, mediana: number | null): Comparacao | null {
  if (valor === null || mediana === null || mediana <= 0) return null

  const fator = valor / mediana

  const nivel = fator >= 1 + BANDA_TIPICA
    ? 'acima'
    : fator <= 1 - BANDA_TIPICA ? 'abaixo' : 'tipico'

  /* Above the median a multiplier reads naturally — "2,4× a mediana". Below it
     the same shape gives "0,4× a mediana", which people read as a factor of
     four in the wrong direction. A percentage says the same thing without the
     trap. */
  const texto = fator >= 1
    ? `${fator.toFixed(1).replace('.', ',')}× a mediana`
    : `${Math.round(fator * 100)}% da mediana`

  return { fator, texto, nivel }
}

/**
 * Comments per thousand views.
 *
 * Not per reach, because the public export has no reach — and the project's own
 * rule is that a rate must state its base. This one states it in the label on
 * screen: views count loops, so this is not "per thousand people". It is still
 * the only way to compare a post with two million views against one with a
 * hundred thousand.
 */
export function porMilViews (interacoes: number | null, views: number | null): number | null {
  if (interacoes === null || views === null || views <= 0) return null
  return (interacoes / views) * 1000
}

/**
 * The middle of a set of numbers.
 *
 * Median and not mean: this account has posts at 7.4 million views next to
 * posts at 84 thousand, and one viral week would drag an average far above
 * anything typical — making most of her work look like it underperformed.
 */
export function mediana (valores: number[]): number | null {
  const limpos = valores.filter(v => Number.isFinite(v)).sort((a, b) => a - b)
  if (limpos.length === 0) return null

  const meio = Math.floor(limpos.length / 2)
  if (limpos.length % 2 === 1) return limpos[meio] ?? null

  const a = limpos[meio - 1]
  const b = limpos[meio]
  return a === undefined || b === undefined ? null : (a + b) / 2
}
