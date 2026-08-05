'use client'

import { useOptimistic, useRef, useState, useTransition } from 'react'
import { setStepState } from '@/lib/step-actions'
import type { StepState } from '@/lib/step-actions'

/**
 * The three-state control for one step.
 *
 * `useOptimistic` moves the highlight on tap, before the round trip. On a phone
 * over 4G the wait is long enough to feel like the tap did not register, and a
 * second tap on a toggle undoes the first.
 *
 * Marking is one tap and the note is optional — a partial answer has to be as
 * cheap as a complete one, or she only answers when everything is done, which
 * means never.
 *
 * Every visible string is pt-BR.
 */

const OPCOES: Array<{ estado: StepState; rotulo: string; descricao: string }> = [
  { estado: 'pending', rotulo: 'a fazer', descricao: 'ainda não comecei' },
  { estado: 'done', rotulo: 'feito', descricao: 'já está pronto' },
  { estado: 'blocked', rotulo: 'travou', descricao: 'tentei e não consegui' }
]

export function StepControl ({
  stepId,
  estado,
  comentario
}: {
  stepId: number
  estado: StepState
  comentario: string | null
}) {
  const [pendente, iniciar] = useTransition()
  const [otimista, definirOtimista] = useOptimistic(estado)
  const [erro, setErro] = useState<string | null>(null)
  const [notaAberta, setNotaAberta] = useState(comentario !== null)
  const [salvo, setSalvo] = useState(false)
  const nota = useRef<HTMLTextAreaElement>(null)

  function marcar (novo: StepState) {
    setErro(null)
    setSalvo(false)
    iniciar(async () => {
      definirOtimista(novo)
      const r = await setStepState(stepId, novo, nota.current?.value ?? comentario)
      if (!r.ok) setErro(r.error ?? 'Não consegui salvar. Tente de novo.')
      /* When something blocks her, the note is the point — open it for her
         instead of making her find it. */
      if (r.ok && novo === 'blocked') setNotaAberta(true)
    })
  }

  function salvarNota () {
    setErro(null)
    iniciar(async () => {
      const r = await setStepState(stepId, otimista, nota.current?.value ?? '')
      if (r.ok) setSalvo(true)
      else setErro(r.error ?? 'Não consegui salvar. Tente de novo.')
    })
  }

  return (
    <div className="controle">
      <div className="segmentos" role="group" aria-label="Como está este item">
        {OPCOES.map(o => {
          const ativo = otimista === o.estado
          return (
            <button
              key={o.estado}
              type="button"
              className={ativo ? `segmento segmento-${o.estado} segmento-ativo` : 'segmento'}
              aria-pressed={ativo}
              title={o.descricao}
              disabled={pendente}
              onClick={() => marcar(o.estado)}
            >
              {o.rotulo}
            </button>
          )
        })}
      </div>

      {!notaAberta && (
        <button type="button" className="link-nota" onClick={() => setNotaAberta(true)}>
          anotar alguma coisa
        </button>
      )}

      {notaAberta && (
        <div className="nota">
          <label htmlFor={`nota-${stepId}`}>
            {otimista === 'blocked'
              ? 'O que travou? É isso que me faz trocar o caminho.'
              : 'Alguma coisa que você notou?'}
          </label>
          <textarea
            id={`nota-${stepId}`}
            ref={nota}
            defaultValue={comentario ?? ''}
            rows={3}
            maxLength={2000}
            placeholder={otimista === 'blocked'
              ? 'Ex.: não achei onde troca o link'
              : 'Ex.: fiz e o alcance caiu'}
            onChange={() => { setSalvo(false) }}
          />
          <div className="nota-pe">
            <button type="button" className="btn-nota" disabled={pendente} onClick={salvarNota}>
              {pendente ? 'Salvando…' : 'Salvar anotação'}
            </button>
            {salvo && <span className="nota-ok">salvo</span>}
          </div>
        </div>
      )}

      {erro !== null && <p className="nota-erro" role="alert">{erro}</p>}
    </div>
  )
}
