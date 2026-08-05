import { randomBytes } from 'node:crypto'

/**
 * ULID: 26 characters, Crockford base32, lexicographically sortable.
 *
 * Written here instead of pulled from a package. It is thirty lines, the format
 * is frozen, and the project's rule is to justify every dependency — a package
 * for this would be one more thing to audit for the sake of thirty lines.
 *
 * Why not a plain auto-increment in the URL: sequential ids in a client-facing
 * link publish how many clients, deliveries and files exist. A consultancy's
 * client count is not something the client should be able to read off a URL.
 *
 * Layout: 10 characters of millisecond timestamp (48 bits) + 16 characters of
 * randomness (80 bits). The timestamp prefix keeps generated ids in creation
 * order, which keeps the B-tree index appending at the right edge instead of
 * scattering writes across pages the way a UUIDv4 would.
 */

/* Crockford base32: no I, L, O or U. Excluded so a code read out loud or typed
   from a screenshot cannot turn 1 into I or 0 into O. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const TIME_CHARS = 10
const RANDOM_CHARS = 16

export const ULID_LENGTH = TIME_CHARS + RANDOM_CHARS

function encodeTime (ms: number): string {
  let rest = ms
  let out = ''
  for (let i = 0; i < TIME_CHARS; i++) {
    out = ALPHABET[rest % 32] + out
    rest = Math.floor(rest / 32)
  }
  return out
}

function encodeRandom (): string {
  /* One byte per character, taking only the low 5 bits. Wasteful in bytes and
     exactly right in bias: `byte % 32` over 0..255 is uniform, because 256 is a
     multiple of 32. Reading 5-bit groups across byte boundaries would save
     bytes and invite an off-by-one that silently shrinks the keyspace. */
  const bytes = randomBytes(RANDOM_CHARS)
  let out = ''
  for (const byte of bytes) out += ALPHABET[byte % 32]
  return out
}

/**
 * @param now Milliseconds since the epoch. Injected so tests are deterministic
 *            and so the domain never reaches for the clock implicitly.
 */
export function ulid (now: number = Date.now()): string {
  if (!Number.isFinite(now) || now < 0) {
    throw new Error(`Invalid timestamp for ULID: ${now}`)
  }
  return encodeTime(Math.floor(now)) + encodeRandom()
}

/** Whether a string is shaped like a ULID. Does not prove it was generated here. */
export function isUlid (value: string): boolean {
  if (value.length !== ULID_LENGTH) return false
  for (const char of value) {
    if (!ALPHABET.includes(char)) return false
  }
  return true
}
