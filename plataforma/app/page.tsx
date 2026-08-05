import { conexao } from '@/banco/conexao'
import type { RowDataPacket } from 'mysql2/promise'

/**
 * Página de fundação: confirma que o app fala com o banco e que as migrações
 * rodaram. É substituída pela tela de entrada na Fase 2.
 */
export const dynamic = 'force-dynamic'

interface Contagem extends RowDataPacket { tabelas: number }

async function estadoDoBanco (): Promise<{ ok: boolean; tabelas: number; motivo?: string }> {
  try {
    const [linhas] = await conexao().query<Contagem[]>(
      'SELECT COUNT(*) AS tabelas FROM information_schema.tables WHERE table_schema = DATABASE()'
    )
    return { ok: true, tabelas: linhas[0]?.tabelas ?? 0 }
  } catch (erro) {
    return { ok: false, tabelas: 0, motivo: erro instanceof Error ? erro.message : String(erro) }
  }
}

export default async function Inicio () {
  const estado = await estadoDoBanco()

  return (
    <main style={{ maxWidth: '38rem', margin: '0 auto', padding: '3rem 1.25rem' }}>
      <h1 style={{ fontSize: '1.5rem', margin: '0 0 .5rem' }}>Plataforma — fundação</h1>
      <p style={{ color: 'var(--suave)', margin: '0 0 2rem' }}>
        Fase 1. As telas entram nas fases seguintes.
      </p>

      {estado.ok
        ? (
          <p>
            Banco conectado — <strong>{estado.tabelas}</strong> tabela(s) no esquema.
            {estado.tabelas === 0 && ' Rode `npm run banco:migrar`.'}
          </p>
          )
        : (
          <p>
            Banco indisponível.{' '}
            <span style={{ color: 'var(--suave)' }}>{estado.motivo}</span>
          </p>
          )}
    </main>
  )
}
