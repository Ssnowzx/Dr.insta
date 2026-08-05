import { describe, expect, it } from 'vitest'
import {
  burnEquivalentTime, hashPassword, isTooShort, MIN_LENGTH, verifyPassword
} from '../lib/password.ts'

describe('password', () => {
  it('should accept the correct password against its own hash', async () => {
    // ARRANGE
    const password = 'olivo-primavera-27'

    // ACT
    const stored = await hashPassword(password)
    const matches = await verifyPassword(stored, password)

    // ASSERT
    expect(matches).toBe(true)
  })

  it('should reject a wrong password', async () => {
    // ARRANGE
    const stored = await hashPassword('olivo-primavera-27')

    // ACT
    const matches = await verifyPassword(stored, 'olivo-primavera-28')

    // ASSERT
    expect(matches).toBe(false)
  })

  it('should produce different hashes for the same password', async () => {
    // ARRANGE
    const password = 'same-password-twice'

    // ACT \u2014 the library generates a fresh salt on every call
    const a = await hashPassword(password)
    const b = await hashPassword(password)

    // ASSERT \u2014 equal hashes for equal passwords would expose password reuse
    expect(a).not.toBe(b)
    expect(await verifyPassword(a, password)).toBe(true)
    expect(await verifyPassword(b, password)).toBe(true)
  })

  it('should produce an argon2id hash with the chosen parameters', async () => {
    // ARRANGE / ACT
    const stored = await hashPassword('checking-the-format')

    // ASSERT \u2014 breaks if ARGON2ID stops being 2 or the costs change
    expect(stored).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/)
  })

  it('should reject a password below the minimum length', async () => {
    // ARRANGE
    const short = 'a'.repeat(MIN_LENGTH - 1)

    // ACT / ASSERT
    expect(isTooShort(short)).toBe(true)
    await expect(hashPassword(short)).rejects.toThrow(/at least/)
  })

  it('should accept a password exactly at the minimum length', async () => {
    // ARRANGE
    const atLimit = 'a'.repeat(MIN_LENGTH)

    // ACT / ASSERT
    expect(isTooShort(atLimit)).toBe(false)
    await expect(hashPassword(atLimit)).resolves.toBeTypeOf('string')
  })

  it('should return false instead of throwing when the stored hash is corrupt', async () => {
    // ARRANGE \u2014 a broken row must not become a 500 on the sign-in screen
    const garbage = 'not-an-argon2-hash'

    // ACT
    const matches = await verifyPassword(garbage, 'any-password-here')

    // ASSERT
    expect(matches).toBe(false)
  })

  it('should burn comparable time when the email does not exist', async () => {
    // ARRANGE \u2014 without this, a non-existent email answers instantly and the
    // sign-in screen becomes an oracle for who has an account here
    const stored = await hashPassword('reference-password-1')

    // ACT
    const t0 = process.hrtime.bigint()
    await verifyPassword(stored, 'deliberately-wrong-password')
    const real = Number(process.hrtime.bigint() - t0) / 1e6

    const t1 = process.hrtime.bigint()
    await burnEquivalentTime()
    const fake = Number(process.hrtime.bigint() - t1) / 1e6

    // ASSERT \u2014 same order of magnitude; the bound is loose on purpose, because
    // timing on shared CI varies legitimately
    expect(fake).toBeGreaterThan(real * 0.4)
    expect(fake).toBeLessThan(real * 4)
  })
})
