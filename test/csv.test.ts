import { describe, expect, it } from 'vitest'

import {
  detectarSeparador,
  dividirLinha,
  lerCsv,
  normalizar,
  normalizarData,
  normalizarFormato,
  paraNumero,
} from '@/infra/csv.js'

describe('normalizar', () => {
  it('deve remover acentos e padronizar separadores', () => {
    // ARRANGE / ACT
    const resultado = normalizar('  Contas Alcançadas ')

    // ASSERT
    expect(resultado).toBe('contas_alcancadas')
  })

  it('deve descartar caracteres nao alfanumericos', () => {
    // ARRANGE / ACT
    const resultado = normalizar('Retenção (%)')

    // ASSERT
    expect(resultado).toBe('retencao_')
  })
})

describe('dividirLinha', () => {
  it('deve dividir campos simples pelo separador', () => {
    // ARRANGE / ACT
    const resultado = dividirLinha('a,b,c', ',')

    // ASSERT
    expect(resultado).toEqual(['a', 'b', 'c'])
  })

  it('deve preservar virgulas dentro de aspas', () => {
    // ARRANGE / ACT
    const resultado = dividirLinha('p1,"legenda com, virgula",100', ',')

    // ASSERT
    expect(resultado).toEqual(['p1', 'legenda com, virgula', '100'])
  })

  it('deve interpretar aspas duplas escapadas', () => {
    // ARRANGE / ACT
    const resultado = dividirLinha('p1,"ele disse ""oi""",100', ',')

    // ASSERT
    expect(resultado[1]).toBe('ele disse "oi"')
  })
})

describe('detectarSeparador', () => {
  it.each([
    ['a,b,c', ','],
    ['a;b;c', ';'],
    ['a\tb\tc', '\t'],
  ])('deve detectar o separador de "%s"', (cabecalho, esperado) => {
    // ARRANGE / ACT
    const resultado = detectarSeparador(cabecalho)

    // ASSERT
    expect(resultado).toBe(esperado)
  })
})

describe('paraNumero', () => {
  it.each([
    ['1234', 1234],
    ['1.234', 1234],
    ['1.234,5', 1234.5],
    ['1,234.5', 1234.5],
    ['42%', 42],
    ['  87  ', 87],
  ])('deve converter "%s" em %f', (entrada, esperado) => {
    // ARRANGE / ACT
    const resultado = paraNumero(entrada)

    // ASSERT
    expect(resultado).toBe(esperado)
  })

  it.each([[''], ['-'], ['abc'], [undefined]])(
    'deve retornar undefined para %s',
    (entrada) => {
      // ARRANGE / ACT
      const resultado = paraNumero(entrada)

      // ASSERT
      expect(resultado).toBeUndefined()
    },
  )
})

describe('normalizarData', () => {
  it('deve aceitar formato ISO', () => {
    // ARRANGE / ACT
    const resultado = normalizarData('2026-06-15')

    // ASSERT
    expect(resultado).toBe('2026-06-15')
  })

  it('deve aceitar ISO com horario e descartar a hora', () => {
    // ARRANGE / ACT
    const resultado = normalizarData('2026-06-15 14:30')

    // ASSERT
    expect(resultado).toBe('2026-06-15')
  })

  it('deve converter formato brasileiro para ISO', () => {
    // ARRANGE / ACT
    const resultado = normalizarData('5/6/2026')

    // ASSERT
    expect(resultado).toBe('2026-06-05')
  })

  it('deve retornar undefined para data invalida', () => {
    // ARRANGE / ACT
    const resultado = normalizarData('ontem')

    // ASSERT
    expect(resultado).toBeUndefined()
  })

  it('deve retornar undefined para string vazia', () => {
    // ARRANGE / ACT
    const resultado = normalizarData('   ')

    // ASSERT
    expect(resultado).toBeUndefined()
  })
})

describe('normalizarFormato', () => {
  it.each([
    ['Reels', 'reels'],
    ['reel', 'reels'],
    ['video', 'reels'],
    ['Carrossel', 'carrossel'],
    ['carousel', 'carrossel'],
    ['album', 'carrossel'],
    ['foto', 'imagem'],
    ['Photo', 'imagem'],
    ['stories', 'story'],
  ])('deve mapear "%s" para "%s"', (entrada, esperado) => {
    // ARRANGE / ACT
    const resultado = normalizarFormato(entrada)

    // ASSERT
    expect(resultado).toBe(esperado)
  })

  it('deve retornar undefined para formato desconhecido', () => {
    // ARRANGE / ACT
    const resultado = normalizarFormato('podcast')

    // ASSERT
    expect(resultado).toBeUndefined()
  })

  it('deve retornar undefined quando o valor esta ausente', () => {
    // ARRANGE / ACT
    const resultado = normalizarFormato(undefined)

    // ASSERT
    expect(resultado).toBeUndefined()
  })
})

