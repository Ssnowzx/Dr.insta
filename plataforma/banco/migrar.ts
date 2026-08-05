import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import mysql from 'mysql2/promise'
import type { RowDataPacket } from 'mysql2/promise'
import { configuracaoConexao, esperarBanco } from './conexao.ts'

/**
 * Aplica os arquivos de `banco/migracoes/` em ordem alfabética, uma vez cada.
 *
 * A tabela `migracao` é criada aqui, não na 001: se ela nascesse na primeira
 * migração, a 001 precisaria registrar a si mesma numa tabela que ela ainda
 * está criando.
 *
 * Uso:
 *   npm run banco:migrar     aplica o que falta
 *   npm run banco:estado     só lista, não altera nada
 */

const PASTA = join(import.meta.dirname, 'migracoes')

const CRIAR_CONTROLE = `
  CREATE TABLE IF NOT EXISTS migracao (
    arquivo     VARCHAR(120) NOT NULL,
    aplicada_em DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (arquivo)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

interface LinhaMigracao extends RowDataPacket {
  arquivo: string
  aplicada_em: Date
}

async function listarArquivos (): Promise<string[]> {
  const entradas = await readdir(PASTA)
  return entradas.filter(nome => nome.endsWith('.sql')).sort()
}

async function principal (): Promise<void> {
  const soListar = process.argv.includes('--estado')

  await esperarBanco()

  /* `multipleStatements` fica restrito a esta conexão, que só executa arquivo
     versionado do próprio repositório. O pool da aplicação não recebe esta
     permissão — ali ela seria uma porta aberta para SQL injection encadeada. */
  const conn = await mysql.createConnection({
    ...configuracaoConexao(),
    multipleStatements: true
  })

  try {
    await conn.query(CRIAR_CONTROLE)

    const [linhas] = await conn.query<LinhaMigracao[]>(
      'SELECT arquivo, aplicada_em FROM migracao ORDER BY arquivo'
    )
    const aplicadas = new Map(linhas.map(l => [l.arquivo, l.aplicada_em]))
    const arquivos = await listarArquivos()

    if (arquivos.length === 0) {
      console.log('Nenhum arquivo .sql em banco/migracoes/.')
      return
    }

    if (soListar) {
      console.log('Estado das migrações:\n')
      for (const arquivo of arquivos) {
        const quando = aplicadas.get(arquivo)
        console.log(
          quando
            ? `  ✓ ${arquivo}  aplicada em ${quando.toISOString()}`
            : `  · ${arquivo}  pendente`
        )
      }
      const orfas = [...aplicadas.keys()].filter(a => !arquivos.includes(a))
      if (orfas.length > 0) {
        console.log('\n⚠ Registradas no banco mas ausentes do repositório:')
        for (const orfa of orfas) console.log(`  ? ${orfa}`)
      }
      return
    }

    const pendentes = arquivos.filter(a => !aplicadas.has(a))
    if (pendentes.length === 0) {
      console.log(`Banco em dia — ${arquivos.length} migração(ões) já aplicada(s).`)
      return
    }

    for (const arquivo of pendentes) {
      const sql = await readFile(join(PASTA, arquivo), 'utf8')
      process.stdout.write(`Aplicando ${arquivo} ... `)

      /* DDL no MySQL faz commit implícito: não existe migração transacional de
         CREATE TABLE. Se um arquivo falhar no meio, parte dele ficou aplicada e
         o registro NÃO é gravado. Por isso paramos aqui em vez de seguir para o
         próximo — continuar deixaria o banco num estado que ninguém consegue
         descrever. */
      await conn.query(sql)
      await conn.query('INSERT INTO migracao (arquivo) VALUES (?)', [arquivo])
      console.log('ok')
    }

    console.log(`\n${pendentes.length} migração(ões) aplicada(s).`)
  } finally {
    await conn.end()
  }
}

principal().catch((erro: unknown) => {
  const motivo = erro instanceof Error ? erro.message : String(erro)
  console.error(`\nFalhou: ${motivo}`)
  process.exitCode = 1
})
