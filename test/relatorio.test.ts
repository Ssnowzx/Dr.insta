import { describe, expect, it } from 'vitest'

import { analisar, comparar } from '@/dominio/diagnostico.js'
import { formatarAnalise, formatarComparacao } from '@/dominio/relatorio.js'
import type { PostBruto } from '@/tipos/index.js'

function serie(sobrescritas: Partial<PostBruto> = {}): PostBruto[] {
  return Array.from({ length: 10 }, (_, i) => ({
    id: `p${i}`,
    data: `2026-06-${String(i * 3 + 1).padStart(2, '0')}`,
    formato: i % 2 === 0 ? 'reels' : 'carrossel',
    pilar: i % 2 === 0 ? 'utilidade' : 'ponto-de-vista',
    alcance: 10000,
    curtidas: 700,
    comentarios: 60,
    salvamentos: 300,
    compartilhamentos: 250,
    ...sobrescritas,
  }))
}

describe('formatarAnalise', () => {
  it('deve incluir o cabecalho e os totais', () => {
    // ARRANGE
    const analise = analisar(serie())

    // ACT
    const markdown = formatarAnalise(analise)

    // ASSERT
    expect(markdown).toContain('# Analise de performance')
    expect(markdown).toContain('**Posts analisados:** 10')
    expect(markdown).toContain('negocios-marketing')
  })

  it('deve deixar explicito que a base de calculo e o alcance', () => {
    // ARRANGE
    const analise = analisar(serie())

    // ACT
    const markdown = formatarAnalise(analise)

    // ASSERT: a base precisa estar visivel para o numero nao ser mal interpretado
    expect(markdown).toContain('Taxas medias (base: alcance)')
  })

  it('deve destacar compartilhamentos na tabela de taxas', () => {
    // ARRANGE
    const analise = analisar(serie())

    // ACT
    const markdown = formatarAnalise(analise)

    // ASSERT: sends e o sinal de ranqueamento que mais importa depois de watch time
    expect(markdown).toContain('**Compartilhamentos/alcance**')
  })

  it('deve incluir as tabelas por formato e por pilar', () => {
    // ARRANGE
    const analise = analisar(serie())

    // ACT
    const markdown = formatarAnalise(analise)

    // ASSERT
    expect(markdown).toContain('Desempenho por formato')
    expect(markdown).toContain('Desempenho por pilar')
  })

  it('deve renderizar cada achado com evidencia, acao e metrica alvo', () => {
    // ARRANGE
    const analise = analisar(serie({ compartilhamentos: 5, salvamentos: 8 }))

    // ACT
    const markdown = formatarAnalise(analise)

    // ASSERT
    expect(markdown).toContain('**Evidencia:**')
    expect(markdown).toContain('**Acao:**')
    expect(markdown).toContain('**Metrica que deve se mover:**')
  })

  it('deve exibir o aviso de confiabilidade quando a amostra e pequena', () => {
    // ARRANGE
    const analise = analisar([
      { ...serie()[0]!, id: 'unico' },
    ])

    // ACT
    const markdown = formatarAnalise(analise)

    // ASSERT
    expect(markdown).toContain('**Confiabilidade.**')
  })

  it('nao deve exibir aviso de confiabilidade quando a amostra e suficiente', () => {
    // ARRANGE
    const analise = analisar(serie())

    // ACT
    const markdown = formatarAnalise(analise)

    // ASSERT
    expect(markdown).not.toContain('**Confiabilidade.**')
  })

  it('deve avisar quando o benchmark esta desatualizado', () => {
    // ARRANGE
    const analise = analisar(serie(), undefined, new Date('2029-01-01T00:00:00Z'))

    // ACT
    const markdown = formatarAnalise(analise)

    // ASSERT
    expect(markdown).toContain('**Benchmark desatualizado.**')
  })

  it('deve citar a fonte e a data do benchmark no rodape', () => {
    // ARRANGE
    const analise = analisar(serie())

    // ACT
    const markdown = formatarAnalise(analise)

    // ASSERT: numero de referencia sem procedencia nao pode circular
    expect(markdown).toContain('_Referencia:')
    expect(markdown).toMatch(/atualizado em \d{4}-\d{2}-\d{2}/)
  })

  it('deve listar melhores e piores posts', () => {
    // ARRANGE
    const analise = analisar(serie())

    // ACT
    const markdown = formatarAnalise(analise)

    // ASSERT
    expect(markdown).toContain('## Melhores posts')
    expect(markdown).toContain('## Posts de menor score')
  })

  it('deve usar tracinho quando o post nao tem pilar', () => {
    // ARRANGE
    const posts = serie().map(({ pilar: _pilar, ...resto }) => resto)
    const analise = analisar(posts)

    // ACT
    const markdown = formatarAnalise(analise)

    // ASSERT
    expect(markdown).toContain('| — |')
  })
})

describe('formatarComparacao', () => {
  it('deve incluir titulo, resumo e tabela', () => {
    // ARRANGE
    const comparacao = comparar(analisar(serie()), analisar(serie({ compartilhamentos: 600 })))

    // ACT
    const markdown = formatarComparacao(comparacao)

    // ASSERT
    expect(markdown).toContain('# Comparacao entre periodos')
    expect(markdown).toContain('**Resumo:**')
    expect(markdown).toContain('| Metrica | Anterior | Atual |')
  })

  it('deve prefixar variacoes positivas com sinal de mais', () => {
    // ARRANGE
    const comparacao = comparar(analisar(serie()), analisar(serie({ compartilhamentos: 600 })))

    // ACT
    const markdown = formatarComparacao(comparacao)

    // ASSERT
    expect(markdown).toMatch(/\|\s\+\d/)
  })

  it('deve explicar o limiar de ruido no rodape', () => {
    // ARRANGE
    const analise = analisar(serie())
    const comparacao = comparar(analise, analise)

    // ACT
    const markdown = formatarComparacao(comparacao)

    // ASSERT
    expect(markdown).toContain('abaixo de 5%')
  })
})
