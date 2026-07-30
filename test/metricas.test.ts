import { describe, expect, it } from 'vitest'

import { obterBenchmark } from '@/dominio/benchmarks.js'
import {
  agrupar,
  analisarPost,
  arredondar,
  avaliarConfiabilidade,
  calcularScore,
  calcularTaxas,
  classificarScore,
  diasCobertos,
  media,
  taxaSegura,
  taxasMedias,
} from '@/dominio/metricas.js'
import type { PostBruto } from '@/tipos/index.js'

function criarPost(sobrescritas: Partial<PostBruto> = {}): PostBruto {
  return {
    id: 'p1',
    data: '2026-06-01',
    formato: 'reels',
    alcance: 10000,
    curtidas: 600,
    comentarios: 40,
    salvamentos: 200,
    compartilhamentos: 150,
    ...sobrescritas,
  }
}

describe('arredondar', () => {
  it('deve arredondar para duas casas por padrao', () => {
    // ARRANGE / ACT
    const resultado = arredondar(1.23456)

    // ASSERT
    expect(resultado).toBe(1.23)
  })

  it('deve respeitar o numero de casas informado', () => {
    // ARRANGE / ACT
    const resultado = arredondar(1.23456, 3)

    // ASSERT
    expect(resultado).toBe(1.235)
  })
})

describe('taxaSegura', () => {
  it('deve calcular o percentual quando o denominador e positivo', () => {
    // ARRANGE / ACT
    const resultado = taxaSegura(50, 200)

    // ASSERT
    expect(resultado).toBe(25)
  })

  it('deve retornar zero quando o denominador e zero', () => {
    // ARRANGE / ACT
    const resultado = taxaSegura(50, 0)

    // ASSERT
    expect(resultado).toBe(0)
  })

  it('deve retornar zero quando o denominador e negativo', () => {
    // ARRANGE / ACT
    const resultado = taxaSegura(50, -10)

    // ASSERT
    expect(resultado).toBe(0)
  })
})

describe('calcularTaxas', () => {
  it('deve normalizar todas as interacoes por alcance', () => {
    // ARRANGE
    const post = criarPost()

    // ACT
    const taxas = calcularTaxas(post)

    // ASSERT
    expect(taxas.curtidasPorAlcance).toBe(6)
    expect(taxas.comentariosPorAlcance).toBe(0.4)
    expect(taxas.salvamentosPorAlcance).toBe(2)
    expect(taxas.compartilhamentosPorAlcance).toBe(1.5)
  })

  it('deve somar as quatro interacoes no engajamento total', () => {
    // ARRANGE
    const post = criarPost()

    // ACT
    const taxas = calcularTaxas(post)

    // ASSERT: (600+40+200+150)/10000 = 9.9%
    expect(taxas.engajamentoTotal).toBe(9.9)
  })

  it('deve considerar apenas salvamentos e compartilhamentos no engajamento de valor', () => {
    // ARRANGE
    const post = criarPost()

    // ACT
    const taxas = calcularTaxas(post)

    // ASSERT: (200+150)/10000 = 3.5%
    expect(taxas.engajamentoDeValor).toBe(3.5)
  })

  it('deve retornar todas as taxas zeradas quando o alcance e zero', () => {
    // ARRANGE
    const post = criarPost({ alcance: 0 })

    // ACT
    const taxas = calcularTaxas(post)

    // ASSERT
    expect(taxas.engajamentoTotal).toBe(0)
    expect(taxas.curtidasPorAlcance).toBe(0)
  })
})

