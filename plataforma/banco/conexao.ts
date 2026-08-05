import mysql from 'mysql2/promise'
import type { ConnectionOptions, Pool, PoolOptions } from 'mysql2/promise'

/**
 * Configuração de uma conexão avulsa, lida do ambiente.
 *
 * `timezone: 'Z'` junto com o servidor em `--default-time-zone=+00:00` é o que
 * sustenta a promessa do esquema: todo DATETIME gravado é UTC. Sem isso, o
 * driver converte pelo fuso do processo e o mesmo instante vira dois valores
 * diferentes conforme a máquina que gravou.
 *
 * `decimalNumbers: false` mantém DECIMAL(16,6) como string. É intencional:
 * converter para `number` reintroduz ponto flutuante exatamente na coluna que
 * guarda dinheiro. A formatação acontece na borda, com o valor íntegro na mão.
 */
export function configuracaoConexao (): ConnectionOptions {
  const exigir = (chave: string): string => {
    const valor = process.env[chave]
    if (valor === undefined || valor.trim() === '') {
      throw new Error(`Variável de ambiente ausente: ${chave}. Veja .env.exemplo.`)
    }
    return valor
  }

  return {
    host: exigir('BANCO_HOST'),
    port: Number(process.env.BANCO_PORTA ?? 3306),
    user: exigir('BANCO_USUARIO'),
    password: exigir('BANCO_SENHA'),
    database: exigir('BANCO_NOME'),
    charset: 'utf8mb4_unicode_ci',
    timezone: 'Z',
    decimalNumbers: false,
    dateStrings: false,
    supportBigNumbers: true,
    bigNumberStrings: false
  }
}

/**
 * Configuração do pool: a de conexão mais o que só existe em pool.
 *
 * Separado de propósito. `createConnection` recusa opções de pool sob
 * `exactOptionalPropertyTypes`, e passar `connectionLimit: undefined` para
 * contornar isso é o tipo de gambiarra que sobrevive até virar bug.
 */
export function configuracaoPool (): PoolOptions {
  return {
    ...configuracaoConexao(),
    connectionLimit: 10,
    enableKeepAlive: true,
    waitForConnections: true,
    queueLimit: 0
  }
}

let pool: Pool | undefined

/** Pool único do processo. Next recria módulos em desenvolvimento; sem o cache, cada recarga abriria um pool novo. */
export function conexao (): Pool {
  pool ??= mysql.createPool(configuracaoPool())
  return pool
}

/**
 * Espera o banco aceitar conexão.
 *
 * O `depends_on: service_healthy` do Compose já cobre a subida normal, mas
 * migração rodada à mão logo depois de `docker compose up` pega o MySQL no meio
 * da inicialização. Errar aqui produz "connection refused", que parece erro de
 * senha e manda você procurar no lugar errado.
 */
export async function esperarBanco (tentativas = 30, intervaloMs = 2000): Promise<void> {
  const cfg = configuracaoConexao()
  for (let i = 1; i <= tentativas; i++) {
    try {
      const conn = await mysql.createConnection(cfg)
      await conn.ping()
      await conn.end()
      return
    } catch (erro) {
      if (i === tentativas) {
        const motivo = erro instanceof Error ? erro.message : String(erro)
        throw new Error(`Banco não respondeu após ${tentativas} tentativas: ${motivo}`)
      }
      await new Promise(resolve => setTimeout(resolve, intervaloMs))
    }
  }
}
