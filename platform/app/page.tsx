import { db } from '@/db/connection'
import type { RowDataPacket } from 'mysql2/promise'

/**
 * Foundation page: confirms the app talks to the database and that migrations
 * ran. Replaced by the sign-in screen in phase 2.
 *
 * Visible text is pt-BR \u2014 it is what a person reads.
 */
export const dynamic = 'force-dynamic'

interface TableCount extends RowDataPacket { tables: number }

async function databaseState (): Promise<{ ok: boolean; tables: number; reason?: string }> {
  try {
    const [rows] = await db().query<TableCount[]>(
      'SELECT COUNT(*) AS tables FROM information_schema.tables WHERE table_schema = DATABASE()'
    )
    return { ok: true, tables: rows[0]?.tables ?? 0 }
  } catch (error) {
    return { ok: false, tables: 0, reason: error instanceof Error ? error.message : String(error) }
  }
}

export default async function Home () {
  const state = await databaseState()

  return (
    <main style={{ maxWidth: '38rem', margin: '0 auto', padding: '3rem 1.25rem' }}>
      <h1 style={{ fontSize: '1.5rem', margin: '0 0 .5rem' }}>Plataforma \u2014 funda\u00e7\u00e3o</h1>
      <p style={{ color: 'var(--suave)', margin: '0 0 2rem' }}>
        Fase 1. As telas entram nas fases seguintes.
      </p>

      {state.ok
        ? (
          <p>
            Banco conectado \u2014 <strong>{state.tables}</strong> tabela(s) no esquema.
            {state.tables === 0 && ' Rode `npm run db:migrate`.'}
          </p>
          )
        : (
          <p>
            Banco indispon\u00edvel.{' '}
            <span style={{ color: 'var(--suave)' }}>{state.reason}</span>
          </p>
          )}
    </main>
  )
}
