import { obterBenchmark } from '@/dominio/benchmarks.js'
import type {
  Agregado,
  Benchmark,
  Classificacao,
  Confiabilidade,
  PostAnalisado,
  PostBruto,
  TaxasPost,
} from '@/tipos/index.js'

/**
 * Pesos do score, derivados da ordem de importancia dos sinais de ranqueamento
 * divulgada pelo Instagram: watch time primeiro, depois sends (compartilhamentos)
 * por alcance, depois likes por alcance.
 *
 * Compartilhamento e salvamento pesam mais que curtida porque sinalizam intencao
 * (levar para outra pessoa / voltar depois), nao reacao passiva.
 */
const PESOS = {
  compartilhamentos: 0.35,
  salvamentos: 0.3,
  comentarios: 0.2,
  curtidas: 0.15,
} as const

/** Amostra minima para que uma tendencia seja considerada real, e nao ruido. */
export const MINIMO_POSTS = 7
export const MINIMO_DIAS = 14

/** Arredonda para `casas` decimais, evitando ruido de ponto flutuante. */
export function arredondar(valor: number, casas = 2): number {
  const fator = 10 ** casas
  return Math.round(valor * fator) / fator
}

/**
 * Divide protegendo contra denominador zero ou negativo.
 * Um post com alcance zero nao gera taxa infinita: gera zero.
 */
export function taxaSegura(numerador: number, denominador: number): number {
  if (denominador <= 0) return 0
  return (numerador / denominador) * 100
}

/**
 * Calcula as taxas de um post normalizadas por alcance.
 *
 * Todas as taxas usam alcance como denominador porque e a base que o Instagram
 * usa para ranquear e a unica comparavel entre contas de tamanhos diferentes.
 */
export function calcularTaxas(post: PostBruto): TaxasPost {
  const { alcance } = post
  const curtidasPorAlcance = arredondar(taxaSegura(post.curtidas, alcance))
  const comentariosPorAlcance = arredondar(taxaSegura(post.comentarios, alcance))
  const salvamentosPorAlcance = arredondar(taxaSegura(post.salvamentos, alcance))
  const compartilhamentosPorAlcance = arredondar(taxaSegura(post.compartilhamentos, alcance))

  const interacoes =
    post.curtidas + post.comentarios + post.salvamentos + post.compartilhamentos

  return {
    curtidasPorAlcance,
    comentariosPorAlcance,
    salvamentosPorAlcance,
    compartilhamentosPorAlcance,
    engajamentoTotal: arredondar(taxaSegura(interacoes, alcance)),
    engajamentoDeValor: arredondar(
      taxaSegura(post.salvamentos + post.compartilhamentos, alcance),
    ),
  }
}

/**
 * Converte um valor em uma nota 0-100 usando as faixas do benchmark como ancoras.
 * A interpolacao e linear dentro de cada faixa, o que evita saltos bruscos de nota
 * quando o valor cruza uma fronteira por pouco.
 */
function notaPorFaixa(valor: number, faixa: { critico: number; abaixo: number; naMedia: number; acima: number }): number {
  const ancoras: readonly (readonly [number, number])[] = [
    [0, 0],
    [faixa.critico, 20],
    [faixa.abaixo, 40],
    [faixa.naMedia, 60],
    [faixa.acima, 85],
  ]

  for (let i = ancoras.length - 1; i >= 0; i -= 1) {
    const atual = ancoras[i]
    if (atual === undefined) continue
    const [limite, nota] = atual

    if (valor < limite) continue

    const proxima = ancoras[i + 1]
    if (proxima === undefined) {
      // Acima da ultima ancora: cresce ate 100, saturando em 2x o limite `acima`.
      const excedente = faixa.acima > 0 ? (valor - faixa.acima) / faixa.acima : 1
      return Math.min(100, nota + Math.min(1, excedente) * 15)
    }

    const [limiteProximo, notaProxima] = proxima
    const intervalo = limiteProximo - limite
    if (intervalo <= 0) return nota
    return nota + ((valor - limite) / intervalo) * (notaProxima - nota)
  }

  return 0
}

/**
 * Score 0-100 do post, ponderado pelos sinais que o algoritmo mais premia.
 * Serve para ranquear posts entre si, nao como nota absoluta de qualidade.
 */
export function calcularScore(taxas: TaxasPost, benchmark: Benchmark): number {
  const nota =
    notaPorFaixa(taxas.compartilhamentosPorAlcance, benchmark.compartilhamentosPorAlcance) *
      PESOS.compartilhamentos +
    notaPorFaixa(taxas.salvamentosPorAlcance, benchmark.salvamentosPorAlcance) *
      PESOS.salvamentos +
    notaPorFaixa(taxas.comentariosPorAlcance, benchmark.comentariosPorAlcance) *
      PESOS.comentarios +
    notaPorFaixa(taxas.curtidasPorAlcance, benchmark.curtidasPorAlcance) * PESOS.curtidas

  return arredondar(nota, 1)
}

