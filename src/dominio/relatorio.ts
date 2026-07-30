import { obterBenchmark } from '@/dominio/benchmarks.js'
import type { Agregado, Analise, Comparacao, Severidade } from '@/tipos/index.js'

/**
 * Formatacao do resultado em Markdown.
 *
 * Vive no dominio (e nao em infra) porque nao faz I/O: recebe uma analise e
 * devolve string. Isso permite testar o texto do relatorio sem tocar em arquivos.
 */

const ROTULO_SEVERIDADE: Readonly<Record<Severidade, string>> = {
  alta: 'ALTA',
  media: 'MEDIA',
  baixa: 'BAIXA',
}

function pct(valor: number): string {
  return `${valor.toFixed(2)}%`
}

function tabelaAgregados(titulo: string, itens: readonly Agregado[]): string {
  if (itens.length === 0) return ''

  const linhas = itens.map(
    (a) =>
      `| ${a.chave} | ${a.quantidadePosts} | ${a.alcanceMedio.toLocaleString('pt-BR')} | ${pct(a.taxasMedias.engajamentoTotal)} | ${pct(a.taxasMedias.compartilhamentosPorAlcance)} | ${pct(a.taxasMedias.salvamentosPorAlcance)} | ${a.scoreMedio} |`,
  )

  return [
    ``,
    `### ${titulo}`,
    ``,
    `| ${titulo.split(' ').pop()} | Posts | Alcance medio | Engaj. total | Sends/reach | Saves/reach | Score |`,
    `|---|---:|---:|---:|---:|---:|---:|`,
    ...linhas,
  ].join('\n')
}

