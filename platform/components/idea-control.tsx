'use client'

import { useOptimistic, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addIdeaNote, setIdeaState } from '@/lib/idea-actions'
import type { IdeaState } from '@/lib/agenda'

/**
 * Where a pauta is, and what she thought of it.
 *
 * The four states she actually moves between. `proposed` is missing on purpose:
 * it is where a pauta starts, and offering "voltar para proposta" is offering a
 * button whose only use is undoing a tap — which `agendada` already does.
 *
 * `useOptimistic` moves the highlight before the round trip, like the plan's
 * control. She marks this standing in a room with a ring light, on 4G.
 */

/* Four labels of one or two short words, because at 390px the control gives
   each segment about 88px and "não vou fazer" wrapped to two lines — which
   makes one segment taller than the other three and the whole control read as
   broken. Measured rendered, not guessed. */
const ESTADOS: Array<{ estado: IdeaState; rotulo: string; descricao: string }> = [
  { estado: 'scheduled', rotulo: 'na fila', descricao: 'está agendada, ainda não gravei' },
  { estado: 'recorded', rotulo: 'gravei', descricao: 'gravado, ainda não publiquei' },
  { estado: 'published', rotulo: 'publiquei', descricao: 'já está no ar' },
  { estado: 'dropped', rotulo: 'não faço', descricao: 'essa pauta não é pra mim' }
]

export function IdeaControl ({
  ideaId,
  estado
}: {
  ideaId: number
  estado: IdeaState
}) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [otimista, definirOtimista] = useOptimistic(estado)
  const [erro, setErro] = useState<string | null>(null)

  function marcar (novo: IdeaState) {
    setErro(null)
    iniciar(async () => {
      definirOtimista(novo)
      const r = await setIdeaState(ideaId, novo)
      if (!r.ok) setErro(r.error ?? 'Não consegui salvar. Tente de novo.')
      /* The list groups by state, so the card moves sections. Without the
         refresh it stays where it was until the next navigation, which reads as
         the tap not having worked. */
      else router.refresh()
    })
  }

  return (
    <div className="controle">
      {/* Four options, not three: the grid's column count is a modifier because
          `.segmentos` hard-codes three, and a fourth child in a three-column
          grid wraps onto a second row half the width of the first. */}
      <div className="segmentos segmentos-quatro" role="group" aria-label="Como está esta pauta">
        {ESTADOS.map(o => {
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
      {erro !== null && <p className="nota-erro" role="alert">{erro}</p>}
    </div>
  )
}

/**
 * The conversation about one pauta.
 *
 * This is the half that makes the scripts get better instead of merely arriving.
 * What comes back — "ficou longo", "essa não é minha voz", "esse rendeu
 * comentário" — is what the next batch is written from, and it has to be as
 * cheap to send as a message, or it is sent through a channel with no history.
 *
 * Appended, never edited: the sequence is the value. A single field would keep
 * only the last thing anyone thought and lose why it changed.
 */
export function IdeaTalk ({ ideaId }: { ideaId: number }) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)
  const caixa = useRef<HTMLTextAreaElement>(null)

  function enviar () {
    setErro(null)
    setEnviado(false)
    iniciar(async () => {
      const r = await addIdeaNote(ideaId, caixa.current?.value ?? '')
      if (!r.ok) {
        setErro(r.error ?? 'Não consegui enviar. Tente de novo.')
        return
      }
      if (caixa.current !== null) caixa.current.value = ''
      setEnviado(true)
      router.refresh()
    })
  }

  return (
    <div className="nota">
      <label htmlFor={`fala-${ideaId}`}>
        O que você achou desta pauta?
      </label>
      <textarea
        id={`fala-${ideaId}`}
        ref={caixa}
        rows={3}
        maxLength={4000}
        placeholder="Ex.: gravei e ficou longo demais · essa abertura não é meu jeito de falar · esse foi o que mais rendeu comentário"
        onChange={() => { setEnviado(false) }}
      />
      <div className="nota-pe">
        <button type="button" className="btn-nota" disabled={pendente} onClick={enviar}>
          {pendente ? 'Enviando…' : 'Enviar'}
        </button>
        {enviado && <span className="nota-ok">enviado</span>}
      </div>
      {erro !== null && <p className="nota-erro" role="alert">{erro}</p>}
    </div>
  )
}
