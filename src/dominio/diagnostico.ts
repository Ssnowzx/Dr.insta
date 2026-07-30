import { classificar, estaDesatualizado, obterBenchmark } from '@/dominio/benchmarks.js'
import {
  agrupar,
  analisarPost,
  arredondar,
  avaliarConfiabilidade,
  media,
  taxasMedias,
} from '@/dominio/metricas.js'
import type {
  Achado,
  Analise,
  Comparacao,
  Direcao,
  PostAnalisado,
  PostBruto,
  TaxasPost,
  Variacao,
} from '@/tipos/index.js'

/** Quantos posts entram nas listas de melhores e piores. */
const TOP_N = 3

/** Diferenca relativa minima para tratar uma variacao como movimento real. */
const LIMIAR_ESTAVEL = 5

/**
 * Gera achados acionaveis a partir das taxas medias e dos agregados.
 *
 * Um achado so entra na lista se tiver acao associada e metrica alvo. Observacao
 * sem acao e ruido: ocupa espaco no relatorio e nao muda comportamento nenhum.
 */
export function gerarAchados(
  posts: readonly PostAnalisado[],
  medias: TaxasPost,
  nicho?: string,
): readonly Achado[] {
  const benchmark = obterBenchmark(nicho)
  const achados: Achado[] = []

  // Sinal #2 de ranqueamento. O que mais desbloqueia alcance de nao-seguidores.
  const classCompart = classificar(
    medias.compartilhamentosPorAlcance,
    benchmark.compartilhamentosPorAlcance,
  )
  if (classCompart === 'critico' || classCompart === 'abaixo') {
    achados.push({
      severidade: classCompart === 'critico' ? 'alta' : 'media',
      titulo: 'Compartilhamentos abaixo do esperado',
      evidencia: `sends/reach medio de ${medias.compartilhamentosPorAlcance}% contra referencia de ${benchmark.compartilhamentosPorAlcance.naMedia}% para o nicho.`,
      acao: 'Escreva pautas com gatilho de envio explicito — conteudo que serve de recado ("manda pra quem precisa ver") ou que da identidade ("isso sou eu"). Compartilhamento vem de utilidade social, nao de qualidade percebida.',
      metricaAlvo: 'compartilhamentos/alcance',
    })
  }

  // Sinal de intencao de retorno; sustenta distribuicao de cauda longa.
  const classSalv = classificar(medias.salvamentosPorAlcance, benchmark.salvamentosPorAlcance)
  if (classSalv === 'critico' || classSalv === 'abaixo') {
    achados.push({
      severidade: classSalv === 'critico' ? 'alta' : 'media',
      titulo: 'Salvamentos abaixo do esperado',
      evidencia: `saves/reach medio de ${medias.salvamentosPorAlcance}% contra referencia de ${benchmark.salvamentosPorAlcance.naMedia}%.`,
      acao: 'Produza conteudo que a pessoa precise consultar depois: checklist, passo a passo numerado, script pronto. Se o conteudo se esgota na leitura, nao ha razao para salvar.',
      metricaAlvo: 'salvamentos/alcance',
    })
  }

  // Comentario e o insumo direto da metrica-norte do ciclo (comunidade).
  const classCom = classificar(medias.comentariosPorAlcance, benchmark.comentariosPorAlcance)
  if (classCom === 'critico' || classCom === 'abaixo') {
    achados.push({
      severidade: 'alta',
      titulo: 'Comentarios abaixo do esperado',
      evidencia: `comentarios/alcance medio de ${medias.comentariosPorAlcance}% contra referencia de ${benchmark.comentariosPorAlcance.naMedia}%.`,
      acao: 'Termine os posts com uma pergunta que so essa audiencia consegue responder — especifica e com baixo custo de resposta. Responda todo comentario nas primeiras 2h; a janela inicial de interacao concentra a distribuicao.',
      metricaAlvo: 'comentarios/alcance',
    })
  }

  // Curtida alta com valor baixo indica conteudo agradavel porem descartavel.
  const curtidaAlta =
    medias.curtidasPorAlcance >= benchmark.curtidasPorAlcance.naMedia
  const valorBaixo =
    medias.engajamentoDeValor <
    benchmark.salvamentosPorAlcance.abaixo + benchmark.compartilhamentosPorAlcance.abaixo
  if (curtidaAlta && valorBaixo) {
    achados.push({
      severidade: 'media',
      titulo: 'Engajamento raso: muita curtida, pouco salvamento e compartilhamento',
      evidencia: `curtidas/alcance de ${medias.curtidasPorAlcance}% mas engajamento de valor de apenas ${medias.engajamentoDeValor}%.`,
      acao: 'O conteudo agrada mas nao e util nem compartilhavel. Troque parte do volume de conteudo de reforco ("isso e verdade") por conteudo de aplicacao ("faca assim") e de posicionamento ("discordo disso").',
      metricaAlvo: 'engajamento de valor (saves + sends)/alcance',
    })
  }

  // Retencao e o sinal #1 para video; so avaliar quando ha dado.
  const comRetencao = posts.filter((p) => p.post.retencaoMedia !== undefined)
  if (comRetencao.length >= 3) {
    const retencaoMedia = arredondar(
      media(comRetencao.map((p) => p.post.retencaoMedia ?? 0)),
    )
    const classRet = classificar(retencaoMedia, benchmark.retencaoMedia)
    if (classRet === 'critico' || classRet === 'abaixo') {
      achados.push({
        severidade: 'alta',
        titulo: 'Retencao de video abaixo do esperado',
        evidencia: `retencao media de ${retencaoMedia}% em ${comRetencao.length} videos, contra referencia de ${benchmark.retencaoMedia.naMedia}%.`,
        acao: 'O problema quase sempre esta nos 3 primeiros segundos. Comece pelo resultado ou pela tensao, corte qualquer introducao e elimine saudacao. Watch time e o sinal de ranqueamento mais forte para Reels.',
        metricaAlvo: 'retencao media (%)',
      })
    }
  }

  // Diferenca grande entre formatos e a alavanca mais barata que existe.
  const porFormato = agrupar(posts, (p) => p.post.formato)
  const melhorFormato = porFormato[0]
  const piorFormato = porFormato[porFormato.length - 1]
  if (
    melhorFormato !== undefined &&
    piorFormato !== undefined &&
    porFormato.length >= 2 &&
    melhorFormato.quantidadePosts >= 2 &&
    piorFormato.quantidadePosts >= 2 &&
    melhorFormato.scoreMedio - piorFormato.scoreMedio >= 15
  ) {
    achados.push({
      severidade: 'media',
      titulo: `Formato "${melhorFormato.chave}" rende muito mais que "${piorFormato.chave}"`,
      evidencia: `score medio ${melhorFormato.scoreMedio} (${melhorFormato.quantidadePosts} posts) contra ${piorFormato.scoreMedio} (${piorFormato.quantidadePosts} posts).`,
      acao: `Realoque volume de "${piorFormato.chave}" para "${melhorFormato.chave}" por 2 semanas e reavalie. Nao zere o formato fraco — mantenha uma amostra para nao perder a leitura.`,
      metricaAlvo: 'score medio por formato',
    })
  }

  // Mesma logica para pilar: mostra que assunto a audiencia realmente quer.
  const porPilar = agrupar(posts, (p) => p.post.pilar)
  const melhorPilar = porPilar[0]
  const piorPilar = porPilar[porPilar.length - 1]
  if (
    melhorPilar !== undefined &&
    piorPilar !== undefined &&
    porPilar.length >= 2 &&
    melhorPilar.quantidadePosts >= 2 &&
    piorPilar.quantidadePosts >= 2 &&
    melhorPilar.scoreMedio - piorPilar.scoreMedio >= 15
  ) {
    achados.push({
      severidade: 'baixa',
      titulo: `Pilar "${melhorPilar.chave}" performa acima de "${piorPilar.chave}"`,
      evidencia: `score medio ${melhorPilar.scoreMedio} contra ${piorPilar.scoreMedio}.`,
      acao: `Aumente a fatia de "${melhorPilar.chave}" no mix. Antes de cortar "${piorPilar.chave}", teste mudar o formato dele — o assunto pode estar certo e a embalagem errada.`,
      metricaAlvo: 'score medio por pilar',
    })
  }

  if (achados.length === 0) {
    achados.push({
      severidade: 'baixa',
      titulo: 'Nenhum gargalo evidente nas metricas medias',
      evidencia: `engajamento total medio de ${medias.engajamentoTotal}%, dentro ou acima da referencia do nicho.`,
      acao: 'Passe de otimizacao para escala: aumente frequencia no formato de maior score mantendo o padrao de qualidade, e comece a testar alcance de nao-seguidores via colaboracoes.',
      metricaAlvo: 'alcance de nao-seguidores (%)',
    })
  }

  const ordem = { alta: 0, media: 1, baixa: 2 } as const
  return achados.sort((a, b) => ordem[a.severidade] - ordem[b.severidade])
}

