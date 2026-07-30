import { describe, expect, it } from 'vitest'

import { extrairFrontmatter, validarNome, validarSkill } from '@/dominio/validacao-skill.js'

const DESCRICAO_VALIDA =
  'Faz analise de performance de perfil no Instagram. Use quando o usuario pedir diagnostico de metricas.'

function skillValida(sobrescritas: { nome?: string; descricao?: string; corpo?: string } = {}): string {
  const nome = sobrescritas.nome ?? 'minha-skill'
  const descricao = sobrescritas.descricao ?? DESCRICAO_VALIDA
  const corpo = sobrescritas.corpo ?? '# Minha Skill\n\nInstrucoes aqui.'
  return `---\nname: ${nome}\ndescription: ${descricao}\n---\n\n${corpo}\n`
}

describe('extrairFrontmatter', () => {
  it('deve separar frontmatter e corpo', () => {
    // ARRANGE
    const conteudo = skillValida()

    // ACT
    const { campos, corpo, encontrado } = extrairFrontmatter(conteudo)

    // ASSERT
    expect(encontrado).toBe(true)
    expect(campos.get('name')).toBe('minha-skill')
    expect(corpo).toContain('# Minha Skill')
  })

  it('deve sinalizar ausencia de frontmatter', () => {
    // ARRANGE / ACT
    const { encontrado } = extrairFrontmatter('# Sem frontmatter\n\nTexto.')

    // ASSERT
    expect(encontrado).toBe(false)
  })

  it('deve remover aspas envolventes do valor', () => {
    // ARRANGE
    const conteudo = `---\nname: teste\ndescription: "Descricao entre aspas"\n---\n\nCorpo.\n`

    // ACT
    const { campos } = extrairFrontmatter(conteudo)

    // ASSERT
    expect(campos.get('description')).toBe('Descricao entre aspas')
  })

  it('deve ignorar chaves aninhadas e comentarios', () => {
    // ARRANGE
    const conteudo = `---\nname: teste\n# comentario\nmetadata:\n  version: "1.0"\n---\n\nCorpo.\n`

    // ACT
    const { campos } = extrairFrontmatter(conteudo)

    // ASSERT
    expect(campos.has('metadata')).toBe(true)
    expect(campos.has('version')).toBe(false)
  })

  it('deve lidar com BOM no inicio do arquivo', () => {
    // ARRANGE
    const conteudo = `﻿${skillValida()}`

    // ACT
    const { encontrado, campos } = extrairFrontmatter(conteudo)

    // ASSERT
    expect(encontrado).toBe(true)
    expect(campos.get('name')).toBe('minha-skill')
  })
})

describe('validarNome', () => {
  it('deve aceitar nome em kebab-case', () => {
    // ARRANGE / ACT
    const problemas = validarNome('instagram-metrics')

    // ASSERT
    expect(problemas).toHaveLength(0)
  })

  it('deve rejeitar nome vazio', () => {
    // ARRANGE / ACT
    const problemas = validarNome('')

    // ASSERT
    expect(problemas[0]).toContain('vazio')
  })

  it('deve rejeitar letras maiusculas', () => {
    // ARRANGE / ACT
    const problemas = validarNome('Instagram-Metrics')

    // ASSERT
    expect(problemas.some((p) => p.includes('minusculas'))).toBe(true)
  })

  it('deve rejeitar hifen no inicio ou no fim', () => {
    // ARRANGE / ACT
    const inicio = validarNome('-skill')
    const fim = validarNome('skill-')

    // ASSERT
    expect(inicio.some((p) => p.includes('hifen'))).toBe(true)
    expect(fim.some((p) => p.includes('hifen'))).toBe(true)
  })

  it('deve rejeitar hifens consecutivos', () => {
    // ARRANGE / ACT
    const problemas = validarNome('skill--nome')

    // ASSERT
    expect(problemas.some((p) => p.includes('consecutivos'))).toBe(true)
  })

  it('deve rejeitar nome acima de 64 caracteres', () => {
    // ARRANGE / ACT
    const problemas = validarNome('a'.repeat(65))

    // ASSERT
    expect(problemas.some((p) => p.includes('maximo'))).toBe(true)
  })
})

