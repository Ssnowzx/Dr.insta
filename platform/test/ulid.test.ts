import { describe, expect, it } from 'vitest'
import { isUlid, ulid, ULID_LENGTH } from '../lib/ulid.ts'

describe('ulid', () => {
  it('should produce 26 characters, which is what CHAR(26) holds', () => {
    // ARRANGE / ACT
    const value = ulid()

    // ASSERT
    expect(value).toHaveLength(ULID_LENGTH)
    expect(ULID_LENGTH).toBe(26)
  })

  it('should use only Crockford base32 characters', () => {
    // ARRANGE / ACT — 200 samples, because a bad index shows up rarely
    const values = Array.from({ length: 200 }, () => ulid())

    // ASSERT — no I, L, O or U: they are excluded so a code read aloud or typed
    // from a screenshot cannot turn 1 into I or 0 into O
    for (const value of values) {
      expect(value).toMatch(/^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{26}$/)
    }
  })

  it('should never produce undefined characters', () => {
    // ARRANGE / ACT — an off-by-one in the alphabet index yields the string
    // "undefined" spliced into the output, which still looks vaguely like an id
    const values = Array.from({ length: 500 }, () => ulid())

    // ASSERT
    for (const value of values) {
      expect(value).not.toContain('undefined')
    }
  })

  it('should not repeat across many draws', () => {
    // ARRANGE / ACT
    const values = new Set(Array.from({ length: 2000 }, () => ulid()))

    // ASSERT — 80 bits of randomness; a collision in 2000 draws means the
    // random part is not random
    expect(values.size).toBe(2000)
  })

  it('should sort lexicographically in creation order', () => {
    // ARRANGE — the timestamp prefix is what keeps the index appending at the
    // right edge instead of scattering writes the way a UUIDv4 would
    const earlier = ulid(1_000_000_000_000)
    const later = ulid(1_000_000_001_000)

    // ACT / ASSERT
    expect(earlier < later).toBe(true)
  })

  it('should encode the same timestamp into the same 10-character prefix', () => {
    // ARRANGE
    const when = 1_754_000_000_000

    // ACT
    const a = ulid(when).slice(0, 10)
    const b = ulid(when).slice(0, 10)

    // ASSERT — same instant, same prefix; only the random tail differs
    expect(a).toBe(b)
    expect(ulid(when)).not.toBe(ulid(when))
  })

  it('should reject an invalid timestamp instead of producing a broken id', () => {
    // ARRANGE / ACT / ASSERT
    expect(() => ulid(Number.NaN)).toThrow(/Invalid timestamp/)
    expect(() => ulid(-1)).toThrow(/Invalid timestamp/)
  })
})

describe('isUlid', () => {
  it('should accept what ulid produces', () => {
    // ARRANGE / ACT / ASSERT
    expect(isUlid(ulid())).toBe(true)
  })

  it('should reject the wrong length', () => {
    // ARRANGE / ACT / ASSERT
    expect(isUlid('0123456789')).toBe(false)
    expect(isUlid(`${ulid()}X`)).toBe(false)
  })

  it('should reject the excluded letters', () => {
    // ARRANGE — I, L, O and U are not in the alphabet
    const withI = `I${ulid().slice(1)}`

    // ACT / ASSERT
    expect(isUlid(withI)).toBe(false)
  })

  it('should reject lowercase', () => {
    // ARRANGE / ACT / ASSERT — the alphabet is uppercase only
    expect(isUlid(ulid().toLowerCase())).toBe(false)
  })
})
