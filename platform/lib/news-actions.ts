'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { orm } from '@/db/client'
import { auditLog, user } from '@/db/schema'
import { clientScope, requireConsultant, requireSession } from './dal.ts'
import { issueToken } from './tokens.ts'
import { ulid } from './ulid.ts'

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

/* Bounds that match the columns. A paste longer than these is a database error,
   which reaches the screen as "algo deu errado" and loses what was typed. */
const MAX_NAME = 120
const MAX_EMAIL = 190
const MAX_JOB = 80

/**
 * The address is the identity, so it is checked before anything is written.
 *
 * Deliberately loose: the job of this pattern is to catch a typo and a pasted
 * name, not to adjudicate RFC 5322. A regex that rejects a valid address is
 * worse than one that accepts an invalid one — nothing is emailed here, the link
 * is relayed by hand, and the address is only ever used to sign in.
 */
function looksLikeEmail (value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

/**
 * Adds someone to the client's team and mints their first link.
 *
 * Bianca has an assistant who runs the profile with her, and until now a second
 * person meant an SSH session and `npm run invite`. That is a real barrier: the
 * account that owns the site is deliberately kept out of the docker group, so
 * "give Cris access" was a task only one person could do and only at a computer.
 *
 * `npm run invite` still exists and is still the only way to create the FIRST
 * account — before anyone can sign in, no screen can be reached. This is the
 * second one onwards.
 *
 * Consultant-only, for the same reason minting a link is: adding a person is
 * granting access to everything this client's screens hold.
 */
export interface AddPersonResult extends LinkResult {
  name?: string
}

export async function addClientPerson (
  name: string,
  email: string,
  jobTitle: string
): Promise<AddPersonResult> {
  const identity = await requireConsultant()
  const clientId = await clientScope()

  const nome = name.trim().slice(0, MAX_NAME)
  /* Lower-cased before the uniqueness check and before the insert, because
     `uq_user_email` is one index and "Cris@x.com" and "cris@x.com" are one
     person. Storing both would make signing in depend on how she typed it. */
  const mail = email.trim().toLowerCase().slice(0, MAX_EMAIL)
  const funcao = jobTitle.trim().slice(0, MAX_JOB)

  if (nome === '') return { ok: false, error: 'Escreva o nome dela.' }
  if (!looksLikeEmail(mail)) return { ok: false, error: 'Esse e-mail não parece completo.' }

  const existing = await orm()
    .select({ id: user.id, name: user.name, clientId: user.clientId })
    .from(user)
    .where(eq(user.email, mail))
    .limit(1)

  const already = existing[0]

  /* An address already in use is refused rather than adopted. Reassigning an
     existing row to this client would be a way to move a consultant — or another
     client's user — into this account by typing their address. */
  if (already !== undefined) {
    return already.clientId === clientId
      ? {
          ok: false,
          error: `${already.name} já está nesta conta. Gere o link de acesso na lista acima.`
        }
      : { ok: false, error: 'Esse e-mail já está em uso em outra conta.' }
  }

  const now = new Date()
  const [created] = await orm().insert(user).values({
    publicCode: ulid(),
    clientId,
    name: nome,
    email: mail,
    role: 'client',
    createdAt: now,
    updatedAt: now,
    ...(funcao === '' ? {} : { jobTitle: funcao })
  }).$returningId()

  const newId = created?.id
  if (newId === undefined) return { ok: false, error: 'Não consegui criar o acesso.' }

  await orm().insert(auditLog).values({
    action: 'user_added',
    entity: 'user',
    entityId: newId,
    userId: identity.userId,
    clientId,
    details: { email: mail, jobTitle: funcao },
    createdAt: now
  })

  const issued = await issueToken(newId, 'invite')

  revalidatePath('/conta')

  return {
    ok: true,
    name: nome,
    url: issued.url,
    expiresAt: issued.expiresAt.toISOString()
  }
}
