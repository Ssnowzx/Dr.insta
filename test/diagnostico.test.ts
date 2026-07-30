import { describe, expect, it } from 'vitest'

import { analisar, calcularVariacao, comparar, gerarAchados } from '@/dominio/diagnostico.js'
import { analisarPost, taxasMedias } from '@/dominio/metricas.js'
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

/** Serie saudavel: 10 posts espalhados por 30 dias, metricas acima da media. */
function serieSaudavel(): PostBruto[] {
  return Array.from({ length: 10 }, (_, i) =>
    criarPost({
      id: `p${i}`,
      data: `2026-06-${String(i * 3 + 1).padStart(2, '0')}`,
      curtidas: 700,
      comentarios: 60,
      salvamentos: 300,
      compartilhamentos: 250,
    }),
  )
}

describe('gerarAchados', () => {
  it('deve apontar compartilhamentos baixos como achado de alta severidade', () => {
    // ARRANGE
    const posts = Array.from({ length: 8 }, (_, i) =>
      analisarPost(criarPost({ id: `p${i}`, compartilhamentos: 5 })),
    )

    // ACT
    const achados = gerarAchados(posts, taxasMedias(posts))

    // ASSERT
    const achado = achados.find((a) => a.titulo.includes('Compartilhamentos'))
    expect(achado).toBeDefined()
    expect(achado?.severidade).toBe('alta')
    expect(achado?.metricaAlvo).toBe('compartilhamentos/alcance')
  })

  it('deve apontar salvamentos baixos', () => {
    // ARRANGE
    const posts = Array.from({ length: 8 }, (_, i) =>
      analisarPost(criarPost({ id: `p${i}`, salvamentos: 10 })),
    )

    // ACT
    const achados = gerarAchados(posts, taxasMedias(posts))

    // ASSERT
    expect(achados.some((a) => a.titulo.includes('Salvamentos'))).toBe(true)
  })

  it('deve apontar comentarios baixos', () => {
    // ARRANGE
    const posts = Array.from({ length: 8 }, (_, i) =>
      analisarPost(criarPost({ id: `p${i}`, comentarios: 2 })),
    )

    // ACT
    const achados = gerarAchados(posts, taxasMedias(posts))

    // ASSERT
    expect(achados.some((a) => a.titulo.includes('Comentarios'))).toBe(true)
  })

  it('deve detectar engajamento raso: muita curtida com pouco salvamento e compartilhamento', () => {
    // ARRANGE
    const posts = Array.from({ length: 8 }, (_, i) =>
      analisarPost(
        criarPost({ id: `p${i}`, curtidas: 900, salvamentos: 20, compartilhamentos: 15 }),
      ),
    )

    // ACT
    const achados = gerarAchados(posts, taxasMedias(posts))

    // ASSERT
    expect(achados.some((a) => a.titulo.includes('Engajamento raso'))).toBe(true)
  })

  it('deve apontar retencao baixa quando ha ao menos 3 videos com o dado', () => {
    // ARRANGE
    const posts = Array.from({ length: 5 }, (_, i) =>
      analisarPost(criarPost({ id: `p${i}`, retencaoMedia: 18 })),
    )

    // ACT
    const achados = gerarAchados(posts, taxasMedias(posts))

    // ASSERT
    const achado = achados.find((a) => a.titulo.includes('Retencao'))
    expect(achado).toBeDefined()
    expect(achado?.acao).toContain('3 primeiros segundos')
  })

  it('deve ignorar retencao quando ha menos de 3 videos com o dado', () => {
    // ARRANGE
    const posts = [
      analisarPost(criarPost({ id: 'a', retencaoMedia: 10 })),
      analisarPost(criarPost({ id: 'b', retencaoMedia: 12 })),
      analisarPost(criarPost({ id: 'c' })),
    ]

    // ACT
    const achados = gerarAchados(posts, taxasMedias(posts))

    // ASSERT
    expect(achados.some((a) => a.titulo.includes('Retencao'))).toBe(false)
  })

  it('deve comparar formatos quando a diferenca de score e relevante', () => {
    // ARRANGE
    const posts = [
      ...Array.from({ length: 3 }, (_, i) =>
        analisarPost(
          criarPost({ id: `r${i}`, formato: 'reels', salvamentos: 500, compartilhamentos: 450 }),
        ),
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        analisarPost(
          criarPost({ id: `i${i}`, formato: 'imagem', salvamentos: 5, compartilhamentos: 3 }),
        ),
      ),
    ]

    // ACT
    const achados = gerarAchados(posts, taxasMedias(posts))

    // ASSERT
    const achado = achados.find((a) => a.titulo.includes('Formato'))
    expect(achado).toBeDefined()
    expect(achado?.titulo).toContain('reels')
  })

  it('deve comparar pilares quando a diferenca de score e relevante', () => {
    // ARRANGE
    const posts = [
      ...Array.from({ length: 3 }, (_, i) =>
        analisarPost(
          criarPost({ id: `a${i}`, pilar: 'utilidade', salvamentos: 500, compartilhamentos: 450 }),
        ),
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        analisarPost(
          criarPost({ id: `b${i}`, pilar: 'oferta', salvamentos: 5, compartilhamentos: 3 }),
        ),
      ),
    ]

    // ACT
    const achados = gerarAchados(posts, taxasMedias(posts))

    // ASSERT
    const achado = achados.find((a) => a.titulo.includes('Pilar'))
    expect(achado).toBeDefined()
    expect(achado?.severidade).toBe('baixa')
  })

  it('deve devolver achado de escala quando nenhum gargalo e encontrado', () => {
    // ARRANGE
    const posts = serieSaudavel().map((p) => analisarPost(p))

    // ACT
    const achados = gerarAchados(posts, taxasMedias(posts))

    // ASSERT
    expect(achados).toHaveLength(1)
    expect(achados[0]?.titulo).toContain('Nenhum gargalo')
  })

  it('deve ordenar os achados por severidade decrescente', () => {
    // ARRANGE
    const posts = Array.from({ length: 8 }, (_, i) =>
      analisarPost(
        criarPost({
          id: `p${i}`,
          comentarios: 2,
          salvamentos: 10,
          compartilhamentos: 5,
        }),
      ),
    )

    // ACT
    const achados = gerarAchados(posts, taxasMedias(posts))

    // ASSERT
    const ordem = { alta: 0, media: 1, baixa: 2 } as const
    const valores = achados.map((a) => ordem[a.severidade])
    expect(valores).toEqual([...valores].sort((a, b) => a - b))
  })

  it('deve garantir que todo achado tenha acao e metrica alvo', () => {
    // ARRANGE
    const posts = Array.from({ length: 8 }, (_, i) =>
      analisarPost(criarPost({ id: `p${i}`, compartilhamentos: 3, salvamentos: 8 })),
    )

    // ACT
    const achados = gerarAchados(posts, taxasMedias(posts))

    // ASSERT: observacao sem acao e ruido de relatorio
    for (const achado of achados) {
      expect(achado.acao.length).toBeGreaterThan(20)
      expect(achado.metricaAlvo.length).toBeGreaterThan(0)
    }
  })
})

