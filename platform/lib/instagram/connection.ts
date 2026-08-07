import 'server-only'
import { and, eq } from 'drizzle-orm'
import { orm } from '@/db/client'
import { instagramConnection } from '@/db/schema'
import { open, seal } from '../crypto-box.ts'
import { ulid } from '../ulid.ts'
import { SCOPES } from './oauth.ts'

/**
 * Reading and writing the stored connection.
 *
 * Everything that touches the token goes through here, so there is one place to
 * check when asking "can this value reach a screen?". The answer is no: the
 * decrypted token is returned only by `tokenFor`, whose callers are the API
 * client and the refresh routine.
 */

export type ConnectionState = 'active' | 'expired' | 'revoked' | 'failing'

/** What a screen may know. No token, not even encrypted. */
export interface ConnectionView {
  state: ConnectionState
  username: string | null
  connectedAt: Date | null
  lastSyncAt: Date | null
  tokenExpiresAt: Date | null
  /** Present only for the consultant — she gets consequence, not diagnostics. */
  lastError: string | null
}

export async function connectionFor (clientId: number): Promise<ConnectionView | null> {
  const rows = await orm()
    .select({
      state: instagramConnection.state,
      username: instagramConnection.username,
      connectedAt: instagramConnection.connectedAt,
      lastSyncAt: instagramConnection.lastSyncAt,
      tokenExpiresAt: instagramConnection.tokenExpiresAt,
      lastError: instagramConnection.lastError
    })
    .from(instagramConnection)
    .where(eq(instagramConnection.clientId, clientId))
    .limit(1)

  return rows[0] ?? null
}

export interface StoredToken {
  token: string
  igUserId: string
  expiresAt: Date | null
}

/**
 * The usable token, decrypted.
 *
 * Returns null for a connection that is revoked or has no token — a caller
 * should stop rather than call the API with nothing. It deliberately does NOT
 * check the expiry date: a token slightly past its recorded expiry may still
 * work, and Meta's answer is more authoritative than our clock.
 */
export async function tokenFor (clientId: number): Promise<StoredToken | null> {
  const rows = await orm()
    .select({
      accessToken: instagramConnection.accessToken,
      igUserId: instagramConnection.igUserId,
      tokenExpiresAt: instagramConnection.tokenExpiresAt,
      state: instagramConnection.state
    })
    .from(instagramConnection)
    .where(and(
      eq(instagramConnection.clientId, clientId),
      /* `revoked` means she disconnected. Using a token after that would be
         acting on an authorisation she withdrew. */
      eq(instagramConnection.state, 'active')
    ))
    .limit(1)

  const row = rows[0]
  if (row === undefined || row.accessToken === null) return null

  return {
    token: open(row.accessToken),
    igUserId: row.igUserId,
    expiresAt: row.tokenExpiresAt
  }
}

export interface NewConnection {
  clientId: number
  igUserId: string
  username: string | null
  token: string
  tokenExpiresAt: Date
  connectedBy: number
  /** The version of the agreement she accepted, when there is one. */
  termsVersion?: string
}

/**
 * Records an authorisation, replacing whatever was there.
 *
 * Upsert and not insert: reconnecting is the normal repair for every failure
 * mode this feature has, and it must not depend on someone deleting the old row
 * first. The unique key on `client_id` is what makes it one row.
 *
 * Reconnecting clears `last_error` and `last_sync_at` stays — the numbers
 * already collected are still there, and their age is still true.
 */
export async function saveConnection (input: NewConnection): Promise<void> {
  const now = new Date()
  const encrypted = seal(input.token)

  await orm()
    .insert(instagramConnection)
    .values({
      publicCode: ulid(),
      clientId: input.clientId,
      igUserId: input.igUserId,
      username: input.username,
      accessToken: encrypted,
      tokenExpiresAt: input.tokenExpiresAt,
      scopes: SCOPES.join(','),
      termsVersion: input.termsVersion ?? null,
      termsAcceptedAt: input.termsVersion === undefined ? null : now,
      connectedBy: input.connectedBy,
      connectedAt: now,
      state: 'active',
      lastError: null,
      lastErrorAt: null,
      createdAt: now,
      updatedAt: now
    })
    .onDuplicateKeyUpdate({
      set: {
        igUserId: input.igUserId,
        username: input.username,
        accessToken: encrypted,
        tokenExpiresAt: input.tokenExpiresAt,
        scopes: SCOPES.join(','),
        termsVersion: input.termsVersion ?? null,
        termsAcceptedAt: input.termsVersion === undefined ? null : now,
        connectedBy: input.connectedBy,
        connectedAt: now,
        state: 'active',
        lastError: null,
        lastErrorAt: null,
        updatedAt: now
      }
    })
}

/**
 * Marks a connection as no longer usable.
 *
 * The token is erased rather than kept alongside a flag. A revoked credential
 * that stays in the table is a credential someone can still decrypt, and the
 * only reason to keep it would be to use it.
 */
export async function markRevoked (clientId: number): Promise<void> {
  const now = new Date()

  await orm()
    .update(instagramConnection)
    .set({
      accessToken: null,
      tokenExpiresAt: null,
      state: 'revoked',
      lastError: null,
      lastErrorAt: null,
      updatedAt: now
    })
    .where(eq(instagramConnection.clientId, clientId))
}

/** Records a failure without touching the credential — it may still be fine. */
export async function markFailure (
  clientId: number,
  state: 'expired' | 'failing',
  reason: string,
  now: Date = new Date()
): Promise<void> {
  await orm()
    .update(instagramConnection)
    .set({
      state,
      /* Truncated to the column: a provider message longer than this would
         throw on write, turning a recorded failure into an unrecorded one. */
      lastError: reason.slice(0, 255),
      lastErrorAt: now,
      updatedAt: now
    })
    .where(eq(instagramConnection.clientId, clientId))
}

/** Records a successful collection, clearing any failure state. */
export async function markSynced (clientId: number, now: Date = new Date()): Promise<void> {
  await orm()
    .update(instagramConnection)
    .set({ state: 'active', lastSyncAt: now, lastError: null, lastErrorAt: null, updatedAt: now })
    .where(eq(instagramConnection.clientId, clientId))
}

/** Stores a refreshed credential. */
export async function updateToken (
  clientId: number,
  token: string,
  expiresAt: Date,
  now: Date = new Date()
): Promise<void> {
  await orm()
    .update(instagramConnection)
    .set({
      accessToken: seal(token),
      tokenExpiresAt: expiresAt,
      lastRefreshAt: now,
      state: 'active',
      updatedAt: now
    })
    .where(eq(instagramConnection.clientId, clientId))
}
