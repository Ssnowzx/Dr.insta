import { eq, sql } from 'drizzle-orm'
import { orm } from './client.ts'
import { db, waitForDatabase } from './connection.ts'
import {
  benchmark, client, cycle, delivery, experiment, metricDef, metricTarget,
  metricValue, request, step
} from './schema.ts'
import { ulid } from '../lib/ulid.ts'

/**
 * Initial data, from the real client record.
 *
 * Sources, so no number here is unattributable:
 *   · Instagram Insights, 4 Jul to 3 Aug 2026  -> dados/bianca-olivo-2026-07/
 *   · Store revenue-by-source panel, July 2026 -> same folder
 *   · Cycle, targets and experiments           -> perfil/metas.md
 *   · Niche reference                          -> src/dominio/benchmarks.ts
 *
 * Idempotent: every insert carries ON DUPLICATE KEY UPDATE against a unique
 * key, so running it twice changes nothing. A seed that duplicates on the
 * second run is a seed nobody dares to run.
 *
 * User-facing strings are pt-BR; identifiers and comments are English.
 */

const now = new Date()
const JULY = '2026-07-01'
const CYCLE_START = '2026-08-04'

/* Niche reference, copied from src/dominio/benchmarks.ts (LIFESTYLE.naMedia).
   Stored as ratios, never as pre-formatted percentages. */
const BENCHMARK_SOURCE =
  'Compilado de Hootsuite Social Media Benchmarks 2026, Rival IQ Social Media ' +
  'Industry Benchmark Report e dados publicos de ranqueamento divulgados por ' +
  'Adam Mosseri (Instagram)'
const BENCHMARK_UPDATED = '2026-01-15'

interface DefSeed {
  key: string
  label: string
  short?: string
  unit: 'ratio' | 'count' | 'currency' | 'seconds'
  direction?: 'up' | 'down'
  decimals?: number
  tier?: 'north_star' | 'decision' | 'monitor'
  description?: string
  howToMeasure?: string
}

