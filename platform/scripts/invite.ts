import { eq } from 'drizzle-orm'
import { orm } from '../db/client.ts'
import { db, waitForDatabase } from '../db/connection.ts'
import { client, user } from '../db/schema.ts'
import { issueToken } from '../lib/tokens.ts'
import { ulid } from '../lib/ulid.ts'

/**
 * Creates (or finds) a user and prints an invite link.
 *
 * This product sends no email at all, by decision: everything happens inside
 * the platform, and a mail server nobody maintains is a dependency that fails
 * quietly at the worst moment. The link is printed and relayed by hand.
 *
 * Usage:
 *   npm run invite -- --email x@y.com --name "Bianca Olivo"
 *   npm run invite -- --email eu@y.com --name "Rodrigo" --consultant
 *
 * `--client` takes the client slug and defaults to `TENANT_SLUG`, the one client
 * this instance serves. Passing it is only useful for seeding a database that
 * holds more than one. With `--consultant` the user is created with no client
 * scope — which is what makes them a consultant.
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
  const explicitSlug = arg('--client')?.trim()
  const isConsultant = process.argv.includes('--consultant')

  if (email === undefined || email === '') fail('Missing --email.')
  if (name === undefined || name === '') fail('Missing --name.')
  if (isConsultant && explicitSlug !== undefined) {
    fail('--consultant and --client are mutually exclusive: a consultant has no client scope.')
  }

  /* A client user with no `--client` gets the instance's own tenant. Reading it
     from the same variable the application reads keeps the CLI from creating a
     user this deployment would never show. */
  let clientSlug: string | undefined = explicitSlug
  if (!isConsultant && (clientSlug === undefined || clientSlug === '')) {
    clientSlug = process.env.TENANT_SLUG?.trim()
    if (clientSlug === undefined || clientSlug === '') {
      fail('Set TENANT_SLUG, pass --client <slug>, or use --consultant for an unscoped user.')
    }
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

  console.log('Send it over a channel you trust. This product sends no email.\n')
}

main()
  .catch((error: unknown) => {
    const reason = error instanceof Error ? error.message : String(error)
    console.error(`\nFailed: ${reason}`)
    process.exitCode = 1
  })
  .finally(() => { void db().end() })
