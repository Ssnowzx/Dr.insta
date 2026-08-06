'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { orm } from '@/db/client'
import { auditLog, user } from '@/db/schema'
import { currentSession } from './dal.ts'
import { burnEquivalentTime, hashPassword, isTooShort, MIN_LENGTH, verifyPassword } from './password.ts'
import { createSession, destroyAllSessions, destroySession } from './session.ts'
import { consumeToken, issueToken, resolveToken } from './tokens.ts'
import { safeDestination } from './redirect.ts'

/**
 * Server Actions for the whole credential lifecycle.
 *
 * Every user-facing string here is pt-BR: these land on the client's screen.
 */

export interface FormState {
  error?: string
  ok?: string
}

async function requestContext (): Promise<{ ip?: string; userAgent?: string }> {
  const h = await headers()
  /* Behind the host's Nginx, the socket address is always 127.0.0.1 — the real
     address arrives in x-forwarded-for, first entry. */
  const forwarded = h.get('x-forwarded-for')?.split(',')[0]?.trim()
  const agent = h.get('user-agent')?.trim()

  return {
    ...(forwarded === undefined || forwarded === '' ? {} : { ip: forwarded }),
    ...(agent === undefined || agent === '' ? {} : { userAgent: agent })
  }
}

async function record (
  action: string,
  userId: number | null,
  clientId: number | null,
  ip: string | undefined
): Promise<void> {
  await orm().insert(auditLog).values({
    action,
    createdAt: new Date(),
    ...(userId === null ? {} : { userId }),
    ...(clientId === null ? {} : { clientId }),
    ...(ip === undefined ? {} : { ip })
  })
}

// ------------------------------------------------------------------ sign in

export async function signIn (_prev: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get('email') ?? '').trim().toLowerCase()
  const password = String(form.get('senha') ?? '')
  const destination = safeDestination(form.get('destino'))

  if (email === '' || password === '') {
    return { error: 'Preencha o e-mail e a senha.' }
  }

  const rows = await orm()
    .select({
      id: user.id,
      clientId: user.clientId,
      passwordHash: user.passwordHash,
      active: user.active
    })
    .from(user)
    .where(eq(user.email, email))
    .limit(1)

  const found = rows[0]

  /* One message for every failure — unknown email, wrong password, deactivated
     account — and the same time spent on each. Two different messages turn this
     screen into a way to ask "does this person have an account here?", and for a
     client with 713k followers that answer is worth something to someone. */
  const GENERIC = 'E-mail ou senha não confere.'

  if (found === undefined || found.passwordHash === null || found.active !== 1) {
    await burnEquivalentTime()
    return { error: GENERIC }
  }

  const matches = await verifyPassword(found.passwordHash, password)
  if (!matches) {
    return { error: GENERIC }
  }

  const context = await requestContext()
  await createSession(found.id, context)
  await orm().update(user).set({ lastSeenAt: new Date() }).where(eq(user.id, found.id))
  await record('signed_in', found.id, found.clientId, context.ip)

  redirect(destination ?? '/')
}

export async function signOut (): Promise<void> {
  await destroySession()
  redirect('/entrar')
}

// ------------------------------------------------- invite and password reset

/** Shared by the invite and the reset screens: both just set a password. */
async function applyNewPassword (
  rawToken: string,
  purpose: 'invite' | 'reset',
  form: FormData
): Promise<FormState> {
  const password = String(form.get('senha') ?? '')
  const confirmation = String(form.get('confirmacao') ?? '')

  if (isTooShort(password)) {
    return { error: `A senha precisa de pelo menos ${MIN_LENGTH} caracteres.` }
  }
  if (password !== confirmation) {
    return { error: 'As duas senhas não são iguais.' }
  }

  const holder = await resolveToken(rawToken, purpose)
  if (holder === null) {
    return {
      error: purpose === 'invite'
        ? 'Este convite expirou ou já foi usado. Me chama que eu mando outro.'
        : 'Este link expirou ou já foi usado. Peça um novo abaixo.'
    }
  }

  /* Consume BEFORE writing the password. If the write fails afterwards, the
     worst case is a spent token and a request for a new one. Consuming after
     would leave a window where the same link sets the password twice. */
  const consumed = await consumeToken(holder.tokenId)
  if (!consumed) {
    return { error: 'Este link acabou de ser usado. Peça um novo.' }
  }

  const hash = await hashPassword(password)
  await orm().update(user).set({ passwordHash: hash }).where(eq(user.id, holder.userId))

  /* A password change ends every other session. If the reset happened because
     someone else had access, leaving their session alive defeats the reset. */
  await destroyAllSessions(holder.userId)

  const context = await requestContext()
  await createSession(holder.userId, context)
  await record(purpose === 'invite' ? 'accepted_invite' : 'reset_password',
    holder.userId, holder.clientId, context.ip)

  redirect('/')
}

