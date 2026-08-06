import { and, eq } from 'drizzle-orm'
import { orm } from '../db/client.ts'
import { db, waitForDatabase } from '../db/connection.ts'
import { user } from '../db/schema.ts'
import { activeClientIds, digestFor } from '../lib/digest.ts'
import { sendDigest } from '../lib/mail.ts'

/**
 * The daily summary, run from cron.
 *
 * Without it the consultant learns nothing until he opens a page: if she marks
 * "travou" at 11pm on a Sunday, that sits there until he happens to look.
 *
 * Usage:
 *   npm run digest                 last 24 hours, sends
 *   npm run digest -- --horas 48   a wider window
 *   npm run digest -- --seco       prints what it would send, sends nothing
 *
 * Cron on the host, 8am São Paulo:
 *   0 8 * * *  cd /srv/myfavorite && docker compose exec -T app \
 *              node --env-file-if-exists=.env node_modules/.bin/tsx scripts/digest.ts
 */

function arg (flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  if (i === -1) return undefined
  const value = process.argv[i + 1]
  return value === undefined || value.startsWith('--') ? undefined : value
}

async function main (): Promise<void> {
  const hours = Number(arg('--horas') ?? 24)
  const dry = process.argv.includes('--seco')

  if (!Number.isFinite(hours) || hours <= 0) {
    console.error('\n--horas must be a positive number.\n')
    process.exit(1)
  }

  await waitForDatabase()

  const until = new Date()
  const since = new Date(until.getTime() - hours * 60 * 60 * 1000)

  /* Consultants are the recipients. A client must never receive a summary of
     her own activity, and a deactivated account must not keep getting mail
     after being switched off. */
  const recipients = await orm()
    .select({ email: user.email, name: user.name })
    .from(user)
    .where(and(eq(user.role, 'consultant'), eq(user.active, 1)))

  if (recipients.length === 0) {
    console.log('No active consultant to notify.')
    return
  }

  const clientIds = await activeClientIds()
  let sent = 0
  let quiet = 0

  for (const clientId of clientIds) {
    const digest = await digestFor(clientId, since, until)
    if (digest === null) continue

    if (digest.total === 0) {
      quiet++
      console.log(`${digest.clientName}: nothing in the last ${hours}h.`)
      continue
    }

    const resumo =
      `${digest.clientName}: ${digest.total} — ` +
      `${digest.blocked.length} travou, ${digest.done.length} feito, ` +
      `${digest.files.length} arquivo, ${digest.comments.length} recado, ` +
      `${digest.delivered.length} fechado`

    if (dry) {
      console.log(`[seco] ${resumo}`)
      for (const b of digest.blocked) {
        console.log(`        TRAVOU: ${b.title}${b.detail === null ? '' : ` — "${b.detail}"`}`)
      }
      continue
    }

    for (const to of recipients) {
      try {
        await sendDigest(to.email, digest, process.env.APP_URL ?? '')
        sent++
        console.log(`Sent to ${to.email} — ${resumo}`)
      } catch (error) {
        /* One failed recipient must not stop the others, and the reason has to
           reach the cron log — a silent failure here looks exactly like a quiet
           day. */
        console.error(`Could not send to ${to.email}:`,
          error instanceof Error ? error.message : error)
      }
    }
  }

  console.log(`\nWindow: ${since.toISOString()} to ${until.toISOString()}`)
  console.log(`${sent} email(s) sent, ${quiet} client(s) with nothing to report.`)
}

main()
  .catch((error: unknown) => {
    const reason = error instanceof Error ? error.message : String(error)
    console.error(`\nDigest failed: ${reason}`)
    process.exitCode = 1
  })
  .finally(() => { void db().end() })