/**
 * Analisa um conjunto de posts de ponta a ponta.
 *
 * `referencia` entra por parametro (e nao via `new Date()`) para manter o dominio
 * deterministico e testavel.
 */
export function analisar(
  posts: readonly PostBruto[],
  nicho?: string,
  referencia: Date = new Date(0),
): Analise {
  const benchmark = obterBenchmark(nicho)
  const analisados = posts.map((p) => analisarPost(p, nicho))
  const medias = taxasMedias(analisados)

  const ordenados = [...analisados].sort((a, b) => b.score - a.score)

  return {
    nicho: benchmark.nicho,
    confiabilidade: avaliarConfiabilidade(posts),
    totalPosts: posts.length,
    alcanceMedio: Math.round(media(posts.map((p) => p.alcance))),
    taxasMedias: medias,
    scoreMedio: arredondar(media(analisados.map((a) => a.score)), 1),
    porFormato: agrupar(analisados, (p) => p.post.formato),
    porPilar: agrupar(analisados, (p) => p.post.pilar),
    melhores: ordenados.slice(0, TOP_N),
    piores: ordenados.slice(-TOP_N).reverse(),
    achados: gerarAchados(analisados, medias, nicho),
    benchmarkDesatualizado: estaDesatualizado(benchmark, referencia),
  }
}