describe('analisar', () => {
  it('deve produzir a analise completa de uma serie saudavel', () => {
    // ARRANGE
    const posts = serieSaudavel()

    // ACT
    const analise = analisar(posts)

    // ASSERT
    expect(analise.totalPosts).toBe(10)
    expect(analise.confiabilidade.suficiente).toBe(true)
    expect(analise.alcanceMedio).toBe(10000)
    expect(analise.scoreMedio).toBeGreaterThan(0)
    expect(analise.achados.length).toBeGreaterThan(0)
  })

  it('deve marcar amostra insuficiente quando ha poucos posts', () => {
    // ARRANGE
    const posts = [criarPost({ id: 'a', data: '2026-06-01' })]

    // ACT
    const analise = analisar(posts)

    // ASSERT
    expect(analise.confiabilidade.suficiente).toBe(false)
    expect(analise.confiabilidade.aviso).not.toBeNull()
  })

  it('deve limitar melhores e piores a tres posts', () => {
    // ARRANGE
    const posts = serieSaudavel()

    // ACT
    const analise = analisar(posts)

    // ASSERT
    expect(analise.melhores).toHaveLength(3)
    expect(analise.piores).toHaveLength(3)
  })

  it('deve ordenar melhores por score decrescente', () => {
    // ARRANGE
    const posts = [
      criarPost({ id: 'baixo', data: '2026-06-01', compartilhamentos: 10 }),
      criarPost({ id: 'alto', data: '2026-06-05', compartilhamentos: 600 }),
      criarPost({ id: 'medio', data: '2026-06-10', compartilhamentos: 200 }),
    ]

    // ACT
    const analise = analisar(posts)

    // ASSERT
    expect(analise.melhores[0]?.post.id).toBe('alto')
    expect(analise.melhores[0]?.score).toBeGreaterThanOrEqual(analise.melhores[1]?.score ?? 0)
  })

  it('deve agrupar por formato e por pilar', () => {
    // ARRANGE
    const posts = [
      criarPost({ id: 'a', formato: 'reels', pilar: 'utilidade' }),
      criarPost({ id: 'b', formato: 'carrossel', pilar: 'utilidade' }),
      criarPost({ id: 'c', formato: 'imagem', pilar: 'oferta' }),
    ]

    // ACT
    const analise = analisar(posts)

    // ASSERT
    expect(analise.porFormato).toHaveLength(3)
    expect(analise.porPilar).toHaveLength(2)
  })

  it('deve sinalizar benchmark desatualizado usando a data de referencia informada', () => {
    // ARRANGE
    const posts = serieSaudavel()

    // ACT
    const atual = analisar(posts, undefined, new Date('2026-06-01T00:00:00Z'))
    const antigo = analisar(posts, undefined, new Date('2029-06-01T00:00:00Z'))

    // ASSERT
    expect(atual.benchmarkDesatualizado).toBe(false)
    expect(antigo.benchmarkDesatualizado).toBe(true)
  })
})

