'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BotaoTema } from './tema'

/**
 * The one navigation, rendered twice: a rail on desktop, a bar at the bottom on
 * a phone. Same list, same active state, no duplicated source of truth.
 *
 * Bottom bar and not a hamburger: she opens this on a phone, one-handed, and a
 * menu hidden behind a tap is a menu nobody uses.
 *
 * THE RULE THIS FILE NOW ANSWERS TO: NOTHING IS UNREACHABLE ON A PHONE
 *
 * Set by the client on 17/08/2026, after Ideias made eight destinations and
 * Conteúdo was dropped from the bar to keep it at six. She and her assistant
 * work almost entirely from phones, and a screen that exists only on desktop is
 * a screen that does not exist.
 *
 * So the two screens that are NOT destinations move into the top bar, and all
 * six real ones stay in the thumb's reach:
 *
 *   top bar     — the bell (Novidades) and the account name (Conta)
 *   bottom bar  — Painel · Plano · Análise · Pedidos · Ideias · Conteúdo
 *
 * Six is the number the bar fits: 60px each on a 360px phone, where seven is 51
 * and "Conteúdo" stops fitting on one line.
 *
 * This overrules an argument that used to live here — that a bell in the corner
 * is the worst place on a phone, being furthest from a thumb. That is still
 * true, and it is the right trade: reaching is a small cost paid on the two
 * screens that are read occasionally, against a whole screen being absent from
 * the device they actually use. Novidades is also the one destination that
 * announces itself, through a badge that is visible without being reached.
 *
 * "Pedidos" carries a count for BOTH roles, and that is the one signal she has.
 * Nothing is emailed by decision, so before it a request opened for her was
 * invisible until she thought to look. The count rides the destination it is
 * about rather than becoming a second bell: a badge on a nav item is read on
 * the way past, which is the only moment she is guaranteed to have.
 */

interface Destino {
  href: string
  label: string
  icon: 'sino' | 'painel' | 'plano' | 'analise' | 'pedidos' | 'ideias' | 'conteudo' | 'conta'
}

const DESTINOS: Destino[] = [
  { href: '/novidades', label: 'Novidades', icon: 'sino' },
  { href: '/', label: 'Painel', icon: 'painel' },
  { href: '/plano', label: 'Plano', icon: 'plano' },
  /* Between the plan and the requests: it answers "what did you find out",
     which sits naturally after "what do I do" and before "what do you need
     from me". */
  { href: '/analise', label: 'Análise', icon: 'analise' },
  { href: '/pedidos', label: 'Pedidos', icon: 'pedidos' },
  /* The scripts. Ahead of the archive because of how often each is opened: this
     is the screen she reaches for on a filming day, and `/conteudo` is a
     reference she consults occasionally. */
  { href: '/ideias', label: 'Ideias', icon: 'ideias' },
  { href: '/conteudo', label: 'Conteúdo', icon: 'conteudo' },
  { href: '/conta', label: 'Conta', icon: 'conta' }
]

const COMUM = {
  width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.7,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  'aria-hidden': true
}

function Icone ({ nome }: { nome: Destino['icon'] }) {
  switch (nome) {
    case 'sino':
      return <Sino />
    case 'painel':
      /* Three descending bars — the funnel, which is what the panel is about. */
      return <svg {...COMUM}><path d="M4 6h16M4 12h9M4 18h4" /></svg>
    case 'plano':
      return <svg {...COMUM}><path d="M4 6.5 6 8.5 9.5 5M4 12.5l2 2L9.5 11M4 18.5l2 2 3.5-3.5M13 7h7M13 13h7M13 19h7" /></svg>
    case 'analise':
      /* A rising line over a baseline: the progression, which is the part of
         this screen she cannot get anywhere else. */
      return <svg {...COMUM}><path d="M4 19h16M6.5 15.5l4-4.5 3 3 4.5-6" /></svg>
    case 'pedidos':
      return <svg {...COMUM}><path d="M12 3v12M7.5 10.5 12 15l4.5-4.5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
    case 'ideias':
      /* A sheet with lines and a spark: a script, and the idea before it. Not a
         lightbulb — every product uses one, and beside a play button it would
         read as "tips" rather than "the thing you film today". */
      return <svg {...COMUM}><path d="M6 3.6h8.5L19 8v12a1.4 1.4 0 0 1-1.4 1.4H6A1.4 1.4 0 0 1 4.6 20V5A1.4 1.4 0 0 1 6 3.6M14 3.8V8h4.2M8 12.5h5M8 16.5h3" /></svg>
    case 'conteudo':
      return <svg {...COMUM}><rect x="3.2" y="4.2" width="17.6" height="15.6" rx="3" /><path d="M10.4 9.2 15 12l-4.6 2.8z" /></svg>
    case 'conta':
      return <svg {...COMUM}><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></svg>
  }
}

function Sino () {
  return <svg {...COMUM}><path d="M18 8.5a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7M13.7 20a2 2 0 0 1-3.4 0" /></svg>
}

function ativo (pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href)
}

/**
 * What the count on a destination means, spelled out for a screen reader.
 *
 * A bare "3" beside "Pedidos" is announced as "Pedidos 3", which could be a
 * position in a list as easily as a number of open items. The unit is per
 * destination because they do not count the same thing: news is unread, a
 * request is outstanding, and "Novidades: 12 em aberto" is the wrong sentence.
 */
