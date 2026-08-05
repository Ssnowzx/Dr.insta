import { drizzle } from 'drizzle-orm/mysql2'
import type { MySql2Database } from 'drizzle-orm/mysql2'
import { db as pool } from './connection.ts'
import * as schema from './schema.ts'

/**
 * The single Drizzle instance, on top of the pool from `connection.ts`.
 *
 * `mode: 'default'` is correct for a self-hosted MySQL; `'planetscale'` changes
 * transaction behaviour and does not apply here.
 *
 * Deliberately without `casing: 'snake_case'` — every column whose name differs
 * from its property is spelled out in `schema.ts`, and `test/schema.test.ts`
 * checks that against information_schema. Relying on a global option would mean
 * that forgetting it generates queries against columns that do not exist, with
 * the error surfacing far from the cause.
 */
let instance: MySql2Database<typeof schema> | undefined

export function orm (): MySql2Database<typeof schema> {
  instance ??= drizzle(pool(), { schema, mode: 'default' })
  return instance
}

export { schema }
