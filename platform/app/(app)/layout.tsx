import type { ReactNode } from 'react'
import { NavInferior, NavLateral, SinoTopo } from '@/components/nav'
import { BotaoTema } from '@/components/tema'
import { clientProfile } from '@/lib/dashboard'
import { digestFor, newsSince } from '@/lib/digest'
import { clientScope, requireSession } from '@/lib/dal'
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
  const consultant = identity.role === 'consultant'

  /* Both roles land on the same client now, so the header reads the same for
     both. It used to say "Visão de consultor" because a consultant had no
     client to name; on a dedicated instance there is always one. */
  const clientId = await clientScope()
  const profile = await clientProfile(clientId)

  /* The unread count only exists for a consultant, so a client's page load
     never pays for it. */
  const unread = consultant ? await countUnread(identity.userId, clientId) : 0

  const brand = profile?.brand ?? 'My Favorite'
  const account = profile?.name ?? identity.name

  return (
    <div className="casca">
      <NavLateral marca={brand} conta={account} consultor={consultant} novidades={unread} />

      <div className="corpo">
        <header className="topo">
          <span className="topo-marca">{brand}</span>
          <span className="topo-direita">
            <span className="topo-conta">{account}</span>
            {/* The rail carries this on desktop; the rail does not exist on a
                phone, and a setting she cannot reach is a setting she does not
                have. */}
            <BotaoTema />
            {consultant && <SinoTopo novidades={unread} />}
          </span>
        </header>

        <main className="conteudo">{children}</main>
      </div>

      <NavInferior />
    </div>
  )
}

/**
 * How much has happened since he last read the news.
 *
 * Runs on every page load for a consultant, so it is bounded: one client, one
 * digest, over an indexed time window.
 */
async function countUnread (userId: number, clientId: number): Promise<number> {
  const since = await newsSince(userId)
  const digest = await digestFor(clientId, since, new Date())
  return digest?.total ?? 0
}
