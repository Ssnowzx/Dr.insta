import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'

import { analisar, comparar } from '@/dominio/diagnostico.js'
import { formatarAnalise, formatarComparacao } from '@/dominio/relatorio.js'
import { lerCsv } from '@/infra/csv.js'
import type { Analise, ResultadoParse } from '@/tipos/index.js'

/**
 * CLI do motor de metricas.
 *
 * Uso:
 *   npm run ig -- analisar <caminho.csv> [--nicho <nicho>]
 *   npm run ig -- comparar <anterior.csv> <atual.csv> [--nicho <nicho>]
 *   npm run ig -- exemplo
 */

const AJUDA = `
Motor de metricas de Instagram

  npm run ig -- analisar <arquivo.csv> [--nicho <nicho>]
      Calcula taxas por alcance, agrupa por formato/pilar e gera diagnostico.

  npm run ig -- comparar <anterior.csv> <atual.csv> [--nicho <nicho>]
      Compara dois periodos e mostra o que se moveu acima do ruido.

  npm run ig -- exemplo
      Roda a analise sobre dados/exemplos/posts-exemplo.csv (smoke test).

Nichos disponiveis: negocios-marketing (padrao), tech-software, lifestyle.
`

function extrairNicho(args: readonly string[]): string | undefined {
  const indice = args.indexOf('--nicho')
  if (indice === -1) return undefined
  return args[indice + 1]
}

function carregar(caminho: string): ResultadoParse {
  const absoluto = resolve(process.cwd(), caminho)
  let conteudo: string
  try {
    conteudo = readFileSync(absoluto, 'utf8')
  } catch {
    throw new Error(`Nao foi possivel ler o arquivo: ${absoluto}`)
  }
  return lerCsv(conteudo)
}

function reportarErros(caminho: string, resultado: ResultadoParse): void {
  if (resultado.erros.length === 0) return
  process.stderr.write(`\nAvisos de leitura em ${caminho}:\n`)
  for (const erro of resultado.erros) {
    process.stderr.write(`  linha ${erro.linha}: ${erro.motivo}\n`)
  }
  process.stderr.write('\n')
}

function analisarArquivo(caminho: string, nicho: string | undefined): Analise {
  const resultado = carregar(caminho)
  reportarErros(caminho, resultado)

  if (resultado.posts.length === 0) {
    throw new Error(
      `Nenhum post valido em ${caminho}. Confira o cabecalho: sao obrigatorias as colunas data, formato e alcance.`,
    )
  }

  return analisar(resultado.posts, nicho, new Date())
}

function main(argv: readonly string[]): number {
  const args = argv.slice(2)
  const comando = args[0]

  if (comando === undefined || comando === '--help' || comando === '-h') {
    process.stdout.write(AJUDA)
    return 0
  }

  const nicho = extrairNicho(args)

  try {
    if (comando === 'exemplo') {
      const analise = analisarArquivo('dados/exemplos/posts-exemplo.csv', nicho)
      process.stdout.write(formatarAnalise(analise))
      return 0
    }

    if (comando === 'analisar') {
      const caminho = args[1]
      if (caminho === undefined || caminho.startsWith('--')) {
        process.stderr.write('Informe o caminho do CSV. Ex.: npm run ig -- analisar dados/metricas/jan.csv\n')
        return 1
      }
      process.stdout.write(formatarAnalise(analisarArquivo(caminho, nicho)))
      return 0
    }

    if (comando === 'comparar') {
      const anterior = args[1]
      const atual = args[2]
      if (anterior === undefined || atual === undefined || atual.startsWith('--')) {
        process.stderr.write('Informe dois CSVs. Ex.: npm run ig -- comparar dados/metricas/jan.csv dados/metricas/fev.csv\n')
        return 1
      }
      const comparacao = comparar(
        analisarArquivo(anterior, nicho),
        analisarArquivo(atual, nicho),
      )
      process.stdout.write(formatarComparacao(comparacao))
      return 0
    }

    process.stderr.write(`Comando desconhecido: ${comando}\n${AJUDA}`)
    return 1
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro)
    process.stderr.write(`Erro: ${mensagem}\n`)
    return 1
  }
}

process.exitCode = main(process.argv)
