import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/* Next resolves `@/…` from tsconfig `paths`; Vitest does not read those. Without
   this alias, any test that reaches a file importing `@/db/client` fails with
   "Cannot find package", which reads like a missing dependency. */
const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  /**
   * `server-only` ships two entry points: under React's `react-server`
   * condition it resolves to an empty module, and everywhere else it throws on
   * import. Vitest resolves the throwing one, so any test that reaches
   * `lib/session.ts` dies before running a single assertion.
   *
   * The `react-server` condition is the fix rather than aliasing the package
   * away: aliasing would also silence the guard in application code, and that
   * guard is what keeps a database import from ever reaching the browser
   * bundle.
   */
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
      exclude: ['db/migrations/**'],
      thresholds: { lines: 80, statements: 80, functions: 80 }
    }
  }
})