describe('calcularScore', () => {
  it('deve dar score maior para o post com mais compartilhamentos, mantendo o resto igual', () => {
    // ARRANGE
    const benchmark = obterBenchmark()
    const base = calcularTaxas(criarPost({ compartilhamentos: 50 }))
    const compartilhado = calcularTaxas(criarPost({ compartilhamentos: 400 }))

    // ACT
    const scoreBase = calcularScore(base, benchmark)
    const scoreCompartilhado = calcularScore(compartilhado, benchmark)

    // ASSERT
    expect(scoreCompartilhado).toBeGreaterThan(scoreBase)
  })

  it('deve pesar compartilhamento acima de curtida', () => {
    // ARRANGE: mesma quantidade extra de interacao, canais diferentes
    const benchmark = obterBenchmark()
    const viaCurtida = calcularTaxas(criarPost({ curtidas: 800 }))
    const viaCompartilhamento = calcularTaxas(criarPost({ compartilhamentos: 350 }))

    // ACT
    const scoreCurtida = calcularScore(viaCurtida, benchmark)
    const scoreCompartilhamento = calcularScore(viaCompartilhamento, benchmark)

    // ASSERT
    expect(scoreCompartilhamento).toBeGreaterThan(scoreCurtida)
  })

  it('deve produzir score zero para post sem nenhuma interacao', () => {
    // ARRANGE
    const benchmark = obterBenchmark()
    const taxas = calcularTaxas(
      criarPost({ curtidas: 0, comentarios: 0, salvamentos: 0, compartilhamentos: 0 }),
    )

    // ACT
    const score = calcularScore(taxas, benchmark)

    // ASSERT
    expect(score).toBe(0)
  })

  it('deve limitar o score em 100 mesmo com metricas extremas', () => {
    // ARRANGE
    const benchmark = obterBenchmark()
    const taxas = calcularTaxas(
      criarPost({
        alcance: 1000,
        curtidas: 900,
        comentarios: 500,
        salvamentos: 800,
        compartilhamentos: 900,
      }),
    )

    // ACT
    const score = calcularScore(taxas, benchmark)

    // ASSERT
    expect(score).toBeLessThanOrEqual(100)
    expect(score).toBeGreaterThan(90)
  })
})

describe('classificarScore', () => {
  it.each([
    [10, 'critico'],
    [30, 'abaixo'],
    [50, 'na-media'],
    [70, 'acima'],
    [95, 'excelente'],
  ])('deve classificar score %i como %s', (score, esperado) => {
    // ARRANGE / ACT
    const resultado = classificarScore(score)

    // ASSERT
    expect(resultado).toBe(esperado)
  })
})

describe('analisarPost', () => {
  it('deve devolver post, taxas, score e classificacao', () => {
    // ARRANGE
    const post = criarPost()

    // ACT
    const resultado = analisarPost(post)

    // ASSERT
    expect(resultado.post).toBe(post)
    expect(resultado.taxas.engajamentoTotal).toBe(9.9)
    expect(resultado.score).toBeGreaterThan(0)
    expect(resultado.classificacao).toBeDefined()
  })

  it('deve pontuar o mesmo post de forma diferente conforme o nicho', () => {
    // ARRANGE
    const post = criarPost({ salvamentos: 250 })

    // ACT
    const negocios = analisarPost(post, 'negocios-marketing')
    const lifestyle = analisarPost(post, 'lifestyle')

    // ASSERT: as faixas de referencia mudam por nicho, entao o score tem que mudar junto
    expect(lifestyle.score).not.toBe(negocios.score)
  })

  it('deve pontuar mais alto no nicho cuja faixa de salvamentos e mais permissiva', () => {
    // ARRANGE: post que so difere em salvamentos, para isolar essa dimensao
    const post = criarPost({ curtidas: 0, comentarios: 0, compartilhamentos: 0, salvamentos: 250 })

    // ACT
    const negocios = analisarPost(post, 'negocios-marketing')
    const lifestyle = analisarPost(post, 'lifestyle')

    // ASSERT: lifestyle exige menos salvamentos para "na media", entao o mesmo valor rende mais
    expect(lifestyle.score).toBeGreaterThan(negocios.score)
  })
})

describe('media', () => {
  it('deve calcular a media aritmetica', () => {
    // ARRANGE / ACT
    const resultado = media([2, 4, 6])

    // ASSERT
    expect(resultado).toBe(4)
  })

  it('deve retornar zero para lista vazia', () => {
    // ARRANGE / ACT
    const resultado = media([])

    // ASSERT
    expect(resultado).toBe(0)
  })
})

