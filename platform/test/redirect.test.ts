import { describe, expect, it } from 'vitest'
import { safeDestination } from '../lib/redirect.ts'

/**
 * The open-redirect guard.
 *
 * This is the single check between a link that looks like ours and a
 * credential-harvesting page on someone else's domain: a visitor who is not
 * signed in gets sent to `/entrar?destino=...`, and that value decides where an
 * authenticated person lands.
 */

describe('safeDestination', () => {
  it('should accept a path inside the app', () => {
    // ARRANGE / ACT / ASSERT
    expect(safeDestination('/plano')).toBe('/plano')
    expect(safeDestination('/pedidos/01ABC?x=1')).toBe('/pedidos/01ABC?x=1')
    expect(safeDestination('/')).toBe('/')
  })

  it('should refuse a protocol-relative URL', () => {
    // ARRANGE — `//evil.com` starts with a slash and looks like a path, but the
    // browser reads it as an absolute address and leaves our origin entirely.
    // This is the case a naive `startsWith('/')` lets through.
    // ACT / ASSERT
    expect(safeDestination('//evil.com')).toBeNull()
    expect(safeDestination('//evil.com/entrar')).toBeNull()
  })

  it('should refuse a backslash after the slash', () => {
    // ARRANGE — some browsers normalise `\` to `/`, so `/\evil.com` becomes
    // `//evil.com`
    // ACT / ASSERT
    expect(safeDestination('/\\evil.com')).toBeNull()
  })

  it('should refuse an absolute URL', () => {
    // ARRANGE / ACT / ASSERT
    expect(safeDestination('https://evil.com')).toBeNull()
    expect(safeDestination('http://evil.com')).toBeNull()
    expect(safeDestination('javascript:alert(1)')).toBeNull()
  })

  it('should refuse a value carrying a newline', () => {
    // ARRANGE — a newline can be smuggled into a Location header
    // ACT / ASSERT
    expect(safeDestination('/plano\nLocation: https://evil.com')).toBeNull()
    expect(safeDestination('/plano\r\nSet-Cookie: a=b')).toBeNull()
  })

  it('should refuse a relative path with no leading slash', () => {
    // ARRANGE / ACT / ASSERT — `evil.com` after a redirect base could resolve
    // outside where we expect
    expect(safeDestination('plano')).toBeNull()
    expect(safeDestination('../admin')).toBeNull()
  })

  it('should refuse anything that is not a string', () => {
    // ARRANGE — form data can carry a File under the same name
    // ACT / ASSERT
    expect(safeDestination(null)).toBeNull()
    expect(safeDestination(undefined)).toBeNull()
    expect(safeDestination(42)).toBeNull()
    expect(safeDestination({ toString: () => '/plano' })).toBeNull()
  })

  it('should refuse an empty or whitespace value', () => {
    // ARRANGE / ACT / ASSERT
    expect(safeDestination('')).toBeNull()
    expect(safeDestination('   ')).toBeNull()
  })
})
