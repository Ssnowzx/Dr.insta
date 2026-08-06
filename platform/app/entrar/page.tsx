import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AuthShell } from '@/components/auth-shell'
import { FormEntrar } from '@/components/auth-forms'
import { currentSession } from '@/lib/dal'
import '../auth.css'

export const metadata: Metadata = { title: 'Entrar' }

/**
 * Sign-in screen.
 *
 * `searchParams` is a Promise in Next 16 — awaiting it is not optional, and
 * reading it as a plain object silently yields undefined.
 */
export default async function Entrar ({
  searchParams
}: {
  searchParams: Promise<{ destino?: string }>
}) {
  /* Sending an already-signed-in person home belongs here and not in `proxy.ts`,
     which can only see that a cookie exists. A cookie whose session is gone,
     expired, or owned by a deactivated user would bounce her away from the one
     screen that could let her back in — and `requireSession()` would bounce her
     straight back, forever. Asking the database costs one query on a screen
     nobody opens in a loop. */
  if (await currentSession() !== null) redirect('/')

  const { destino } = await searchParams

  return (
    <AuthShell>
      <h1>Bom te ver.</h1>
      <p className="auth-lead">
        Entre para ver o seu plano, o que já foi feito e o que ainda falta.
      </p>

      <FormEntrar {...(destino === undefined ? {} : { destino })} />

      <p className="auth-rodape">
        Esqueceu a senha? <a href="/recuperar">Crie uma nova</a>.
      </p>
    </AuthShell>
  )
}
