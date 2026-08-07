'use server'

import { revalidatePath } from 'next/cache'
import { clientScope, requireSession } from '../dal.ts'
import { markRevoked } from './connection.ts'

/**
 * Disconnecting, from her side.
 *
 * An authorisation only the other party can undo is not an authorisation. She
 * granted it in two clicks and must be able to withdraw it in one, without
 * asking anyone — including without asking us.
 *
 * Only the client may do it, for the same reason only the client may connect:
 * the credential is hers. The consultant removing it would be undoing a
 * decision that was never his.
 */
export async function disconnectInstagram (): Promise<{ ok: boolean; error?: string }> {
  const identity = await requireSession()

  if (identity.role !== 'client') {
    return { ok: false, error: 'Só quem conectou a conta pode desconectar.' }
  }

  /* The stored credential is erased, not flagged. What the collection already
     wrote stays: those numbers were measured, they are still true, and their
     date is still their date. Deleting history because a connection ended
     would destroy months the API does not hand back. */
  await markRevoked(await clientScope())

  revalidatePath('/conta')
  revalidatePath('/')

  return { ok: true }
}
