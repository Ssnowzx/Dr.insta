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
 * "Novidades" IS in the bottom bar, and Conta is what left to make room.
 *
 * It used to be the other way round, on two premises that both expired.
 * Novidades was consultant-only — it is not: `countUnread` branches for both
 * roles and she has her own digest. And the arithmetic was for five
 * destinations; Análise made six, so keeping Novidades out AND adding it back
 * would have been seven at ~51px per item on a 360px phone.
 *
 * A bell in the top-right corner is the worst place on a phone for the thing
 * that carries the news: it is the furthest point from a thumb. Conta is a
 * settings screen visited rarely, and the account name already sits in the top
 * bar — making that the way in is where every other app puts it. So the news
 * moved to the thumb and the settings moved to the corner.
 *
 * "Pedidos" carries a count for BOTH roles, and that is the one signal she has.
 * Nothing is emailed by decision, and `/novidades` is his screen — so before
 * this, a request opened for her was invisible until she thought to look. The
 * count rides the destination it is about rather than becoming a second bell:
 * a badge on a nav item is read on the way past, which is the only moment she
 * is guaranteed to have.
 */

interface Destino {
  href: string
  label: string
  icon: 'sino' | 'painel' | 'plano' | 'analise' | 'pedidos' | 'conteudo' | 'conta'
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
 * position in a list as easily as a number of open items.
 */
function rotuloCom (label: string, n: number): string | undefined {
  return n === 0 ? undefined : `${label}: ${n} em aberto`
}

export function NavLateral ({
  marca,
  conta,
  consultor,
  novidades,
  pedidos
}: {
  marca: string
  conta: string
  consultor: boolean
  novidades: number
  pedidos: number
}) {
  const pathname = usePathname()

  return (
    <nav className="rail" aria-label="Seções">
      <div className="rail-marca">
        <span className="rail-marca-nome">{marca}</span>
        <span className="rail-marca-conta">{conta}</span>
      </div>

      <ul className="rail-lista">
        {/* Both sides have news now, from different digests — see
            `lib/digest.ts`. It used to be his alone, which meant the platform
            told him about her and never her about him. */}
        <li>
          <Link
            href="/novidades"
            className={ativo(pathname, '/novidades') ? 'rail-item rail-item-ativo' : 'rail-item'}
            aria-current={ativo(pathname, '/novidades') ? 'page' : undefined}
          >
            <Sino />
            <span>Novidades</span>
            {novidades > 0 && <span className="numero contador">{novidades}</span>}
          </Link>
        </li>

        {DESTINOS.map(d => {
          const n = d.href === '/pedidos' ? pedidos : 0
          return (
            <li key={d.href}>
              <Link
                href={d.href}
                className={ativo(pathname, d.href) ? 'rail-item rail-item-ativo' : 'rail-item'}
                aria-current={ativo(pathname, d.href) ? 'page' : undefined}
                aria-label={rotuloCom(d.label, n)}
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

/** The bell in the top bar, which is where "Novidades" lives on a phone. */
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

/* Six of the seven. Conta is reached from the account name in the top bar,
   which only exists on a phone — the rail carries all seven on desktop, where
   vertical space is not the constraint. */
const NA_BARRA = DESTINOS.filter(d => d.href !== '/conta')

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
        const n = d.href === '/pedidos'
          ? pedidos
          : d.href === '/novidades' ? novidades : 0
        return (
          <Link
            key={d.href}
            href={d.href}
            className={ativo(pathname, d.href) ? 'barra-item barra-item-ativo' : 'barra-item'}
            aria-current={ativo(pathname, d.href) ? 'page' : undefined}
            aria-label={rotuloCom(d.label, n)}
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
