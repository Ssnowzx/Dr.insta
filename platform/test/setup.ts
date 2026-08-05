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