describe('calcularVariacao', () => {
  it('deve calcular variacao percentual positiva', () => {
    // ARRANGE / ACT
    const variacao = calcularVariacao('alcance', 100, 150)

    // ASSERT
    expect(variacao.deltaPercentual).toBe(50)
    expect(variacao.direcao).toBe('subiu')
  })

  it('deve calcular variacao percentual negativa', () => {
    // ARRANGE / ACT
    const variacao = calcularVariacao('alcance', 200, 100)

    // ASSERT
    expect(variacao.deltaPercentual).toBe(-50)
    expect(variacao.direcao).toBe('caiu')
  })

  it('deve tratar variacao abaixo de 5% como estavel', () => {
    // ARRANGE / ACT
    const variacao = calcularVariacao('alcance', 100, 103)

    // ASSERT: 3% esta dentro do ruido normal de distribuicao
    expect(variacao.direcao).toBe('estavel')
  })

  it('deve retornar delta zero quando o valor anterior e zero', () => {
    // ARRANGE / ACT
    const variacao = calcularVariacao('alcance', 0, 100)

    // ASSERT: divisao por zero produziria Infinity, que nao informa nada
    expect(variacao.deltaPercentual).toBe(0)
    expect(variacao.direcao).toBe('estavel')
  })
})

describe('comparar', () => {
  it('deve identificar as metricas que subiram', () => {
    // ARRANGE
    const anterior = analisar(serieSaudavel())
    const melhor = analisar(
      serieSaudavel().map((p) => ({ ...p, compartilhamentos: 600, salvamentos: 700 })),
    )

    // ACT
    const comparacao = comparar(anterior, melhor)

    // ASSERT
    expect(comparacao.resumo).toContain('subiram')
    const sends = comparacao.variacoes.find((v) => v.metrica.includes('compartilhamentos'))
    expect(sends?.direcao).toBe('subiu')
  })

  it('deve identificar as metricas que cairam', () => {
    // ARRANGE
    const anterior = analisar(serieSaudavel())
    const pior = analisar(
      serieSaudavel().map((p) => ({ ...p, compartilhamentos: 20, salvamentos: 15 })),
    )

    // ACT
    const comparacao = comparar(anterior, pior)

    // ASSERT
    expect(comparacao.resumo).toContain('cairam')
  })

  it('deve reportar estabilidade quando nada varia acima do limiar', () => {
    // ARRANGE
    const posts = serieSaudavel()
    const analise = analisar(posts)

    // ACT
    const comparacao = comparar(analise, analise)

    // ASSERT
    expect(comparacao.resumo).toContain('nenhuma metrica variou')
  })

  it('deve acrescentar ressalva quando algum periodo tem amostra insuficiente', () => {
    // ARRANGE
    const completo = analisar(serieSaudavel())
    const curto = analisar([criarPost({ id: 'unico', data: '2026-07-01' })])

    // ACT
    const comparacao = comparar(completo, curto)

    // ASSERT
    expect(comparacao.resumo).toContain('amostra insuficiente')
  })

  it('deve devolver uma variacao para cada metrica acompanhada', () => {
    // ARRANGE
    const analise = analisar(serieSaudavel())

    // ACT
    const comparacao = comparar(analise, analise)

    // ASSERT
    expect(comparacao.variacoes).toHaveLength(6)
  })
})
