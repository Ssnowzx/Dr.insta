import type { Metadata } from 'next'
import Link from 'next/link'
import { DataAge } from '@/components/freshness'
import { Series } from '@/components/series'
import { MetricBar, MetricStat } from '@/components/metric-bar'
import {
  activeCycle, clientProfile, latestPeriod, metrics,
  monthlySeries, requests
} from '@/lib/dashboard'
import { clientScope } from '@/lib/dal'
import { connectionFor } from '@/lib/instagram/connection'
import { format, longDate, monthLabel } from '@/lib/format'

export const metadata: Metadata = { title: 'Painel' }
export const dynamic = 'force-dynamic'

/**
 * The panel.
 *
 * It opens with the cycle's thesis in two measured numbers: the audience
 * already talks to her by the thousands — in private, on Stories — while the
 * public side of the profile applauds and does not converse. The purchase
 * funnel that used to sit here was the PREVIOUS cycle's diagnosis; it left with
 * the handoff of the store side to the brand's own team (12 Aug 2026).
 *
 * Order below is deliberate: what decides the cycle first, what is already
 * healthy second. The healthy numbers are large and would dominate the page if
 * they came first — and this client\'s risk is precisely that she reads the big
 * numbers and concludes nothing is wrong.
 */

/**
 * Metrics whose ownership left the cycle on 12 Aug 2026: the profile→store
 * bridge belongs to the brand's team now. The values stay in the database as
 * history; they just stop being presented as numbers this cycle acts on.
 */
const HANDED_OFF = new Set([
  'tracked_sessions', 'transactions', 'revenue', 'conversion_rate',
  'bio_link_clicks', 'product_reel_retention'
])
export default async function Painel () {
  const clientId = await clientScope()

  const [profile, cycle, period, conexao] = await Promise.all([
    clientProfile(clientId),
    activeCycle(clientId),
    latestPeriod(clientId),
    connectionFor(clientId)
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

  const [todas, pedidos, series] = await Promise.all([
    metrics(clientId, cycle.id, period, profile?.niche ?? 'lifestyle'),
    requests(clientId),
    monthlySeries(clientId, ['views', 'posts_published'])
  ])

  const cartoes = todas.filter(m => !HANDED_OFF.has(m.key))

  /* The two sides of the thesis plate: the private conversation that already
     exists, and the public one the cycle is chasing. */
  const privado = cartoes.find(m => m.key === 'story_replies' && m.value !== null)
  const publico = cartoes.find(m => m.key === 'comments_reach' && m.value !== null)

  /* The north-star metric leaves the grid and gets the full width. Sorting it
     first inside a grid of identical cards made it *first*, not *primary* — and
     a reader scanning nine equal rectangles has no way to tell which one the
     cycle is decided on. */
  const norte = cartoes.find(m => m.tier === 'north_star' && m.value !== null) ?? null
  const decidem = cartoes.filter(m => m.tier === 'decision' && m.value !== null)
  const acompanhar = cartoes.filter(m => m.tier === 'monitor' && m.value !== null)
  const abertos = pedidos.filter(p => p.state === 'open' || p.state === 'in_progress')

  return (
    <>
      <header className="pagina-cab">
        <p className="sobrancelha">
          Ciclo desde {longDate(cycle.startsOn)} · números de {monthLabel(period)}
        </p>
        <h1 className="display">{cycle.title}</h1>
        {cycle.goal !== null && <p className="lead">{cycle.goal}</p>}
        <DataAge period={period} syncedAt={conexao?.state === 'active' ? conexao.lastSyncAt : null} />
      </header>

      {privado !== undefined && publico !== undefined && (
        <section className="placa">
          <h2 className="placa-sobrancelha">A conversa existe — no privado</h2>
          <p className="placa-sub">
            Nos Stories, sua audiência responde aos milhares todo mês. Na parte
            que todo mundo vê — os comentários — quase silêncio. Este ciclo puxa
            a conversa para o público.
          </p>
          {/* The same two-number statement the funnel's collapse used: the
              plate-native pattern, so both numbers read on the dark wool. */}
          <div className="colapso">
            <div className="colapso-lado">
              <span className="numero colapso-n">
                {format(privado.value, privado.unit, privado.decimals)}
              </span>
              <span className="colapso-rot">respostas nos seus Stories, no mês</span>
            </div>
            <div className="colapso-meio" aria-hidden="true">
              <span className="colapso-regua" />
              <span className="colapso-taxa">a mesma audiência, em público</span>
            </div>
            <div className="colapso-lado colapso-lado-fim">
              <span className="numero colapso-n">
                {format(publico.value, publico.unit, publico.decimals)}
              </span>
              <span className="colapso-rot">comentam, por alcance</span>
            </div>
          </div>
          {publico.benchmark !== null && (
            <p className="placa-sub">
              A referência do nicho é{' '}
              {format(publico.benchmark, publico.unit, publico.decimals)} — é essa
              distância que o ciclo quer fechar.
            </p>
          )}
        </section>
      )}

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
          {/* A dip is possible, and this is the screen where she would see it
              first. Saying it here and not only on the plan is the difference
              between "the trade-off was agreed" and "the trade-off was agreed
              somewhere she is not looking". The sentence is short and points at
              the plan; the full text lives there, next to the mix that causes
              it, so the two can never drift apart. */}
          <p className="rodape-nota">
            Estes dois vêm da exportação pública dos seus Reels, não dos Insights.
            Servem para ver esforço e resultado lado a lado.{' '}
            <strong>Se as views baixarem um pouco enquanto o comentário sobe, é o
            combinado</strong> — e o alcance do mês tem guarda. Está escrito em{' '}
            <Link href="/plano">o que isso custa</Link>, no seu plano.
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