const UNIDADE: Record<string, string> = {
  '/novidades': 'sem ler',
  '/pedidos': 'em aberto'
}

function rotuloCom (href: string, label: string, n: number): string | undefined {
  return n === 0 ? undefined : `${label}: ${n} ${UNIDADE[href] ?? 'em aberto'}`
}

/**
 * The badge on a destination, decided once for both navs.
 *
 * The rail and the bottom bar each had their own version of this expression,
 * and they disagreed: the bar counted news, the rail did not, because the rail
 * carried a second hand-written Novidades item above the list instead.
 */
function contagem (href: string, pedidos: number, novidades: number): number {
  return href === '/pedidos' ? pedidos : href === '/novidades' ? novidades : 0
}

export function NavLateral ({
  titular,
  conta,
  novidades,
  pedidos
}: {
  /* Whose account this is — `client.name`, a person on this instance. Called
     `marca` until 17/08/2026, when the slot stopped carrying a brand; a prop
     named after what it no longer holds is the first thing to mislead. */
  titular: string
  /** Who is signed in. Different from `titular` exactly when it matters. */
  conta: string
  novidades: number
  pedidos: number
}) {
  const pathname = usePathname()

  return (
    <nav className="rail" aria-label="Seções">
      <div className="rail-marca">
        <span className="rail-marca-nome">{titular}</span>
        <span className="rail-marca-conta">{conta}</span>
      </div>

      {/* Both sides have news now, from different digests — see `lib/digest.ts`.
          It used to be his alone, which meant the platform told him about her
          and never her about him.

          Novidades is the first entry of DESTINOS and is rendered by the map
          like every other one. It used to be written out here as well, from
          when it was not in the list, and the day it joined the list nobody
          removed this — so the rail printed "Novidades" twice, once with the
          badge and once without, on every screen either of them opened. */}
      <ul className="rail-lista">
        {DESTINOS.map(d => {
          const n = contagem(d.href, pedidos, novidades)
          return (
            <li key={d.href}>
              <Link
                href={d.href}
                className={ativo(pathname, d.href) ? 'rail-item rail-item-ativo' : 'rail-item'}
                aria-current={ativo(pathname, d.href) ? 'page' : undefined}
                aria-label={rotuloCom(d.href, d.label, n)}
              >
                <Icone nome={d.icon} />
                <span>{d.label}</span>
                {n > 0 && <span className="numero contador">{n}</span>}
              </Link>
            </li>
          )
        })}
      </ul>

      {/* Pushed to the bottom of the rail: it is a setting, not a destination,
          and it should not sit in the same list as the pages. */}
      <div className="rail-pe">
        <BotaoTema />
      </div>
    </nav>
  )
}

/**
 * The bell in the top bar, which is where "Novidades" lives on a phone.
 *
 * It was orphaned for a while — exported, styled, and rendered by nothing —
 * during the period when Novidades sat in the bottom bar instead. Wired back on
 * 17/08/2026 so the bar could hold all six real destinations without any of
 * them becoming desktop-only.
 */
export function SinoTopo ({ novidades }: { novidades: number }) {
  const pathname = usePathname()

  return (
    <Link
      href="/novidades"
      className={ativo(pathname, '/novidades') ? 'topo-sino topo-sino-ativo' : 'topo-sino'}
      aria-label={novidades === 0 ? 'Novidades' : `Novidades: ${novidades} sem ler`}
    >
      <Sino />
      {novidades > 0 && <span className="numero contador contador-topo">{novidades}</span>}
    </Link>
  )
}

/**
 * Six of the eight, and the count is load-bearing.
 *
 * The bar gives each item 360/n pixels on the narrowest phone this product is
 * used on. At six that is 60px; at seven it is 51, which is where "Conteúdo"
 * stops fitting on one line and the labels start truncating.
 *
 * The two that leave are the two that are not destinations. Conta is a settings
 * screen and the account name in the top bar is where every app puts the way
 * in. Novidades is a digest, and its badge announces it from the corner without
 * anyone having to reach it — see the header.
 *
 * Both are still ON THE PHONE, in the top bar. Nothing here is desktop-only:
 * that is the rule this list exists to satisfy, not an accident of the count.
 */
const NA_BARRA = DESTINOS.filter(d => d.href !== '/conta' && d.href !== '/novidades')

export function NavInferior ({
  pedidos,
  novidades
}: {
  pedidos: number
  novidades: number
}) {
  const pathname = usePathname()

  return (
    <nav className="barra" aria-label="Seções">
      {NA_BARRA.map(d => {
        const n = contagem(d.href, pedidos, novidades)
        return (
          <Link
            key={d.href}
            href={d.href}
            className={ativo(pathname, d.href) ? 'barra-item barra-item-ativo' : 'barra-item'}
            aria-current={ativo(pathname, d.href) ? 'page' : undefined}
            aria-label={rotuloCom(d.href, d.label, n)}
          >
            <Icone nome={d.icon} />
            <span>{d.label}</span>
            {/* Over the icon rather than beside the label: the bar gives each
                item 60px on a 360px phone, and a badge on the baseline would
                push "Conteúdo" into two lines. */}
            {n > 0 && <span className="numero contador contador-barra">{n}</span>}
          </Link>
        )
      })}
    </nav>
  )
}