describe('validarSkill', () => {
  it('deve aprovar uma skill bem formada', () => {
    // ARRANGE
    const conteudo = skillValida()

    // ACT
    const resultado = validarSkill('minha-skill', conteudo)

    // ASSERT
    expect(resultado.valido).toBe(true)
    expect(resultado.problemas.filter((p) => p.nivel === 'erro')).toHaveLength(0)
  })

  it('deve reprovar skill sem frontmatter', () => {
    // ARRANGE / ACT
    const resultado = validarSkill('minha-skill', '# So markdown')

    // ASSERT
    expect(resultado.valido).toBe(false)
    expect(resultado.problemas[0]?.campo).toBe('frontmatter')
  })

  it('deve reprovar quando name difere do nome do diretorio', () => {
    // ARRANGE
    const conteudo = skillValida({ nome: 'outro-nome' })

    // ACT
    const resultado = validarSkill('minha-skill', conteudo)

    // ASSERT: divergencia quebra o carregamento da skill silenciosamente
    expect(resultado.valido).toBe(false)
    expect(resultado.problemas.some((p) => p.mensagem.includes('difere do nome do diretorio'))).toBe(true)
  })

  it('deve reprovar skill sem description', () => {
    // ARRANGE
    const conteudo = `---\nname: minha-skill\n---\n\nCorpo.\n`

    // ACT
    const resultado = validarSkill('minha-skill', conteudo)

    // ASSERT
    expect(resultado.valido).toBe(false)
    expect(resultado.problemas.some((p) => p.campo === 'description')).toBe(true)
  })

  it('deve reprovar description acima de 1024 caracteres', () => {
    // ARRANGE
    const conteudo = skillValida({ descricao: 'a'.repeat(1025) })

    // ACT
    const resultado = validarSkill('minha-skill', conteudo)

    // ASSERT
    expect(resultado.valido).toBe(false)
  })

  it('deve avisar sobre description curta demais para acionar a skill', () => {
    // ARRANGE
    const conteudo = skillValida({ descricao: 'Faz coisas.' })

    // ACT
    const resultado = validarSkill('minha-skill', conteudo)

    // ASSERT: description e o unico sinal de acionamento
    expect(resultado.valido).toBe(true)
    expect(resultado.problemas.some((p) => p.nivel === 'aviso' && p.campo === 'description')).toBe(true)
  })

  it('deve reprovar compatibility acima de 500 caracteres', () => {
    // ARRANGE
    const conteudo = `---\nname: minha-skill\ndescription: ${DESCRICAO_VALIDA}\ncompatibility: ${'x'.repeat(501)}\n---\n\nCorpo.\n`

    // ACT
    const resultado = validarSkill('minha-skill', conteudo)

    // ASSERT
    expect(resultado.valido).toBe(false)
    expect(resultado.problemas.some((p) => p.campo === 'compatibility')).toBe(true)
  })

  it('deve avisar sobre campo fora da spec', () => {
    // ARRANGE
    const conteudo = `---\nname: minha-skill\ndescription: ${DESCRICAO_VALIDA}\nversion: 1.0\n---\n\nCorpo.\n`

    // ACT
    const resultado = validarSkill('minha-skill', conteudo)

    // ASSERT
    expect(resultado.valido).toBe(true)
    expect(resultado.problemas.some((p) => p.nivel === 'aviso' && p.campo === 'version')).toBe(true)
  })

  it('deve aceitar os campos opcionais previstos na spec sem avisar', () => {
    // ARRANGE
    const conteudo = `---\nname: minha-skill\ndescription: ${DESCRICAO_VALIDA}\nlicense: MIT\nallowed-tools: Read Bash\nmetadata:\n  autor: teste\n---\n\nCorpo.\n`

    // ACT
    const resultado = validarSkill('minha-skill', conteudo)

    // ASSERT
    expect(resultado.problemas.filter((p) => p.nivel === 'aviso')).toHaveLength(0)
  })

  it('deve reprovar SKILL.md sem instrucoes no corpo', () => {
    // ARRANGE
    const conteudo = `---\nname: minha-skill\ndescription: ${DESCRICAO_VALIDA}\n---\n\n   \n`

    // ACT
    const resultado = validarSkill('minha-skill', conteudo)

    // ASSERT
    expect(resultado.valido).toBe(false)
    expect(resultado.problemas.some((p) => p.campo === 'corpo')).toBe(true)
  })

  it('deve avisar quando o corpo passa de 500 linhas', () => {
    // ARRANGE
    const corpoLongo = Array.from({ length: 520 }, (_, i) => `linha ${i}`).join('\n')
    const conteudo = skillValida({ corpo: corpoLongo })

    // ACT
    const resultado = validarSkill('minha-skill', conteudo)

    // ASSERT: acima disso o disclosure progressivo deixa de funcionar
    expect(resultado.valido).toBe(true)
    expect(resultado.problemas.some((p) => p.campo === 'corpo' && p.nivel === 'aviso')).toBe(true)
  })
})
