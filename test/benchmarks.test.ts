import { describe, expect, it } from 'vitest'

import {
  classificar,
  estaDesatualizado,
  listarNichos,
  NICHO_PADRAO,
  obterBenchmark,
} from '@/dominio/benchmarks.js'

describe('obterBenchmark', () => {
  it('deve retornar o benchmark do nicho padrao quando nada e informado', () => {
    // ARRANGE / ACT
    const benchmark = obterBenchmark()

    // ASSERT
    expect(benchmark.nicho).toBe(NICHO_PADRAO)
  })

  it('deve retornar o benchmark do nicho solicitado', () => {
    // ARRANGE / ACT
    const benchmark = obterBenchmark('lifestyle')

    // ASSERT
    expect(benchmark.nicho).toBe('lifestyle')
  })

  it('deve tolerar caixa e espacos no nome do nicho', () => {
    // ARRANGE / ACT
    const benchmark = obterBenchmark('  Tech-Software  ')

    // ASSERT
    expect(benchmark.nicho).toBe('tech-software')
  })

  it('deve cair no padrao quando o nicho nao existe, em vez de falhar', () => {
    // ARRANGE / ACT
    const benchmark = obterBenchmark('nicho-inexistente')

    // ASSERT: analise nunca deve ser bloqueada por um rotulo desconhecido
    expect(benchmark.nicho).toBe(NICHO_PADRAO)
  })

  it('deve declarar fonte e data de atualizacao em todo benchmark', () => {
    // ARRANGE
    const nichos = listarNichos()

    // ACT / ASSERT
    for (const nicho of nichos) {
      const benchmark = obterBenchmark(nicho)
      expect(benchmark.fonte.length).toBeGreaterThan(10)
      expect(benchmark.atualizadoEm).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('deve ter faixas monotonicamente crescentes em todas as metricas', () => {
    // ARRANGE
    const benchmark = obterBenchmark()
    const faixas = [
      benchmark.curtidasPorAlcance,
      benchmark.comentariosPorAlcance,
      benchmark.salvamentosPorAlcance,
      benchmark.compartilhamentosPorAlcance,
      benchmark.engajamentoTotal,
      benchmark.retencaoMedia,
    ]

    // ACT / ASSERT
    for (const faixa of faixas) {
      expect(faixa.critico).toBeLessThan(faixa.abaixo)
      expect(faixa.abaixo).toBeLessThan(faixa.naMedia)
      expect(faixa.naMedia).toBeLessThan(faixa.acima)
    }
  })
})

describe('listarNichos', () => {
  it('deve incluir o nicho padrao', () => {
    // ARRANGE / ACT
    const nichos = listarNichos()

    // ASSERT
    expect(nichos).toContain(NICHO_PADRAO)
  })
})

describe('classificar', () => {
  const faixa = { critico: 1, abaixo: 2, naMedia: 4, acima: 8 }

  it.each([
    [0.5, 'critico'],
    [1.5, 'abaixo'],
    [3, 'na-media'],
    [6, 'acima'],
    [10, 'excelente'],
  ])('deve classificar %f como %s', (valor, esperado) => {
    // ARRANGE / ACT
    const resultado = classificar(valor, faixa)

    // ASSERT
    expect(resultado).toBe(esperado)
  })

  it('deve tratar o valor exatamente no limite como pertencente a faixa superior', () => {
    // ARRANGE / ACT
    const resultado = classificar(2, faixa)

    // ASSERT
    expect(resultado).toBe('na-media')
  })
})

describe('estaDesatualizado', () => {
  it('deve marcar como desatualizado um benchmark com mais de 12 meses', () => {
    // ARRANGE
    const benchmark = obterBenchmark()
    const referencia = new Date('2028-01-01T00:00:00Z')

    // ACT
    const resultado = estaDesatualizado(benchmark, referencia)

    // ASSERT
    expect(resultado).toBe(true)
  })

  it('deve considerar atual um benchmark com menos de 12 meses', () => {
    // ARRANGE
    const benchmark = obterBenchmark()
    const referencia = new Date('2026-06-01T00:00:00Z')

    // ACT
    const resultado = estaDesatualizado(benchmark, referencia)

    // ASSERT
    expect(resultado).toBe(false)
  })
})
