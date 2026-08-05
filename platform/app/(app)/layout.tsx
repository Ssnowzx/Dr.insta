import type { ReactNode } from 'react'
import { NavInferior, NavLateral } from '@/components/nav'
import { clientProfile } from '@/lib/dashboard'
import { requireSession } from '@/lib/dal'
import './app.css'

/**
 * The authenticated shell.
 *
 * `requireSession()` here covers every page in the group — but each page calls
 * it again for its own data, and that repetition is deliberate: a layout in the
 * App Router is not a guarantee that a nested route ran through it, and
 * `cache()` makes the second call free.
 */
export default async function AppLayout ({ children }: { children: ReactNode }) {
  const identity = await requireSession()
  const profile = identity.clientId === null ? null : await clientProfile(identity.clientId)

  const brand = profile?.brand ?? 'My Favorite'
  const account = identity.clientId === null
    ? 'Visão de consultor'
    : profile?.name ?? identity.name

  return (
    <div className="casca">
      <NavLateral marca={brand} conta={account} />

      <div className="corpo">
        <header className="topo">
          <span className="topo-marca">{brand}</span>
          <span className="topo-conta">{account}</span>
        </header>

        <main className="conteudo">{children}</main>
      </div>

      <NavInferior />
    </div>
  )
}
