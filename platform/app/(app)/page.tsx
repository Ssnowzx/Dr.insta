import type { Metadata } from 'next'
import Link from 'next/link'
import { DataAge } from '@/components/freshness'
import { Funnel } from '@/components/funnel'
import { Series } from '@/components/series'
import { MetricBar, MetricStat } from '@/components/metric-bar'
import {
  activeCycle, clientProfile, funnel, latestPeriod, metrics,
  monthlySeries, requests
} from '@/lib/dashboard'
import { clientScope } from '@/lib/dal'
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
export default async function Painel () {
  const clientId = await clientScope()

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

  const [etapas, todas, pedidos, series] = await Promise.all([
    funnel(clientId, period),
    metrics(clientId, cycle.id, period, profile?.niche ?? 'lifestyle'),
    requests(clientId),
    monthlySeries(clientId, ['views', 'posts_published'])
  ])

  /* The north-star metric leaves the grid and gets the full width. Sorting it
     first inside a grid of identical cards made it *first*, not *primary* — and
     a reader scanning nine equal rectangles has no way to tell which one the
     cycle is decided on. */
  const norte = todas.find(m => m.tier === 'north_star' && m.value !== null) ?? null
  const decidem = todas.filter(m => m.tier === 'decision' && m.value !== null)
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
        <DataAge period={period} />
      </header>

      <section className="placa">
        <h2 className="placa-sobrancelha">De quem te vê até quem compra</h2>
        <p className="placa-sub">
          Quatro degraus, na mesma escala. O primeiro é o tamanho da sua
          audiência; o último é quanta gente chegou a comprar.
        </p>
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
        {norte !== null && <MetricBar metric={norte} destaque />}

        <div className="grade-metricas">
          {decidem.map(m => <MetricBar key={m.key} metric={m} />)}
        </div>
      </section>

      {series.length > 0 && (
        <section className="secao">
          <div className="secao-cab">
            <h2 className="titulo-secao">Mês a mês</h2>
            <p className="secao-nota">números públicos</p>
          </div>
          <div className="series">
            {series.map(s => (
              <article className="serie-cartao" key={s.key}>
                <h3 className="serie-titulo">{s.label}</h3>
                {s.description !== null && <p className="serie-desc">{s.description}</p>}
                <Series
                  points={s.points}
                  unit={s.unit}
                  decimals={s.decimals}
                  label={s.label}
                />
              </article>
            ))}
          </div>
          <p className="rodape-nota">
            Estes dois vêm da exportação pública dos seus Reels, não dos Insights.
            Servem para ver esforço e resultado lado a lado — e para a gente
            perceber quando as views caírem, o que é esperado quando o mix mudar.
          </p>
        </section>
      )}

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
