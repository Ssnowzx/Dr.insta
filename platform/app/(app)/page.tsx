import type { Metadata } from 'next'
import Link from 'next/link'
import { DataAge } from '@/components/freshness'
import { Series } from '@/components/series'
import { MetricBar, MetricStat } from '@/components/metric-bar'
import { Funnel } from '@/components/funnel'
import {
  activeCycle, clientProfile, followerGoal, funnel, latestPeriod, metrics,
  monthlySeries, requests
} from '@/lib/dashboard'
import { goalLine } from '@/lib/goal'
import { clientScope, requireSession } from '@/lib/dal'
import { KIND_LABEL, turnOf } from '@/lib/pedido'
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

  const identity = await requireSession()

  const [todas, pedidos, series, etapas, meta] = await Promise.all([
    metrics(clientId, cycle.id, period, profile?.niche ?? 'lifestyle'),
    requests(clientId),
    monthlySeries(clientId, ['views', 'posts_published']),
    funnel(clientId, period),
    followerGoal(clientId, cycle.id)
  ])

  /* The only live number on a page made of closed months, and the reason it is
     here: everything below describes July, and she opens this to find out where
     she is TODAY against the one target she chose herself. Null when the total
     has never been collected — a placeholder at the top of the panel is a line
     she learns to skip. */
  const distancia = goalLine({
    total: meta.total,
    goal: meta.goal,
    deadline: cycle.endsOn,
    today: new Date(),
    lastMonthNet: meta.lastMonthNet
  })

  const cartoes = todas.filter(m => !HANDED_OFF.has(m.key))

  /* The two sides of the thesis plate: how many are reached, and how few of
     them decide to follow. It used to hold Stories replies against comments —
     the thesis of the cycle that closed on 13/08 — and went on saying "este
     ciclo puxa a conversa para o público" four lines under a goal that says
     the opposite. Read from the cards so it follows the cycle instead of
     restating one. */
  const vistas = cartoes.find(m => m.key === 'reach' && m.value !== null)
  const seguiram = cartoes.find(m => m.key === 'followers_net' && m.value !== null)

  /* The north-star metric leaves the grid and gets the full width. Sorting it
     first inside a grid of identical cards made it *first*, not *primary* — and
     a reader scanning nine equal rectangles has no way to tell which one the
     cycle is decided on. */
  /* By the per-cycle flag, not by `metric_def.tier`. The catalogue now holds
     two metrics tiered `north_star` — the followers one this cycle steers by,
     and comments-per-reach, which kept its tier so the closed cycle's screens
     still say what they said. Scanning the tier here would pick whichever the
     query returned first. */
  const norte = cartoes.find(m => m.isNorthStar && m.value !== null) ?? null

  /* A guard-rail is a metric whose target IS its baseline: the cycle asks it not
     to fall, not to rise. Recognised by the numbers rather than by a list, so a
     new floor added to the seed lands in the right group without a code change.
     `piso` is checked before `tier` for the same reason the north star is: the
     tier classifies the catalogue, and whether a metric is a floor is a fact
     about THIS cycle. */
  const ehPiso = (m: typeof cartoes[number]): boolean =>
    m.baseline !== null && m.target !== null && m.target === m.baseline

  const visiveis = cartoes.filter(m => m.value !== null && !m.isNorthStar)

  /* Comments-per-reach fell through every bucket: it keeps `tier: north_star`
     in the catalogue — that is what makes the closed cycle's screens still read
     correctly — while carrying `isNorthStar = 0` here. It matched no filter and
     vanished from the panel, which the cycle's own spec forbids: the diagnosis
     it came from stays visible as a debt. */
  const piso = visiveis.filter(ehPiso)
  const decidem = visiveis.filter(m => !ehPiso(m) && m.tier === 'decision')
  const acompanhar = visiveis.filter(
    m => !ehPiso(m) && m.tier !== 'decision'
  )
  /* Whose turn it is, not merely "not closed". A request she has already
     answered is not something the panel should keep asking her for. */
  const abertos = pedidos.filter(p => turnOf(p.state, p.raisedBySide) === identity.role)

  return (
    <>
      <header className="pagina-cab">
        {/* The deadline, not the start date. "Desde 13 de agosto" tells her
            where the cycle came from; "até 31 de dezembro" is the fact the
            whole cycle is negotiated against, and it was nowhere on screen. */}
        <p className="sobrancelha">
          {cycle.endsOn === null
            ? `Ciclo desde ${longDate(cycle.startsOn)}`
            : `Ciclo até ${longDate(cycle.endsOn)}`} · números de {monthLabel(period)}
        </p>
        <h1 className="display">{cycle.title}</h1>
        {cycle.goal !== null && <p className="lead">{cycle.goal}</p>}
        {distancia !== null && <p className="meta-hoje">{distancia}</p>}
        <DataAge
          period={period}
          syncedAt={conexao?.state === 'active' ? conexao.lastSyncAt : null}
          conectada={conexao?.state === 'active'}
        />
      </header>

      {vistas !== undefined && seguiram !== undefined && (
        <section className="placa">
          <h2 className="placa-sobrancelha">O alcance já é seu</h2>
          <p className="placa-sub">
            Todo mês milhões de contas veem você. Entre ver e seguir tem dois
            degraus: abrir o seu perfil, e decidir seguir depois de abrir. O
            segundo é o que a sua bio, a sua foto e os seus fixados decidem —
            não o post.
          </p>
          {/* The two numbers, and — since 18/08/2026 — the step between them.
              It used to be a hand-built collapse of reach against followers,
              which stated the gap without saying where it opens. The funnel
              lives INSIDE the plate because that is what its colours are for:
              `--sobre-bloco` is #faf4f0, which on the page's own paper is
              invisible. Rendered and measured before shipping, both themes. */}
          {etapas.length > 1
            ? <Funnel stages={etapas} />
            : (
              <div className="colapso">
                <div className="colapso-lado">
                  <span className="numero colapso-n">
                    {format(vistas.value, vistas.unit, vistas.decimals)}
                  </span>
                  <span className="colapso-rot">contas alcançadas no mês</span>
                </div>
                <div className="colapso-meio" aria-hidden="true">
                  <span className="colapso-regua" />
                  <span className="colapso-taxa">quantas decidiram te seguir</span>
                </div>
                <div className="colapso-lado colapso-lado-fim">
                  <span className="numero colapso-n">
                    {format(seguiram.value, seguiram.unit, seguiram.decimals)}
                  </span>
                  <span className="colapso-rot">passaram a te seguir</span>
                </div>
              </div>
              )}
          {seguiram.target !== null && (
            <p className="placa-sub">
              O alvo do ciclo é{' '}
              {format(seguiram.target, seguiram.unit, seguiram.decimals)} por mês.
              A distância não é de alcance — é de quantas dessas pessoas param e
              decidem te acompanhar.
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
                  <span className="lista-meta">{KIND_LABEL[p.kind]}</span>
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

      {/* Its own section, and not folded into the one above. A floor and a
          target look identical on a bar — same shape, same "alvo do ciclo"
          label — and reading "no alvo" on a number the cycle only asks not to
          fall is how a floor gets mistaken for an achievement. */}
      {piso.length > 0 && (
        <section className="secao">
          <div className="secao-cab">
            <h2 className="titulo-secao">O que não pode cair</h2>
            <p className="secao-nota">piso, não alvo</p>
          </div>
          <div className="grade-metricas">
            {piso.map(m => <MetricBar key={m.key} metric={m} />)}
          </div>
          <p className="rodape-nota">
            Estes não são alvo deste ciclo — o alvo é seguidor. Eles estão aqui
            porque crescer às custas deles seria comprar audiência que não
            conversa e não guarda. Se algum começar a cair de verdade, isso muda
            o plano.
          </p>
        </section>
      )}

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
            Servem para ver esforço e resultado lado a lado. Views é o terceiro
            item da sua própria ordem de prioridade — está aqui como contexto, não
            como alvo. O que este ciclo abre mão está escrito em{' '}
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
          Estes não são alvo deste ciclo. Ficam aqui para dar contexto — e para
          a gente perceber na hora se algum começar a cair. Quando um deles tem
          referência de nicho, ela aparece no próprio cartão.
        </p>
      </section>
    </>
  )
}