const DEFS: DefSeed[] = [
  {
    key: 'reach', label: 'Contas alcançadas', short: 'Alcance', unit: 'count',
    tier: 'monitor', decimals: 0,
    description: 'Quantas contas diferentes viram alguma coisa sua no período.',
    howToMeasure: 'Insights > Visão geral > Contas alcançadas'
  },
  {
    key: 'profile_visits', label: 'Visitas ao perfil', unit: 'count',
    tier: 'monitor', decimals: 0,
    description: 'Gente que viu seu conteúdo e foi olhar quem você é. É o degrau antes da loja.',
    howToMeasure: 'Insights > Atividade do perfil'
  },
  {
    key: 'tracked_sessions', label: 'Visitas à loja vindas de você', short: 'Sessões',
    unit: 'count', tier: 'north_star', decimals: 0,
    description: 'A métrica que manda no ciclo: quanta gente sai do Instagram e chega na loja.',
    howToMeasure: 'GA4, origens influencer/bianca-olivo e bianca.olivo'
  },
  {
    key: 'transactions', label: 'Compras', unit: 'count', tier: 'decision', decimals: 0,
    description: 'Pedidos fechados por quem veio de você.',
    howToMeasure: 'Painel de receita por origem'
  },
  {
    key: 'revenue', label: 'Receita do canal', unit: 'currency', tier: 'decision', decimals: 2,
    description: 'Quanto a loja faturou com quem chegou por você.',
    howToMeasure: 'Painel de receita por origem'
  },
  {
    key: 'conversion_rate', label: 'Quantas visitas viram compra', short: 'Conversão',
    unit: 'ratio', tier: 'decision', decimals: 2,
    description: 'De cada 100 pessoas que chegam na loja por você, quantas compram.',
    howToMeasure: 'GA4'
  },
  {
    key: 'saves_reach', label: 'Salvamentos por alcance', short: 'Salvamentos',
    unit: 'ratio', tier: 'decision', decimals: 2,
    description: 'Quem salva um post pretende voltar nele. É o sinal mais próximo de intenção de compra.',
    howToMeasure: 'Insights por post'
  },
  {
    key: 'sends_reach', label: 'Compartilhamentos por alcance', short: 'Compartilhados',
    unit: 'ratio', tier: 'monitor', decimals: 2,
    description: 'Mandar no direct é o que mais faz o Instagram entregar seu conteúdo para gente nova.',
    howToMeasure: 'Insights por post'
  },
  {
    key: 'likes_reach', label: 'Curtidas por alcance', short: 'Curtidas',
    unit: 'ratio', tier: 'monitor', decimals: 2,
    description: 'Sinal mais fraco que salvar e compartilhar, mas serve de termômetro.',
    howToMeasure: 'Insights por post'
  },
  {
    key: 'comments_reach', label: 'Comentários por alcance', short: 'Comentários',
    unit: 'ratio', tier: 'monitor', decimals: 2,
    description: 'Conversa na publicação.',
    howToMeasure: 'Insights por post'
  },
  {
    key: 'product_reel_retention', label: 'Até onde assistem seu Reel de peça',
    short: 'Retenção de peça', unit: 'ratio', tier: 'decision', decimals: 0,
    description: 'Quanto do vídeo as pessoas veem quando o assunto é roupa.',
    howToMeasure: 'Insights por Reel'
  },
  {
    key: 'bio_link_clicks', label: 'Cliques no link da bio', unit: 'count',
    tier: 'decision', decimals: 0,
    description: 'O caminho mais curto entre te ver e chegar na loja.',
    howToMeasure: 'Insights > Atividade do perfil'
  },
  {
    key: 'followers_net', label: 'Seguidores novos', unit: 'count',
    tier: 'monitor', decimals: 0,
    description: 'Crescimento líquido no período. Neste ciclo é contexto, não meta.',
    howToMeasure: 'Insights > Público'
  },
  {
    key: 'reel_shares', label: 'Compartilhamentos em Reels', unit: 'count',
    tier: 'monitor', decimals: 0,
    howToMeasure: 'Insights > Interações por formato'
  },
  {
    key: 'story_replies', label: 'Respostas nos Stories', unit: 'count',
    tier: 'monitor', decimals: 0,
    howToMeasure: 'Insights > Interações por formato'
  },
  /* Derived from the public Reels export, and only ever written with
     `source: 'public'`. A view counts every loop, so it is not distinct people —
     the description says so where she reads it. */
  {
    key: 'views', label: 'Visualizações dos Reels', short: 'Views', unit: 'count',
    tier: 'monitor', decimals: 0,
    description: 'Quantas vezes seus Reels rodaram. Vídeo curto roda de novo sozinho, então isso não é o mesmo que gente diferente.',
    howToMeasure: 'Exportação pública de Reels'
  },
  {
    key: 'posts_published', label: 'Reels publicados', short: 'Publicados', unit: 'count',
    tier: 'monitor', decimals: 0,
    description: 'Quantos Reels saíram no mês. Serve para ver esforço ao lado de resultado.',
    howToMeasure: 'Exportação pública de Reels'
  }
]

interface ValueSeed {
  key: string
  value: string
  source: 'insights' | 'ga4' | 'store' | 'public' | 'manual'
  sample?: number
  note?: string
}

