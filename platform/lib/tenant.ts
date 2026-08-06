import 'server-only'
import { cache } from 'react'
import { clientBySlug } from './dashboard.ts'

/**
 * The one client this instance serves.
 *
 * This deployment is dedicated: one client, one instance, one database. Opening
 * a second client means running a second instance with a different
 * `TENANT_SLUG` — not adding a picker back to the screen.
 *
 * WHY AN ENVIRONMENT VARIABLE AND NOT "THE ONLY ROW IN `client`"
 *
 * Deriving the tenant from the data would make a forgotten seed row silently
 * change who the application serves, and nothing would look broken: the panel
 * would render, with someone else's numbers. The instance has to state who it
 * is, and be wrong loudly rather than plausibly.
 *
 * The `client_id` columns stay in the schema and every query stays scoped by
 * them. What goes away is choosing a client at runtime, not the isolation
 * between clients — see `lib/scope.ts`.
 */

/**
 * Reads and validates `TENANT_SLUG`.
 *
 * Pure and env-injected, mirroring the split between `lib/scope.ts` and
 * `lib/dal.ts`: the rule is testable without a database, and the lookup that
 * needs one lives below.
 *
 * @throws When the variable is missing or blank — a default here would serve
 *   an arbitrary client rather than refuse.
 */
export function tenantSlug (env: Record<string, string | undefined>): string {
  const raw = env.TENANT_SLUG?.trim() ?? ''
  if (raw === '') {
    throw new Error(
      'TENANT_SLUG is not set. This instance serves exactly one client and has ' +
      'no default. Set it to the client slug, e.g. TENANT_SLUG=bianca-olivo.'
    )
  }
  return raw
}

/**
 * The tenant's `client_id`.
 *
 * `cache()` memoises within a single render pass, the same way
 * `currentSession()` does in `lib/dal.ts`: a page that resolves the scope in
 * the layout and again in three components makes one query, not four. The cache
 * does not cross requests.
 *
 * @throws When the slug names no client. Returning `null` would push the
 *   failure into every caller as an empty screen, and the cause — a typo in an
 *   environment variable — would be the last place anyone looked.
 */
export const tenantId = cache(async (): Promise<number> => {
  const slug = tenantSlug(process.env)
  const found = await clientBySlug(slug)

  if (found === null) {
    throw new Error(
      `TENANT_SLUG is "${slug}", but no client has that slug. Check the value ` +
      'against the `client` table, or run `npm run db:seed`.'
    )
  }

  return found.id
})
