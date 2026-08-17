'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { orm } from '@/db/client'
import { instagramConnection } from '@/db/schema'
import { clientScope, requireSession } from '../dal.ts'
import { markRevoked } from './connection.ts'

/**
 * Disconnecting, from her side.
 *
 * An authorisation only the other party can undo is not an authorisation. She
 * granted it in two clicks and must be able to withdraw it in one, without
 * asking anyone — including without asking us.
 *
 * ONLY THE PERSON WHO AUTHORISED IT
 *
 * The role check was enough while a client meant one person. With an assistant
 * on the same account it stops being: Cris signing in would inherit the power to
 * revoke a credential Bianca granted with her own Instagram login, and the
 * screen would say "você pode desligar quando quiser" to someone the sentence
 * was never about.
 *
 * `connected_by` already recorded who did it — the fact existed and nothing read
 * it. So the rule needs no new column and no permission table, which is the
 * property the README asks this schema to keep.
 *
 * If she ever wants the assistant to hold it, the assistant connects the account
 * herself and the row moves with her. That is the honest way to transfer an
 * authorisation: by granting it again, not by inheriting the button.
 */
export async function disconnectInstagram (): Promise<{ ok: boolean; error?: string }> {
  const identity = await requireSession()

  if (identity.role !== 'client') {
    return { ok: false, error: 'Só quem conectou a conta pode desconectar.' }
  }

  const clientId = await clientScope()

  const rows = await orm()
    .select({ connectedBy: instagramConnection.connectedBy })
    .from(instagramConnection)
    .where(eq(instagramConnection.clientId, clientId))
    .limit(1)

  const conexao = rows[0]
  if (conexao === undefined) {
    return { ok: false, error: 'Não há conexão para desligar.' }
  }

  /* A null `connectedBy` is a row written before the column meant anything.
     Refusing on it would strand the connection with nobody able to end it, so it
     falls back to the old rule: any client user may. */
  if (conexao.connectedBy !== null && conexao.connectedBy !== identity.userId) {
    return {
      ok: false,
      error: 'Quem conectou esta conta foi outra pessoa da equipe, e só ela desliga. A autorização é do Instagram dela.'
    }
  }

  /* The stored credential is erased, not flagged. What the collection already
     wrote stays: those numbers were measured, they are still true, and their
     date is still their date. Deleting history because a connection ended
     would destroy months the API does not hand back. */
  await markRevoked(clientId)

  revalidatePath('/conta')
  revalidatePath('/')

  return { ok: true }
}
