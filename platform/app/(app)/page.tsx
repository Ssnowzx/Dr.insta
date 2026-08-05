import type { Metadata } from 'next'
import Link from 'next/link'
import { ClientPicker } from '@/components/client-picker'
import { Funnel } from '@/components/funnel'
import { MetricBar, MetricStat } from '@/components/metric-bar'
import {
  activeCycle, clientBySlug, clientProfile, funnel, latestPeriod, metrics, requests
} from '@/lib/dashboard'
import { requireSession } from '@/lib/dal'
import { longDate, monthLabel } from '@/lib/format'

export const metadata: Metadata = { title: 'Painel — My Favorite' }
export const dynamic = 'force-dynamic'

/**
 * The panel.
 *
 * It opens with the funnel because the funnel is the diagnosis: enormous
 * attention, almost no purchases. A grid of KPI cards would show the same four
 * numbers and hide the relationship between them, which is the only thing that
 * matters here.
 *
 * Order below the funnel is deliberate: what decides the cycle first, what is
 * already healthy second. The healthy numbers are large and would dominate the
 * page if they came first — and this client\'s risk is precisely that she reads
 * the big numbers and concludes nothing is wrong.
 */
export default async function Painel ({
  searchParams
}: {
  searchParams: Promise<{ cliente?: string }>
}) {
  const identity = await requireSession()
  const { cliente } = await searchParams

  /* A client user's own id always wins; the query string is only consulted for
     a consultant, who has none. Reading the parameter first would let a client
     open another client by editing the URL. */
  const clientId = identity.clientId
    ?? (cliente === undefined ? null : (await clientBySlug(cliente))?.id ?? null)

  if (clientId === null) return <ClientPicker base="/" />

  const [profile, cycle, period] = await Promise.all([
    clientProfile(clientId),
    activeCycle(clientId),
    latestPeriod(clientId)
  ])

  if (period === null || cycle === null) {
    return (
      <header className="pagina-cab">
        <p className="sobrancelha">Painel</p>
        <h1 className="display">Ainda sem números.</h1>
        <p className="lead">
          Assim que os primeiros dados entrarem, eles aparecem aqui.
        </p>
      </header>
    )
  }

  const [etapas, todas, pedidos] = await Promise.all([
    funnel(clientId, period),
    metrics(clientId, cycle.id, period, profile?.niche ?? 'lifestyle'),
    requests(clientId)
  ])

  const decidem = todas
    .filter(m => (m.tier === 'decision' || m.tier === 'north_star') && m.value !== null)
    .sort((a, b) => (a.tier === 'north_star' ? -1 : 0) - (b.tier === 'north_star' ? -1 : 0))

  const acompanhar = todas.filter(m => m.tier === 'monitor' && m.value !== null)
  const abertos = pedidos.filter(p => p.state === 'open' || p.state === 'in_progress')

  return (
    <>
      <header className="pagina-cab">
        <p className="sobrancelha">
          Ciclo desde {longDate(cycle.startsOn)} · números de {monthLabel(period)}
        </p>
        <h1 className="display">{cycle.title}</h1>
        {cycle.goal !== null && <p className="lead">{cycle.goal}</p>}
      </header>

      <section className="painel-destaque">
        <div className="destaque-cab">
          <h2 className="destaque-titulo">De quem te vê até quem compra</h2>
          <p className="destaque-sub">
            Quatro degraus, na mesma escala. O primeiro é o tamanho da sua
            audiência; o último é quanta gente chegou a comprar.
          </p>
        </div>
        <Funnel stages={etapas} />
      </section>

      {abertos.length > 0 && (
        <section className="secao">
          <div className="secao-cab">
            <h2 className="titulo-secao">O que eu preciso de você</h2>
            <Link href="/pedidos" className="secao-nota">ver os {abertos.length} →</Link>
          </div>
          <ul className="lista-simples">
            {abertos.slice(0, 3).map(p => (
              <li key={p.id}>
                <Link href="/pedidos" className="lista-item">
                  <span className="lista-titulo">{p.title}</span>
                  <span className="lista-meta">
                    {p.kind === 'data' ? 'me mandar um dado' : p.kind === 'question' ? 'só responder' : 'uma ação'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="secao">
        <div className="secao-cab">
          <h2 className="titulo-secao">O que decide este ciclo</h2>
          <p className="secao-nota">seguir estes, não a média</p>
        </div>
        <div className="grade-metricas">
          {decidem.map(m => <MetricBar key={m.key} metric={m} />)}
        </div>
      </section>

      <section className="secao">
        <div className="secao-cab">
          <h2 className="titulo-secao">Já está bom — não mexer</h2>
          <p className="secao-nota">reportar, não otimizar</p>
        </div>
        <div className="grade-stats">
          {acompanhar.map(m => <MetricStat key={m.key} metric={m} />)}
        </div>
        <p className="rodape-nota">
          Estes números estão na média do seu nicho ou acima dela. Eles entram
          aqui para dar contexto e para a gente perceber se caírem — não para
          serem melhorados neste ciclo.
        </p>
      </section>
    </>
  )
}
