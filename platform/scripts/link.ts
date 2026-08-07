import { eq } from 'drizzle-orm'
import { orm } from '../db/client.ts'
import { db, waitForDatabase } from '../db/connection.ts'
import { user } from '../db/schema.ts'
import { issueToken } from '../lib/tokens.ts'

/**
 * Prints a fresh access link for someone who already exists.
 *
 * `invite.ts` refuses anyone who already has a password — re-inviting would be
 * a way to reset a credential without proving anything — and points at "the
 * password-reset flow". This is that flow. Without it the sentence pointed at
 * nothing: `package.json` declared `npm run link` and the file was never
 * written, so the only recovery path left was the consultant being already
 * signed in. If he is the one locked out, that path is closed.
 *
 * Usage:
 *   npm run link -- --email bianca@...        # picks invite or reset for her
 *   npm run link -- --email eu@... --invite   # forces an invite
 *
 * The purpose is chosen from the account rather than asked for: someone who
 * never set a password needs an invite (seven days, and the screen greets her),
 * someone who has one needs a reset (one hour, because it is a live path to
 * change a credential). Getting that backwards prints a link whose screen
 * refuses the token.
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
  const forceInvite = process.argv.includes('--invite')

  if (email === undefined || email === '') {
    fail('Missing --email. Usage: npm run link -- --email pessoa@dominio.com')
  }
  if ((process.env.APP_URL ?? '') === '') {
    fail('APP_URL is not set — the printed link would not open. See .env.exemplo.')
  }

  await waitForDatabase()

  const rows = await orm()
    .select({
      id: user.id,
      name: user.name,
      role: user.role,
      active: user.active,
      passwordHash: user.passwordHash
    })
    .from(user)
    .where(eq(user.email, email))
    .limit(1)

  const found = rows[0]
  if (found === undefined) {
    fail(`No user with e-mail "${email}". Create one with: npm run invite -- --email ${email} --name "Nome"`)
  }

  /* A link for a deactivated account resolves to nothing: `resolveToken`
     rejects it. Printing one anyway would send someone to a screen that
     refuses them with no explanation. */
  if (found.active !== 1) {
    fail(`${email} is deactivated. Reactivate the account before issuing a link.`)
  }

  const purpose = forceInvite || found.passwordHash === null ? 'invite' : 'reset'

  /* `issueToken` drops any earlier unused token of the same purpose, so the
     link printed here is the only one that works from now on. Say it out loud:
     running this twice and sending the first link is a silent dead end. */
  const issued = await issueToken(found.id, purpose)

  const label = purpose === 'invite' ? 'Invite' : 'Password reset'
  console.log(`\n${label} link for ${found.name} <${email}> (${found.role}).`)
  console.log(`Single use, valid until ${issued.expiresAt.toISOString()}:\n`)
  console.log(`  ${issued.url}\n`)
  console.log('Send it over a channel you trust. This product sends no email.')
  console.log('Issuing another one invalidates this one.\n')
}

main()
  .catch((error: unknown) => {
    const reason = error instanceof Error ? error.message : String(error)
    console.error(`\nFailed: ${reason}`)
    process.exitCode = 1
  })
  .finally(() => { void db().end() })
