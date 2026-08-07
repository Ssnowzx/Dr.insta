'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { orm } from '@/db/client'
import { user } from '@/db/schema'
import { requireConsultant, requireSession } from './dal.ts'
import { issueToken } from './tokens.ts'

/**
 * The activity screen and the access links that replaced email.
 */

/** Advances the read marker. Only ever for the caller's own row. */
export async function markNewsSeen (): Promise<void> {
  const identity = await requireSession()

  await orm()
    .update(user)
    .set({ newsSeenAt: new Date() })
    .where(eq(user.id, identity.userId))

  revalidatePath('/novidades')
  revalidatePath('/')
}

export interface LinkResult {
  ok: boolean
  url?: string
  expiresAt?: string
  error?: string
}

/**
 * Mints a fresh access link for a client user, to be relayed by hand.
 *
 * This product sends no email, so a client who cannot get in has no
 * self-service path. This is that path, and it is deliberately consultant-only:
 * an unauthenticated visitor able to mint one could burn the pending link of
 * someone who is mid-recovery just by typing their address.
 *
 * `issueToken` drops any earlier unused token of the same purpose, so the last
 * link generated is the only one that works.
 */
export async function generateAccessLink (userId: number): Promise<LinkResult> {
  const identity = await requireConsultant()

  const rows = await orm()
    .select({
      id: user.id,
      name: user.name,
      clientId: user.clientId,
      active: user.active,
      hasPassword: user.passwordHash
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

  const target = rows[0]
  if (target === undefined) return { ok: false, error: 'Essa pessoa não está mais aqui.' }

  if (target.active !== 1) {
    return { ok: false, error: 'Essa conta está desativada. Reative antes de gerar o link.' }
  }

  /* A user with no password yet has never accepted an invite, so the link that
     makes sense is an invite — seven days, and the screen greets her. One who
     already has a password gets a reset, which lasts an hour because it is a
     live path to change a credential. */
  const purpose = target.hasPassword === null ? 'invite' : 'reset'
  const issued = await issueToken(target.id, purpose)

  return {
    ok: true,
    url: issued.url,
    expiresAt: issued.expiresAt.toISOString()
  }
}
