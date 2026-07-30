/**
 * Tipos do dominio de analise de Instagram.
 *
 * Convencao de nomes: campos em portugues, pois o vocabulario do dominio
 * (alcance, salvamentos, compartilhamentos) e o que aparece no Insights em PT-BR.
 */

/** Formato de publicacao. Cada formato tem sistema de ranqueamento proprio no Instagram. */
export type FormatoPost = 'reels' | 'carrossel' | 'imagem' | 'story'

/** Pilar editorial ao qual o post pertence. Livre para permitir pilares customizados. */
export type Pilar = string

/**
 * Um post com suas metricas brutas, exatamente como saem do Instagram Insights.
 * Campos opcionais refletem que nem todo formato expoe toda metrica
 * (ex.: `retencaoMedia` so existe em video).
 */
export interface PostBruto {
  readonly id: string
  readonly data: string
  readonly formato: FormatoPost
  readonly pilar?: Pilar
  readonly legenda?: string
  /** Contas alcancadas. Denominador de todas as taxas. */
  readonly alcance: number
  readonly curtidas: number
  readonly comentarios: number
  readonly salvamentos: number
  /** Compartilhamentos (sends). Sinal de ranqueamento mais forte depois de watch time. */
  readonly compartilhamentos: number
  /** Percentual medio assistido (0-100). Apenas video. */
  readonly retencaoMedia?: number
  /** Percentual de nao-seguidores no alcance (0-100). */
  readonly alcanceNaoSeguidores?: number
  readonly visitasPerfil?: number
  readonly cliquesLink?: number
}

/** Taxas normalizadas por alcance, em percentual (0-100). */
export interface TaxasPost {
  readonly curtidasPorAlcance: number
  readonly comentariosPorAlcance: number
  readonly salvamentosPorAlcance: number
  readonly compartilhamentosPorAlcance: number
  /** Soma das quatro interacoes sobre alcance. */
  readonly engajamentoTotal: number
  /** Salvamentos + compartilhamentos: o que o algoritmo mais premia. */
  readonly engajamentoDeValor: number
}

/** Como uma metrica se compara ao benchmark do nicho. */
export type Classificacao = 'critico' | 'abaixo' | 'na-media' | 'acima' | 'excelente'

/** Post com taxas calculadas e score atribuido. */
export interface PostAnalisado {
  readonly post: PostBruto
  readonly taxas: TaxasPost
  /** Score 0-100 ponderado pelos sinais de ranqueamento. */
  readonly score: number
  readonly classificacao: Classificacao
}

/** Faixas de referencia para uma metrica, em percentual. */
export interface FaixaBenchmark {
  readonly critico: number
  readonly abaixo: number
  readonly naMedia: number
  readonly acima: number
}

/** Conjunto de benchmarks de um nicho, com procedencia. */
export interface Benchmark {
  readonly nicho: string
  readonly fonte: string
  /** ISO 8601 (YYYY-MM-DD). Benchmark com mais de 12 meses deve ser sinalizado. */
  readonly atualizadoEm: string
  readonly curtidasPorAlcance: FaixaBenchmark
  readonly comentariosPorAlcance: FaixaBenchmark
  readonly salvamentosPorAlcance: FaixaBenchmark
  readonly compartilhamentosPorAlcance: FaixaBenchmark
  readonly engajamentoTotal: FaixaBenchmark
  readonly retencaoMedia: FaixaBenchmark
}

/** Severidade de um achado do diagnostico. */
export type Severidade = 'alta' | 'media' | 'baixa'

/** Um achado acionavel produzido pelo diagnostico. */
export interface Achado {
  readonly severidade: Severidade
  readonly titulo: string
  /** O que os dados mostram. */
  readonly evidencia: string
  /** O que fazer a respeito. */
  readonly acao: string
  /** Qual metrica deve se mover se a acao funcionar. */
  readonly metricaAlvo: string
}

/** Agregado de um recorte (por formato ou por pilar). */
export interface Agregado {
  readonly chave: string
  readonly quantidadePosts: number
  readonly alcanceMedio: number
  readonly taxasMedias: TaxasPost
  readonly scoreMedio: number
}

/** Confiabilidade estatistica da amostra analisada. */
export interface Confiabilidade {
  readonly suficiente: boolean
  readonly quantidadePosts: number
  readonly diasCobertos: number
  readonly aviso: string | null
}

/** Resultado completo de uma analise. */
export interface Analise {
  readonly nicho: string
  readonly confiabilidade: Confiabilidade
  readonly totalPosts: number
  readonly alcanceMedio: number
  readonly taxasMedias: TaxasPost
  readonly scoreMedio: number
  readonly porFormato: readonly Agregado[]
  readonly porPilar: readonly Agregado[]
  readonly melhores: readonly PostAnalisado[]
  readonly piores: readonly PostAnalisado[]
  readonly achados: readonly Achado[]
  readonly benchmarkDesatualizado: boolean
}

/** Direcao da variacao entre dois periodos. */
export type Direcao = 'subiu' | 'caiu' | 'estavel'

/** Variacao de uma metrica entre dois periodos. */
export interface Variacao {
  readonly metrica: string
  readonly anterior: number
  readonly atual: number
  /** Diferenca percentual relativa. Zero quando o valor anterior e zero. */
  readonly deltaPercentual: number
  readonly direcao: Direcao
}

/** Resultado da comparacao entre dois periodos. */
export interface Comparacao {
  readonly variacoes: readonly Variacao[]
  readonly resumo: string
}

/** Erro de parsing de uma linha de CSV. */
export interface ErroLinha {
  readonly linha: number
  readonly motivo: string
}

/** Resultado do parsing de um CSV: o que deu certo e o que falhou. */
export interface ResultadoParse {
  readonly posts: readonly PostBruto[]
  readonly erros: readonly ErroLinha[]
}
