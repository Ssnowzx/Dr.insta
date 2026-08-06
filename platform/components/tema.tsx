'use client'

import { useEffect, useState } from 'react'
import { CHAVE_TEMA } from '@/lib/tema'
import type { Tema } from '@/lib/tema'

/**
 * The theme switch.
 *
 * It exists because the product had two themes and no way to see one of them:
 * the palette followed `prefers-color-scheme` alone, so whichever theme the
 * operating system was set to was the only theme anyone could ever look at.
 * Half the design work was unreviewable.
 *
 * HOW THE SWITCH ACTUALLY WORKS
 *
 * It sets `data-tema` on `<html>`, and `app/base.css` turns that into a
 * `color-scheme` of `light` or `dark`. Every colour token is written as
 * `light-dark(claro, escuro)` and resolves against that automatically — so this
 * component changes ONE attribute and never touches a colour. Adding a token
 * later needs no change here.
 *
 * Three states, not two: "sistema" hands the decision back to the OS, which is
 * the right default and the only way to follow a machine that switches at
 * sunset. A two-state toggle silently pins whatever the user last tapped.
 */

const ORDEM: Tema[] = ['sistema', 'claro', 'escuro']

const ROTULO: Record<Tema, string> = {
  sistema: 'Tema do sistema',
  claro: 'Tema claro',
  escuro: 'Tema escuro'
}

function aplicar (tema: Tema): void {
  const raiz = document.documentElement
  if (tema === 'sistema') {
    delete raiz.dataset.tema
    try { localStorage.removeItem(CHAVE_TEMA) } catch { /* modo privado */ }
  } else {
    raiz.dataset.tema = tema
    try { localStorage.setItem(CHAVE_TEMA, tema) } catch { /* modo privado */ }
  }
}

export function BotaoTema () {
  /* Starts at `sistema` on both server and client so the markup matches; the
     effect below corrects it from storage after mount. Reading localStorage
     during render would make the server and the client disagree. */
  const [tema, setTema] = useState<Tema>('sistema')

  useEffect(() => {
    const guardado = document.documentElement.dataset.tema
    if (guardado === 'claro' || guardado === 'escuro') setTema(guardado)
  }, [])

  const proximo = ORDEM[(ORDEM.indexOf(tema) + 1) % ORDEM.length] ?? 'sistema'

  function trocar (): void {
    aplicar(proximo)
    setTema(proximo)
  }

  return (
    <button
      type="button"
      className="btn-tema"
      onClick={trocar}
      /* The label says the CURRENT state and the title says what the tap does.
         A control named after its own effect ("Escurecer") is ambiguous the
         moment there are three states. */
      aria-label={`${ROTULO[tema]}. Trocar para ${ROTULO[proximo].toLowerCase()}.`}
      title={`Trocar para ${ROTULO[proximo].toLowerCase()}`}
    >
      <Icone tema={tema} />
      <span className="btn-tema-rot">{ROTULO[tema].replace('Tema ', '')}</span>
    </button>
  )
}

/* Only `aria-*` and the rendered icon change between states — never
   `textContent` or `innerHTML` on the button, which would wipe the SVG. */
function Icone ({ tema }: { tema: Tema }) {
  const comum = {
    width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.7,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
    'aria-hidden': true
  }

  if (tema === 'claro') {
    return (
      <svg {...comum}>
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
      </svg>
    )
  }

  if (tema === 'escuro') {
    return (
      <svg {...comum}>
        <path d="M20 13.4A8.2 8.2 0 1 1 10.6 4a6.6 6.6 0 0 0 9.4 9.4Z" />
      </svg>
    )
  }

  /* System: half sun, half moon — the state is "whatever the machine says". */
  return (
    <svg {...comum}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 3.8a8.2 8.2 0 0 0 0 16.4Z" fill="currentColor" stroke="none" />
    </svg>
  )
}