/* July 2026 (4 Jul – 3 Aug). Ratios as ratios: 0.23% is 0.002300. */
const VALUES: ValueSeed[] = [
  { key: 'reach', value: '5413754', source: 'insights' },
  { key: 'profile_visits', value: '347482', source: 'insights' },
  { key: 'followers_net', value: '20824', source: 'insights' },
  { key: 'reel_shares', value: '284000', source: 'insights' },
  { key: 'story_replies', value: '22000', source: 'insights' },
  { key: 'bio_link_clicks', value: '0', source: 'insights', note: 'Não havia link na bio no período.' },

  { key: 'tracked_sessions', value: '7976', source: 'ga4', note: 'Gerado sem link na bio — só sticker manual em Stories.' },
  { key: 'conversion_rate', value: '0.002900', source: 'ga4' },

  /* July had no tagged link in the bio, so the store attributed these orders by
     a rule of its own that is recorded nowhere. The figure is the best one
     available and it is NOT a tracked measurement — a distinction the reader
     cannot make from "23" alone, and the reason the first step of the plan
     exists. */
  {
    key: 'transactions',
    value: '23',
    source: 'store',
    note: 'Em julho não havia link etiquetado. A loja atribuiu estes pedidos por critério próprio, que não está registrado aqui — é o melhor número disponível, não uma medição rastreada. Com a etiqueta no ar, o mês seguinte passa a ser comparável.'
  },
  {
    key: 'revenue',
    value: '10583.280000',
    source: 'store',
    note: 'Mesmo período sem link etiquetado: a atribuição é da loja, por critério não registrado aqui.'
  },
  /* The disagreement the schema exists to preserve: the form said R$ 12.7k and
     the panel said R$ 10,583.28. She confirmed ~10k, so the panel is what
     counts — but deleting the other number would erase the fact that they ever
     disagreed. */
  { key: 'revenue', value: '12700.000000', source: 'manual', note: 'Resposta 12 do formulário. Descartada em 04/08/2026: a cliente confirmou ~R$ 10 mil.' },

  { key: 'saves_reach', value: '0.002300', source: 'insights', sample: 6, note: 'Amostra de 6 Reels em 13 dias — abaixo do mínimo de 7 posts.' },
  { key: 'sends_reach', value: '0.013200', source: 'insights', sample: 6 },
  { key: 'likes_reach', value: '0.077300', source: 'insights', sample: 6 },
  { key: 'comments_reach', value: '0.002100', source: 'insights', sample: 6 },
  { key: 'product_reel_retention', value: '0.080000', source: 'insights', sample: 1, note: 'Um único Reel: o lançamento da coleção, 1min37.' }
]

interface TargetSeed {
  key: string
  baseline: string
  target?: string
  contaminated?: boolean
  note?: string
}

const TARGETS: TargetSeed[] = [
  {
    key: 'tracked_sessions', baseline: '7976', contaminated: true,
    note: 'Gerado sem link na bio. Corrigir a etiqueta do link, rodar 30 dias e só então fixar alvo.'
  },
  {
    key: 'revenue', baseline: '10583.280000', contaminated: true,
    note: 'Mesmo período sem link na bio. Meta sobre um número que já vai mudar de patamar é ficção.'
  },
  {
    key: 'saves_reach', baseline: '0.002300', target: '0.008000',
    note: 'Referência do nicho é 1,40%. O critério do ciclo é 0,8% em 14 dias com no mínimo 7 posts.'
  },
  {
    key: 'conversion_rate', baseline: '0.002900', target: '0.005000',
    note: 'Dobrar a conversão do canal.'
  },
  {
    key: 'product_reel_retention', baseline: '0.080000', target: '0.400000',
    note: 'Referência do nicho é 48%. Abaixo de 22% é crítico.'
  },
  {
    key: 'bio_link_clicks', baseline: '0',
    note: 'Não havia link na bio. O baseline começa quando a etiqueta entrar.'
  }
]

const BENCHMARKS: Array<{ key: string; value: string }> = [
  { key: 'likes_reach', value: '0.080000' },
  { key: 'comments_reach', value: '0.005000' },
  { key: 'saves_reach', value: '0.014000' },
  { key: 'sends_reach', value: '0.016000' },
  { key: 'product_reel_retention', value: '0.480000' }
]

const STEPS = [
  {
    code: 'a1', urgency: 'today' as const, deadlineLabel: 'hoje, se der',
    title: 'Trocar o link da sua bio por um link com etiqueta',
    summary: 'O link que está lá hoje funciona, mas chega na loja sem dizer que veio de você. A etiqueta faz o relatório creditar cada visita à sua conta.',
    evidenceValue: '0', evidenceLabel: 'visitas creditadas a você hoje'
  },
  {
    code: 'a2', urgency: 'this_week' as const, deadlineLabel: 'esta semana',
    title: 'Criar três destaques que respondam "onde comprou?"',
    summary: 'Os destaques são a única parte do perfil que não desaparece. Dá para montar os três só com Story que você já postou.',
    evidenceValue: '347.482', evidenceLabel: 'visitas ao perfil em 30 dias'
  },
  {
    code: 'a3', urgency: 'ongoing' as const, deadlineLabel: 'a partir de já',
    title: 'Uma regra nova pros Stories: peça leva link, pessoal não leva',
    summary: 'Quando você conta o que é a peça, o clique triplica. Quando só marca a loja, não.',
    evidenceValue: '600', evidenceLabel: 'cliques no Story que nomeou o vestido'
  },
  {
    code: 'a4', urgency: 'ongoing' as const, deadlineLabel: 'já deu certo uma vez',
    title: 'Repetir o unboxing no closet, de propósito',
    summary: 'Mesmo produto, mesma semana: o unboxing natural converteu o dobro do Reel de lançamento. Muda o formato, muda tudo.',
    evidenceValue: '0,66%', evidenceLabel: 'de conversão no dia do unboxing'
  },
  {
    code: 'a5', urgency: 'ongoing' as const, deadlineLabel: 'a partir de já',
    title: 'Postar o conteúdo de peça às 18h',
    summary: 'Seu pico é às 18h, e os dias mais movimentados são domingo e segunda. Vale segurar o que envolve peça e link para o fim da tarde.',
    evidenceValue: '18h', evidenceLabel: 'pico de gente sua online'
  }
]

