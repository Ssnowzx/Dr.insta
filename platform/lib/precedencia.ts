/**
 * Which number wins when the same indicator arrives from more than one source.
 *
 * This file exists ahead of the collection that makes it necessary, and that
 * order is deliberate. `metric_value` is keyed on
 * `(client, metric_def, period, granularity, source)`, so two sources for the
 * same metric and period are two rows — by design, which is how July revenue
 * exists as both `store` and `manual`. The dashboard reaches them through a
 * `leftJoin`, and a join that matches twice renders the card twice. Today no
 * measured metric has two sources; the day the API writes `reach` for a month
 * that was already transcribed, every one of them does.
 *
 * The rule: an instrument beats a person. `api` is the official source
 * answering a request, `insights` is someone reading the app and typing what
 * they saw, `manual` is a figure reported with no instrument behind it. `store`
 * and `ga4` measure what Instagram does not, so in practice they never contend
 * with `api` — they are ordered anyway, because a partial order leaves the
 * winner to whatever the database happened to return first.
 *
 * Pure: no I/O, no clock. Everything it needs arrives as an argument.
 */

/** Highest precedence first. Anything absent here sorts last. */
const ORDEM = ['api', 'store', 'ga4', 'insights', 'manual', 'public'] as const

export type Origem = typeof ORDEM[number]

/**
 * Sources a figure may be decided on, in one place.
 *
 * It lives here because it was written out three times in `dashboard.ts` and
 * adding `api` to one of them was not enough: the funnel and the "latest
 * period" query kept their own copies and silently ignored the new source. The
 * panel went on showing the transcribed number while the collected one sat in
 * the table — no error, no empty screen, just a stale figure.
 *
 * `manual` is excluded: a reported figure is not a measurement. `public` is
 * excluded because its views count looping, so it is not a count of people.
 */
export const ORIGENS_MEDIDAS = ['api', 'insights', 'ga4', 'store'] as const

const POSICAO = new Map<string, number>(ORDEM.map((origem, i) => [origem, i]))

/**
 * Rank of a source. Lower wins.
 *
 * An unknown source sorts last rather than throwing: a value someone added
 * straight into the database should not blank a screen, and it will lose to
 * anything declared.
 */
export function posicao (origem: string | null): number {
  if (origem === null) return ORDEM.length
  return POSICAO.get(origem) ?? ORDEM.length
}

/** The minimum a row needs for precedence to apply to it. */
export interface ComOrigem {
  source: string | null
  value: number | null
}

export interface Resolvido<T extends ComOrigem> {
  /** The row the screen shows. */
  escolhido: T
  /**
   * Rows that lost AND disagree with the winner.
   *
   * Only disagreements: two sources reporting the same figure is agreement, and
   * showing it as a divergence would turn a confirmation into a doubt. Two that
   * differ are information about how much to trust the number, and hiding the
   * loser turns disagreement into false certainty.
   */
  divergentes: T[]
}

/**
 * Picks one row and reports meaningful disagreement.
 *
 * A row with no value never wins over one that has a value, however high its
 * source ranks — precedence decides between numbers, and an absent number is
 * not a number. This matters as soon as collection runs: the API answering
 * "nothing for this period" must not blank a figure that was transcribed by
 * hand.
 */
export function resolver<T extends ComOrigem> (linhas: T[]): Resolvido<T> | null {
  if (linhas.length === 0) return null

  const ordenadas = [...linhas].sort((a, b) => {
    const aTem = a.value !== null
    const bTem = b.value !== null
    if (aTem !== bTem) return aTem ? -1 : 1
    return posicao(a.source) - posicao(b.source)
  })

  const escolhido = ordenadas[0] as T

  const divergentes = ordenadas
    .slice(1)
    .filter(linha => linha.value !== null && linha.value !== escolhido.value)

  return { escolhido, divergentes }
}

/**
 * Same rule, applied per group.
 *
 * `chave` names the group — in practice the metric definition. Insertion order
 * of the first appearance of each key is preserved, so a caller that ordered
 * its query keeps that order.
 */
export function resolverPorChave<T extends ComOrigem> (
  linhas: T[],
  chave: (linha: T) => string | number
): Array<Resolvido<T>> {
  const grupos = new Map<string | number, T[]>()

  for (const linha of linhas) {
    const k = chave(linha)
    const atual = grupos.get(k)
    if (atual === undefined) grupos.set(k, [linha])
    else atual.push(linha)
  }

  const saida: Array<Resolvido<T>> = []
  for (const grupo of grupos.values()) {
    const resolvido = resolver(grupo)
    if (resolvido !== null) saida.push(resolvido)
  }

  return saida
}
