import Link from 'next/link'
import { listClients } from '@/lib/dashboard'

/**
 * What a consultant sees before choosing a client.
 *
 * The real multi-client view is a later phase. This exists because without it
 * the consultant's read view — what she marked, what blocked her — is
 * unreachable: a consultant has no `client_id`, so every scoped page stops at
 * "pick a client" and the feature built for them can never be opened.
 *
 * The choice travels in the query string and is resolved server-side against
 * the client table, so a hand-typed slug for a client that does not exist
 * simply finds nothing.
 */
export async function ClientPicker ({ base }: { base: string }) {
  const clients = await listClients()

  return (
    <>
      <header className="pagina-cab">
        <p className="sobrancelha">Visão de consultor</p>
        <h1 className="display">Escolha um cliente.</h1>
        <p className="lead">
          A visão com vários clientes lado a lado entra numa fase seguinte. Por
          enquanto, abra um de cada vez.
        </p>
      </header>

      <ul className="lista-simples">
        {clients.map(c => (
          <li key={c.id}>
            <Link href={`${base}?cliente=${c.slug}`} className="lista-item">
              <span className="lista-titulo">{c.name}</span>
              <span className="lista-meta">{c.brand ?? '—'}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
