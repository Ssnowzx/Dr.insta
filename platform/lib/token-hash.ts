import { createHash } from 'node:crypto'

/**
 * The one-way hash for session ids and credential tokens.
 *
 * It lives alone, in a file that imports nothing but `node:crypto`, because of
 * what depends on it. `lib/tokens.ts` needs it to issue an invite, and it used
 * to reach into `lib/session.ts` to get it — which imports `next/headers` for
 * the cookie jar. That pulled the whole Next request runtime into
 * `scripts/invite.ts`, and inside the production image `next/headers` does not
 * resolve at all: the standalone output bundles it into `server.js` rather than
 * leaving it in `node_modules`. Creating the first user on a fresh VPS died
 * with ERR_MODULE_NOT_FOUND on a module nobody meant to use — a CLI has no
 * cookies to read.
 *
 * SHA-256 without a salt is deliberate and not a password shortcut. The input
 * is 32 bytes from `randomBytes`, so there is no dictionary to attack and
 * nothing to slow down; what matters is that a database dump cannot be replayed
 * as a live token. Passwords take a different path entirely — Argon2id, in
 * `lib/password.ts`.
 */
export function digestToken (token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}
