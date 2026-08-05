'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * The one navigation, rendered twice: a rail on desktop, a bar at the bottom on
 * a phone. Same list, same active state, no duplicated source of truth.
 *
 * Bottom bar and not a hamburger: she opens this on a phone, one-handed, and a
 * menu hidden behind a tap is a menu nobody uses. Four destinations fit across
 * a 360px screen with 44px targets.
 *
 * Icons are inline SVG at `stroke: currentColor` so they inherit the active
 * colour and the theme without a second set of assets.
 */

interface Destino {
  href: string
  label: string
  icon: 'painel' | 'plano' | 'pedidos' | 'conteudo' | 'conta'
}

const DESTINOS: Destino[] = [
  { href: '/', label: 'Painel', icon: 'painel' },
  { href: '/plano', label: 'Plano', icon: 'plano' },
  { href: '/pedidos', label: 'Pedidos', icon: 'pedidos' },
  { href: '/conteudo', label: 'Conteúdo', icon: 'conteudo' },
  { href: '/conta', label: 'Conta', icon: 'conta' }
]

function Icone ({ nome }: { nome: Destino['icon'] }) {
  const comum = {
    width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.7,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
    'aria-hidden': true
  }

  switch (nome) {
    case 'painel':
      /* Three descending bars — the funnel, which is what the panel is about. */
      return <svg {...comum}><path d="M4 6h16M4 12h9M4 18h4" /></svg>
    case 'plano':
      return <svg {...comum}><path d="M4 6.5 6 8.5 9.5 5M4 12.5l2 2L9.5 11M4 18.5l2 2 3.5-3.5M13 7h7M13 13h7M13 19h7" /></svg>
    case 'pedidos':
      return <svg {...comum}><path d="M12 3v12M7.5 10.5 12 15l4.5-4.5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
    case 'conteudo':
      /* A play triangle inside a frame: the archive is Reels. */
      return <svg {...comum}><rect x="3.2" y="4.2" width="17.6" height="15.6" rx="3" /><path d="M10.4 9.2 15 12l-4.6 2.8z" /></svg>
    case 'conta':
      return <svg {...comum}><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></svg>
  }
}

function ativo (pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href)
}

export function NavLateral ({ marca, conta }: { marca: string; conta: string }) {
  const pathname = usePathname()

  return (
    <nav className="rail" aria-label="Seções">
      <div className="rail-marca">
        <span className="rail-marca-nome">{marca}</span>
        <span className="rail-marca-conta">{conta}</span>
      </div>

      <ul className="rail-lista">
        {DESTINOS.map(d => (
          <li key={d.href}>
            <Link
              href={d.href}
              className={ativo(pathname, d.href) ? 'rail-item rail-item-ativo' : 'rail-item'}
              aria-current={ativo(pathname, d.href) ? 'page' : undefined}
            >
              <Icone nome={d.icon} />
              <span>{d.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function NavInferior () {
  const pathname = usePathname()

  return (
    <nav className="barra" aria-label="Seções">
      {DESTINOS.map(d => (
        <Link
          key={d.href}
          href={d.href}
          className={ativo(pathname, d.href) ? 'barra-item barra-item-ativo' : 'barra-item'}
          aria-current={ativo(pathname, d.href) ? 'page' : undefined}
        >
          <Icone nome={d.icon} />
          <span>{d.label}</span>
        </Link>
      ))}
    </nav>
  )
}
