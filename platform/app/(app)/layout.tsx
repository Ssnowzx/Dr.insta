import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { NavInferior, NavLateral, SinoTopo } from '@/components/nav'
import { BotaoTema } from '@/components/tema'
import { clientProfile, openRequestCount } from '@/lib/dashboard'
import { digestFor, newsSince } from '@/lib/digest'
import { clientScope, requireSession } from '@/lib/dal'
import './app.css'

/**
 * The browser tab, named after the client this instance serves.
 *
 * `My Favorite` used to be hard-coded into the title of every page, including
 * the sign-in screen. It is the CLIENT's brand, not this product's — writing it
 * into the source made the platform present itself as hers, and would have made
 * every title a lie the day a second instance served someone else. The brand
 * now comes from the same row the header reads, and only inside the
 * authenticated area, which is the only place there is a client to name.
 *
 * The template applies to every page in the group: a page says `Painel` and the
 * tab reads `Painel — My Favorite`.
 */
export async function generateMetadata (): Promise<Metadata> {
  const profile = await clientProfile(await clientScope())
  const brand = profile?.brand ?? profile?.name ?? 'Painel'

  return {
    title: { template: `%s — ${brand}`, default: brand }
  }
}

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
     never pays for it. The open-request count is for both: it is the same fact
     read from either side — what is still hers to answer. */
  const [unread, pedidos] = await Promise.all([
    consultant ? countUnread(identity.userId, clientId) : Promise.resolve(0),
    openRequestCount(clientId)
  ])

  const brand = profile?.brand ?? 'My Favorite'
  const account = profile?.name ?? identity.name

  return (
    <div className="casca">
      <NavLateral
        marca={brand}
        conta={account}
        consultor={consultant}
        novidades={unread}
        pedidos={pedidos}
      />

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

      <NavInferior pedidos={pedidos} />
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
