import { describe, expect, it, afterAll } from 'vitest'
import { is } from 'drizzle-orm'
import { getTableConfig, MySqlTable } from 'drizzle-orm/mysql-core'
import type { RowDataPacket } from 'mysql2/promise'
import mysql from 'mysql2/promise'
import { connectionSettings } from '../db/connection.ts'
import * as schema from '../db/schema.ts'

/**
 * Guards against this project's quietest divergence: a column declared in
 * Drizzle that does not exist in the database.
 *
 * TypeScript will not catch it — `clientId` compiles beautifully while pointing
 * at a `clientId` column MySQL has never heard of. The error shows up at
 * runtime, in some query, far from the cause. This compares the declaration
 * against information_schema and reports the whole divergence at once.
 *
 * Needs the database running:
 *   docker compose -f docker-compose.yml -f compose.dev.yml up -d db
 *   npm run db:migrate
 */

interface ColumnRow extends RowDataPacket {
  TABLE_NAME: string
  COLUMN_NAME: string
  IS_NULLABLE: 'YES' | 'NO'
}

const conn = await mysql.createConnection(connectionSettings())

afterAll(async () => { await conn.end() })

const [columns] = await conn.query<ColumnRow[]>(
  `SELECT TABLE_NAME, COLUMN_NAME, IS_NULLABLE
     FROM information_schema.columns
    WHERE table_schema = DATABASE()`
)

/** table -> set of columns MySQL actually has. */
const actual = new Map<string, Set<string>>()
for (const c of columns) {
  const name = c.TABLE_NAME
  let set = actual.get(name)
  if (set === undefined) {
    set = new Set<string>()
    actual.set(name, set)
  }
  set.add(c.COLUMN_NAME)
}

/* Drizzle's `is()` rather than `typeof === 'object'`: the module also exports
   types and helpers, and `getTableConfig` on a non-table blows up with a
   message that helps nobody. */
const declared: Array<[string, MySqlTable]> = []
for (const [name, value] of Object.entries(schema)) {
  if (is(value, MySqlTable)) declared.push([name, value])
}

describe('Drizzle schema against the database', () => {
  it('should declare at least one table', () => {
    // ARRANGE / ACT — collection happens at module top level
    // ASSERT
    expect(declared.length).toBeGreaterThan(0)
    expect(actual.size).toBeGreaterThan(0)
  })

  it.each(declared)('should match every column of %s against the database', (_name, table) => {
    // ARRANGE
    const cfg = getTableConfig(table)
    const actualColumns = actual.get(cfg.name)

    // ACT
    const missing = cfg.columns
      .map(c => c.name)
      .filter(name => actualColumns === undefined || !actualColumns.has(name))

    // ASSERT
    expect(actualColumns, `table "${cfg.name}" does not exist in the database`).toBeDefined()
    expect(missing, `columns declared but absent from "${cfg.name}"`).toEqual([])
  })

  it('should cover every table in the database except migration bookkeeping', () => {
    // ARRANGE
    const declaredNames = new Set(declared.map(([, t]) => getTableConfig(t).name))

    // ACT
    const undeclared = [...actual.keys()]
      .filter(name => name !== 'migration' && !declaredNames.has(name))

    // ASSERT — a table with no type in code is code nobody wrote yet
    expect(undeclared).toEqual([])
  })
})

/**
 * Two guarantees the Instagram connection leans on, asserted against MySQL
 * rather than against the Drizzle declaration — the declaration is what this
 * file exists to distrust.
 */
describe('instagram_connection constraints', () => {
  it('should allow only one connection per client', async () => {
    // ARRANGE
    /* Explicit lowercase aliases: MySQL returns information_schema columns
       upper-cased, and only aliases come back as written. */
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT index_name AS name, non_unique AS notUnique,
              GROUP_CONCAT(column_name ORDER BY seq_in_index) AS cols
         FROM information_schema.statistics
        WHERE table_schema = DATABASE() AND table_name = 'instagram_connection'
        GROUP BY index_name, non_unique`
    )

    // ACT — a second row for the same client must be refused by the database,
    // not by whoever remembers to check before inserting
    const onClient = rows.find(r => r.cols === 'client_id')

    // ASSERT
    expect(onClient, 'no index on client_id alone').toBeDefined()
    expect(Number(onClient?.notUnique)).toBe(0)
  })

  it('should accept api as a metric_value source', async () => {
    // ARRANGE
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT column_type AS type
         FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'metric_value' AND column_name = 'source'`
    )

    // ACT
    const type = String(rows[0]?.type ?? '')

    // ASSERT — `insights` must survive alongside it: it is the fallback for the
    // day the API changes, and the reason precedence exists at all
    expect(type).toContain("'api'")
    expect(type).toContain("'insights'")
  })
})
