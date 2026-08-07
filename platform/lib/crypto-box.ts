import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

/**
 * Symmetric encryption for credentials this product holds on someone's behalf.
 *
 * The Instagram access token is not a password: it cannot be hashed, because we
 * have to send the original to Meta on every call. So it is encrypted, with a
 * key that lives outside the database. A dump of `instagram_connection` must
 * not be enough to act on the client's account.
 *
 * AES-256-GCM and not CBC because GCM authenticates: ciphertext altered in the
 * database fails to decrypt instead of quietly producing garbage that some
 * caller then sends to an API.
 *
 * `node:crypto`, no dependency. Stored format is `iv:authTag:ciphertext`, all
 * base64 — three fields because decryption needs all three, and putting them in
 * separate columns would let a partial write produce a value that cannot be
 * read back with no indication of why.
 */

const ALGORITHM = 'aes-256-gcm'
const KEY_BYTES = 32
const IV_BYTES = 12

/**
 * Reads and validates the key.
 *
 * Deliberately read per call rather than at import: a module that throws while
 * loading takes down every screen, including the ones that have nothing to do
 * with Instagram. A missing key must break connecting an account, not the app.
 */
function key (): Buffer {
  const raw = process.env.ENCRYPTION_KEY

  if (raw === undefined || raw.trim() === '') {
    throw new Error('ENCRYPTION_KEY is not set. See .env.exemplo.')
  }

  const bytes = Buffer.from(raw, 'base64')
  if (bytes.length !== KEY_BYTES) {
    /* Says what was found. A key of the wrong length is usually a truncated
       copy-paste, and "invalid key" alone sends people looking at the algorithm
       instead of at what they pasted. */
    throw new Error(
      `ENCRYPTION_KEY must be ${KEY_BYTES} bytes in base64; got ${bytes.length}. See .env.exemplo.`
    )
  }

  return bytes
}

/** Encrypts. The IV is fresh per call — reusing one under GCM leaks the key. */
export function seal (plaintext: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key(), iv)

  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(':')
}

/**
 * Decrypts, or throws.
 *
 * Never returns a fallback, never returns empty on failure. A caller that gets
 * a string back is entitled to assume it is the credential; handing back
 * something else on error is how an empty token reaches an API call and comes
 * back as "unauthorised", sending the search in the wrong direction.
 */
export function open (stored: string): string {
  const parts = stored.split(':')
  if (parts.length !== 3) {
    throw new Error('Stored credential is not in iv:authTag:ciphertext form.')
  }

  const [iv, authTag, ciphertext] = parts as [string, string, string]
  const decipher = createDecipheriv(ALGORITHM, key(), Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(authTag, 'base64'))

  /* `final()` is what verifies the tag, so tampering surfaces here rather than
     as a wrong plaintext. */
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()])
    .toString('utf8')
}

/**
 * Generates a key, for `.env`. Not called by the application — it exists so the
 * documented way to produce a key is code that was type-checked, rather than an
 * openssl incantation in a README that nobody verified.
 */
export function generateKey (): string {
  return randomBytes(KEY_BYTES).toString('base64')
}
