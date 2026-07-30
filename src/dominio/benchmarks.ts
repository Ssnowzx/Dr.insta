import type { Benchmark, Classificacao, FaixaBenchmark } from '@/tipos/index.js'

/**
 * Benchmarks de referencia por nicho, em percentual sobre ALCANCE.
 *
 * Atencao: a maior parte dos relatorios publicos de mercado divulga engajamento
 * sobre SEGUIDORES, numero que nao e comparavel ao que o Instagram Insights mostra
 * por alcance. Os valores aqui foram convertidos para base-alcance, que e a base
 * que o algoritmo usa para ranquear e a unica comparavel entre contas de tamanhos
 * diferentes.
 *
 * Toda entrada carrega `fonte` e `atualizadoEm`. Benchmark com mais de 12 meses
 * deve ser sinalizado ao usuario (ver `estaDesatualizado`).
 */

const FONTE_PADRAO =
  'Compilado de Hootsuite Social Media Benchmarks 2026, Rival IQ Social Media Industry Benchmark Report e dados publicos de ranqueamento divulgados por Adam Mosseri (Instagram)'

const ATUALIZADO_EM = '2026-01-15'

/** Nicho usado quando nenhum e informado. */
export const NICHO_PADRAO = 'negocios-marketing'

const NEGOCIOS_MARKETING: Benchmark = {
  nicho: NICHO_PADRAO,
  fonte: FONTE_PADRAO,
  atualizadoEm: ATUALIZADO_EM,
  curtidasPorAlcance: { critico: 1.5, abaixo: 3, naMedia: 6, acima: 10 },
  comentariosPorAlcance: { critico: 0.05, abaixo: 0.15, naMedia: 0.4, acima: 0.8 },
  salvamentosPorAlcance: { critico: 0.3, abaixo: 0.8, naMedia: 2, acima: 4 },
  compartilhamentosPorAlcance: { critico: 0.2, abaixo: 0.6, naMedia: 1.5, acima: 3 },
  engajamentoTotal: { critico: 2, abaixo: 4.5, naMedia: 9, acima: 15 },
  retencaoMedia: { critico: 20, abaixo: 30, naMedia: 45, acima: 60 },
}

const TECH_SOFTWARE: Benchmark = {
  nicho: 'tech-software',
  fonte: FONTE_PADRAO,
  atualizadoEm: ATUALIZADO_EM,
  curtidasPorAlcance: { critico: 1.2, abaixo: 2.5, naMedia: 5, acima: 8.5 },
  comentariosPorAlcance: { critico: 0.04, abaixo: 0.12, naMedia: 0.35, acima: 0.7 },
  salvamentosPorAlcance: { critico: 0.4, abaixo: 1, naMedia: 2.5, acima: 5 },
  compartilhamentosPorAlcance: { critico: 0.2, abaixo: 0.5, naMedia: 1.3, acima: 2.8 },
  engajamentoTotal: { critico: 1.8, abaixo: 4, naMedia: 8.5, acima: 14 },
  retencaoMedia: { critico: 20, abaixo: 30, naMedia: 45, acima: 60 },
}

const LIFESTYLE: Benchmark = {
  nicho: 'lifestyle',
  fonte: FONTE_PADRAO,
  atualizadoEm: ATUALIZADO_EM,
  curtidasPorAlcance: { critico: 2, abaixo: 4, naMedia: 8, acima: 13 },
  comentariosPorAlcance: { critico: 0.06, abaixo: 0.2, naMedia: 0.5, acima: 1 },
  salvamentosPorAlcance: { critico: 0.2, abaixo: 0.5, naMedia: 1.4, acima: 3 },
  compartilhamentosPorAlcance: { critico: 0.2, abaixo: 0.6, naMedia: 1.6, acima: 3.2 },
  engajamentoTotal: { critico: 2.5, abaixo: 5.5, naMedia: 11, acima: 18 },
  retencaoMedia: { critico: 22, abaixo: 32, naMedia: 48, acima: 63 },
}

const CATALOGO: ReadonlyMap<string, Benchmark> = new Map([
  [NEGOCIOS_MARKETING.nicho, NEGOCIOS_MARKETING],
  [TECH_SOFTWARE.nicho, TECH_SOFTWARE],
  [LIFESTYLE.nicho, LIFESTYLE],
])

/** Nichos disponiveis no catalogo. */
export function listarNichos(): readonly string[] {
  return [...CATALOGO.keys()]
}

/**
 * Retorna o benchmark do nicho. Cai no nicho padrao quando o nome nao existe,
 * para que uma analise nunca seja bloqueada por um rotulo desconhecido.
 */
export function obterBenchmark(nicho: string = NICHO_PADRAO): Benchmark {
  const encontrado = CATALOGO.get(nicho.trim().toLowerCase())
  if (encontrado !== undefined) return encontrado

  const padrao = CATALOGO.get(NICHO_PADRAO)
  /* c8 ignore next -- o nicho padrao esta sempre no catalogo; guarda apenas para satisfazer o tipo */
  if (padrao === undefined) throw new Error(`Nicho padrao ausente do catalogo: ${NICHO_PADRAO}`)
  return padrao
}

/** Classifica um valor contra uma faixa de referencia. */
export function classificar(valor: number, faixa: FaixaBenchmark): Classificacao {
  if (valor < faixa.critico) return 'critico'
  if (valor < faixa.abaixo) return 'abaixo'
  if (valor < faixa.naMedia) return 'na-media'
  if (valor < faixa.acima) return 'acima'
  return 'excelente'
}

/**
 * Indica se o benchmark passou de 12 meses e merece revisao.
 * A data de referencia entra por parametro para manter o dominio deterministico.
 */
export function estaDesatualizado(benchmark: Benchmark, referencia: Date): boolean {
  const atualizacao = new Date(`${benchmark.atualizadoEm}T00:00:00Z`)
  const meses =
    (referencia.getTime() - atualizacao.getTime()) / (1000 * 60 * 60 * 24 * 365.25 / 12)
  return meses > 12
}
