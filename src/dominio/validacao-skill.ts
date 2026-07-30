/**
 * Validacao de SKILL.md contra a Agent Skills Specification.
 *
 * Regras implementadas conforme https://agentskills.io/specification:
 * - frontmatter YAML delimitado por `---`
 * - `name`: 1-64 chars, [a-z0-9-], sem hifen inicial/final, sem `--`, igual ao diretorio
 * - `description`: 1-1024 chars, nao vazia
 * - `compatibility`: no maximo 500 chars
 * - corpo do SKILL.md abaixo de 500 linhas (recomendacao de disclosure progressivo)
 */

/** Severidade do problema encontrado. `erro` reprova; `aviso` apenas sinaliza. */
export type NivelProblema = 'erro' | 'aviso'

export interface ProblemaSkill {
  readonly nivel: NivelProblema
  readonly campo: string
  readonly mensagem: string
}

export interface ResultadoValidacaoSkill {
  readonly nome: string
  readonly valido: boolean
  readonly problemas: readonly ProblemaSkill[]
}

const MAX_NOME = 64
const MAX_DESCRICAO = 1024
const MAX_COMPATIBILIDADE = 500
const MAX_LINHAS_CORPO = 500

/** Campos de frontmatter reconhecidos pela spec. */
const CAMPOS_CONHECIDOS: readonly string[] = [
  'name',
  'description',
  'license',
  'compatibility',
  'metadata',
  'allowed-tools',
]

interface Frontmatter {
  readonly campos: ReadonlyMap<string, string>
  readonly corpo: string
  readonly encontrado: boolean
}

/**
 * Extrai o frontmatter de forma minimalista.
 *
 * Le apenas pares `chave: valor` de primeiro nivel — que e tudo que a spec define
 * como escalar. Chaves aninhadas (como `metadata:`) sao registradas com valor vazio,
 * o suficiente para saber que existem sem precisar de um parser YAML completo.
 */
export function extrairFrontmatter(conteudo: string): Frontmatter {
  const normalizado = conteudo.replace(/^﻿/, '')
  const casamento = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(normalizado)

  if (casamento === null) {
    return { campos: new Map(), corpo: normalizado, encontrado: false }
  }

  const bloco = casamento[1] ?? ''
  const corpo = casamento[2] ?? ''
  const campos = new Map<string, string>()

  for (const linha of bloco.split(/\r?\n/)) {
    if (linha.trim() === '' || linha.trimStart().startsWith('#')) continue
    // Apenas chaves de primeiro nivel (sem indentacao).
    if (/^\s/.test(linha)) continue

    const separador = linha.indexOf(':')
    if (separador === -1) continue

    const chave = linha.slice(0, separador).trim()
    let valor = linha.slice(separador + 1).trim()

    // Remove aspas envolventes, comuns em descriptions longas.
    if (
      (valor.startsWith('"') && valor.endsWith('"') && valor.length >= 2) ||
      (valor.startsWith("'") && valor.endsWith("'") && valor.length >= 2)
    ) {
      valor = valor.slice(1, -1)
    }

    campos.set(chave, valor)
  }

  return { campos, corpo, encontrado: true }
}

/** Verifica se o `name` respeita as regras de formato da spec. */
export function validarNome(nome: string): readonly string[] {
  const problemas: string[] = []

  if (nome.length === 0) {
    problemas.push('`name` esta vazio.')
    return problemas
  }
  if (nome.length > MAX_NOME) {
    problemas.push(`\`name\` tem ${nome.length} caracteres; o maximo e ${MAX_NOME}.`)
  }
  if (!/^[a-z0-9-]+$/.test(nome)) {
    problemas.push('`name` so pode conter letras minusculas, numeros e hifens.')
  }
  if (nome.startsWith('-') || nome.endsWith('-')) {
    problemas.push('`name` nao pode comecar nem terminar com hifen.')
  }
  if (nome.includes('--')) {
    problemas.push('`name` nao pode conter hifens consecutivos.')
  }

  return problemas
}

