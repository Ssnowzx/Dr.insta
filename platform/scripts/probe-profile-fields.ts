import { eq } from 'drizzle-orm'
import { orm } from '../db/client.ts'
import { db, waitForDatabase } from '../db/connection.ts'
import { client } from '../db/schema.ts'
import { createClient, IgAuthError, type IgClient } from '../lib/instagram/client.ts'
import { tokenFor } from '../lib/instagram/connection.ts'

/**
 * Asks the API which fields of the account itself it will answer, and writes
 * nothing.
 *
 * WHY THIS RUN EXISTS
 *
 * The product has never called `/me`. It reads media and it reads insights,
 * and both of those describe posts. Two fields of the account would change
 * what the screens can say, and neither has been confirmed against the real
 * token — only against documentation, which is not evidence:
 *
 * 1. `followers_count` — the total, right now. The cycle's north star is net
 *    followers per month and the panel shows July's 20.824, a closed month.
 *    She declared a target of a million by December and has no screen that
 *    says how far she is from it today. The collection already runs five times
 *    a day; if this field answers, that number stops being a month old.
 *
 * 2. `biography` — the bio text. Step c5 hands her a bio to paste and then
 *    depends on somebody ticking a box. If this field answers, the platform
 *    can see the change itself, which is the rule that came out of her own
 *    complaint: a task the product can verify must never be asked again.
 *
 * The rest are asked because a run that has already paid for the token may as
 * well map the whole node.
 *
 * WHY ONE FIELD PER CALL
 *
 * Same reason as `probe-media-metrics.ts`: the endpoint rejects the whole
 * request when one field in the list is invalid, so a batch that fails teaches
 * nothing about which fields were fine. One call per field costs ~9 requests
 * and returns a per-field verdict.
 *
 * `user_id` and `username` are CONTROLS. They are documented as always present
 * on this node. If they fail, the failure is the call or the token, and no
 * conclusion may be drawn about the others from this run.
 *
 * Read-only: no INSERT, no UPDATE, nothing is stored.
 *
 * Usage:
 *   npm run probe:profile
 */

/**
 * What to ask for, one at a time. Controls first, so a broken run is obvious
 * before the interesting fields are read.
 */
const CANDIDATE_FIELDS = [
  'user_id',
  'username',
  'followers_count',
  'biography',
  'follows_count',
  'media_count',
  'account_type',
  'name',
  'profile_picture_url'
] as const

interface Verdict {
  field: string
  answered: boolean
  /** Shown as the API returned it, shortened when it is prose. */
  value: string | null
  detail: string | null
}

function reason (error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** A value a person can read in a terminal: prose gets cut, numbers do not. */
function show (raw: unknown): string {
  if (raw === null || raw === undefined) return '(null)'
  const texto = typeof raw === 'string' ? raw : JSON.stringify(raw)
  const uma = texto.replace(/\s+/g, ' ').trim()
  return uma.length <= 72 ? uma : `${uma.slice(0, 71)}…`
}

/**
 * One field, one call.
 *
 * A field the node does not have comes back as an error naming it. A field it
 * has but that is empty comes back present and null — and those two are not
 * the same answer, so the verdict keeps them apart.
 */
async function probe (api: IgClient, field: string): Promise<Verdict> {
  try {
    const payload = await api.get('me', { fields: field })
    const objeto = payload as Record<string, unknown>
    const bruto = objeto[field]
    return {
      field,
      answered: true,
      value: bruto === undefined ? '(absent from the payload)' : show(bruto),
      detail: null
    }
  } catch (erro) {
    /* An auth failure is not a verdict about the field — it ends the run. */
    if (erro instanceof IgAuthError) throw erro
    return { field, answered: false, value: null, detail: reason(erro) }
  }
}

/** What the answers mean, said out loud rather than left to be inferred. */
function conclude (verdicts: Verdict[]): void {
  const de = (field: string): Verdict | undefined => verdicts.find(v => v.field === field)
  const controls = ['user_id', 'username'].map(de)
  const controlsOk = controls.every(v => v?.answered === true)

  console.log('\nWHAT THIS RUN SETTLES\n')

  if (!controlsOk) {
    console.log(
      '  NOTHING. The controls (user_id, username) did not answer, so every\n' +
      '  refusal below is about the call or the token and not about the field.\n'
    )
    return
  }

  const seguidores = de('followers_count')
  const bio = de('biography')

  console.log(
    seguidores?.answered === true
      ? `  followers_count ANSWERS (${seguidores.value}). The panel can show the\n` +
        '  live total against the December target instead of a closed month.\n'
      : '  followers_count REFUSED. The follower total stays monthly, from the\n' +
        '  insights collection, and no live counter can be built on this scope.\n'
  )

  console.log(
    bio?.answered === true
      ? '  biography ANSWERS. Step c5 can be verified by the platform itself, so\n' +
        '  the bio stops depending on somebody ticking a box.\n'
      : '  biography REFUSED. The bio can only be verified by a person looking\n' +
        '  at the profile — keep it a manual step and do not promise otherwise.\n'
  )
}

async function main (): Promise<void> {
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

  const stored = await tokenFor(found.id)
  if (stored === null) {
    console.error(`\n${found.name}: no usable Instagram credential. Nothing to probe.\n`)
    process.exitCode = 1
    return
  }

  const api = createClient(stored.token)

  console.log(`\n${found.name} — probing the account node, one field per call\n`)

  const verdicts: Verdict[] = []
  for (const field of CANDIDATE_FIELDS) {
    const verdict = await probe(api, field)
    verdicts.push(verdict)
    console.log(
      `  ${verdict.answered ? 'YES' : 'no '}  ${field.padEnd(20)}` +
      (verdict.answered ? verdict.value ?? '' : verdict.detail ?? '')
    )
  }

  conclude(verdicts)
  console.log(`  ${api.calls} API call(s). Nothing was written.\n`)
}

main()
  .catch((error: unknown) => {
    if (error instanceof IgAuthError) {
      console.error(`\nThe credential is no longer valid: ${error.message}`)
      console.error('She has to reconnect from Conta.\n')
    } else {
      console.error(`\nFailed: ${reason(error)}\n`)
    }
    process.exitCode = 1
  })
  .finally(() => { void db().end() })