/** Gera o relatorio completo de uma analise em Markdown. */
export function formatarAnalise(analise: Analise): string {
  const benchmark = obterBenchmark(analise.nicho)
  const partes: string[] = []

  partes.push(`# Analise de performance — Instagram`)
  partes.push(``)
  partes.push(`**Nicho de referencia:** ${analise.nicho}`)
  partes.push(`**Posts analisados:** ${analise.totalPosts}`)
  partes.push(`**Periodo coberto:** ${analise.confiabilidade.diasCobertos} dia(s)`)
  partes.push(`**Alcance medio:** ${analise.alcanceMedio.toLocaleString('pt-BR')}`)
  partes.push(`**Score medio:** ${analise.scoreMedio}/100`)

  if (analise.confiabilidade.aviso !== null) {
    partes.push(``)
    partes.push(`> **Confiabilidade.** ${analise.confiabilidade.aviso}`)
  }

  if (analise.benchmarkDesatualizado) {
    partes.push(``)
    partes.push(
      `> **Benchmark desatualizado.** A referencia foi atualizada em ${benchmark.atualizadoEm} e ja passou de 12 meses. Revise \`src/dominio/benchmarks.ts\` antes de tirar conclusao comparativa.`,
    )
  }

  partes.push(``)
  partes.push(`## Taxas medias (base: alcance)`)
  partes.push(``)
  partes.push(`| Metrica | Valor | Referencia do nicho |`)
  partes.push(`|---|---:|---:|`)
  partes.push(
    `| Curtidas/alcance | ${pct(analise.taxasMedias.curtidasPorAlcance)} | ${pct(benchmark.curtidasPorAlcance.naMedia)} |`,
  )
  partes.push(
    `| Comentarios/alcance | ${pct(analise.taxasMedias.comentariosPorAlcance)} | ${pct(benchmark.comentariosPorAlcance.naMedia)} |`,
  )
  partes.push(
    `| Salvamentos/alcance | ${pct(analise.taxasMedias.salvamentosPorAlcance)} | ${pct(benchmark.salvamentosPorAlcance.naMedia)} |`,
  )
  partes.push(
    `| **Compartilhamentos/alcance** | **${pct(analise.taxasMedias.compartilhamentosPorAlcance)}** | ${pct(benchmark.compartilhamentosPorAlcance.naMedia)} |`,
  )
  partes.push(
    `| Engajamento total | ${pct(analise.taxasMedias.engajamentoTotal)} | ${pct(benchmark.engajamentoTotal.naMedia)} |`,
  )
  partes.push(
    `| Engajamento de valor (saves+sends) | ${pct(analise.taxasMedias.engajamentoDeValor)} | — |`,
  )

  const porFormato = tabelaAgregados('Desempenho por formato', analise.porFormato)
  if (porFormato !== '') partes.push(porFormato)

  const porPilar = tabelaAgregados('Desempenho por pilar', analise.porPilar)
  if (porPilar !== '') partes.push(porPilar)

  partes.push(``)
  partes.push(`## Diagnostico`)

  analise.achados.forEach((achado, indice) => {
    partes.push(``)
    partes.push(`### ${indice + 1}. [${ROTULO_SEVERIDADE[achado.severidade]}] ${achado.titulo}`)
    partes.push(``)
    partes.push(`- **Evidencia:** ${achado.evidencia}`)
    partes.push(`- **Acao:** ${achado.acao}`)
    partes.push(`- **Metrica que deve se mover:** ${achado.metricaAlvo}`)
  })

  if (analise.melhores.length > 0) {
    partes.push(``)
    partes.push(`## Melhores posts`)
    partes.push(``)
    partes.push(`| Data | Formato | Pilar | Alcance | Sends/reach | Score |`)
    partes.push(`|---|---|---|---:|---:|---:|`)
    for (const m of analise.melhores) {
      partes.push(
        `| ${m.post.data} | ${m.post.formato} | ${m.post.pilar ?? '—'} | ${m.post.alcance.toLocaleString('pt-BR')} | ${pct(m.taxas.compartilhamentosPorAlcance)} | ${m.score} |`,
      )
    }
  }

  if (analise.piores.length > 0) {
    partes.push(``)
    partes.push(`## Posts de menor score`)
    partes.push(``)
    partes.push(`| Data | Formato | Pilar | Alcance | Sends/reach | Score |`)
    partes.push(`|---|---|---|---:|---:|---:|`)
    for (const p of analise.piores) {
      partes.push(
        `| ${p.post.data} | ${p.post.formato} | ${p.post.pilar ?? '—'} | ${p.post.alcance.toLocaleString('pt-BR')} | ${pct(p.taxas.compartilhamentosPorAlcance)} | ${p.score} |`,
      )
    }
  }

  partes.push(``)
  partes.push(`---`)
  partes.push(``)
  partes.push(`_Referencia: ${benchmark.fonte} (atualizado em ${benchmark.atualizadoEm})._`)
  partes.push(``)

  return partes.join('\n')
}

/** Gera o relatorio de comparacao entre dois periodos em Markdown. */
export function formatarComparacao(comparacao: Comparacao): string {
  const partes: string[] = []

  partes.push(`# Comparacao entre periodos`)
  partes.push(``)
  partes.push(`**Resumo:** ${comparacao.resumo}`)
  partes.push(``)
  partes.push(`| Metrica | Anterior | Atual | Variacao | Direcao |`)
  partes.push(`|---|---:|---:|---:|---|`)

  const simbolo = { subiu: 'subiu', caiu: 'caiu', estavel: 'estavel' } as const

  for (const v of comparacao.variacoes) {
    const sinal = v.deltaPercentual > 0 ? '+' : ''
    partes.push(
      `| ${v.metrica} | ${v.anterior} | ${v.atual} | ${sinal}${v.deltaPercentual}% | ${simbolo[v.direcao]} |`,
    )
  }

  partes.push(``)
  partes.push(
    `> Variacoes abaixo de 5% sao tratadas como estaveis — dentro da faixa de ruido normal de distribuicao.`,
  )
  partes.push(``)

  return partes.join('\n')
}
