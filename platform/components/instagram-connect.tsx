'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { disconnectInstagram } from '@/lib/instagram/actions'

/**
 * Disconnecting, with a confirmation step.
 *
 * Two clicks and not one: this is the only control on the screen whose effect
 * she cannot undo by pressing it again — reconnecting means going back through
 * Instagram's authorisation. Not a modal, though; a modal would block the page
 * to ask a question the button can ask itself.
 */
export function DesconectarInstagram () {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [confirmando, setConfirmando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function desconectar (): void {
    setErro(null)
    iniciar(async () => {
      const resultado = await disconnectInstagram()
      if (resultado.ok) {
        setConfirmando(false)
        router.refresh()
      } else {
        setErro(resultado.error ?? 'Não consegui desconectar agora.')
      }
    })
  }

  if (!confirmando) {
    return (
      <>
        <button type="button" className="btn-acesso" onClick={() => setConfirmando(true)}>
          Desconectar minha conta
        </button>
        {erro !== null && <p className="aviso aviso-erro">{erro}</p>}
      </>
    )
  }

  return (
    <div className="ig-confirmar">
      <p className="rodape-nota" style={{ marginTop: 0 }}>
        Os números que já entraram continuam aqui. O que para é a atualização
        automática — daí em diante eu volto a depender de você me mandar.
      </p>
      <div className="ig-confirmar-botoes">
        <button type="button" className="btn-acesso" disabled={pendente} onClick={desconectar}>
          {pendente ? 'Desconectando…' : 'Sim, desconectar'}
        </button>
        <button
          type="button"
          className="btn-acesso"
          disabled={pendente}
          onClick={() => setConfirmando(false)}
        >
          Deixar como está
        </button>
      </div>
      {erro !== null && <p className="aviso aviso-erro">{erro}</p>}
    </div>
  )
}
