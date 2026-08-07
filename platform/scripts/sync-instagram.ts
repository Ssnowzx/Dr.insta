import { eq } from 'drizzle-orm'
import { orm } from '../db/client.ts'
import { db, waitForDatabase } from '../db/connection.ts'
import { client } from '../db/schema.ts'
import { connectionFor } from '../lib/instagram/connection.ts'
import { currentPeriod, syncClient } from '../lib/instagram/sync.ts'

/**
 * The daily collection, run from cron on the host.
 *
 * A CLI and not a job inside the Next server: a timer in the server dies on
 * every restart, keeps no log of its own, and cannot be run by hand when
 * somebody wants to see what it does. The rest of this project's operations —
 * migrate, seed, invite, link — are commands, and this is one too.
 *
 * Usage:
 *   npm run sync:instagram
 *   npm run sync:instagram -- --period 2026-07-01    # backfill one month
 *
 * Exit code is 1 on failure so cron's own mail (or a monitor) notices. The
 * failure is ALSO written to the connection row, which is what reaches the
 * consultant's screen — a routine that only fails into a log nobody reads is a
 * routine that fails silently.
 */

function arg (flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  if (i === -1) return undefined
  const value = process.argv[i + 1]
  return value === undefined || value.startsWith('--') ? undefined : value
}

async function main (): Promise<void> {
  const period = arg('--period') ?? currentPeriod()

  if (!/^\d{4}-\d{2}-01$/.test(period)) {
    console.error(`\n--period must be YYYY-MM-01; got "${period}".\n`)
    process.exitCode = 1
    return
  }

  const slug = process.env.TENANT_SLUG?.trim()
  if (slug === undefined || slug === '') {
    console.error('\nTENANT_SLUG is not set. See .env.exemplo.\n')
    process.exitCode = 1
    return
  }

  await waitForDatabase()

  const rows = await orm()
    .select({ id: client.id, name: client.name })
    .from(client)
    .where(eq(client.slug, slug))
    .limit(1)

  const found = rows[0]
  if (found === undefined) {
    console.error(`\nNo client with slug "${slug}".\n`)
    process.exitCode = 1
    return
  }

  const before = await connectionFor(found.id)
  if (before === null) {
    /* Not an error: nobody has connected an account yet. Exit 0 so a cron entry
       on a fresh install does not report failure every night. */
    console.log(`${found.name}: no Instagram account connected. Nothing to do.`)
    return
  }

  const result = await syncClient(found.id, period)

  if (result.ok) {
    console.log(
      `${found.name}: ${result.stored} metric(s) stored for ${period}` +
      `${result.refreshed ? ', credential refreshed' : ''}` +
      ` (${result.calls} API call${result.calls === 1 ? '' : 's'}).`
    )
    return
  }

  console.error(`\n${found.name}: collection failed — ${result.error ?? 'unknown reason'}`)
  if (result.needsReconnect === true) {
    console.error('The credential is no longer valid. She has to reconnect from Conta.')
  }
  console.error('')

  process.exitCode = 1
}

main()
  .catch((error: unknown) => {
    const reason = error instanceof Error ? error.message : String(error)
    console.error(`\nFailed: ${reason}`)
    process.exitCode = 1
  })
  .finally(() => { void db().end() })