describe('taxasMedias', () => {
  it('deve calcular a media de cada taxa entre os posts', () => {
    // ARRANGE
    const posts = [
      analisarPost(criarPost({ curtidas: 400 })),
      analisarPost(criarPost({ curtidas: 800 })),
    ]

    // ACT
    const medias = taxasMedias(posts)

    // ASSERT: (4% + 8%) / 2
    expect(medias.curtidasPorAlcance).toBe(6)
  })
})

describe('agrupar', () => {
  it('deve agrupar por chave e ordenar por score medio decrescente', () => {
    // ARRANGE
    const posts = [
      analisarPost(criarPost({ id: 'a', formato: 'reels', compartilhamentos: 500 })),
      analisarPost(criarPost({ id: 'b', formato: 'reels', compartilhamentos: 450 })),
      analisarPost(criarPost({ id: 'c', formato: 'imagem', compartilhamentos: 5 })),
    ]

    // ACT
    const grupos = agrupar(posts, (p) => p.post.formato)

    // ASSERT
    expect(grupos).toHaveLength(2)
    expect(grupos[0]?.chave).toBe('reels')
    expect(grupos[0]?.quantidadePosts).toBe(2)
    expect(grupos[0]?.scoreMedio).toBeGreaterThan(grupos[1]?.scoreMedio ?? 0)
  })

  it('deve ignorar posts sem valor para a chave', () => {
    // ARRANGE
    const posts = [
      analisarPost(criarPost({ id: 'a', pilar: 'utilidade' })),
      analisarPost(criarPost({ id: 'b' })),
    ]

    // ACT
    const grupos = agrupar(posts, (p) => p.post.pilar)

    // ASSERT
    expect(grupos).toHaveLength(1)
    expect(grupos[0]?.quantidadePosts).toBe(1)
  })
})

describe('diasCobertos', () => {
  it('deve contar os dias entre o primeiro e o ultimo post, inclusive', () => {
    // ARRANGE
    const posts = [
      criarPost({ data: '2026-06-01' }),
      criarPost({ data: '2026-06-15' }),
    ]

    // ACT
    const resultado = diasCobertos(posts)

    // ASSERT
    expect(resultado).toBe(15)
  })

  it('deve retornar zero para lista vazia', () => {
    // ARRANGE / ACT
    const resultado = diasCobertos([])

    // ASSERT
    expect(resultado).toBe(0)
  })

  it('deve retornar zero quando nenhuma data e valida', () => {
    // ARRANGE
    const posts = [criarPost({ data: 'nao-e-data' })]

    // ACT
    const resultado = diasCobertos(posts)

    // ASSERT
    expect(resultado).toBe(0)
  })
})

describe('avaliarConfiabilidade', () => {
  it('deve considerar suficiente uma amostra com 7 posts cobrindo 15 dias', () => {
    // ARRANGE: 7 posts entre 01/06 e 15/06 — acima do minimo de 7 posts e 14 dias
    const dias = ['01', '03', '05', '07', '09', '11', '15']
    const posts = dias.map((dia, i) => criarPost({ id: `p${i}`, data: `2026-06-${dia}` }))

    // ACT
    const resultado = avaliarConfiabilidade(posts)

    // ASSERT
    expect(resultado.suficiente).toBe(true)
    expect(resultado.aviso).toBeNull()
  })

  it('deve avisar quando ha poucos posts', () => {
    // ARRANGE
    const posts = [criarPost({ data: '2026-06-01' }), criarPost({ data: '2026-06-20' })]

    // ACT
    const resultado = avaliarConfiabilidade(posts)

    // ASSERT
    expect(resultado.suficiente).toBe(false)
    expect(resultado.aviso).toContain('minimo para tendencia')
  })

  it('deve avisar quando o periodo e curto demais', () => {
    // ARRANGE
    const posts = Array.from({ length: 8 }, (_, i) =>
      criarPost({ id: `p${i}`, data: '2026-06-01' }),
    )

    // ACT
    const resultado = avaliarConfiabilidade(posts)

    // ASSERT
    expect(resultado.suficiente).toBe(false)
    expect(resultado.aviso).toContain('dia(s) cobertos')
  })
})
