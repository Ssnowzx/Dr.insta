import mysql from 'mysql2/promise'
import type { ConnectionOptions, Pool, PoolOptions } from 'mysql2/promise'

/**
 * Single-connection settings, read from the environment.
 *
 * `timezone: 'Z'` together with the server running `--default-time-zone=+00:00`
 * is what upholds the schema's promise: every DATETIME written is UTC. Without
 * it the driver converts using the process timezone, and the same instant
 * becomes two different values depending on which machine wrote it.
 *
 * `decimalNumbers: false` keeps DECIMAL(16,6) as a string. That is deliberate:
 * converting to `number` reintroduces floating point in exactly the column that
 * holds money. Formatting happens at the edge, with the intact value in hand.
 */
export function connectionSettings (): ConnectionOptions {
  const required = (key: string): string => {
    const value = process.env[key]
    if (value === undefined || value.trim() === '') {
      throw new Error(`Missing environment variable: ${key}. See .env.exemplo.`)
    }
    return value
  }

  return {
    host: required('DB_HOST'),
    port: Number(process.env.DB_PORT ?? 3306),
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
    database: required('DB_NAME'),
    charset: 'utf8mb4_unicode_ci',
    timezone: 'Z',
    decimalNumbers: false,
    dateStrings: false,
    supportBigNumbers: true,
    bigNumberStrings: false
  }
}

/**
 * Pool settings: the connection settings plus what only exists on a pool.
 *
 * Kept separate on purpose. `createConnection` rejects pool-only options under
 * `exactOptionalPropertyTypes`, and passing `connectionLimit: undefined` to work
 * around that is the kind of hack that survives until it becomes a bug.
 */
export function poolSettings (): PoolOptions {
  return {
    ...connectionSettings(),
    connectionLimit: 10,
    enableKeepAlive: true,
    waitForConnections: true,
    queueLimit: 0
  }
}

let pool: Pool | undefined

/** One pool per process. Next re-evaluates modules in dev; without the cache every reload would open a new pool. */
export function db (): Pool {
  pool ??= mysql.createPool(poolSettings())
  return pool
}

/**
 * Waits until the database accepts connections.
 *
 * Compose's `depends_on: service_healthy` covers a normal boot, but a migration
 * run by hand right after `docker compose up` catches MySQL mid-initialisation.
 * Getting this wrong yields "connection refused", which looks like a password
 * problem and sends you looking in the wrong place.
 */
export async function waitForDatabase (attempts = 30, intervalMs = 2000): Promise<void> {
  const settings = connectionSettings()
  for (let i = 1; i <= attempts; i++) {
    try {
      const conn = await mysql.createConnection(settings)
      await conn.ping()
      await conn.end()
      return
    } catch (error) {
      if (i === attempts) {
        const reason = error instanceof Error ? error.message : String(error)
        throw new Error(`Database did not respond after ${attempts} attempts: ${reason}`)
      }
      await new Promise(resolve => setTimeout(resolve, intervalMs))
    }
  }
}
