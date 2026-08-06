/**
 * Where a number came from, in words she can act on.
 *
 * Every metric in this product already carries its source and its measurement
 * recipe in the database — and neither ever reached the screen. The gap was
 * found by the consultant asking, out loud, where "23 purchases" came from and
 * whether it was an average. If he had to ask, she will.
 *
 * A dashboard whose whole argument is provenance cannot show a figure and hide
 * where it was read. Especially this one: the numbers arrive by hand, from four
 * different panels, and two of them disagree about revenue on purpose.
 */

/** The sources a metric value can come from. Mirrors the `source` enum. */
export type Origem = 'insights' | 'ga4' | 'store' | 'public' | 'manual'

interface Descricao {
  /** Short label, for the badge. */
  curto: string
  /** What it means for the number's trustworthiness. */
  longo: string
  /** Measured by an instrument, or typed in by a person. */
  medido: boolean
}

const ORIGENS: Record<Origem, Descricao> = {
  insights: {
    curto: 'Instagram',
    longo: 'Lido nos Insights da sua conta.',
    medido: true
  },
  ga4: {
    curto: 'GA4',
    longo: 'Contado pelo Google Analytics quando a pessoa chega na loja.',
    medido: true
  },
  store: {
    curto: 'loja',
    longo: 'Vem do painel da loja, por origem do pedido.',
    medido: true
  },
  public: {
    curto: 'público',
    longo: 'Somado da exportação pública dos seus Reels. Views contam looping, então não são pessoas diferentes.',
    medido: true
  },
  manual: {
    /* Kept visible rather than hidden: a number somebody typed is not the same
       kind of number as one an instrument counted, and the screen has to say
       which is which before anyone decides anything on it. */
    curto: 'informado',
    longo: 'Número informado por você, não medido por ferramenta.',
    medido: false
  }
}

export function descreverOrigem (origem: string | null): Descricao | null {
  if (origem === null) return null
  return ORIGENS[origem as Origem] ?? null
}
