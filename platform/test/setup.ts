import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Loads the local `.env` for tests that talk to the database.
 *
 * Node has `--env-file`, but it applies to the Vitest process and does not
 * reach the workers where tests actually run. Reading it here works in both.
 *
 * Variables already present in the environment win: in CI there is no `.env`
 * and credentials arrive another way.
 */
const path = join(import.meta.dirname, '..', '.env')

try {
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('#')) continue

    const cut = trimmed.indexOf('=')
    if (cut <= 0) continue

    const key = trimmed.slice(0, cut).trim()
    const value = trimmed.slice(cut + 1).trim().replace(/^["']|["']$/g, '')
    process.env[key] ??= value
  }
} catch {
  // No .env: carry on with whatever is in the environment. Anything that needs
  // a missing variable fails with its own message pointing at .env.exemplo.
}

/**
 * Refuses to run against a production database.
 *
 * Ten of these test files INSERT, UPDATE and DELETE — `pedido.test.ts` creates
 * a client and a user and then deletes rows by id. The block above loads
 * whatever `.env` sits beside it, and on the VPS that file points at the
 * client's live database. Nothing in the suite would notice; it would pass.
 *
 * This nearly happened on 18/08/2026: after a clean deploy, running the suite
 * on the server "to confirm the new tests pass against the code that just
 * shipped" was proposed, which is a reasonable thing to want and would have
 * written into her data.
 *
 * `NODE_ENV=production` is set by the Dockerfile and by docker-compose, and is
 * never set when Vitest runs locally or in CI. It is the one signal that is
 * already true in exactly the place this must not run.
 */
if (process.env.NODE_ENV === 'production') {
  throw new Error(
    'Recusando rodar os testes com NODE_ENV=production.\n' +
    'Dez arquivos desta suíte escrevem no banco apontado pelo .env, e em produção\n' +
    'esse banco é o da cliente. Rode os testes localmente, contra o banco de dev.'
  )
}
