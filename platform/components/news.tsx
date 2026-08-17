'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addClientPerson, generateAccessLink, markNewsSeen } from '@/lib/news-actions'

/** Advances the read marker for the activity screen. */
export function MarkSeen () {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()

  return (
    <button
      type="button"
      className="btn-lido"
      disabled={pendente}
      onClick={() => iniciar(async () => { await markNewsSeen(); router.refresh() })}
    >
      {pendente ? 'Marcando…' : 'Marcar como lido'}
    </button>
  )
}

/**
 * Mints an access link for a client and puts it on the clipboard.
 *
 * This product sends no email, so a client who cannot get in has no
 * self-service path — this is it. The link is shown as well as copied, because
 * `navigator.clipboard` needs a secure context and silently does nothing over
 * plain HTTP; showing it means the feature still works when the copy does not.
 */
export function AccessLink ({ userId, userName }: { userId: number; userName: string }) {
  const [pendente, iniciar] = useTransition()
  const [url, setUrl] = useState<string | null>(null)
  const [expira, setExpira] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  function gerar () {
    setErro(null)
    setCopiado(false)
    iniciar(async () => {
      const r = await generateAccessLink(userId)
      if (!r.ok || r.url === undefined) {
        setErro(r.error ?? 'Não consegui gerar o link.')
        return
      }
      setUrl(r.url)
      setExpira(r.expiresAt ?? null)
      try {
        await navigator.clipboard.writeText(r.url)
        setCopiado(true)
      } catch {
        /* Needs a secure context. The link is on screen either way. */
      }
    })
  }

  return (
    <div className="acesso">
      <button type="button" className="btn-acesso" disabled={pendente} onClick={gerar}>
        {pendente ? 'Gerando…' : `Gerar link de acesso para ${userName.split(' ')[0]}`}
      </button>

      {url !== null && (
        <div className="acesso-saida">
          <p className="acesso-rot">
            {copiado ? 'Copiado. Mande por onde vocês conversam.' : 'Copie e mande por onde vocês conversam.'}
          </p>
          <code className="acesso-url">{url}</code>
          {expira !== null && (
            <p className="acesso-prazo">
              Vale até {new Date(expira).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.
              Gerar outro invalida este.
            </p>
          )}
        </div>
      )}

      {erro !== null && <p className="nota-erro" role="alert">{erro}</p>}
    </div>
  )
}

/**
 * Adds a second person to the client's team, and hands over their first link.
 *
 * The profile is run by two people — Bianca and her assistant — and until this
 * existed, adding the second one meant an SSH session and `npm run invite`. The
 * account that owns the site is deliberately outside the docker group, so that
 * was a task one person could do at a computer and nowhere else.
 *
 * Collapsed by default. It sits under a list of people who already have access,
 * and an open three-field form there reads as the main thing on the section when
 * it is the rare one.
 */
export function AddPerson () {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [pendente, iniciar] = useTransition()
  const [url, setUrl] = useState<string | null>(null)
  const [quem, setQuem] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  const nome = useRef<HTMLInputElement>(null)
  const email = useRef<HTMLInputElement>(null)
  const funcao = useRef<HTMLInputElement>(null)

  function criar () {
    setErro(null)
    setCopiado(false)
    iniciar(async () => {
      const r = await addClientPerson(
        nome.current?.value ?? '',
        email.current?.value ?? '',
        funcao.current?.value ?? ''
      )
      if (!r.ok || r.url === undefined) {
        setErro(r.error ?? 'Não consegui criar o acesso.')
        return
      }
      setUrl(r.url)
      setQuem(r.name ?? null)
      try {
        await navigator.clipboard.writeText(r.url)
        setCopiado(true)
      } catch {
        /* Needs a secure context. The link is on screen either way. */
      }
      /* The list above has to gain a row, and it is server-rendered. Without
         this the new person appears only on the next hard reload, which reads as
         the form not having worked. */
      router.refresh()
    })
  }

  if (!aberto) {
    return (
      <button type="button" className="link-nota" onClick={() => setAberto(true)}>
        + adicionar alguém da equipe dela
      </button>
    )
  }

  return (
    <div className="acesso">
      <div className="campo">
        <label htmlFor="pessoa-nome">Nome</label>
        <input id="pessoa-nome" ref={nome} type="text" autoComplete="off" maxLength={120} />
      </div>
      <div className="campo">
        <label htmlFor="pessoa-email">E-mail</label>
        <input
          id="pessoa-email" ref={email} type="email"
          autoComplete="off" inputMode="email" maxLength={190}
        />
      </div>
      <div className="campo">
        <label htmlFor="pessoa-funcao">O que ela faz</label>
        <input
          id="pessoa-funcao" ref={funcao} type="text"
          autoComplete="off" maxLength={80} placeholder="assessora de conteúdo"
        />
        <span className="dica">
          Aparece ao lado do nome dela nas telas. Não muda o que ela pode fazer.
        </span>
      </div>

      <button type="button" className="btn" disabled={pendente} onClick={criar}>
        {pendente ? 'Criando…' : 'Criar acesso e gerar link'}
      </button>

      {url !== null && (
        <div className="acesso-saida">
          <p className="acesso-rot">
            {quem === null ? 'Pronto.' : `${quem} já pode entrar.`}{' '}
            {copiado ? 'O link está copiado — mande por onde vocês conversam.' : 'Copie e mande por onde vocês conversam.'}
          </p>
          <code className="acesso-url">{url}</code>
          <p className="acesso-prazo">Vale 7 dias. Nenhum e-mail sai daqui.</p>
        </div>
      )}

      {erro !== null && <p className="nota-erro" role="alert">{erro}</p>}
    </div>
  )
}
