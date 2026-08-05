import { eq } from 'drizzle-orm'
import { orm } from '@/db/client'
import { client } from '@/db/schema'
import { requireSession } from '@/lib/dal'
import { signOut } from '@/lib/auth-actions'
import './home.css'

/**
 * Home. For now it proves the identity boundary works end to end; the real
 * dashboard arrives in phases 4 to 6.
 *
 * `requireSession()` is what actually protects this page. `proxy.ts` only
 * checks that a cookie exists — a revoked session still carries a cookie, and
 * without this call the page would render for it.
 *
 * Visible text is pt-BR.
 */
export const dynamic = 'force-dynamic'

function firstName (full: string): string {
  return full.split(' ')[0] ?? full
}

export default async function Home () {
  const identity = await requireSession()

  const rows = identity.clientId === null
    ? []
    : await orm()
      .select({ name: client.name, brand: client.brand })
      .from(client)
      .where(eq(client.id, identity.clientId))
      .limit(1)

  const account = rows[0]

  return (
    <div className="home-wrap">
      <main className="home-card">
        <p className="home-mark">{account?.brand ?? 'My Favorite'}</p>

        <h1>Oi, {firstName(identity.name)}.</h1>
        <p className="home-lead">
          Sua área está pronta. O plano, os números e o que eu precisar te pedir
          vão aparecer aqui — em construção nesta semana.
        </p>

        <dl className="home-dados">
          <div>
            <dt>Entrando como</dt>
            <dd>{identity.email}</dd>
          </div>
          <div>
            <dt>{identity.role === 'consultant' ? 'Acesso' : 'Conta'}</dt>
            <dd>
              {identity.role === 'consultant'
                ? 'Consultor — todos os clientes'
                : account?.name ?? '—'}
            </dd>
          </div>
        </dl>

        <form action={signOut}>
          <button className="btn-sair" type="submit">Sair</button>
        </form>
      </main>
    </div>
  )
}
