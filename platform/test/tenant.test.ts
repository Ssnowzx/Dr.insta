import { describe, expect, it } from 'vitest'
import { tenantSlug } from '../lib/tenant.ts'

/**
 * Which client this instance serves.
 *
 * The deployment is dedicated, so this one string decides whose revenue figures
 * render on every screen. The failure worth testing is not a crash — it is the
 * quiet one: a missing or blank variable falling back to some default and
 * serving a client nobody asked for, with a panel that looks perfectly fine.
 *
 * The lookup that turns the slug into a `client_id` needs a database and is
 * exercised end to end; the rule itself is pure and lives here.
 */

describe('tenantSlug', () => {
  it('should return the configured slug', () => {
    // ARRANGE
    const env = { TENANT_SLUG: 'bianca-olivo' }

    // ACT
    const slug = tenantSlug(env)

    // ASSERT
    expect(slug).toBe('bianca-olivo')
  })

  it('should trim surrounding whitespace', () => {
    // ARRANGE — a trailing space survives a copy-paste into a .env file and
    // would otherwise match no client at all
    const env = { TENANT_SLUG: '  bianca-olivo\n' }

    // ACT / ASSERT
    expect(tenantSlug(env)).toBe('bianca-olivo')
  })

  it('should refuse a missing variable', () => {
    // ARRANGE / ACT / ASSERT — never a default: serving an arbitrary client is
    // worse than refusing to serve
    expect(() => tenantSlug({})).toThrow(/TENANT_SLUG/)
  })

  it('should refuse an empty or blank variable', () => {
    // ARRANGE / ACT / ASSERT — `TENANT_SLUG=` in a .env file reads as an empty
    // string, not as absent, and must fail the same way
    expect(() => tenantSlug({ TENANT_SLUG: '' })).toThrow(/TENANT_SLUG/)
    expect(() => tenantSlug({ TENANT_SLUG: '   ' })).toThrow(/TENANT_SLUG/)
  })
})