export async function acceptInvite (token: string, _prev: FormState, form: FormData): Promise<FormState> {
  return await applyNewPassword(token, 'invite', form)
}

export async function setNewPassword (token: string, _prev: FormState, form: FormData): Promise<FormState> {
  return await applyNewPassword(token, 'reset', form)
}

// ------------------------------------------------------- changing a password

/**
 * Changes the password of whoever is signed in.
 *
 * This is what makes the account hers rather than something issued to her.
 * Before it existed, the password she typed once at the invite was the password
 * she had forever, and the only way to alter it was to ask the consultant to
 * mint a link — which put a credential she owns behind someone else's action.
 *
 * The current password is required. Without it, anyone who found an unlocked
 * phone could take the account over silently: they already have the session,
 * and changing the password is what makes the takeover permanent.
 */
export async function changePassword (_prev: FormState, form: FormData): Promise<FormState> {
  const identity = await currentSession()
  if (identity === null) return { error: 'Sua sessão expirou. Entre de novo.' }

  const atual = String(form.get('atual') ?? '')
  const nova = String(form.get('senha') ?? '')
  const confirmacao = String(form.get('confirmacao') ?? '')

  if (atual === '') return { error: 'Escreva a sua senha atual.' }
  if (isTooShort(nova)) {
    return { error: `A senha nova precisa de pelo menos ${MIN_LENGTH} caracteres.` }
  }
  if (nova !== confirmacao) return { error: 'As duas senhas novas não são iguais.' }
  if (nova === atual) return { error: 'A senha nova é igual à atual.' }

  const rows = await orm()
    .select({ id: user.id, clientId: user.clientId, passwordHash: user.passwordHash })
    .from(user)
    .where(eq(user.id, identity.userId))
    .limit(1)

  const found = rows[0]
  if (found === undefined || found.passwordHash === null) {
    return { error: 'Não consegui confirmar a sua senha atual.' }
  }

  const confere = await verifyPassword(found.passwordHash, atual)
  if (!confere) return { error: 'A senha atual não confere.' }

  const hash = await hashPassword(nova)
  await orm().update(user).set({ passwordHash: hash }).where(eq(user.id, found.id))

  /* Every other session ends. If the reason for changing the password is that
     someone else had it, leaving their session alive defeats the change. The
     one being used right now is created fresh below, so she is not signed out
     of the screen she is standing on. */
  await destroyAllSessions(found.id)

  const context = await requestContext()
  await createSession(found.id, context)
  await record('changed_password', found.id, found.clientId, context.ip)

  return { ok: 'Senha trocada. As outras sessões foram encerradas.' }
}

/**
 * Records that someone could not get in.
 *
 * There is no email in this product, so nothing is sent: the consultant
 * generates a fresh access link inside the platform and passes it on. What this
 * does is leave a trace, so a request for help is visible on his activity
 * screen instead of depending on her remembering to message him.
 *
 * The answer is the same whether or not the address exists — a different one
 * would turn this into a way to ask who has an account here.
 */
export async function requestReset (_prev: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get('email') ?? '').trim().toLowerCase()
  const SAME_ANSWER =
    'Avisei o Rodrigo. Ele te manda um link novo — normalmente no mesmo dia.'

  if (email === '') return { error: 'Escreva o seu e-mail.' }

  const rows = await orm()
    .select({ id: user.id, name: user.name, clientId: user.clientId, active: user.active })
    .from(user)
    .where(eq(user.email, email))
    .limit(1)

  const found = rows[0]
  if (found === undefined || found.active !== 1) {
    await burnEquivalentTime()
    return { ok: SAME_ANSWER }
  }

  /* No token is minted here. Issuing one on an unauthenticated request would
     let anyone burn the pending link of a person who is mid-recovery, just by
     typing their address. The consultant mints it from inside the platform. */
  const context = await requestContext()
  await record('asked_for_access', found.id, found.clientId, context.ip)

  return { ok: SAME_ANSWER }
}
