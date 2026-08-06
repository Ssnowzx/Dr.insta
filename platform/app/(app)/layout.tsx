import type { ReactNode } from 'react'
import { NavInferior, NavLateral, SinoTopo } from '@/components/nav'
import { clientProfile } from '@/lib/dashboard'
import { activeClientIds, digestFor, newsSince } from '@/lib/digest'
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
  const consultant = identity.role === 'consultant'

  const profile = identity.clientId === null ? null : await clientProfile(identity.clientId)

  /* The unread count only exists for a consultant, so a client's page load
     never pays for it. */
  const unread = consultant ? await countUnread(identity.userId) : 0

  const brand = profile?.brand ?? 'My Favorite'
  const account = identity.clientId === null
    ? 'Visão de consultor'
    : profile?.name ?? identity.name

  return (
    <div className="casca">
      <NavLateral marca={brand} conta={account} consultor={consultant} novidades={unread} />

      <div className="corpo">
        <header className="topo">
          <span className="topo-marca">{brand}</span>
          <span className="topo-direita">
            <span className="topo-conta">{account}</span>
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
 * Runs on every page load for a consultant, so it is bounded: one small query
 * per active client, over an indexed time window. With one client that is two
 * queries; if the client list ever grows past a handful this becomes a single
 * aggregate instead.
 */
async function countUnread (userId: number): Promise<number> {
  const since = await newsSince(userId)
  const until = new Date()
  const ids = await activeClientIds()

  const digests = await Promise.all(ids.map(id => digestFor(id, since, until)))
  return digests.reduce((n, d) => n + (d?.total ?? 0), 0)
}