describe('lerCsv', () => {
  const cabecalho = 'data,formato,alcance,curtidas,comentarios,salvamentos,compartilhamentos'

  it('deve fazer o parse de um CSV valido', () => {
    // ARRANGE
    const csv = `${cabecalho}\n2026-06-01,reels,10000,500,30,200,150`

    // ACT
    const resultado = lerCsv(csv)

    // ASSERT
    expect(resultado.erros).toHaveLength(0)
    expect(resultado.posts).toHaveLength(1)
    expect(resultado.posts[0]?.alcance).toBe(10000)
    expect(resultado.posts[0]?.formato).toBe('reels')
  })

  it('deve reconhecer cabecalhos em ingles', () => {
    // ARRANGE
    const csv = 'date,type,reach,likes,comments,saves,shares\n2026-06-01,reel,8000,400,20,100,90'

    // ACT
    const resultado = lerCsv(csv)

    // ASSERT
    expect(resultado.posts).toHaveLength(1)
    expect(resultado.posts[0]?.compartilhamentos).toBe(90)
  })

  it('deve aceitar ponto e virgula como separador', () => {
    // ARRANGE
    const csv = `${cabecalho.replace(/,/g, ';')}\n2026-06-01;carrossel;5000;300;10;80;40`

    // ACT
    const resultado = lerCsv(csv)

    // ASSERT
    expect(resultado.posts).toHaveLength(1)
    expect(resultado.posts[0]?.formato).toBe('carrossel')
  })

  it('deve gerar id automatico quando a coluna nao existe', () => {
    // ARRANGE
    const csv = `${cabecalho}\n2026-06-01,reels,10000,500,30,200,150`

    // ACT
    const resultado = lerCsv(csv)

    // ASSERT
    expect(resultado.posts[0]?.id).toBe('linha-2')
  })

  it('deve tratar contagem ausente como zero', () => {
    // ARRANGE
    const csv = `${cabecalho}\n2026-06-01,reels,10000,,,,`

    // ACT
    const resultado = lerCsv(csv)

    // ASSERT
    expect(resultado.posts[0]?.curtidas).toBe(0)
    expect(resultado.posts[0]?.compartilhamentos).toBe(0)
  })

  it('deve registrar erro e seguir adiante quando uma linha tem data invalida', () => {
    // ARRANGE
    const csv = `${cabecalho}\nontem,reels,10000,500,30,200,150\n2026-06-02,reels,9000,400,20,150,120`

    // ACT
    const resultado = lerCsv(csv)

    // ASSERT: a linha ruim nao pode derrubar a analise inteira
    expect(resultado.posts).toHaveLength(1)
    expect(resultado.erros).toHaveLength(1)
    expect(resultado.erros[0]?.linha).toBe(2)
    expect(resultado.erros[0]?.motivo).toContain('Data invalida')
  })

  it('deve registrar erro para formato desconhecido', () => {
    // ARRANGE
    const csv = `${cabecalho}\n2026-06-01,podcast,10000,500,30,200,150`

    // ACT
    const resultado = lerCsv(csv)

    // ASSERT
    expect(resultado.posts).toHaveLength(0)
    expect(resultado.erros[0]?.motivo).toContain('Formato invalido')
  })

  it('deve registrar erro para alcance ausente', () => {
    // ARRANGE
    const csv = `${cabecalho}\n2026-06-01,reels,,500,30,200,150`

    // ACT
    const resultado = lerCsv(csv)

    // ASSERT
    expect(resultado.erros[0]?.motivo).toContain('Alcance invalido')
  })

  it('deve reprovar cabecalho sem colunas obrigatorias', () => {
    // ARRANGE
    const csv = 'curtidas,comentarios\n500,30'

    // ACT
    const resultado = lerCsv(csv)

    // ASSERT
    expect(resultado.posts).toHaveLength(0)
    expect(resultado.erros[0]?.motivo).toContain('coluna(s) obrigatoria(s)')
  })

  it('deve reportar arquivo vazio', () => {
    // ARRANGE / ACT
    const resultado = lerCsv('   \n  ')

    // ASSERT
    expect(resultado.erros[0]?.motivo).toBe('Arquivo vazio.')
  })

  it('deve capturar campos opcionais quando presentes', () => {
    // ARRANGE
    const csv =
      'data,formato,pilar,alcance,curtidas,comentarios,salvamentos,compartilhamentos,retencao_media,visitas_perfil\n' +
      '2026-06-01,reels,utilidade,10000,500,30,200,150,45,120'

    // ACT
    const resultado = lerCsv(csv)

    // ASSERT
    expect(resultado.posts[0]?.pilar).toBe('utilidade')
    expect(resultado.posts[0]?.retencaoMedia).toBe(45)
    expect(resultado.posts[0]?.visitasPerfil).toBe(120)
  })

  it('deve omitir campos opcionais vazios em vez de guardar string vazia', () => {
    // ARRANGE
    const csv =
      'data,formato,pilar,alcance,curtidas,comentarios,salvamentos,compartilhamentos\n' +
      '2026-06-01,reels,,10000,500,30,200,150'

    // ACT
    const resultado = lerCsv(csv)

    // ASSERT
    expect(resultado.posts[0]?.pilar).toBeUndefined()
  })

  it('deve lidar com quebras de linha do Windows', () => {
    // ARRANGE
    const csv = `${cabecalho}\r\n2026-06-01,reels,10000,500,30,200,150\r\n`

    // ACT
    const resultado = lerCsv(csv)

    // ASSERT
    expect(resultado.posts).toHaveLength(1)
  })
})
