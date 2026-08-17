import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
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
 * the sign-in screen. Writing it into the source made the platform present
 * itself as hers, and would have made every title a lie the day a second
 * instance served someone else. It comes from the database now, and only inside
 * the authenticated area — the only place there is a client to name.
 *
 * IT IS `client.name`, NOT `client.brand` — changed 17/08/2026
 *
 * The client of this instance is Bianca Olivo, a person. My Favorite is her
 * company, and the profile→store relationship left this product's scope on
 * 12/08/2026 when the brand's own team took it over. Every screen here is about
 * her personal profile, so naming the brand at the top of all of them was the
 * product contradicting the cycle it exists to run — and, for the assistant who
 * signs in to work on that profile, naming the wrong thing outright.
 *
 * `brand` stays in the schema and stays the fallback: a future client may be a
 * company, where the brand IS the name of the thing being worked on.
 *
 * The template applies to every page in the group: a page says `Painel` and the
 * tab reads `Painel — Bianca Olivo`.
 */
export async function generateMetadata (): Promise<Metadata> {
  const profile = await clientProfile(await clientScope())
  const titular = profile?.name ?? profile?.brand ?? 'Painel'

  return {
    title: { template: `%s — ${titular}`, default: titular }
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

  /* The person this whole instance is about — see `generateMetadata`. Falls
     back to the brand, then to nothing rather than to a name in the source. */
  const titular = profile?.name ?? profile?.brand ?? ''

  /**
   * WHO is signed in, not WHICH client.
   *
   * This read the CLIENT's name, so with two people on the client side, Cris
   * signed in and the corner said "Bianca Olivo" — on the very screen she goes
   * to in order to change HER password. The account is already named on the
   * left; naming it twice cost the one fact this corner exists to carry.
   *
   * The two do read the same for Bianca, and that is fine: the left is whose
   * account this is and the right is who is holding the phone. They differ
   * exactly when it matters.
   *
   * The first name alone below 400px, and nothing below 360px, where the full
   * one does not fit beside a name, a bell and a toggle. "Bianca Ol…" is worse
   * than "Bianca": an ellipsis on a person's name reads as a bug, and the point
   * here is only to tell two people apart.
   */
  const pessoa = identity.name
  const primeiroNome = pessoa.trim().split(/\s+/)[0] ?? pessoa

  return (
    <div className="casca">
      <NavLateral
        titular={titular}
        conta={pessoa}
        novidades={unread}
        pedidos={pedidos}
      />

      <div className="corpo">
        <header className="topo">
          <span className="topo-marca">{titular}</span>
          <span className="topo-direita">
            {/* The two screens that are not destinations. Both live HERE on a
                phone, so the bottom bar can hold all six real ones and nothing
                is desktop-only — the rule the client set on 17/08/2026, because
                she and her assistant work from phones and a screen that exists
                only on a laptop does not exist.

                The bell first: it carries a count, and a number is read on the
                way past whether or not anyone reaches for it. The rail carries
                both on desktop, where this header is hidden. */}
            <SinoTopo novidades={unread} />
            <Link className="topo-conta" href="/conta" aria-label={`Conta de ${pessoa}`}>
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.7"
                strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
              >
                <circle cx="12" cy="8" r="3.6" />
                <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
              </svg>
              {/* Both rendered, one hidden by width. The alternative — reading
                  the viewport in JS to pick one — is a hydration mismatch
                  waiting to happen on the first render, and this corner already
                  carries `suppressHydrationWarning` for the theme script. */}
              <span className="topo-conta-longo">{pessoa}</span>
              <span className="topo-conta-curto">{primeiroNome}</span>
            </Link>
            <BotaoTema />
          </span>
        </header>

        <main className="conteudo">{children}</main>
      </div>

      <NavInferior pedidos={pedidos} novidades={unread} />
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
