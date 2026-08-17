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
 * WHOSE ANSWER THIS IS
 *
 * The state shown is the TEAM's, not the reader's own. With Bianca and her
 * assistant both on the client side, a control that showed each of them their
 * private answer would have them doing the same chore twice — so `quem` names
 * whoever last answered, and the caption says it out loud rather than leaving
 * the two of them to work out why the toggle moved on its own.
 *
 * `somenteLeitura` is the consultant's view: he sees what they answered and
 * cannot overwrite it by tapping. He used to get a separate block of markup for
 * exactly this, which is how the two views drifted apart.
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
  comentario,
  quem,
  quando,
  notaDeOutro,
  somenteLeitura = false
}: {
  stepId: number
  estado: StepState
  /**
   * THIS person's note, never the team's.
   *
   * It is the textarea's `defaultValue`, and `marcar()` posts that textarea on
   * every state change — so a teammate's sentence here would be written into
   * this person's row, under this person's name, by a tap on "feito". The
   * team's note is `notaDeOutro`, displayed and not editable.
   */
  comentario: string | null
  /** Who last answered, when someone has. */
  quem?: string
  quando?: string
  /** A note written by the OTHER person on the team. Read-only, attributed. */
  notaDeOutro?: { texto: string; quem: string }
  somenteLeitura?: boolean
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

  /* His view. Read-only, same shape, so the two sides cannot describe the same
     row differently — which they did, for weeks, in two blocks of markup. */
  if (somenteLeitura) {
    return (
      <div className="controle">
        <div className="segmentos" role="group" aria-label="Como está este item">
          {OPCOES.map(o => (
            <span
              key={o.estado}
              className={otimista === o.estado
                ? `segmento segmento-${o.estado} segmento-ativo segmento-leitura`
                : 'segmento segmento-leitura'}
            >
              {o.rotulo}
            </span>
          ))}
        </div>
        <p className="resposta-quem">
          {quem === undefined
            ? 'Ninguém da equipe dela marcou este ainda.'
            : `${quem} marcou${quando === undefined ? '' : ` em ${quando}`}.`}
        </p>
        {comentario !== null && <p className="resposta-nota">{comentario}</p>}
      </div>
    )
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

      {/* Who answered, on her side too. Without it, the assistant marking
          something makes the state change under Bianca with no explanation —
          which reads as the app deciding things by itself. */}
      {quem !== undefined && (
        <p className="resposta-quem">
          {quem} marcou{quando === undefined ? '' : ` em ${quando}`}. Se mudou, é
          só tocar de novo.
        </p>
      )}

      {/* What the teammate wrote, shown and not editable. It used to be loaded
          into the textarea below, which is how one person's words got saved
          under the other's name. */}
      {notaDeOutro !== undefined && (
        <p className="resposta-nota">
          <span className="resposta-nota-quem">{notaDeOutro.quem} anotou</span>
          {notaDeOutro.texto}
        </p>
      )}

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
              ? 'Ex.: não achei essa aba no Insights'
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