/** Traduz o score em uma classificacao legivel. */
export function classificarScore(score: number): Classificacao {
  if (score < 20) return 'critico'
  if (score < 40) return 'abaixo'
  if (score < 60) return 'na-media'
  if (score < 85) return 'acima'
  return 'excelente'
}

/** Analisa um post: taxas, score e classificacao. */
export function analisarPost(post: PostBruto, nicho?: string): PostAnalisado {
  const benchmark = obterBenchmark(nicho)
  const taxas = calcularTaxas(post)
  const score = calcularScore(taxas, benchmark)
  return { post, taxas, score, classificacao: classificarScore(score) }
}

/** Media aritmetica; retorna 0 para lista vazia. */
export function media(valores: readonly number[]): number {
  if (valores.length === 0) return 0
  return valores.reduce((soma, v) => soma + v, 0) / valores.length
}

/** Media das taxas de um conjunto de posts ja analisados. */
export function taxasMedias(posts: readonly PostAnalisado[]): TaxasPost {
  return {
    curtidasPorAlcance: arredondar(media(posts.map((p) => p.taxas.curtidasPorAlcance))),
    comentariosPorAlcance: arredondar(media(posts.map((p) => p.taxas.comentariosPorAlcance))),
    salvamentosPorAlcance: arredondar(media(posts.map((p) => p.taxas.salvamentosPorAlcance))),
    compartilhamentosPorAlcance: arredondar(
      media(posts.map((p) => p.taxas.compartilhamentosPorAlcance)),
    ),
    engajamentoTotal: arredondar(media(posts.map((p) => p.taxas.engajamentoTotal))),
    engajamentoDeValor: arredondar(media(posts.map((p) => p.taxas.engajamentoDeValor))),
  }
}

/**
 * Agrupa posts por uma chave e calcula as medias de cada grupo.
 * Grupos sao ordenados por score medio decrescente.
 */
export function agrupar(
  posts: readonly PostAnalisado[],
  obterChave: (p: PostAnalisado) => string | undefined,
): readonly Agregado[] {
  const grupos = new Map<string, PostAnalisado[]>()

  for (const p of posts) {
    const chave = obterChave(p)
    if (chave === undefined || chave === '') continue
    const existente = grupos.get(chave)
    if (existente === undefined) grupos.set(chave, [p])
    else existente.push(p)
  }

  return [...grupos.entries()]
    .map(([chave, itens]) => ({
      chave,
      quantidadePosts: itens.length,
      alcanceMedio: Math.round(media(itens.map((i) => i.post.alcance))),
      taxasMedias: taxasMedias(itens),
      scoreMedio: arredondar(media(itens.map((i) => i.score)), 1),
    }))
    .sort((a, b) => b.scoreMedio - a.scoreMedio)
}

/** Numero de dias distintos cobertos pelos posts. */
export function diasCobertos(posts: readonly PostBruto[]): number {
  if (posts.length === 0) return 0
  const tempos = posts
    .map((p) => new Date(`${p.data}T00:00:00Z`).getTime())
    .filter((t) => Number.isFinite(t))
  if (tempos.length === 0) return 0
  const menor = Math.min(...tempos)
  const maior = Math.max(...tempos)
  return Math.round((maior - menor) / (1000 * 60 * 60 * 24)) + 1
}

/**
 * Avalia se a amostra sustenta uma conclusao.
 *
 * Isso existe para impedir o erro mais comum de analise de social: tirar tendencia
 * de 3 posts. Abaixo do minimo, o resultado ainda e calculado — mas vem com aviso.
 */
export function avaliarConfiabilidade(posts: readonly PostBruto[]): Confiabilidade {
  const quantidadePosts = posts.length
  const dias = diasCobertos(posts)
  const suficiente = quantidadePosts >= MINIMO_POSTS && dias >= MINIMO_DIAS

  if (suficiente) {
    return { suficiente, quantidadePosts, diasCobertos: dias, aviso: null }
  }

  const faltas: string[] = []
  if (quantidadePosts < MINIMO_POSTS) {
    faltas.push(`${quantidadePosts} post(s) — o minimo para tendencia e ${MINIMO_POSTS}`)
  }
  if (dias < MINIMO_DIAS) {
    faltas.push(`${dias} dia(s) cobertos — o minimo e ${MINIMO_DIAS}`)
  }

  return {
    suficiente,
    quantidadePosts,
    diasCobertos: dias,
    aviso: `Amostra insuficiente: ${faltas.join(' e ')}. Trate os numeros como indicio, nao como tendencia.`,
  }
}
