import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/* Next resolves `@/…` from tsconfig `paths`; Vitest does not read those. Without
   this alias, any test that reaches a file importing `@/db/client` fails with
   "Cannot find package", which reads like a missing dependency. */
const root = fileURLToPath(new URL('.', import.meta.url))

/**
 * Modules a unit test cannot reach without standing up a Next request.
 *
 * They are excluded from the coverage denominator so the percentage means
 * something, and each one is listed with how it IS verified — an exclusion with
 * no answer to "then what covers it" is just a lowered bar.
 *
 *  · Server Actions and the DAL read `cookies()` and `headers()`. Exercised end
 *    to end in the browser: sign in, invite, reset, marking a step, moving a
 *    request. The security-critical pure parts were extracted precisely so they
 *    could be tested — see `lib/redirect.ts` and `lib/scope.ts`.
 *  · `lib/dashboard.ts` is the query layer; every page runs through it, and
 *    `test/schema.test.ts` proves each column it names exists.
 *  · `lib/session.ts` writes the session cookie. Its pure half (digest,
 *    constant-time compare, expiry sweep) is covered in `test/session.test.ts`.
 *  · `lib/mail.ts` needs a socket to send. Its pure half is covered in
 *    `test/mail.test.ts`, and delivery was verified against a local SMTP sink.
 *  · The `db/*.ts` CLIs are run by hand and verified by their effect on the
 *    database — the seed is asserted idempotent across three runs.
 */
const NEEDS_A_REQUEST = [
  'lib/auth-actions.ts',
  'lib/step-actions.ts',
  'lib/request-actions.ts',
  'lib/dal.ts',
  'lib/dashboard.ts',
  'lib/session.ts',
  'lib/mail.ts',
  'db/seed.ts',
  'db/migrate.ts',
  'db/import-reels.ts',
  'db/migrations/**'
]

export default defineConfig({
  resolve: {
    conditions: ['react-server', 'node', 'import'],
    alias: { '@': root }
  },
  /* Vitest transforms through Vite's SSR pipeline, and that pipeline reads
     `ssr.resolve.conditions` — not `resolve.conditions`. Setting only the
     latter looks right and changes nothing. */
  ssr: {
    resolve: {
      conditions: ['react-server', 'node', 'import']
    }
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // Loads the local .env for tests that need the real database.
    // Without it, `connectionSettings()` throws on a missing variable.
    setupFiles: ['test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.ts', 'db/**/*.ts'],
      exclude: NEEDS_A_REQUEST,
      thresholds: { lines: 80, statements: 80, functions: 80 }
    }
  }
})
