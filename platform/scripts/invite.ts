import { eq } from 'drizzle-orm'
import { orm } from '../db/client.ts'
import { db, waitForDatabase } from '../db/connection.ts'
import { client, user } from '../db/schema.ts'
import { issueToken } from '../lib/tokens.ts'
import { mailConfigured, sendInvite } from '../lib/mail.ts'
import { ulid } from '../lib/ulid.ts'

/**
 * Creates (or finds) a user and prints an invite link.
 *
 * Exists so the platform can onboard someone before SMTP is configured, and so
 * there is always a way in when email fails — a consultancy of two people does
 * not need a mail server to be the single point of failure for access.
 *
 * Usage:
 *   npm run invite -- --email x@y.com --name "Bianca Olivo" --client bianca-olivo
 *   npm run invite -- --email eu@y.com --name "Rodrigo" --consultant
 *
 * `--client` takes the client slug. Without it, and with `--consultant`, the
 * user is created with no client scope — which is what makes them a consultant.
 */

function arg (flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  if (i === -1) return undefined
  const value = process.argv[i + 1]
  return value === undefined || value.startsWith('--') ? undefined : value
}

function fail (message: string): never {
  console.error(`\n${message}\n`)
  process.exit(1)
}

async function main (): Promise<void> {
  const email = arg('--email')?.trim().toLowerCase()
  const name = arg('--name')?.trim()
  const clientSlug = arg('--client')?.trim()
  const isConsultant = process.argv.includes('--consultant')

  if (email === undefined || email === '') fail('Missing --email.')
  if (name === undefined || name === '') fail('Missing --name.')
  if (!isConsultant && (clientSlug === undefined || clientSlug === '')) {
    fail('Provide --client <slug>, or --consultant for an unscoped user.')
  }
  if (isConsultant && clientSlug !== undefined) {
    fail('--consultant and --client are mutually exclusive: a consultant has no client scope.')
  }
  if ((process.env.APP_URL ?? '') === '') {
    fail('APP_URL is not set — the printed link would not open. See .env.exemplo.')
  }

  await waitForDatabase()

  let clientId: number | null = null
  if (clientSlug !== undefined) {
    const rows = await orm()
      .select({ id: client.id, name: client.name })
      .from(client)
      .where(eq(client.slug, clientSlug))
      .limit(1)

    const found = rows[0]
    if (found === undefined) fail(`No client with slug "${clientSlug}". Run the seed first.`)
    clientId = found.id
    console.log(`Client: ${found.name} (#${found.id})`)
  }

  const existing = await orm()
    .select({ id: user.id, passwordHash: user.passwordHash })
    .from(user)
    .where(eq(user.email, email))
    .limit(1)

  let userId: number
  const already = existing[0]

  if (already !== undefined) {
    userId = already.id
    /* Re-inviting someone who already has a password would be a way to reset it
       without proving anything. That path is the reset flow, which at least
       requires access to the inbox. */
    if (already.passwordHash !== null) {
      fail(`${email} already has a password. Use the password-reset flow instead.`)
    }
    console.log(`User already existed (#${userId}), issuing a fresh invite.`)
  } else {
    const now = new Date()
    const [created] = await orm().insert(user).values({
      publicCode: ulid(),
      name,
      email,
      role: isConsultant ? 'consultant' : 'client',
      createdAt: now,
      updatedAt: now,
      ...(clientId === null ? {} : { clientId })
    }).$returningId()

    userId = created?.id ?? 0
    console.log(`User created: ${name} <${email}> (#${userId})`)
  }

  const issued = await issueToken(userId, 'invite')

  /* Always print the link, even when the mail goes out. If delivery is slow or
     lands in spam, the operator already has it in front of them instead of
     re-running the command and invalidating the token they just sent. */
  console.log('\nInvite link (single use, valid until ' + issued.expiresAt.toISOString() + '):\n')
  console.log(`  ${issued.url}\n`)

  if (mailConfigured()) {
    try {
      await sendInvite(email, name, issued.url, isConsultant ? 'consultant' : 'client')
      console.log(`Emailed to ${email}.\n`)
    } catch (error) {
      console.error('Could not send the email:',
        error instanceof Error ? error.message : error)
      console.error('The link above is still valid — send it by hand.\n')
    }
  } else {
    console.log('SMTP is not configured, so nothing was emailed.')
    console.log('Send the link over a channel you trust.\n')
  }
}

main()
  .catch((error: unknown) => {
    const reason = error instanceof Error ? error.message : String(error)
    console.error(`\nFailed: ${reason}`)
    process.exitCode = 1
  })
  .finally(() => { void db().end() })
