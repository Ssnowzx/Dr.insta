'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addRequestComment, setRequestState } from '@/lib/request-actions'
import type { RequestState } from '@/lib/request-actions'

/**
 * The interactive half of a request: send a file, write a note, close it.
 *
 * Upload goes to a Route Handler over XHR rather than `fetch`, because only XHR
 * reports upload progress. On 4G a 7 MB file takes long enough that a screen
 * with no progress reads as frozen, and a second tap starts a second upload.
 *
 * Every visible string is pt-BR.
 */

const ACEITOS = [
  'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif',
  'text/csv', 'application/csv', 'text/plain', 'application/pdf', 'application/json',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]

interface Envio {
  nome: string
  porcento: number
  erro?: string
  pronto?: boolean
}

function tamanho (bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`.replace('.', ',')
}

function enviarArquivo (
  pedido: string,
  arquivo: File,
  aoProgredir: (p: number) => void
): Promise<{ ok: boolean; erro?: string }> {
  return new Promise(resolve => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `/api/arquivo?pedido=${encodeURIComponent(pedido)}`)

    /* The type the browser inferred; the server checks it against its own list.
       Some phones hand back an empty type for .csv, so we fall back rather than
       sending nothing and being rejected for a missing header. */
    xhr.setRequestHeader('content-type', arquivo.type === '' ? 'application/octet-stream' : arquivo.type)
    /* Headers are latin-1 and her filenames carry accents. */
    xhr.setRequestHeader('x-nome-arquivo', encodeURIComponent(arquivo.name))

    xhr.upload.addEventListener('progress', e => {
      if (e.lengthComputable) aoProgredir(Math.round((e.loaded / e.total) * 100))
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ ok: true })
        return
      }
      let erro = 'Não consegui receber esse arquivo.'
      try {
        const corpo: unknown = JSON.parse(xhr.responseText)
        if (typeof corpo === 'object' && corpo !== null && 'erro' in corpo) {
          erro = String((corpo as { erro: unknown }).erro)
        }
      } catch { /* resposta sem JSON: fica a mensagem genérica */ }
      resolve({ ok: false, erro })
    })

    xhr.addEventListener('error', () => {
      resolve({ ok: false, erro: 'A conexão caiu no meio do envio. Tente de novo.' })
    })

    xhr.send(arquivo)
  })
}

export function RequestActions ({
  pedido,
  estado
}: {
  pedido: string
  estado: RequestState
}) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [envios, setEnvios] = useState<Envio[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const campo = useRef<HTMLInputElement>(null)
  const nota = useRef<HTMLTextAreaElement>(null)

  async function aoEscolher (lista: FileList | null) {
    if (lista === null || lista.length === 0) return
    setErro(null)
    setEnviando(true)

    const arquivos = [...lista]
    setEnvios(arquivos.map(a => ({ nome: a.name, porcento: 0 })))

    for (const [i, arquivo] of arquivos.entries()) {
      const r = await enviarArquivo(pedido, arquivo, p => {
        setEnvios(atual => atual.map((e, j) => j === i ? { ...e, porcento: p } : e))
      })
      setEnvios(atual => atual.map((e, j) => j === i
        ? { ...e, porcento: 100, pronto: r.ok, ...(r.erro === undefined ? {} : { erro: r.erro }) }
        : e))
    }

    setEnviando(false)
    if (campo.current !== null) campo.current.value = ''
    router.refresh()
  }

  function comentar () {
    const texto = nota.current?.value ?? ''
    setErro(null)
    iniciar(async () => {
      const r = await addRequestComment(pedido, texto)
      if (!r.ok) { setErro(r.error ?? 'Não consegui salvar.'); return }
      if (nota.current !== null) nota.current.value = ''
      router.refresh()
    })
  }

  function mudar (novo: RequestState) {
    setErro(null)
    iniciar(async () => {
      const r = await setRequestState(pedido, novo)
      if (!r.ok) { setErro(r.error ?? 'Não consegui salvar.'); return }
      router.refresh()
    })
  }

  const fechado = estado === 'delivered' || estado === 'dropped'

  return (
    <div className="acoes">
      <div className="envio">
        <label className="btn-envio" htmlFor={`arquivo-${pedido}`}>
          {enviando ? 'Enviando…' : 'Anexar arquivo'}
        </label>
        <input
          id={`arquivo-${pedido}`}
          ref={campo}
          type="file"
          multiple
          accept={ACEITOS.join(',')}
          disabled={enviando}
          onChange={e => { void aoEscolher(e.target.files) }}
        />
        <p className="envio-dica">
          Planilha, CSV, PDF ou print. Até 64 MB cada — pode mandar vários de uma vez.
        </p>

        {envios.length > 0 && (
          <ul className="envio-lista">
            {envios.map((e, i) => (
              <li key={`${e.nome}-${i}`} className={e.erro !== undefined ? 'envio-item envio-falhou' : 'envio-item'}>
                <span className="envio-nome">{e.nome}</span>
                <div className="envio-trilho">
                  <div className="envio-barra" style={{ width: `${e.porcento}%` }} />
                </div>
                <span className="envio-estado">
                  {e.erro !== undefined ? e.erro : e.pronto === true ? 'recebido' : `${e.porcento}%`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="nota">
        <label htmlFor={`nota-${pedido}`}>Quer escrever alguma coisa junto?</label>
        <textarea
          id={`nota-${pedido}`}
          ref={nota}
          rows={3}
          maxLength={4000}
          placeholder="Ex.: exportei só de junho pra cá, o resto não deixou"
        />
        <div className="nota-pe">
          <button type="button" className="btn-nota" disabled={pendente} onClick={comentar}>
            {pendente ? 'Salvando…' : 'Enviar recado'}
          </button>
        </div>
      </div>

      {/* Closing is hers to declare. An upload moves a request to "em andamento"
          and stops there — deciding it is finished on her behalf would be me
          answering my own question. */}
      <div className="fechar">
        {fechado
          ? (
            <button type="button" className="btn-reabrir" disabled={pendente} onClick={() => mudar('open')}>
              Reabrir este pedido
            </button>
            )
          : (
            <>
              <button type="button" className="btn-fechar" disabled={pendente} onClick={() => mudar('delivered')}>
                Mandei tudo que dava
              </button>
              <button type="button" className="btn-dispensar" disabled={pendente} onClick={() => mudar('dropped')}>
                Não vou conseguir esse
              </button>
            </>
            )}
      </div>

      {erro !== null && <p className="nota-erro" role="alert">{erro}</p>}
    </div>
  )
}

export function FileSize ({ bytes }: { bytes: number }) {
  return <>{tamanho(bytes)}</>
}
