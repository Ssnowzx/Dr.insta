'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RequestText } from './request-text'
import { answerField } from '@/lib/campo-actions'

/**
 * A number she types instead of a screenshot she sends.
 *
 * THE COPY IS THE FEATURE HERE
 *
 * The field itself is four lines of state. What decides whether it works is
 * whether she can read it once and know exactly what to type — so every string
 * says WHERE to look and WHAT to write, in that order, with an example that is
 * a real number off her own account.
 *
 * One field at a time, each saved on its own. A form with five inputs and one
 * button is a form she abandons when she only has three of the numbers; here
 * the third one saves and the other two go on waiting.
 */

export interface CampoView {
  id: number
  label: string
  hint: string | null
  unit: 'count' | 'ratio'
  /** What she already sent, written back the way she would write it. */
  eco: string | null
  answeredAt: string | null
}

export function CampoNumero ({ campo }: { campo: CampoView }) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [salvo, setSalvo] = useState<string | null>(campo.eco)
  const entrada = useRef<HTMLInputElement>(null)

  function enviar () {
    setErro(null)
    iniciar(async () => {
      const r = await answerField(campo.id, entrada.current?.value ?? '')
      if (!r.ok) {
        setErro(r.error ?? 'Não consegui salvar.')
        return
      }
      setSalvo(r.eco ?? null)
      if (entrada.current !== null) entrada.current.value = ''
      router.refresh()
    })
  }

  return (
    <li className={salvo === null ? 'campo-num' : 'campo-num campo-num-ok'}>
      <label className="campo-num-rot" htmlFor={`campo-${campo.id}`}>
        {campo.label}
      </label>
      {/* Through `RequestText`, so the Reel's address is a link she can tap
          rather than a URL she has to retype. On a phone that is the whole
          difference between following an instruction and not. */}
      {campo.hint !== null && (
        <p className="campo-num-onde"><RequestText text={campo.hint} /></p>
      )}

      <div className="campo-num-linha">
        <input
          id={`campo-${campo.id}`}
          ref={entrada}
          type="text"
          /* `inputMode` and not `type="number"`: a number input on a phone
             rejects the dot she uses for thousands, strips it on some Android
             keyboards, and adds a spinner nobody wants. The parse is ours
             either way — see `lib/numero.ts`. */
          inputMode="decimal"
          autoComplete="off"
          maxLength={20}
          placeholder={campo.unit === 'ratio' ? 'ex.: 64' : 'ex.: 347.482'}
          onKeyDown={e => { if (e.key === 'Enter') enviar() }}
        />
        <button type="button" className="btn-nota" disabled={pendente} onClick={enviar}>
          {pendente ? 'Salvando…' : salvo === null ? 'Enviar' : 'Corrigir'}
        </button>
      </div>

      {/* The echo. She typed "347482" or "347.482" and both were accepted, so
          the confirmation has to show what actually landed — otherwise a
          thousand-fold typo is invisible at the exact moment it could be
          caught. */}
      {salvo !== null && erro === null && (
        <p className="campo-num-eco">
          <span aria-hidden="true">✓</span> Guardei <strong>{salvo}</strong>.
          {campo.answeredAt !== null && <> Enviado em {campo.answeredAt}.</>}
          {' '}Se estiver errado, escreva de novo aí em cima.
        </p>
      )}

      {erro !== null && <p className="nota-erro" role="alert">{erro}</p>}
    </li>
  )
}

/**
 * The whole block, with the sentence that frames it.
 *
 * Framed as "escreva o número" and never as "preencha o formulário": the ask is
 * one integer she can read off a screen she already has open, and calling it a
 * form is what makes it feel like something to do later.
 */
export function CamposDoPedido ({
  campos,
  ehCliente
}: {
  campos: CampoView[]
  ehCliente: boolean
}) {
  if (campos.length === 0) return null

  const faltam = campos.filter(c => c.eco === null).length

  return (
    <section className="secao">
      <div className="secao-cab">
        <h2 className="titulo-secao">Escreva o número aqui</h2>
        <p className="secao-nota">
          {faltam === 0
            ? 'tudo enviado'
            : faltam === campos.length
              ? 'não precisa mandar print'
              : faltam === 1 ? 'falta um' : `faltam ${faltam}`}
        </p>
      </div>

      <p className="rodape-nota" style={{ marginTop: 0, marginBottom: '1rem' }}>
        {ehCliente
          ? 'Abra o Instagram, ache o número e escreva aqui. Ele entra no painel na hora — não precisa tirar print nem esperar ninguém.'
          : 'O que ela escrever aqui entra direto no painel, sem passar por você.'}
      </p>

      <ul className="campos-num">
        {campos.map(c => <CampoNumero key={c.id} campo={c} />)}
      </ul>
    </section>
  )
}
