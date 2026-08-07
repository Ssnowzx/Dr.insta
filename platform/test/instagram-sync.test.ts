import { describe, expect, it } from 'vitest'
import { currentPeriod, needsRefresh } from '../lib/instagram/sync.ts'
import { REFRESH_WHEN_UNDER_MS } from '../lib/instagram/sync.ts'

/**
 * When the routine renews the credential.
 *
 * A long-lived token dies at sixty days and cannot be revived — only reissued
 * by her, from the authorisation screen. So renewing on the last day turns one
 * bad night into a reconnection request, and that is the failure this margin
 * exists to absorb.
 */

const now = new Date('2026-08-07T00:00:00Z')
const emDias = (d: number): Date => new Date(now.getTime() + d * 24 * 60 * 60 * 1000)

describe('needsRefresh', () => {
  it('should renew well before the credential lapses', () => {
    // ARRANGE / ACT / ASSERT — ten days left is inside the margin
    expect(needsRefresh(emDias(10), now)).toBe(true)
  })

  it('should leave a credential with plenty of time alone', () => {
    // ARRANGE / ACT / ASSERT — a wasted request every day is still waste
    expect(needsRefresh(emDias(45), now)).toBe(false)
  })

  it('should keep a margin of at least two weeks', () => {
    // ARRANGE / ACT — with daily runs, this is how many consecutive failures
    // the routine can absorb before the token is past saving
    const diasDeFolga = REFRESH_WHEN_UNDER_MS / (24 * 60 * 60 * 1000)

    // ASSERT
    expect(diasDeFolga).toBeGreaterThanOrEqual(14)
  })

  it('should renew when the expiry is unknown', () => {
    // ARRANGE / ACT / ASSERT — not knowing how long it has is not a reason to
    // assume it has plenty; at worst this costs one request
    expect(needsRefresh(null, now)).toBe(true)
  })

  it('should renew a credential that already lapsed', () => {
    // ARRANGE / ACT / ASSERT — the attempt will fail, and that failure is what
    // marks the connection as needing her
    expect(needsRefresh(emDias(-1), now)).toBe(true)
  })
})

describe('currentPeriod', () => {
  it('should be the first day of the current month', () => {
    // ARRANGE / ACT / ASSERT
    expect(currentPeriod(new Date('2026-08-07T13:45:00Z'))).toBe('2026-08-01')
  })

  it('should pad a single-digit month', () => {
    // ARRANGE / ACT / ASSERT — '2026-1-01' would not match any stored period
    expect(currentPeriod(new Date('2026-01-31T23:59:00Z'))).toBe('2026-01-01')
  })
})
