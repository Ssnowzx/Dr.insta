import type { Metadata } from 'next'
import { FormEntrar } from '@/components/auth-forms'
import '../auth.css'

export const metadata: Metadata = { title: 'Entrar — My Favorite' }

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
  const { destino } = await searchParams

  return (
    <div className="auth-wrap">
      <main className="auth-card">
        <p className="auth-mark">My Favorite</p>

        <h1>Bom te ver.</h1>
        <p className="auth-lead">
          Entre para ver o seu plano, o que já foi feito e o que ainda falta.
        </p>

        <FormEntrar {...(destino === undefined ? {} : { destino })} />

        <p className="auth-rodape">
          Esqueceu a senha? <a href="/recuperar">Crie uma nova</a>.
        </p>
      </main>
    </div>
  )
}