/**
 * Valida o conteudo de um SKILL.md.
 *
 * `nomeDiretorio` e comparado com o campo `name`, porque a spec exige que sejam iguais
 * — e divergencia ai quebra o carregamento da skill silenciosamente.
 */
export function validarSkill(
  nomeDiretorio: string,
  conteudo: string,
): ResultadoValidacaoSkill {
  const problemas: ProblemaSkill[] = []
  const { campos, corpo, encontrado } = extrairFrontmatter(conteudo)

  if (!encontrado) {
    return {
      nome: nomeDiretorio,
      valido: false,
      problemas: [
        {
          nivel: 'erro',
          campo: 'frontmatter',
          mensagem: 'SKILL.md sem frontmatter YAML delimitado por `---`.',
        },
      ],
    }
  }

  const nome = campos.get('name')
  if (nome === undefined) {
    problemas.push({ nivel: 'erro', campo: 'name', mensagem: '`name` ausente (obrigatorio).' })
  } else {
    for (const m of validarNome(nome)) {
      problemas.push({ nivel: 'erro', campo: 'name', mensagem: m })
    }
    if (nome !== nomeDiretorio) {
      problemas.push({
        nivel: 'erro',
        campo: 'name',
        mensagem: `\`name\` ("${nome}") difere do nome do diretorio ("${nomeDiretorio}"). A spec exige que sejam iguais.`,
      })
    }
  }

  const descricao = campos.get('description')
  if (descricao === undefined || descricao === '') {
    problemas.push({
      nivel: 'erro',
      campo: 'description',
      mensagem: '`description` ausente ou vazia (obrigatoria).',
    })
  } else {
    if (descricao.length > MAX_DESCRICAO) {
      problemas.push({
        nivel: 'erro',
        campo: 'description',
        mensagem: `\`description\` tem ${descricao.length} caracteres; o maximo e ${MAX_DESCRICAO}.`,
      })
    }
    if (descricao.length < 40) {
      problemas.push({
        nivel: 'aviso',
        campo: 'description',
        mensagem:
          '`description` muito curta. Ela e o unico sinal de acionamento da skill — descreva o que faz E quando usar, com palavras-chave que o usuario realmente digitaria.',
      })
    }
  }

  const compatibilidade = campos.get('compatibility')
  if (compatibilidade !== undefined && compatibilidade.length > MAX_COMPATIBILIDADE) {
    problemas.push({
      nivel: 'erro',
      campo: 'compatibility',
      mensagem: `\`compatibility\` tem ${compatibilidade.length} caracteres; o maximo e ${MAX_COMPATIBILIDADE}.`,
    })
  }

  for (const chave of campos.keys()) {
    if (!CAMPOS_CONHECIDOS.includes(chave)) {
      problemas.push({
        nivel: 'aviso',
        campo: chave,
        mensagem: `Campo "${chave}" nao faz parte da spec. Campos livres devem ir dentro de \`metadata\`.`,
      })
    }
  }

  const linhasCorpo = corpo.split(/\r?\n/).length
  if (linhasCorpo > MAX_LINHAS_CORPO) {
    problemas.push({
      nivel: 'aviso',
      campo: 'corpo',
      mensagem: `Corpo com ${linhasCorpo} linhas (recomendado ate ${MAX_LINHAS_CORPO}). Mova detalhe para \`references/\` e aponte de dentro do SKILL.md.`,
    })
  }

  if (corpo.trim() === '') {
    problemas.push({
      nivel: 'erro',
      campo: 'corpo',
      mensagem: 'SKILL.md sem instrucoes abaixo do frontmatter.',
    })
  }

  return {
    nome: nome ?? nomeDiretorio,
    valido: !problemas.some((p) => p.nivel === 'erro'),
    problemas,
  }
}
