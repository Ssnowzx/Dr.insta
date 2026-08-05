import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import mysql from 'mysql2/promise'
import type { RowDataPacket } from 'mysql2/promise'
import { connectionSettings, waitForDatabase } from './connection.ts'

/**
 * Applies the files in `db/migrations/` in alphabetical order, once each.
 *
 * The `migration` table is created here rather than in 001: if it were born in
 * the first migration, 001 would have to record itself in a table it is still
 * creating.
 *
 * Usage:
 *   npm run db:migrate   apply what is pending
 *   npm run db:status    list only, change nothing
 */

const FOLDER = join(import.meta.dirname, 'migrations')

const CREATE_BOOKKEEPING = `
  CREATE TABLE IF NOT EXISTS migration (
    filename    VARCHAR(120) NOT NULL,
    applied_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (filename)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

interface MigrationRow extends RowDataPacket {
  filename: string
  applied_at: Date
}

async function listFiles (): Promise<string[]> {
  const entries = await readdir(FOLDER)
  return entries.filter(name => name.endsWith('.sql')).sort()
}

async function main (): Promise<void> {
  const listOnly = process.argv.includes('--status')

  await waitForDatabase()

  /* `multipleStatements` is scoped to this connection, which only ever runs
     version-controlled files from this repository. The application pool does
     NOT get this permission — there it would be an open door to chained SQL
     injection. */
  const conn = await mysql.createConnection({
    ...connectionSettings(),
    multipleStatements: true
  })

  try {
    await conn.query(CREATE_BOOKKEEPING)

    const [rows] = await conn.query<MigrationRow[]>(
      'SELECT filename, applied_at FROM migration ORDER BY filename'
    )
    const applied = new Map(rows.map(r => [r.filename, r.applied_at]))
    const files = await listFiles()

    if (files.length === 0) {
      console.log('No .sql files in db/migrations/.')
      return
    }

    if (listOnly) {
      console.log('Migration status:\n')
      for (const file of files) {
        const when = applied.get(file)
        console.log(
          when
            ? `  ✓ ${file}  applied at ${when.toISOString()}`
            : `  · ${file}  pending`
        )
      }
      const orphans = [...applied.keys()].filter(a => !files.includes(a))
      if (orphans.length > 0) {
        console.log('\n! Recorded in the database but missing from the repository:')
        for (const orphan of orphans) console.log(`  ? ${orphan}`)
      }
      return
    }

    const pending = files.filter(f => !applied.has(f))
    if (pending.length === 0) {
      console.log(`Up to date — ${files.length} migration(s) already applied.`)
      return
    }

    for (const file of pending) {
      const sql = await readFile(join(FOLDER, file), 'utf8')
      process.stdout.write(`Applying ${file} ... `)

      /* DDL in MySQL commits implicitly: there is no transactional CREATE TABLE
         migration. If a file fails midway, part of it has been applied and the
         bookkeeping row is NOT written. That is why we stop here instead of
         moving to the next one — continuing would leave the database in a state
         nobody can describe. */
      await conn.query(sql)
      await conn.query('INSERT INTO migration (filename) VALUES (?)', [file])
      console.log('ok')
    }

    console.log(`\n${pending.length} migration(s) applied.`)
  } finally {
    await conn.end()
  }
}

main().catch((error: unknown) => {
  const reason = error instanceof Error ? error.message : String(error)
  console.error(`\nFailed: ${reason}`)
  process.exitCode = 1
})
