'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { openRequest } from '@/lib/request-actions'

/**
 * Opening a request, from either side.
 *
 * One required field. The temptation is to ask for kind, priority, a deadline
 * and why it matters — and a form with five fields is how you get her to close
 * the tab and send a WhatsApp message instead, which is the exact behaviour
 * this replaces. Everything else has a default and is editable afterwards.
 *
 * Collapsed until clicked: an open textarea at the bottom of a list of pending
 * work reads as one more thing to do.
 */
export function NovoPedido ({ titulo, dica }: { titulo: string; dica: string }) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const campo = useRef<HTMLInputElement>(null)
  const texto = useRef<HTMLTextAreaElement>(null)

  function enviar () {
    setErro(null)
    iniciar(async () => {
      const r = await openRequest(campo.current?.value ?? '', texto.current?.value)
      if (!r.ok) { setErro(r.error ?? 'Não consegui abrir.'); return }
      if (campo.current !== null) campo.current.value = ''
      if (texto.current !== null) texto.current.value = ''
      setAberto(false)
      router.refresh()
    })
  }

  if (!aberto) {
    return (
      <section className="secao">
        <button type="button" className="btn-abrir" onClick={() => setAberto(true)}>
          {titulo}
        </button>
      </section>
    )
  }

  return (
    <section className="secao">
      <div className="secao-cab">
        <h2 className="titulo-secao">{titulo}</h2>
      </div>

      <div className="nota">
        <label htmlFor="novo-titulo">Do que se trata?</label>
        <input id="novo-titulo" ref={campo} type="text" maxLength={200} />

        <label htmlFor="novo-texto">Quer detalhar?</label>
        <textarea id="novo-texto" ref={texto} rows={3} maxLength={4000} />

        <div className="nota-pe">
          <button type="button" className="btn-nota" disabled={pendente} onClick={enviar}>
            {pendente ? 'Abrindo…' : 'Abrir pedido'}
          </button>
          <button type="button" className="btn-dispensar" onClick={() => setAberto(false)}>
            Cancelar
          </button>
        </div>

        <p className="envio-dica">{dica}</p>
        {erro !== null && <p className="nota-erro" role="alert">{erro}</p>}
      </div>
    </section>
  )
}
