import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { NavInferior, NavLateral, SinoTopo } from '@/components/nav'
import { BotaoTema } from '@/components/tema'
import { clientProfile, openRequestCount } from '@/lib/dashboard'
import { clientDigestFor, digestFor, newsSince } from '@/lib/digest'
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

  /* Both sides get a count now, from different digests. It used to be his
     alone, which made the platform tell him about her and never her about him —
     she found out he had published something by opening the screen. The
     connection made that asymmetry untenable: a credential only she can renew
     would have been announced to him and left for him to relay. */
  /* The request badge is now per-role too, for the same reason. It used to
     count only what was hers to answer, so his own backlog was invisible to him
     inside the product and visible to her only as silence. */
  const [unread, pedidos] = await Promise.all([
    countUnread(identity.userId, clientId, consultant),
    openRequestCount(clientId, identity.role)
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
            <SinoTopo novidades={unread} />
          </span>
        </header>

        <main className="conteudo">{children}</main>
      </div>

      <NavInferior pedidos={pedidos} />
    </div>
  )
}

/**
 * How much has happened since this person last read the news.
 *
 * Two digests, because the two sides have opposite questions. His is "what did
 * she do"; hers is "what changed here that I did not do". A shared list would
 * tell each of them what they already know.
 *
 * Runs on every page load, so it stays bounded: one client, one digest, over an
 * indexed time window.
 */
async function countUnread (
  userId: number,
  clientId: number,
  consultant: boolean
): Promise<number> {
  const since = await newsSince(userId)
  const now = new Date()

  if (consultant) {
    const digest = await digestFor(clientId, since, now)
    return digest?.total ?? 0
  }

  return (await clientDigestFor(clientId, since, now)).total
}
