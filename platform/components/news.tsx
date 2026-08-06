'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { generateAccessLink, markNewsSeen } from '@/lib/news-actions'

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