/** Variacao relativa entre dois valores, com direcao. */
export function calcularVariacao(metrica: string, anterior: number, atual: number): Variacao {
  const deltaPercentual =
    anterior === 0 ? 0 : arredondar(((atual - anterior) / Math.abs(anterior)) * 100, 1)

  let direcao: Direcao = 'estavel'
  if (Math.abs(deltaPercentual) >= LIMIAR_ESTAVEL) {
    direcao = deltaPercentual > 0 ? 'subiu' : 'caiu'
  }

  return { metrica, anterior, atual, deltaPercentual, direcao }
}

/** Compara duas analises e resume o que mudou. */
export function comparar(anterior: Analise, atual: Analise): Comparacao {
  const variacoes: readonly Variacao[] = [
    calcularVariacao('alcance medio', anterior.alcanceMedio, atual.alcanceMedio),
    calcularVariacao('score medio', anterior.scoreMedio, atual.scoreMedio),
    calcularVariacao(
      'engajamento total (%)',
      anterior.taxasMedias.engajamentoTotal,
      atual.taxasMedias.engajamentoTotal,
    ),
    calcularVariacao(
      'compartilhamentos/alcance (%)',
      anterior.taxasMedias.compartilhamentosPorAlcance,
      atual.taxasMedias.compartilhamentosPorAlcance,
    ),
    calcularVariacao(
      'salvamentos/alcance (%)',
      anterior.taxasMedias.salvamentosPorAlcance,
      atual.taxasMedias.salvamentosPorAlcance,
    ),
    calcularVariacao(
      'comentarios/alcance (%)',
      anterior.taxasMedias.comentariosPorAlcance,
      atual.taxasMedias.comentariosPorAlcance,
    ),
  ]

  const subiram = variacoes.filter((v) => v.direcao === 'subiu')
  const cairam = variacoes.filter((v) => v.direcao === 'caiu')

  const partes: string[] = []
  if (subiram.length > 0) partes.push(`subiram: ${subiram.map((v) => v.metrica).join(', ')}`)
  if (cairam.length > 0) partes.push(`cairam: ${cairam.map((v) => v.metrica).join(', ')}`)
  if (partes.length === 0) partes.push('nenhuma metrica variou acima do limiar de ruido')

  const amostraFraca = !anterior.confiabilidade.suficiente || !atual.confiabilidade.suficiente
  const ressalva = amostraFraca
    ? ' Atencao: ao menos um dos periodos tem amostra insuficiente — leia como indicio.'
    : ''

  return { variacoes, resumo: `${partes.join('; ')}.${ressalva}` }
}