const REQUESTS = [
  {
    title: 'Uma planilha só, com os 203 Reels de uma vez',
    kind: 'data' as const, priority: 'high' as const,
    description: 'No Business Suite, exporte os dados dos Reels do ano inteiro. É um arquivo só, e resolve quase tudo.',
    whyItMatters: 'Sem alcance real eu só consigo ver visualização, e visualização conta looping. Com a planilha eu fecho a análise e a gente para de discutir formato por impressão.'
  },
  {
    title: 'O gráfico de "até onde assistiram" de nove vídeos',
    kind: 'data' as const, priority: 'high' as const,
    description: 'Print do gráfico de retenção de nove Reels que eu listo, incluindo o de lançamento da coleção.',
    whyItMatters: 'É o que mostra em que segundo as pessoas saem. Sem isso, "o vídeo não performou" não tem causa.'
  },
  {
    title: 'O relatório de visitas da loja, dia por dia',
    kind: 'data' as const, priority: 'medium' as const,
    description: 'Exportação diária de sessões e receita por origem, do mesmo período.',
    whyItMatters: 'Permite cruzar o dia do post com o dia da compra, e é assim que se separa coincidência de causa.'
  },
  {
    title: 'Algum desses vídeos foi impulsionado?',
    kind: 'question' as const, priority: 'medium' as const,
    description: 'Só preciso saber quais, se houve.',
    whyItMatters: 'Se teve dinheiro por trás, o alcance não é comparável com o dos outros — e eu estaria elogiando o formato quando a diferença era o impulsionamento.'
  },
  {
    title: 'As datas dos lançamentos e das publis grandes',
    kind: 'data' as const, priority: 'low' as const,
    description: 'Uma lista simples de datas.',
    whyItMatters: 'Picos de alcance nesses dias têm causa conhecida. Sem as datas eu leio pico de campanha como se fosse mérito do formato.'
  }
]

