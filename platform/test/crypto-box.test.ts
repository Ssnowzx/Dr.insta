import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { generateKey, open, seal } from '../lib/crypto-box.ts'

/**
 * The credential box.
 *
 * What matters here is not that encryption works — it is that the failure modes
 * are loud. A box that returns garbage instead of throwing sends an empty token
 * to Meta, which answers "unauthorised", which sends whoever is debugging to
 * look at the Instagram app settings instead of at this file.
 */

const ORIGINAL = process.env.ENCRYPTION_KEY

beforeEach(() => {
  process.env.ENCRYPTION_KEY = generateKey()
})

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.ENCRYPTION_KEY
  else process.env.ENCRYPTION_KEY = ORIGINAL
})

describe('seal and open', () => {
  it('should return the original value after a round trip', () => {
    // ARRANGE
    const token = 'IGAAQ1example.token-value_with-symbols'

    // ACT
    const restored = open(seal(token))

    // ASSERT
    expect(restored).toBe(token)
  })

  it('should preserve non-ascii content', () => {
    // ARRANGE — tokens are ascii, but this box will hold other things
    const value = 'ação · coração 🎯'

    // ACT
    const restored = open(seal(value))

    // ASSERT
    expect(restored).toBe(value)
  })

  it('should produce different ciphertext for the same input', () => {
    // ARRANGE
    const token = 'same-token-twice'

    // ACT — a fresh IV per call; reusing one under GCM leaks the key
    const first = seal(token)
    const second = seal(token)

    // ASSERT
    expect(first).not.toBe(second)
    expect(open(first)).toBe(open(second))
  })

  it('should not contain the plaintext anywhere in the stored form', () => {
    // ARRANGE
    const token = 'unmistakable-secret-value'

    // ACT
    const stored = seal(token)

    // ASSERT
    expect(stored).not.toContain(token)
  })
})

describe('tampering', () => {
  it('should throw when the ciphertext was altered', () => {
    // ARRANGE
    const stored = seal('token-value')
    const [iv, tag, ciphertext] = stored.split(':') as [string, string, string]
    const flipped = Buffer.from(ciphertext, 'base64')
    flipped[0] = (flipped[0] ?? 0) ^ 0xff

    // ACT
    const act = (): string => open([iv, tag, flipped.toString('base64')].join(':'))

    // ASSERT — GCM authenticates, so this fails loudly instead of returning noise
    expect(act).toThrow()
  })

  it('should throw when the auth tag was altered', () => {
    // ARRANGE
    const stored = seal('token-value')
    const [iv, tag, ciphertext] = stored.split(':') as [string, string, string]
    const flipped = Buffer.from(tag, 'base64')
    flipped[0] = (flipped[0] ?? 0) ^ 0xff

    // ACT
    const act = (): string => open([iv, flipped.toString('base64'), ciphertext].join(':'))

    // ASSERT
    expect(act).toThrow()
  })

  it('should throw when another key is used', () => {
    // ARRANGE
    const stored = seal('token-value')

    // ACT
    process.env.ENCRYPTION_KEY = generateKey()
    const act = (): string => open(stored)

    // ASSERT — losing the key loses the connection, by design
    expect(act).toThrow()
  })

  it('should reject a stored value that is not in three parts', () => {
    // ARRANGE
    const malformed = 'not-encrypted-at-all'

    // ACT
    const act = (): string => open(malformed)

    // ASSERT
    expect(act).toThrow(/iv:authTag:ciphertext/)
  })
})

describe('key validation', () => {
  it('should point at the example file when the key is missing', () => {
    // ARRANGE
    delete process.env.ENCRYPTION_KEY

    // ACT
    const act = (): string => seal('anything')

    // ASSERT
    expect(act).toThrow(/ENCRYPTION_KEY.*\.env\.exemplo/s)
  })

  it('should report the length found when the key is the wrong size', () => {
    // ARRANGE — the usual cause is a truncated paste, so the message says so
    process.env.ENCRYPTION_KEY = Buffer.alloc(16).toString('base64')

    // ACT
    const act = (): string => seal('anything')

    // ASSERT
    expect(act).toThrow(/got 16/)
  })

  it('should generate a key of the size it demands', () => {
    // ARRANGE / ACT
    const generated = generateKey()

    // ASSERT
    expect(Buffer.from(generated, 'base64')).toHaveLength(32)
  })
})
