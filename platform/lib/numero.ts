/**
 * Reading a number the way a Brazilian types it.
 *
 * THIS IS THE MOST DANGEROUS PARSE IN THE PRODUCT
 *
 * "347.482" is three hundred and forty-seven thousand in pt-BR and three
 * hundred and forty-seven point four in `Number()`. A thousand-fold error, in
 * the number that is the second step of the funnel, entering the database
 * looking perfectly plausible. Every rate computed from it would be wrong and
 * nothing downstream would break.
 *
 * So the rule is stated rather than inferred:
 *
 *   · comma is ALWAYS the decimal separator
 *   · dot is ALWAYS a thousands separator
 *
 * That is unambiguous for anyone typing on a Brazilian keyboard, which is the
 * only person who uses this field. It deliberately refuses to be clever about
 * "1.5" — in pt-BR that is one thousand five hundred written badly, and a
 * parser that guesses gets it right for one person and wrong for the other.
 *
 * Pure, and tested to the point of tedium, because a wrong answer here is
 * silent forever.
 */

export type Unidade = 'count' | 'ratio'

export interface Lido {
  ok: boolean
  /** Stored form: a count as itself, a ratio as a ratio (12,5% -> 0.125). */
  valor?: number
  /** What to say to her. Never "invalid input". */
  erro?: string
}

/** Digits, separators, spaces and a percent sign. Everything else is a typo. */
const ACEITO = /^[0-9.,\s%]+$/

/**
 * A thousands group is exactly three digits, and that is what makes "1.5"
 * detectable as a mistake rather than silently read as 1.5 or as 15.
 */
const MILHAR_VALIDO = /^\d{1,3}(\.\d{3})*$/

export function lerNumero (bruto: string, unidade: Unidade = 'count'): Lido {
  const texto = bruto.trim()

  if (texto === '') return { ok: false, erro: 'Escreva o número.' }

  if (!ACEITO.test(texto)) {
    return {
      ok: false,
      erro: 'Use só números. Pode escrever com ponto e vírgula, como aparece no Instagram — 347.482.'
    }
  }

  const limpo = texto.replace(/[\s%]/g, '')

  const virgulas = (limpo.match(/,/g) ?? []).length
  if (virgulas > 1) {
    return { ok: false, erro: 'Tem mais de uma vírgula. A vírgula marca a casa decimal, e só entra uma vez.' }
  }

  const [inteira = '', decimal = ''] = limpo.split(',')

  if (inteira === '') {
    return { ok: false, erro: 'Faltou a parte antes da vírgula.' }
  }

  /* The dot has to be a thousands separator or not be there. "1.5" reaches here
     and is refused rather than guessed at — it is 1,5 typed with the wrong key,
     or 1.500 typed short, and picking one of those silently is how a number
     ends up a thousand times wrong. */
  if (inteira.includes('.') && !MILHAR_VALIDO.test(inteira)) {
    return {
      ok: false,
      erro: 'O ponto separa os milhares e precisa de três dígitos depois — 347.482. Se for casa decimal, use vírgula.'
    }
  }

  if (decimal.includes('.')) {
    return { ok: false, erro: 'Depois da vírgula vêm só dígitos.' }
  }

  const n = Number(`${inteira.replace(/\./g, '')}.${decimal === '' ? '0' : decimal}`)

  if (!Number.isFinite(n)) return { ok: false, erro: 'Não consegui ler esse número.' }
  if (n < 0) return { ok: false, erro: 'Não pode ser negativo.' }

  if (unidade === 'count') {
    if (!Number.isInteger(n)) {
      return { ok: false, erro: 'Esse número é uma contagem — não tem casa decimal.' }
    }
    return { ok: true, valor: n }
  }

  /* ONE RULE: what she types is the percentage as displayed, sign or no sign.
     "12,5" and "12,5%" are both 12,5%. Stored as a ratio, because the schema
     stores ratios as ratios and the ×100 lives in `lib/format.ts` alone.

     There was a second branch here — "a value under 1 is already a ratio" —
     and it contradicted the comment above it, which is how the test caught it.
     Cleverness in a parser buys a correct guess for one person and a silent
     thousand-fold error for the next; the rule that can be stated in one
     sentence is the one that gets typed correctly. */
  if (n > 100) {
    return { ok: false, erro: 'Uma porcentagem não passa de 100%.' }
  }

  return { ok: true, valor: n / 100 }
}

/**
 * The stored value back as she would write it — for showing what was saved.
 *
 * Not `Intl` with a currency or a unit: this is an echo of her own input, and
 * it has to look like what she typed or the confirmation does not confirm.
 */
export function escreverNumero (valor: number, unidade: Unidade = 'count'): string {
  if (unidade === 'ratio') {
    return `${new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 0, maximumFractionDigits: 2
    }).format(valor * 100)}%`
  }
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(valor)
}