async function main (): Promise<void> {
  await waitForDatabase()
  const o = orm()

  // ---------------------------------------------------------------- client
  await o.insert(client).values({
    publicCode: ulid(),
    slug: 'bianca-olivo',
    name: 'Bianca Olivo',
    brand: 'My Favorite',
    instagramHandle: 'bianca.olivo',
    website: 'https://www.myfavorite.com.br',
    niche: 'lifestyle',
    createdAt: now,
    updatedAt: now
  }).onDuplicateKeyUpdate({ set: { name: 'Bianca Olivo', updatedAt: now } })

  const [c] = await o.select({ id: client.id }).from(client)
    .where(eq(client.slug, 'bianca-olivo')).limit(1)
  const clientId = c?.id
  if (clientId === undefined) throw new Error('Client was not created.')

  // ----------------------------------------------------------------- cycle
  await o.insert(cycle).values({
    publicCode: ulid(),
    clientId,
    title: 'Caminho até a compra',
    goal: 'Transformar quem já te assiste em quem compra. Você vê, ela quer — falta ela conseguir chegar.',
    northStarMetric: 'Visitas à loja vindas das suas origens',
    startsOn: CYCLE_START,
    state: 'active',
    createdAt: now,
    updatedAt: now
  }).onDuplicateKeyUpdate({ set: { updatedAt: now } })

  const [cy] = await o.select({ id: cycle.id }).from(cycle)
    .where(eq(cycle.clientId, clientId)).limit(1)
  const cycleId = cy?.id
  if (cycleId === undefined) throw new Error('Cycle was not created.')

  // ----------------------------------------------------------- metric defs
  for (const d of DEFS) {
    await o.insert(metricDef).values({
      metricKey: d.key,
      label: d.label,
      unit: d.unit,
      direction: d.direction ?? 'up',
      decimals: d.decimals ?? 2,
      tier: d.tier ?? 'monitor',
      ...(d.short === undefined ? {} : { shortLabel: d.short }),
      ...(d.description === undefined ? {} : { description: d.description }),
      ...(d.howToMeasure === undefined ? {} : { howToMeasure: d.howToMeasure })
    }).onDuplicateKeyUpdate({ set: { label: d.label, tier: d.tier ?? 'monitor' } })
  }

  const defRows = await o.select({ id: metricDef.id, key: metricDef.metricKey }).from(metricDef)
  const defId = new Map(defRows.map(r => [r.key, r.id]))
  const requireDef = (key: string): number => {
    const id = defId.get(key)
    if (id === undefined) throw new Error(`Metric definition missing: ${key}`)
    return id
  }

  // --------------------------------------------------------- metric values
  for (const v of VALUES) {
    await o.insert(metricValue).values({
      clientId,
      metricDefId: requireDef(v.key),
      period: JULY,
      granularity: 'month',
      value: v.value,
      source: v.source,
      createdAt: now,
      updatedAt: now,
      ...(v.sample === undefined ? {} : { sampleSize: v.sample }),
      ...(v.note === undefined ? {} : { note: v.note })
      /* `note` travels in the update, not only in the insert. Without it a
         corrected caveat would sit in this file and never reach a database
         that already had the row — the seed would report success and change
         nothing, which is the worst shape a fix can take. */
    }).onDuplicateKeyUpdate({
      set: { value: v.value, note: v.note ?? null, updatedAt: now }
    })
  }

  // -------------------------------------------------------------- targets
  for (const t of TARGETS) {
    await o.insert(metricTarget).values({
      clientId,
      cycleId,
      metricDefId: requireDef(t.key),
      baseline: t.baseline,
      baselineOn: '2026-08-04',
      contaminated: t.contaminated === true ? 1 : 0,
      createdAt: now,
      updatedAt: now,
      ...(t.target === undefined ? {} : { target: t.target }),
      ...(t.note === undefined ? {} : { note: t.note })
    }).onDuplicateKeyUpdate({ set: { baseline: t.baseline, updatedAt: now } })
  }

  // ------------------------------------------------------------ benchmarks
  for (const b of BENCHMARKS) {
    await o.insert(benchmark).values({
      niche: 'lifestyle',
      metricDefId: requireDef(b.key),
      value: b.value,
      source: BENCHMARK_SOURCE,
      updatedOn: BENCHMARK_UPDATED
    }).onDuplicateKeyUpdate({ set: { value: b.value, updatedOn: BENCHMARK_UPDATED } })
  }

  // ----------------------------------------------------------- experiments
  const EXPERIMENTS = [
    {
      name: 'Etiqueta no link da bio',
      hypothesis: 'Sem a etiqueta, a visita que sai da sua bio chega na loja sem dizer que veio de você — e o relatório credita a ninguém.',
      isolated: 'link da bio',
      successLabel: 'Volume mensurável na campanha bio',
      position: 1
    },
    {
      name: 'Mix de pilares',
      hypothesis: 'Conteúdo de utilidade eleva salvamentos, hoje em 0,23%.',
      isolated: 'mix editorial',
      key: 'saves_reach', successValue: '0.008000',
      successLabel: 'salvamentos/alcance ≥ 0,8%',
      minSample: 7, minDays: 14, position: 2
    },
    {
      name: 'Voz única para marca',
      hypothesis: 'O post de produto rende menos em parte porque a sua voz muda quando o assunto é a própria marca.',
      isolated: 'legenda',
      key: 'product_reel_retention', successValue: '0.400000',
      successLabel: 'retenção de Reel de produto ≥ 40%',
      minSample: 7, minDays: 14, position: 3
    },
    {
      name: 'Unboxing natural no closet',
      hypothesis: 'Peça mostrada no seu ambiente converte melhor que apresentação formal.',
      isolated: 'formato do conteúdo de produto',
      key: 'conversion_rate', successValue: '0.005000',
      successLabel: 'conversão do dia ≥ 0,50%',
      minSample: 4, position: 4
    }
  ]

  for (const e of EXPERIMENTS) {
    await o.insert(experiment).values({
      publicCode: ulid(),
      clientId,
      cycleId,
      name: e.name,
      hypothesis: e.hypothesis,
      isolatedVariable: e.isolated,
      successLabel: e.successLabel,
      position: e.position,
      state: 'not_started',
      createdAt: now,
      updatedAt: now,
      ...(e.key === undefined ? {} : { metricDefId: requireDef(e.key) }),
      ...(e.successValue === undefined ? {} : { successValue: e.successValue }),
      ...(e.minSample === undefined ? {} : { minSample: e.minSample }),
      ...(e.minDays === undefined ? {} : { minDays: e.minDays })
          /* Copy corrected in this file has to reach a database that already
         holds the row. Updating only `updatedAt` meant a reworded hypothesis
         sat here and never shipped — the seed reporting success while changing
         nothing, which is the worst shape a fix can take. */
    }).onDuplicateKeyUpdate({
      set: { name: e.name, hypothesis: e.hypothesis, successLabel: e.successLabel, updatedAt: now }
    })
  }

  // ------------------------------------------------------ delivery + steps
  await o.insert(delivery).values({
    publicCode: ulid(),
    clientId,
    cycleId,
    slug: 'cinco-ajustes',
    title: 'Cinco ajustes. Nenhum deles é postar mais.',
    subtitle: 'Seu alcance está ótimo e não é ali que está o problema. Estes cinco ajustes mexem no que acontece depois que a pessoa te assiste.',
    kind: 'plan',
    periodStart: '2026-07-04',
    periodEnd: '2026-08-03',
    readingMinutes: 8,
    position: 1,
    publishedAt: new Date('2026-08-04T12:00:00Z'),
    createdAt: now,
    updatedAt: now
  }).onDuplicateKeyUpdate({ set: { updatedAt: now } })

  const [d] = await o.select({ id: delivery.id }).from(delivery)
    .where(eq(delivery.slug, 'cinco-ajustes')).limit(1)
  const deliveryId = d?.id
  if (deliveryId === undefined) throw new Error('Delivery was not created.')

  for (const [i, s] of STEPS.entries()) {
    await o.insert(step).values({
      deliveryId,
      clientId,
      code: s.code,
      title: s.title,
      summary: s.summary,
      deadlineLabel: s.deadlineLabel,
      urgency: s.urgency,
      evidenceValue: s.evidenceValue,
      evidenceLabel: s.evidenceLabel,
      position: i + 1,
      createdAt: now,
      updatedAt: now
    }).onDuplicateKeyUpdate({ set: { title: s.title, updatedAt: now } })
  }

  // -------------------------------------------------------------- requests
  const existing = await o
    .select({ n: sql<number>`COUNT(*)` })
    .from(request)
    .where(eq(request.clientId, clientId))

  if ((existing[0]?.n ?? 0) === 0) {
    for (const [i, r] of REQUESTS.entries()) {
      await o.insert(request).values({
        publicCode: ulid(),
        clientId,
        cycleId,
        title: r.title,
        description: r.description,
        whyItMatters: r.whyItMatters,
        kind: r.kind,
        priority: r.priority,
        raisedBySide: 'consultant',
        state: 'open',
        position: i + 1,
        createdAt: now,
        updatedAt: now
      })
    }
  }

  console.log(`Seeded client #${clientId}, cycle #${cycleId}, delivery #${deliveryId}.`)
  console.log(`  ${DEFS.length} metric definitions, ${VALUES.length} values, ${TARGETS.length} targets`)
  console.log(`  ${BENCHMARKS.length} benchmarks, ${EXPERIMENTS.length} experiments`)
  console.log(`  ${STEPS.length} steps, ${REQUESTS.length} requests`)
}

main()
  .catch((error: unknown) => {
    const reason = error instanceof Error ? error.message : String(error)
    console.error(`\nSeed failed: ${reason}`)
    process.exitCode = 1
  })
  .finally(() => { void db().end() })
