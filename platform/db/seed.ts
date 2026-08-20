import { and, eq, isNull, notInArray, or, sql } from 'drizzle-orm'
import { orm } from './client.ts'
import { db, waitForDatabase } from './connection.ts'
import {
  benchmark, client, cycle, delivery, deliverySection, experiment, metricDef,
  idea, ideaBeat, metricTarget, metricValue, pillar, request, requestEvent,
  post, requestField, step, user
} from './schema.ts'
import { ulid } from '../lib/ulid.ts'

/**
 * Initial data, from the real client record.
 *
 * Sources, so no number here is unattributable:
 *   · Instagram Insights, 4 Jul to 3 Aug 2026  -> dados/bianca-olivo-2026-07/
 *   · Store revenue-by-source panel, July 2026 -> same folder
 *   · Cycles, targets and experiments          -> perfil/metas.md
 *   · Editorial mix                            -> perfil/pilares.md
 *   · Niche reference                          -> src/dominio/benchmarks.ts
 *
 * Three cycles live here since 13 Aug 2026. "Caminho até a compra" and
 * "O perfil que conversa" are CLOSED — the first when the store side went to
 * the brand's own team (12/08), the second a day later when the client ranked
 * followers first and set 1M by December. Their pillars, targets and
 * experiments stay frozen under them, which is what lets "did the bet pay
 * off?" keep an object. "Quem te vê, te segue" is the active cycle.
 *
 * Idempotent: every insert carries ON DUPLICATE KEY UPDATE against a unique
 * key, so running it twice changes nothing. A seed that duplicates on the
 * second run is a seed nobody dares to run. The rule for the update sets:
 * whatever the seed AUTHORS, the seed OVERWRITES. Ids, public codes and
 * anything a person produced in the app stay out.
 *
 * User-facing strings are pt-BR; identifiers and comments are English.
 */

const now = new Date()
const JULY = '2026-07-01'
const CYCLE_START = '2026-08-04'
const CYCLE2_START = '2026-08-12'
const CYCLE3_START = '2026-08-13'
const BASELINE_ON = '2026-08-04'

/* Three cycles, and the third one closes the second after a single day.
   That is not a bug in the data: the client redirected the work on 12/08 and
   again on 13/08, and both times the previous cycle ended before its first
   reading. The rows keep that visible — a fourth one closing the same way is
   the signal that the problem stopped being the strategy. */
const OLD_CYCLE_TITLE = 'Caminho até a compra'
const NEW_CYCLE_TITLE = 'O perfil que conversa'
const THIRD_CYCLE_TITLE = 'Quem te vê, te segue'

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
    description: 'Quantas contas diferentes viram alguma coisa sua no período. Já está em nível alto — a regra do ciclo é não deixar cair, não fazer subir.',
    howToMeasure: 'Insights > Visão geral > Contas alcançadas'
  },
  {
    key: 'profile_visits', label: 'Visitas ao perfil', unit: 'count',
    tier: 'monitor', decimals: 0,
    description: 'Gente que viu seu conteúdo e foi olhar quem você é.',
    howToMeasure: 'Insights > Atividade do perfil'
  },
  /* The store-side definitions stay: the values are history and history is
     data. What changed on 12 Aug 2026 is ownership — the profile→store path is
     the brand team's job now — so none of them is a cycle metric anymore, and
     the description says where each one went. */
  {
    key: 'tracked_sessions', label: 'Visitas à loja vindas de você', short: 'Sessões',
    unit: 'count', tier: 'monitor', decimals: 0,
    description: 'Era a métrica do ciclo de conversão. Desde 12/08/2026 a ponte com a loja é da equipe da My Favorite — fica aqui como histórico.',
    howToMeasure: 'GA4, origens influencer/bianca-olivo e bianca.olivo'
  },
  {
    key: 'transactions', label: 'Compras', unit: 'count', tier: 'monitor', decimals: 0,
    description: 'Pedidos fechados por quem veio de você. Assunto da equipe da My Favorite desde 12/08/2026.',
    howToMeasure: 'Painel de receita por origem'
  },
  {
    key: 'revenue', label: 'Receita do canal', unit: 'currency', tier: 'monitor', decimals: 2,
    description: 'Quanto a loja faturou com quem chegou por você. Assunto da equipe da My Favorite desde 12/08/2026.',
    howToMeasure: 'Painel de receita por origem'
  },
  {
    key: 'conversion_rate', label: 'Quantas visitas viram compra', short: 'Conversão',
    unit: 'ratio', tier: 'monitor', decimals: 2,
    description: 'De cada 100 pessoas que chegam na loja por você, quantas compram. Assunto da equipe da My Favorite desde 12/08/2026.',
    howToMeasure: 'GA4'
  },
  {
    key: 'saves_reach', label: 'Salvamentos por alcance', short: 'Salvamentos',
    unit: 'ratio', tier: 'decision', decimals: 2,
    description: 'Quem salva pretende voltar no post. É o sinal de que o conteúdo tem valor de uso, não só de riso.',
    howToMeasure: 'Insights por post'
  },
  {
    key: 'sends_reach', label: 'Compartilhamentos por alcance', short: 'Compartilhados',
    unit: 'ratio', tier: 'decision', decimals: 2,
    description: 'Mandar no direct é o que mais faz o Instagram entregar seu conteúdo para gente nova. É o controle do ciclo: não pode cair.',
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
    unit: 'ratio', tier: 'north_star', decimals: 2,
    description: 'A métrica que manda no ciclo: de cada mil contas que você alcança, quantas comentam. Conversa em público, não aplauso.',
    howToMeasure: 'Insights por post'
  },
  {
    key: 'product_reel_retention', label: 'Até onde assistem seu Reel de peça',
    short: 'Retenção de peça', unit: 'ratio', tier: 'monitor', decimals: 0,
    description: 'Quanto do vídeo as pessoas veem quando o assunto é roupa. O achado vai no material da equipe da My Favorite.',
    howToMeasure: 'Insights por Reel'
  },
  {
    key: 'bio_link_clicks', label: 'Cliques no link da bio', unit: 'count',
    tier: 'monitor', decimals: 0,
    description: 'O caminho entre te ver e chegar na loja. Assunto da equipe da My Favorite desde 12/08/2026.',
    howToMeasure: 'Insights > Atividade do perfil'
  },
  {
    key: 'followers_net', label: 'Seguidores novos', unit: 'count',
    tier: 'north_star', decimals: 0,
    description: 'Quantas pessoas passaram a te seguir no mês, já descontando quem deixou. É o número que decide este ciclo.',
    howToMeasure: 'Insights > Público'
  },
  {
    key: 'follows_reach', label: 'Seguidores por alcance', short: 'Viram e seguiram',
    unit: 'ratio', tier: 'decision', decimals: 3,
    description: 'De cada mil pessoas que veem um post seu, quantas passam a te seguir. É a conversão que este ciclo trabalha.',
    howToMeasure: 'Insights por post: Seguimentos ÷ Alcance'
  },
  {
    key: 'profile_visits_reach', label: 'Abriram seu perfil, por alcance',
    short: 'Foram ao perfil', unit: 'ratio', tier: 'decision', decimals: 2,
    description: 'De cada cem pessoas alcançadas, quantas abrem o seu perfil. É o passo entre te ver e decidir te seguir.',
    howToMeasure: 'Insights > Visão geral: visitas ao perfil ÷ contas alcançadas'
  },
  /* The second gap of the funnel, added 18/08/2026.
     Deliberately without a target. Closing the cycle's arithmetic needs 3x, and
     3x can come from this rate, from the number of visits, or from both — a
     target on this one alone would claim a decision nobody has made. Baseline
     before target. */
  {
    key: 'follows_per_visit', label: 'Abriram o perfil e seguiram',
    short: 'Abriram e seguiram', unit: 'ratio', tier: 'decision', decimals: 1,
    description: 'De cada cem pessoas que abrem o seu perfil, quantas passam a te seguir. É o que a sua bio, a sua foto e os seus fixados decidem — não o post.',
    howToMeasure: 'Seguidores no mês ÷ visitas ao perfil no mês'
  },
  /* Deliberately without a target until the Público tab is collected. The
     split between followers and strangers was INFERRED from traffic sources on
     eight Reels — an indication, not a measurement, and a target on top of an
     indication is fiction. */
  {
    key: 'nonfollower_reach_share', label: 'Quanto do seu alcance é gente nova',
    short: 'Alcance novo', unit: 'ratio', tier: 'decision', decimals: 1,
    description: 'Quem já te segue não pode te seguir de novo. Esta é a fatia do seu alcance que ainda pode virar seguidor.',
    howToMeasure: 'Insights por Reel > aba Público'
  },
  {
    key: 'follows_per_nonfollower_reach', label: 'Seguidores por alcance de gente nova',
    short: 'Conversão real', unit: 'ratio', tier: 'decision', decimals: 2,
    description: 'A taxa que realmente decide: entre as pessoas novas que te viram, quantas seguiram.',
    howToMeasure: 'Seguimentos ÷ alcance de não-seguidores'
  },
  {
    key: 'reel_shares', label: 'Compartilhamentos em Reels', unit: 'count',
    tier: 'monitor', decimals: 0,
    howToMeasure: 'Insights > Interações por formato'
  },
  {
    key: 'story_replies', label: 'Respostas nos Stories', unit: 'count',
    tier: 'monitor', decimals: 0,
    description: 'A prova de que a conversa existe — no privado. O ciclo quer levar essa conversa para onde todo mundo vê.',
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
  /* Recomputed on read by `derivarTaxas`; stored so the card exists at all. */
  { key: 'follows_per_visit', value: '0.059928', source: 'insights' },
  { key: 'reel_shares', value: '284000', source: 'insights' },
  { key: 'story_replies', value: '22000', source: 'insights' },
  { key: 'bio_link_clicks', value: '0', source: 'insights', note: 'Não havia link na bio no período.' },

  { key: 'tracked_sessions', value: '7976', source: 'ga4', note: 'Gerado sem link na bio — só sticker manual em Stories.' },
  { key: 'conversion_rate', value: '0.002900', source: 'ga4' },

  /* July had no tagged link in the bio, so the store attributed these orders by
     a rule of its own that is recorded nowhere. The figure is the best one
     available and it is NOT a tracked measurement — a distinction the reader
     cannot make from "23" alone. */
  {
    key: 'transactions',
    value: '23',
    source: 'store',
    note: 'Em julho não havia link etiquetado. A loja atribuiu estes pedidos por critério próprio, que não está registrado aqui — é o melhor número disponível, não uma medição rastreada.'
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
  { key: 'comments_reach', value: '0.002100', source: 'insights', sample: 6, note: 'Amostra de 6 Reels em 13 dias — abaixo do mínimo de 7 posts. A primeira leitura com a conta conectada substitui.' },
  { key: 'product_reel_retention', value: '0.080000', source: 'insights', sample: 1, note: 'Um único Reel: o lançamento da coleção, 1min37.' },

  /* Derived from the two figures above, not collected separately: 347.482 ÷
     5.413.754 and 6.987 ÷ 11.730.218. The note says so, because a reader has no
     way to tell a derived ratio from a measured one, and the sample behind the
     second is post-level reach, which double-counts a person seen twice. */
  {
    key: 'profile_visits_reach', value: '0.064200', source: 'insights',
    note: 'Derivado: 347.482 visitas ÷ 5.413.754 contas alcançadas em julho.'
  },
  {
    key: 'follows_reach', value: '0.000600', source: 'insights', sample: 58,
    note: 'Derivado dos 58 posts de julho: 6.987 seguimentos ÷ 11.730.218 de alcance somado por post. O alcance somado conta duas vezes quem viu dois posts.'
  }
]

interface TargetSeed {
  key: string
  /** Absent when there is no measurement yet. Meta sem baseline é ficção. */
  baseline?: string
  target?: string
  contaminated?: boolean
  /** Exactly one per cycle — enforced by a unique index, not by care here. */
  northStar?: boolean
  note?: string
}

/* Frozen with the closed cycle. Re-seeding must leave the closed cycle reading
   exactly as it read on the day it closed — these literals are that reading. */
const OLD_TARGETS: TargetSeed[] = [
  {
    key: 'tracked_sessions', baseline: '7976', contaminated: true, northStar: true,
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

/* The cycle in force. Followers decide; the two conversion rates are how the
   work is steered; conversation and distribution are floors, not targets. */
const THIRD_TARGETS: TargetSeed[] = [
  /* Dated at the start of the cycle, so the sentence stays true as the days
     burn down. It used to say "Faltam 286.162... em 140 dias" in the present
     tense — a count that was 4 days stale by the first deploy and aged daily. */
  {
    key: 'followers_net', baseline: '20824', target: '62200', northStar: true,
    note: 'Na largada do ciclo (13/08) faltavam 286.162 para 1M até 31/12 — 62.200 por mês, três vezes o ritmo de então. Conversão sozinha não fecha essa conta: é conversão mais um evento de escala por mês.'
  },
  {
    key: 'follows_reach', baseline: '0.000600', target: '0.002000',
    note: 'De 0,060% para 0,20%. Os posts explicam só um terço do crescimento; o resto vem de busca, sugestão e perfil.'
  },
  {
    key: 'profile_visits_reach', baseline: '0.064200', target: '0.090000',
    note: 'De 6,42% para 9%. Vale para os dois terços do crescimento que não vêm de post.'
  },
  {
    /* Same 9% as the experiment "Perfil como página de decisão", and from it —
       not a number invented here. Baseline measured two ways in July and they agreed: 20.824 net
       followers over 347.482 profile visits is 5,99%, and the seven feed posts
       collected on 18/08 gave 5,86% from their own follows. */
    key: 'follows_per_visit', baseline: '0.059928', target: '0.090000',
    note: 'Hoje 6 em cada 100 que abrem seu perfil passam a te seguir. O alvo é 9 — e quem decide isso é a bio, a foto e os fixados, não o post.'
  },
  /* No baseline and no target, on purpose. The follower/stranger split was
     inferred from traffic sources on eight Reels — collecting the Público tab
     is the first step of this cycle, and a target before it would be fiction. */
  {
    key: 'nonfollower_reach_share',
    note: 'Sem medição ainda. Indício de 8 Reels: cerca de 1% nos vídeos longos e 80% nos curtos. A aba Público dá o número exato — é o primeiro pedido do ciclo.'
  },
  {
    key: 'follows_per_nonfollower_reach',
    note: 'Só existe depois do número acima. É a taxa que realmente decide, e ela ainda não foi medida.'
  },
  /* This is the ONE targetNote that renders (contaminated → metric-bar shows
     it). It used to assert "o diagnóstico de 12/08 continua verdadeiro" in the
     present tense — a claim the API now remeasures monthly and can contradict.
     Dated measurement instead: true forever, however the number moves. */
  {
    key: 'comments_reach', baseline: '0.002100', target: '0.002100', contaminated: true,
    note: 'Guard-rail, não alvo — medido em 12/08 em 0,21% contra 0,50% do nicho, e rebaixado de alvo por decisão da cliente. O piso é o próprio ponto de partida: se cair, o ciclo está comprando audiência que não conversa.'
  },
  {
    key: 'saves_reach', baseline: '0.002300', target: '0.002300', contaminated: true,
    note: 'Guard-rail. Piso no que já existe.'
  },
  {
    key: 'sends_reach', baseline: '0.013200', target: '0.013200',
    note: 'Guard-rail de distribuição. É o que sustenta o alcance, e o alcance é o topo de tudo neste ciclo.'
  },
  {
    key: 'reach', baseline: '5413754', target: '5413754',
    note: 'Guard-rail. Queda acima de 25% por três semanas abre revisão do mix antes de qualquer decisão de pauta.'
  }
]

const NEW_TARGETS: TargetSeed[] = [
  {
    key: 'comments_reach', baseline: '0.002100', target: '0.005000', northStar: true,
    note: 'Referência do nicho é 0,50%. A fase 1 quer 0,35% em 14 dias com no mínimo 7 posts. O ponto de partida vem de 6 Reels — a primeira leitura com a conta conectada substitui.'
  },
  {
    key: 'saves_reach', baseline: '0.002300', target: '0.008000',
    note: 'Referência do nicho é 1,40%. O critério do ciclo é 0,8% em 14 dias com no mínimo 7 posts.'
  },
  {
    key: 'sends_reach', baseline: '0.013200',
    note: 'Controle: não é para subir, é para não cair enquanto o mix muda. Se cair, a realocação foi longe demais.'
  },
  {
    key: 'reach', baseline: '5413754',
    note: 'Guard-rail: queda acima de 25% sustentada por três semanas vira assunto do ciclo. Fora isso, reportar, não otimizar.'
  },
  {
    key: 'story_replies', baseline: '22000',
    note: 'A conversa que já existe, no privado. Não pode cair enquanto a gente puxa a conversa para o público.'
  }
]

const BENCHMARKS: Array<{ key: string; value: string }> = [
  { key: 'likes_reach', value: '0.080000' },
  { key: 'comments_reach', value: '0.005000' },
  { key: 'saves_reach', value: '0.014000' },
  { key: 'sends_reach', value: '0.016000' },
  { key: 'product_reel_retention', value: '0.480000' }
]

/* The tagged bio link the CLOSED cycle handed her. It stays because the closed
   plan must keep reading as it read — and because it is the string the brand
   team will want in the handoff. */
const LINK_BIO =
  'https://www.myfavorite.com.br/?utm_source=influencer' +
  '&utm_medium=bianca.olivo&utm_campaign=bio'

interface StepSeed {
  code: string
  urgency: 'today' | 'this_week' | 'ongoing'
  deadlineLabel: string
  title: string
  summary: string
  evidenceValue: string
  evidenceLabel: string
  copyValue?: string
  copyLabel?: string
  copyNote?: string
  /**
   * The request this chore IS, by title.
   *
   * By title and not by id because requests are seeded AFTER the deliveries in
   * this file, and reordering them to get an id here would make the seed's own
   * sequence load-bearing. A pass at the end resolves it — see `LINK_STEPS`.
   *
   * A step that carries this stops being asked for the moment she answers the
   * request, which was the whole complaint: `c1` and "A aba Público de cinco
   * Reels" are one job that lived on two screens with nothing joining them.
   */
  requestTitle?: string
  /** A fact the platform observes. See `lib/verificacao.ts`. */
  verifyKey?: string
}

/* The closed cycle's plan, frozen as delivered on 4 Aug 2026. */
const OLD_STEPS: StepSeed[] = [
  {
    code: 'a1', urgency: 'today', deadlineLabel: 'hoje, se der',
    title: 'Trocar o link da sua bio por um link com etiqueta',
    summary: 'O link que está lá hoje funciona, mas chega na loja sem dizer que veio de você. A etiqueta faz o relatório creditar cada visita à sua conta.',
    evidenceValue: '0', evidenceLabel: 'visitas creditadas a você hoje',
    copyValue: LINK_BIO,
    copyLabel: 'Cole exatamente isto no link da sua bio',
    copyNote:
      'Parece comprido, mas ninguém vê. No seu perfil o Instagram mostra só ' +
      '"myfavorite.com.br" — conferi hoje. O endereço inteiro aparece só para ' +
      'você, na tela de edição, e o pedaço depois da interrogação é justamente ' +
      'o que faz o relatório saber que a visita veio de você.\n\n' +
      'Dá para deixar curto de verdade, tipo "myfavorite.com.br/bia", mas isso ' +
      'depende de um ajuste na loja. Não mexe nisso por enquanto: um link curto ' +
      'antes do ajuste dá erro no seu perfil. Quando estiver pronto, eu troco ' +
      'aqui e te aviso.'
  },
  {
    code: 'a2', urgency: 'this_week', deadlineLabel: 'esta semana',
    title: 'Criar três destaques que respondam "onde comprou?"',
    summary: 'Os destaques são a única parte do perfil que não desaparece. Dá para montar os três só com Story que você já postou.',
    evidenceValue: '347.482', evidenceLabel: 'visitas ao perfil em 30 dias'
  },
  {
    code: 'a3', urgency: 'ongoing', deadlineLabel: 'a partir de já',
    title: 'Uma regra nova pros Stories: peça leva link, pessoal não leva',
    summary: 'Quando você conta o que é a peça, o clique triplica. Quando só marca a loja, não.',
    evidenceValue: '600', evidenceLabel: 'cliques no Story que nomeou o vestido'
  },
  {
    code: 'a4', urgency: 'ongoing', deadlineLabel: 'já deu certo uma vez',
    title: 'Repetir o unboxing no closet, de propósito',
    summary: 'Mesmo produto, mesma semana: o unboxing natural converteu o dobro do Reel de lançamento. Muda o formato, muda tudo.',
    evidenceValue: '0,66%', evidenceLabel: 'de conversão no dia do unboxing'
  },
  {
    code: 'a5', urgency: 'ongoing', deadlineLabel: 'a partir de já',
    title: 'Postar o conteúdo de peça às 18h',
    summary: 'Seu pico é às 18h, e os dias mais movimentados são domingo e segunda. Vale segurar o que envolve peça e link para o fim da tarde.',
    evidenceValue: '18h', evidenceLabel: 'pico de gente sua online'
  }
]

/* The active cycle's plan. None of it asks her to serve the brand. */
const NEW_STEPS: StepSeed[] = [
  {
    code: 'b1', urgency: 'today', deadlineLabel: 'hoje, se der',
    title: 'Conectar seu Instagram na aba Conta',
    summary: 'Dois toques, só leitura — você autoriza e desconecta quando quiser, na mesma tela. Sem isso eu não enxergo comentário e salvamento por post, e este ciclo é decidido nesses dois números.',
    evidenceValue: '0', evidenceLabel: 'dos seus 205 Reels têm alcance medido hoje',
    /* She did this on 14/08 and the plan had no way of knowing. The delivery is
       archived, so it does not render today — the verifier is here because a
       plan that is restored, reopened or re-read must not ask again for
       something the platform can see happened. */
    verifyKey: 'instagram_connected'
  },
  {
    code: 'b2', urgency: 'today', deadlineLabel: 'hoje, se der',
    title: 'Responder as cinco perguntas que estão em Pedidos',
    summary: 'O ciclo foi desenhado com o que os números dizem. As suas respostas ajustam o desenho — principalmente a primeira, que decide qual número manda.',
    evidenceValue: '5', evidenceLabel: 'perguntas — nenhuma pede arquivo, é só escrever'
  },
  {
    code: 'b3', urgency: 'ongoing', deadlineLabel: 'a partir de já',
    title: 'Terminar o post em pergunta quando a pauta pedir',
    summary: 'Na sua voz, curta — "vocês também?". Post que termina em pergunta abre espaço para resposta, e comentário em público é o número que este ciclo persegue.',
    evidenceValue: '3,0', evidenceLabel: 'comentários por mil views no Reel do DOJI — o triplo do seu normal'
  },
  {
    code: 'b4', urgency: 'ongoing', deadlineLabel: 'a partir de já',
    title: 'Responder comentário na primeira hora dos posts novos',
    summary: 'Você e a assessora já fazem isso no direct todo dia. É a mesma rotina, só que nos comentários — resposta puxa a segunda rodada de conversa.',
    evidenceValue: '22 mil', evidenceLabel: 'respostas nos seus Stories em um mês: a conversa já existe, só que no privado'
  },
  {
    code: 'b5', urgency: 'this_week', deadlineLabel: 'esta semana',
    title: 'Caixinha com nome fixo, todo domingo às 18h',
    summary: 'Mesmo dia, mesma hora, mesmo nome — ritual cria hábito de resposta; caixinha avulsa é evento. Domingo às 18h é o seu pico medido de gente online.',
    evidenceValue: '18h', evidenceLabel: 'domingo — o pico da sua audiência'
  }
]

interface PillarSeed {
  key: string
  name: string
  share: number
  perWeek: string
  control: boolean
  thesis: string
  role: string
  evidence: string
  metricKey: string
  success: string
}

/* The closed cycle's mix, frozen as it was bet. */
const OLD_PILLARS: PillarSeed[] = [
  {
    key: 'espelho', name: 'Espelho', share: 50, perWeek: '4 por semana',
    control: true,
    thesis: 'Cenas de cotidiano, casal, família e humor em que a pessoa se reconhece ou reconhece alguém. É o que você já faz e é o que te distribui.',
    role: 'Motor de distribuição. É o que traz quem ainda não te segue. Este não se mexe.',
    evidence: '"diálogos de todo casal" (11/07, 13s): 1,44M de views, 48 mil compartilhamentos, 5,38% de sends por alcance — mais de 3× a média do nicho.',
    metricKey: 'sends_reach',
    success: 'Não piorar. Se este cair, a realocação foi longe demais.'
  },
  {
    key: 'provador', name: 'Provador', share: 25, perWeek: '2 por semana',
    control: false,
    thesis: 'Depois de ver, a pessoa sabe como aquela peça se comporta na vida real: veste como, combina com quê, aguenta o dia e a noite.',
    role: 'Conserta o salvamento. Leva para o permanente o que já converte no Story e some em 24h.',
    evidence: 'Seus Stories que mais puxam clique são exatamente peça nomeada com contexto: "o vestido que escolhi" (600 cliques), "esse body é em malha pesada" (487).',
    metricKey: 'saves_reach',
    success: 'Salvamentos por alcance sair de 0,23% para 0,8% em 14 dias, com no mínimo 7 posts.'
  },
  {
    key: 'padrao', name: 'Padrão', share: 15, perWeek: '1 a 2 por semana',
    control: false,
    thesis: 'A My Favorite usada lado a lado com marcas internacionais, como escolha de estilo — não como comparação de preço.',
    role: 'Único pilar que ataca status: "compartilhar isso me posiciona". É a sua tese de posicionamento, e hoje ninguém no perfil está executando ela.',
    evidence: 'Suas palavras: "se eu faço k pro e miu miu, a my tá no mesmo parâmetro".',
    metricKey: 'sends_reach',
    success: 'Sends por alcance ≥ 1,6% sem a retenção cair abaixo de 40%.'
  },
  {
    key: 'bastidor', name: 'Bastidor', share: 10, perWeek: '1 a cada 2 semanas',
    control: false,
    thesis: 'O trabalho de diretora criativa: como a peça nasce, por que essa cor, o que foi cortado e por quê.',
    role: 'Sustenta o lado fundadora sem soar comercial. Bastidor sem tensão vira diário — precisa ter decisão, erro ou custo.',
    evidence: 'Você mesma disse que trazer bastidor te coloca "em outro patamar de autoridade" e te diferencia de outras influenciadoras de moda.',
    metricKey: 'comments_reach',
    success: 'Comentário com substância, não emoji solto.'
  }
]

/* The mix in force. Same volume as before — she publishes about 8 Reels a week
   and this asks for none more. What moves is which of them carry her opinion. */
const THIRD_PILLARS: PillarSeed[] = [
  {
    key: 'espelho', name: 'Espelho', share: 45, perWeek: '3 a 4 por semana',
    control: true,
    thesis: 'Cotidiano, casal, família e humor em que a pessoa se reconhece. Curto, do jeito que você já faz.',
    role: 'É o que alcança quem ainda não te segue: 80% das visualizações dos seus curtos vêm de gente que não te acompanha. Este pilar não se mexe — ele é o topo de tudo.',
    evidence: 'De fevereiro a agosto, os vídeos de até 10 segundos somaram 33 milhões de alcance: 39% de tudo que você alcançou.',
    metricKey: 'sends_reach',
    success: 'Não piorar. Se compartilhamento por alcance cair, a realocação foi longe demais.'
  },
  {
    key: 'opiniao', name: 'Opinião', share: 30, perWeek: '2 a 3 por semana',
    control: false,
    thesis: 'Você falando o que acha — perfume, make, tendência, o que usar em cada ocasião. Longo, sem pressa, do jeito que você já faz nos Stories.',
    role: 'É o único formato que faz estranho decidir te seguir. É o centro deste ciclo.',
    evidence: '"Meus top 5 perfumes favoritos" (21/05, 99s): 305 mil alcançados e 3.131 seguidores novos — 41× a série sobre a coleção, que tem quase a mesma duração. E foi você quem escreveu que essas pautas sempre performam bem.',
    metricKey: 'follows_reach',
    success: 'Seguidores por alcance sair de 0,060% para 0,30% neste pilar, com no mínimo 7 posts.'
  },
  {
    key: 'guardar', name: 'Vale guardar', share: 15, perWeek: '1 por semana',
    control: false,
    thesis: 'Depois de ver, a pessoa tem algo para usar depois — e salva. Qualquer marca, qualquer assunto do seu universo.',
    role: 'Salvamento é o outro sinal abaixo do nicho, e quem salva costuma voltar. Aqui é guard-rail, não alvo.',
    evidence: 'Você já começou sozinha: "produtos baratos que valem a pena" (05/08) é exatamente isso.',
    metricKey: 'saves_reach',
    success: 'Salvamentos por alcance não cair de 0,23%.'
  },
  {
    key: 'personagens', name: 'Personagens', share: 10, perWeek: '1 por semana',
    control: false,
    /* Rewritten 18/08/2026. It described "mozão, o time da My, sucessão
       familiar" — my inference from something she said — while the quadro that
       actually converts is one she had already invented and published. The
       pillar now names the thing that has a number under it, and the family
       scripts stay in the bank. */
    thesis: '"kinda chic" — frases suas sobre fotos suas, mesmo nome, todo domingo.',
    role: 'Dá motivo para voltar, e quem volta segue. Você já inventou o quadro; o que muda é ele ter dia fixo.',
    evidence: 'O "kinda chic" de 10/08 alcançou 459 mil e trouxe 212 seguidores — os seus outros seis carrosséis do mês trouxeram 8 na média. Foi também o mais compartilhado e o mais salvo do mês.',
    metricKey: 'follows_reach',
    success: 'Quadro saindo todo domingo, e cada edição trazendo mais seguidor que a mediana dos seus carrosséis.'
  }
]

/* The active mix. Percentages, roles and criteria come from perfil/pilares.md. */
const NEW_PILLARS: PillarSeed[] = [
  {
    key: 'espelho', name: 'Espelho', share: 50, perWeek: '4 por semana',
    control: true,
    thesis: 'Cenas de cotidiano, casal, família e humor em que a pessoa se reconhece ou reconhece alguém. É o que você já faz e é o que te distribui.',
    role: 'Motor de distribuição. É o que traz quem ainda não te segue e o que sustenta o alcance. Este não se mexe.',
    evidence: '"diálogos de todo casal" (11/07, 13s): 1,44M de views, 48 mil compartilhamentos, 5,38% de sends por alcance — mais de 3× a média do nicho.',
    metricKey: 'sends_reach',
    success: 'Não piorar. Se este cair, a realocação foi longe demais.'
  },
  {
    key: 'conversa', name: 'Conversa', share: 20, perWeek: '1 a 2 por semana',
    control: false,
    thesis: 'O mesmo cotidiano do Espelho, mas com opinião ou pergunta embutida — o post não termina na piada, termina em espaço para a pessoa responder.',
    role: 'Converte reconhecimento em comentário. É o pilar da métrica que manda no ciclo.',
    evidence: 'Medido em 12/08: o Reel do DOJI fez 2,5 comentários por mil views e o do cometa Harley (09/08) fez 2,3 — contra 0,94 da sua mediana histórica. Os dois alcançaram menos que a média e conversaram mais que o dobro: conversa não precisa viralizar para funcionar.',
    metricKey: 'comments_reach',
    success: 'Comentários por alcance sair de 0,21% para 0,35% em 14 dias; 0,50% no ciclo.'
  },
  {
    key: 'vale-guardar', name: 'Vale guardar', share: 20, perWeek: '1 a 2 por semana',
    control: false,
    thesis: 'Depois de ver, a pessoa tem algo para usar depois — e salva. Qualquer marca, qualquer assunto do seu universo: moda, beleza, casa, viagem.',
    role: 'Conserta o salvamento, o outro sinal do perfil abaixo do nicho. Aqui não existe obrigação de citar a My Favorite.',
    evidence: 'Você já começou sozinha: "produtos baratos que valem a pena" (05/08) é exatamente isso. E peça nomeada com contexto sempre puxou ação — 487 cliques no body de malha pesada.',
    metricKey: 'saves_reach',
    success: 'Salvamentos por alcance sair de 0,23% para 0,8% em 14 dias, com no mínimo 7 posts.'
  },
  {
    key: 'personagens', name: 'Personagens', share: 10, perWeek: '1 por semana',
    control: false,
    thesis: 'José, Pipo, Velma, renata dramática — em quadro nomeado, mesmo formato, ritmo de série.',
    role: 'Cria retorno: a mesma pessoa voltando para o próximo episódio. Série sem regularidade é evento, e evento não cria hábito.',
    evidence: 'Você nomeia personagens como se todos já conhecessem — e a audiência conhece. O pedido nº 3 do seu direct é literalmente "quero acompanhar o teu dia".',
    metricKey: 'story_replies',
    success: 'Quadro saindo toda semana, com as respostas de Stories seguras (hoje 22 mil/mês).'
  }
]

interface ExperimentSeed {
  name: string
  hypothesis: string
  isolated: string
  key?: string
  successValue?: string
  successLabel: string
  minSample?: number
  minDays?: number
  position: number
  state: 'not_started' | 'running' | 'read' | 'inconclusive' | 'abandoned'
  outcome?: string
}

const OLD_OUTCOME =
  'Não chegou a rodar: em 12/08/2026 a cliente redirecionou o trabalho para o perfil ' +
  'pessoal e a ponte com a loja passou para a equipe da My Favorite. O diagnóstico que ' +
  'motivou o experimento segue válido e vai no material de handoff.'

const OLD_EXPERIMENTS: ExperimentSeed[] = [
  {
    name: 'Etiqueta no link da bio',
    hypothesis: 'Sem a etiqueta, a visita que sai da sua bio chega na loja sem dizer que veio de você — e o relatório credita a ninguém.',
    isolated: 'link da bio',
    successLabel: 'Volume mensurável na campanha bio',
    position: 1, state: 'abandoned', outcome: OLD_OUTCOME
  },
  {
    name: 'Mix de pilares',
    hypothesis: 'Conteúdo de utilidade eleva salvamentos, hoje em 0,23%.',
    isolated: 'mix editorial',
    key: 'saves_reach', successValue: '0.008000',
    successLabel: 'salvamentos/alcance ≥ 0,8%',
    minSample: 7, minDays: 14, position: 2,
    state: 'abandoned',
    outcome: 'Não chegou a rodar como desenhado aqui. A aposta em salvamento continua — reformulada no ciclo seguinte como pilar Vale guardar, sem obrigação de marca.'
  },
  {
    name: 'Voz única para marca',
    hypothesis: 'O post de produto rende menos em parte porque a sua voz muda quando o assunto é a própria marca.',
    isolated: 'legenda',
    key: 'product_reel_retention', successValue: '0.400000',
    successLabel: 'retenção de Reel de produto ≥ 40%',
    minSample: 7, minDays: 14, position: 3, state: 'abandoned', outcome: OLD_OUTCOME
  },
  {
    name: 'Unboxing natural no closet',
    hypothesis: 'Peça mostrada no seu ambiente converte melhor que apresentação formal.',
    isolated: 'formato do conteúdo de produto',
    key: 'conversion_rate', successValue: '0.005000',
    successLabel: 'conversão do dia ≥ 0,50%',
    minSample: 4, position: 4, state: 'abandoned', outcome: OLD_OUTCOME
  }
]

/* In order, from the biggest waste to the smallest. The order matters more
   than usual here: the stage below multiplies the one above, so widening
   distribution before fixing the decision to follow spends reach at 0,06%. */
const THIRD_EXPERIMENTS: ExperimentSeed[] = [
  {
    name: 'Longo de opinião, feito para ser descoberto',
    hypothesis: 'Vídeo de 90s+ com a sua opinião sobre make, moda, perfume ou "o que usar em tal ocasião" converte estranho em seguidor — quando chega em estranho.',
    isolated: 'pauta e duração',
    key: 'follows_reach', successValue: '0.003000',
    successLabel: 'seguidores/alcance ≥ 0,30% e ao menos 15% das views vindas de Explorar e Aba Reels',
    minSample: 7, minDays: 21, position: 1, state: 'not_started'
  },
  {
    name: 'Perfil como página de decisão',
    hypothesis: 'Bio, foto, destaques e os primeiros nove do grid decidem quem abriu o perfil e ainda não seguiu.',
    isolated: 'o perfil, nada do conteúdo',
    /* Was `profile_visits_reach` until 18/08/2026, which is visits over REACH —
       the step BEFORE the one this hypothesis is about. The success sentence
       always described followers over visits and the metric beside it measured
       something else; both sat near 6% today, so the mismatch read as correct
       on screen and would have been read as correct at the end too. */
    key: 'follows_per_visit', successValue: '0.090000',
    successLabel: 'de cada 100 que abrem o perfil, 9 seguem',
    minSample: 7, minDays: 14, position: 2, state: 'not_started'
  },
  {
    name: 'Motivo de seguir no curto',
    hypothesis: 'O vídeo de até 10 segundos já alcança milhões de estranhos e não diz quem você é. Dizer dobra a conversão dele.',
    isolated: 'o que o curto diz sobre você',
    key: 'follows_reach', successValue: '0.001200',
    successLabel: 'na faixa de 1 a 10s, seguidores/alcance ≥ 0,12%',
    minSample: 7, minDays: 14, position: 3, state: 'not_started'
  },
  {
    name: 'Colab de escala mensal',
    hypothesis: 'Um evento de distribuição por mês, do porte do que março fez, é o que fecha a distância que a conversão sozinha não fecha.',
    isolated: 'distribuição',
    key: 'followers_net', successValue: '15000',
    successLabel: '≥ 15.000 seguidores no mês do colab',
    minSample: 1, minDays: 30, position: 4, state: 'not_started'
  }
]

/* Closed on 13/08 with the cycle, one day after opening. Written on the row
   rather than left at `not_started` forever: an experiment that never ran and
   never says so reads, a month from now, as one somebody forgot. */
const NEW_OUTCOME =
  'Não chegou a rodar. O ciclo foi encerrado em 13/08/2026, um dia depois de abrir, ' +
  'por decisão da cliente — o alvo passou a ser seguidor. Nenhuma leitura foi feita.'

const NEW_EXPERIMENTS: ExperimentSeed[] = [
  {
    name: 'Pauta de conversa',
    hypothesis: 'Post que termina em pergunta curta, na sua voz, puxa comentário — sem precisar viralizar.',
    isolated: 'pauta e legenda',
    key: 'comments_reach', successValue: '0.003500',
    successLabel: 'comentários/alcance ≥ 0,35%',
    minSample: 7, minDays: 14, position: 1, state: 'abandoned', outcome: NEW_OUTCOME
  },
  {
    name: 'Resposta na primeira hora',
    hypothesis: 'Comentário respondido na primeira hora puxa a segunda rodada — quem foi respondido volta.',
    isolated: 'rotina de resposta (você + assessora)',
    key: 'comments_reach',
    successLabel: 'posts com resposta ativa fazem ≥ 1,5× os sem',
    minSample: 7, minDays: 14, position: 2, state: 'abandoned', outcome: NEW_OUTCOME
  },
  {
    name: 'Utilidade na sua voz',
    hypothesis: 'Conteúdo útil no seu formato — qualquer marca — faz a pessoa guardar.',
    isolated: 'pauta do pilar Vale guardar',
    key: 'saves_reach', successValue: '0.008000',
    successLabel: 'salvamentos/alcance ≥ 0,8%',
    minSample: 7, minDays: 14, position: 3, state: 'abandoned', outcome: NEW_OUTCOME
  },
  {
    name: 'Colab mensal',
    hypothesis: 'Colab no formato validado amplia alcance sem derrubar a conversa — a do desfile fez 3,45M, e a colab com a K Pro (09/08) fez 1,4× a sua mediana com a conversa na média.',
    isolated: 'distribuição',
    key: 'reach',
    successLabel: 'colab ≥ 2× a sua mediana de views, com comentários/alcance segurando',
    position: 4, state: 'abandoned', outcome: NEW_OUTCOME
  }
]

/**
 * A number the request asks for, typed instead of sent as a screenshot.
 *
 * `hint` says WHERE to look before the label says what to write — the order is
 * the instruction. It hands over the path inside Instagram rather than naming
 * it, the lesson `step.copy_value` already paid for.
 */
interface FieldSeed {
  /** Stable identity. Rewriting `label` must never create a second field. */
  slug: string
  label: string
  hint: string
  unit?: 'count' | 'ratio'
  /** `metric` -> metric_value by key; `post_share` -> post.non_follower_pct. */
  target?: 'metric' | 'post_share'
  metricKey?: string
  /** `YYYY-MM-01`. Absent on a monthly ask: it lands in the month it is answered. */
  period?: string
  postCode?: string
}

interface RequestSeed {
  title: string
  /** Titles this request carried before — how a renamed request is found again. */
  legacyTitles?: string[]
  kind: 'data' | 'action' | 'question' | 'material'
  priority: 'low' | 'medium' | 'high'
  description: string
  whyItMatters: string
  position: number
  fields?: FieldSeed[]
}

/**
 * The five questions that calibrate the active cycle. First on the list on
 * purpose: her answers can change the cycle's target, and the sooner they
 * arrive the less gets built on a guess.
 */
/* The two that unlock measurement for the cycle in force. First in position
   because the first experiment cannot be read without them: without the Público
   tab, its success criterion is a proxy measured against another proxy — which
   is how the two previous cycles died. */
const MEASURE_REQUESTS: RequestSeed[] = [
  {
    /* Renamed 17/08/2026, and the rename is the whole story of this request.
       She answered it the day the typed fields shipped — by screenshot, hours
       earlier — and she chose SIX Reels of her own rather than the five named
       here. Five of the six were not on the list at all.

       The list moved to her posts instead of her being asked again. Which of
       her Reels carries the measurement was never the point; having the
       measurement was. Asking a second time would have spent the one thing this
       product exists to protect — her willingness to answer at all — on a
       bookkeeping preference of mine. */
    title: 'A aba Público dos Reels que você mediu',
    legacyTitles: ['A aba Público de cinco Reels'],
    kind: 'data', priority: 'high', position: 1,
    description:
      'Já está tudo aqui — você não precisa fazer nada.\n\n' +
      'Você mandou os prints da aba Público de seis Reels em 17/08. Eu li os ' +
      'números deles e passei para cá, um por vídeo, para eles entrarem na conta ' +
      'do painel.\n\n' +
      'Se algum estiver errado, é só escrever por cima.',
    whyItMatters: 'Quem já te segue não pode te seguir de novo. Então, para saber se um vídeo funcionou, o que conta é a fatia de gente nova que viu — e esse número só existe nessa aba. Antes eu deduzia por outro caminho, e deduzir não é medir.',
    /* The six she actually measured, identified one by one against the archive
     * and against Instagram itself: caption, date and like count all matching
     * the screenshot before any code was written down here.
     *
     * EVERY SHORTCODE HERE IS READ OFF THE ARCHIVE, never written from memory.
     * An earlier version of this list invented one for the perfumes Reel and
     * the number would have been accepted, stored on the field, and landed
     * nowhere — `gravarPost` reported it and nobody was reading the audit log.
     * The seed refuses to write a field whose post is not in the archive, so a
     * fabricated code fails loudly at seed time instead of quietly at hers.
     *
     * `publico-perfumes` keeps its slug because it keeps its answer: the upsert
     * is keyed by (request, slug) and never touches `value`. The five retired
     * slugs are unanswered, so the prune below removes them. */
    fields: [
      {
        slug: 'publico-perfumes',
        label: 'meus top 5 perfumes favoritos (21/05, 1min39)',
        hint: 'https://instagram.com/reel/DYnqOYCBfAw — Ver insights → Público → escreva a % de NÃO seguidores',
        unit: 'ratio', target: 'post_share', postCode: 'DYnqOYCBfAw'
      },
      {
        slug: 'publico-sucessao',
        label: 'sucessão familiar da empresa (02/08, 2min37)',
        hint: 'https://instagram.com/reel/Dbii89ahd-i — Ver insights → Público → escreva a % de NÃO seguidores',
        unit: 'ratio', target: 'post_share', postCode: 'Dbii89ahd-i'
      },
      {
        slug: 'publico-baratos',
        label: 'vamos inverter: produtos baratos que valem a pena (05/08, 3min33)',
        hint: 'https://instagram.com/reel/DbredG-MWXy — Ver insights → Público → escreva a % de NÃO seguidores',
        unit: 'ratio', target: 'post_share', postCode: 'DbredG-MWXy'
      },
      {
        slug: 'publico-dedo',
        label: 'posso soltar o dedo hoje? (07/08, 7s)',
        hint: 'https://instagram.com/reel/DbvVnJbhLFD — Ver insights → Público → escreva a % de NÃO seguidores',
        unit: 'ratio', target: 'post_share', postCode: 'DbvVnJbhLFD'
      },
      {
        slug: 'publico-amiga',
        label: 'essa safada é minha amiga mesmo (08/08, 11s)',
        hint: 'https://instagram.com/reel/DbtDW9WBx7W — Ver insights → Público → escreva a % de NÃO seguidores',
        unit: 'ratio', target: 'post_share', postCode: 'DbtDW9WBx7W'
      },
      {
        slug: 'publico-amo',
        label: 'ããmo (09/08, 6s)',
        hint: 'https://instagram.com/reel/Db1ePDFhpsJ — Ver insights → Público → escreva a % de NÃO seguidores',
        unit: 'ratio', target: 'post_share', postCode: 'Db1ePDFhpsJ'
      }
    ]
  },
  {
    title: 'Uma vez por mês: o número de visitas ao perfil',
    /* Renamed and rewritten on 17/08/2026. The old text asked for THREE numbers
       and said it existed "enquanto a conexão não volta" — both untrue since she
       connected on 14/08. Alcance e seguidores agora chegam sozinhos; só
       `profile_visits` não existe como métrica de conta na API.

       Asking for two numbers the platform already has is how a person learns
       that the requests screen has not been read recently, and then stops
       reading it herself. */
    legacyTitles: ['Um print do mês, de Insights > Visão geral'],
    kind: 'data', priority: 'medium', position: 2,
    description:
      /* No markdown here: `RequestText` renders plain text and turns URLs into
         links, and nothing else. Asterisks would print as asterisks. */
      'Não precisa mandar print. É só escrever o número, aqui embaixo.\n\n' +
      'Onde achar, no seu celular:\n' +
      '1. Abra o Instagram e toque em Painel profissional.\n' +
      '2. Toque em Ver todos os insights e deixe o período em Últimos 30 dias.\n' +
      '3. Procure "Visitas ao perfil". É esse número.\n\n' +
      'Uma vez por mês já basta. Alcance e seguidores eu pego sozinho desde que você conectou a conta — esses dois você não precisa mandar mais.',
    whyItMatters: 'É o único número do caminho que o Instagram não me deixa pegar sozinho. Ele é o degrau do meio: quantas pessoas viram você e abriram seu perfil. Sem ele eu enxergo quem te viu e quem te seguiu, e não enxergo o que acontece entre os dois.',
    fields: [
      {
        slug: 'visitas-perfil-mes',
        label: 'Visitas ao perfil nos últimos 30 dias',
        hint: 'Instagram → Painel profissional → Ver todos os insights → Últimos 30 dias → Visitas ao perfil',
        unit: 'count', target: 'metric', metricKey: 'profile_visits'
      }
    ]
  }
]

const QUESTION_REQUESTS: RequestSeed[] = [
  {
    title: 'Quando você fala em engajamento, o que você quer ver mais?',
    kind: 'question', priority: 'high', position: 3,
    description:
      'Me diz a ordem, do mais importante para o menos: mais comentários e conversa? mais alcance e views? mais seguidores?\n\n' +
      'Como responder: escreva na caixa "Quer escrever alguma coisa junto?" aqui embaixo, do seu jeito, e toque em Enviar recado. Não tem certo ou errado.',
    whyItMatters: 'Você já respondeu esta em 13/08 — "primeiro seguidores, segundo comentários e likes, terceiro views" — e foi essa resposta que trocou o ciclo. Fica aqui como registro do que decidiu o rumo.'
  },
  {
    title: 'Quanto tempo por semana você tem, de verdade, para conteúdo?',
    kind: 'question', priority: 'high', position: 4,
    description:
      'Contando gravar, editar e escrever legenda — tudo que já é seu.\n\n' +
      'Como responder: escreva aqui embaixo e toque em Enviar recado. Pode ser "umas 6 horas" — não precisa de precisão, precisa de verdade.',
    whyItMatters: 'Você publicou uns 8 Reels por semana no último mês, tudo sozinha. O plano precisa caber na sua semana real — plano que não cabe é descartado na segunda semana, e a culpa é do plano.'
  },
  {
    title: 'O que você NÃO quer no seu perfil?',
    kind: 'question', priority: 'high', position: 5,
    description:
      'Assunto, formato ou papel que você não quer aí — inclusive quanto de marca você quer mostrar, agora que o time da My Favorite cuida do resto.\n\n' +
      'Como responder: uma lista curta aqui embaixo já resolve. Toque em Enviar recado quando terminar.',
    whyItMatters: 'O perfil é seu. Saber a fronteira evita eu recomendar o que você não vai fazer — foi exatamente o que aconteceu com o plano anterior.'
  },
  {
    title: 'Além de "qual o link?", o que mais chega no seu direct?',
    kind: 'question', priority: 'high', position: 6,
    description:
      'As duas ou três perguntas ou assuntos que mais se repetem — do jeito que as pessoas escrevem.\n\n' +
      'Como responder: escreva aqui embaixo, um por linha, e toque em Enviar recado. Se preferir, tire prints do direct e mande pelo botão Anexar arquivo.',
    whyItMatters: 'A pauta de conversa nasce do que a sua audiência já quer falar com você. O que chega no direct é essa lista, pronta.'
  },
  {
    title: 'Quais personagens você toparia transformar em quadro fixo?',
    kind: 'question', priority: 'high', position: 7,
    description:
      'José, Pipo, Velma, renata dramática... quem topa virar série com nome, no mesmo dia da semana?\n\n' +
      'E uma segunda coisa, na mesma resposta: a assessora que já responde o direct com você pode responder comentário em público também?\n\n' +
      'Como responder: escreva aqui embaixo os nomes e o que você achar dos comentários, e toque em Enviar recado.',
    whyItMatters: 'Quadro fixo cria gente que volta — e resposta na primeira hora puxa a segunda rodada de conversa. As duas coisas dependem só de vocês duas.'
  }
]

/**
 * Data requests that survive the transition: reach, saves and shares per Reel
 * read the NEW cycle's metrics just as well. Positions after the questions.
 */
const RETAINED_REQUESTS: RequestSeed[] = [
  {
    title: 'Uma planilha só, com todos os Reels de uma vez',
    /* Renamed on 11 Aug; production still holds the first title because the
       request seeding used to run only into an empty table. */
    legacyTitles: ['Uma planilha só, com os 203 Reels de uma vez'],
    kind: 'data', priority: 'high', position: 11,
    description:
      'Como fazer, no computador:\n' +
      '1. Entre em https://business.facebook.com com a mesma conta do seu Instagram.\n' +
      '2. No menu da esquerda, abra Insights e depois Conteúdo.\n' +
      '3. Filtre por Reels e escolha o maior período que ele deixar.\n' +
      '4. Toque em Exportar dados e baixe o arquivo.\n' +
      '5. Se ele só deixar 90 dias por vez, repita a exportação mudando o período até cobrir o ano — dois ou três arquivos.\n\n' +
      'Como mandar: pelo botão Anexar arquivo, aqui embaixo. Pode mandar todos de uma vez.',
    whyItMatters: 'Sem alcance real eu só consigo ver visualização, e visualização conta looping. Com a planilha eu leio quantas pessoas passaram a te seguir por post — o número que decide este ciclo.'
  },
  {
    title: 'O gráfico de "até onde assistiram" de nove vídeos',
    kind: 'data', priority: 'medium', position: 12,
    description:
      'Em cada vídeo da lista abaixo, o caminho é o mesmo:\n' +
      '1. Toque no link — no seu celular ele abre direto no app do Instagram.\n' +
      '2. No Reel, toque em Ver insights.\n' +
      '3. Desça até o gráfico de linha que vai caindo — é ele que mostra até onde as pessoas assistiram.\n' +
      '4. Tire um print (captura de tela) com o gráfico inteiro aparecendo.\n\n' +
      'Os nove, com o nome de cada um para você conferir se abriu o certo:\n' +
      '1. https://instagram.com/reel/DZPyUvzBgtN — "por dentro da sua peça favorita" ep. 1 (06/06)\n' +
      '2. https://instagram.com/reel/DZTOQy7hp3M — "por dentro da sua peça favorita" ep. 2 (07/06)\n' +
      '3. https://instagram.com/reel/DZYrlYMMOTQ — "por dentro da sua peça favorita" ep. 3 (10/06)\n' +
      '4. https://instagram.com/reel/DZ6GhB2BJoc — "por dentro da sua peça favorita" ep. 4 (23/06)\n' +
      '5. https://instagram.com/reel/DbW2ZzfBNU8 — lançamento da Primavera 27 (29/07)\n' +
      '6. https://instagram.com/reel/DZvzFECBWjG — o da coleção com a Disney (19/06)\n' +
      '7. https://instagram.com/reel/DVg-YGzAQvd — "ELA TEM MÃE!!!" (05/03)\n' +
      '8. https://instagram.com/reel/DY3KqCzMeNQ — "oq eu perdi?" (28/05)\n' +
      '9. https://instagram.com/reel/DaMRWJeshlz — "haaland fobia" (05/07)\n\n' +
      'Por que estes nove: do 1 ao 4 é a série, o 5 e o 6 são os de coleção, e do 7 ao 9 são seus campeões — eles servem de régua para comparar com os outros.\n\n' +
      'Como mandar: os nove prints pelo botão Anexar arquivo, aqui embaixo. Pode mandar todos de uma vez, e não precisa ser no mesmo dia.',
    whyItMatters: 'É o que mostra em que segundo as pessoas saem. Sem isso, "o vídeo não performou" não tem causa.'
  },
  {
    title: 'Algum desses vídeos foi impulsionado?',
    kind: 'question', priority: 'medium', position: 13,
    description:
      'Só preciso saber quais, se houve.\n\n' +
      'Como responder: escreva aqui embaixo os nomes ou as datas dos vídeos que tiveram impulsionamento — ou só "nenhum" — e toque em Enviar recado.',
    whyItMatters: 'Se teve dinheiro por trás, o alcance não é comparável com o dos outros — e eu estaria elogiando o formato quando a diferença era o impulsionamento.'
  },
  {
    title: 'As datas dos lançamentos e das publis grandes',
    kind: 'data', priority: 'low', position: 14,
    description:
      'Desde janeiro: lançamentos de coleção e publis grandes.\n\n' +
      'Como responder: escreva aqui embaixo, uma por linha — a data (o mês já ajuda) e o que foi. Toque em Enviar recado no fim.',
    whyItMatters: 'Picos de alcance nesses dias têm causa conhecida. Sem as datas eu leio pico de campanha como se fosse mérito do formato.'
  }
]

// ------------------------------------------------------------------- pautas

interface BeatSeed {
  time?: string
  says: string
  shows?: string
  note?: string
}

interface IdeaSeed {
  /** By `pillar.pillar_key` of the active cycle: espelho · opiniao · guardar · personagens. */
  pillar: string
  title: string
  /** Written out, never described. See the column comment in migration 010. */
  hook: string
  format?: 'reel' | 'carrossel' | 'story' | 'foto'
  seconds?: number
  why: string
  caption?: string
  cta?: string
  /** `YYYY-MM-DD`. Absent means the bank. */
  on?: string
  script?: BeatSeed[]
}

/**
 * THREE SCRIPTS A WEEK, AGAINST THE EIGHT REELS SHE PUBLISHES
 *
 * That is the finding, not a shortfall. Across 376 posts the long opinion video
 * converted 41× the brand pauta at comparable reach, and the 1–10s bucket — 39%
 * of all her reach — is the worst converter in the set. The short, spontaneous
 * half of her week IS the distribution engine; scripting it would break the one
 * thing that is not broken, and Espelho is the cycle's declared control.
 *
 * The weekly shape: Personagens is FIXED on Sundays — a named quadro lives on
 * regularity, and a quadro that alternates fortnightly is an event, not a
 * quadro. The other two slots alternate instead: two Opinião one week, Opinião
 * plus Vale guardar the next. (The first draft said "two Opinião + one
 * alternating", which a weekly Sunday quadro under a three-script cap cannot
 * satisfy — the data was right and the sentence was wrong.) Espelho carries no
 * pauta here on purpose.
 *
 * THE SUNDAY QUADRO CHANGED HANDS ON 18/08/2026
 *
 * It was "Trabalhar com a sua própria família", inferred from something she
 * said. It is now "kinda chic", which she invented and which measured 212
 * followers on 459.039 reach against a median of 8 across her other feed posts
 * that month. The family scripts stay in the bank, dated the day she wants
 * them — nothing was thrown away, and the count of three a week did not move.
 *
 * THE DATES ARE FIXED, AND THAT IS DELIBERATE
 *
 * They are the days these pautas were written for, not an offset from whenever
 * the seed happens to run. A date computed from `now` would move every time the
 * file is re-run — including out from under a pauta she had already planned her
 * week around. If a batch slips, the "Passou da data" group is doing its job:
 * it asks for a decision, record late or drop, instead of quietly re-dating.
 *
 * THE VOICE
 *
 * Measured across 45 real captions in `perfil/voz-e-tom.md`: lowercase
 * throughout, two to five words, never explains the video. The blacklist there
 * is honoured — no "não é sobre X, é sobre Y", no stacked CTA, no release
 * adjective. Every hook here is a sentence she could say out loud without
 * reading it.
 */
const IDEAS: IdeaSeed[] = [
  {
    pillar: 'opiniao',
    title: 'Os perfumes que acabam e os que encalham na estante',
    hook: 'eu tenho perfume de quatrocentos reais parado há dois anos e um de farmácia que eu recompro todo mês',
    seconds: 100,
    on: '2026-08-18',
    why: '"Meus top 5 perfumes favoritos" (21/05, 99s) alcançou 305 mil e trouxe 3.131 seguidores — 41× a série sobre a coleção, com quase a mesma duração. É o formato que mais fez estranho te seguir em 376 posts. Isto aqui repete o formato, não o vídeo: o mesmo assunto pelo avesso, que é o que dá uma segunda entrada sem repetir a primeira.',
    caption: 'acabam ou encalham',
    cta: 'me conta qual encalhou aí',
    script: [
      {
        time: '0–5s',
        says: 'eu tenho perfume de quatrocentos reais parado há dois anos e um de farmácia que eu recompro todo mês',
        shows: 'você já com os dois na mão, sem apresentação e sem "oi gente"',
        note: 'Abre pela contradição. O que não pode é começar dizendo do que o vídeo vai ser — foi assim o de 1:37 da coleção, que reteve 8%.'
      },
      {
        time: '5–25s',
        says: 'o barato primeiro. por que ele acaba, em que hora do dia você usa, e o que ele resolve que o caro não resolve.',
        shows: 'o frasco, o preço aparecendo na tela em texto'
      },
      {
        time: '25–55s',
        says: 'agora os que encalharam. dois ou três, com o motivo honesto de cada um — enjoou, é pesado demais pro calor, comprou por causa de outra pessoa.',
        shows: 'os frascos na estante, na ordem em que você fala',
        note: 'Esta é a parte que ninguém posta. É onde a pessoa decide te seguir, porque é onde você está dizendo uma coisa que uma publi não diria.'
      },
      {
        time: '55–85s',
        says: 'os que ficam. cinco no máximo, cada um com a ocasião — trabalho, sair à noite, o que você usa quando não quer pensar.',
        shows: 'um por vez, nome legível na tela'
      },
      {
        time: 'até o fim',
        says: 'me conta qual encalhou aí.',
        note: 'Uma pergunta só, curta, do seu jeito. Nada de "salva, comenta e compartilha" — pedido empilhado derruba os três.'
      }
    ]
  },
  {
    pillar: 'opiniao',
    title: 'O que usar em casamento de dia sem parecer que você tentou demais',
    hook: 'casamento de dia é a única ocasião em que dá pra errar estando toda certa',
    seconds: 110,
    on: '2026-08-20',
    why: 'Você mesma escreveu, em 13/08, o que mais chega no seu direct: "o que usar pra certa ocasião de uso". A pauta não é uma aposta minha — é a pergunta que já está lá todo dia, no formato que os números mostram converter.',
    caption: 'casamento de dia',
    cta: 'manda pra quem vai casar',
    script: [
      {
        time: '0–5s',
        says: 'casamento de dia é a única ocasião em que dá pra errar estando toda certa',
        shows: 'você de frente, sem cenário montado'
      },
      {
        time: '5–30s',
        says: 'os três erros que você vê em toda festa de dia — e por que cada um acontece. sem citar ninguém.',
        shows: 'se tiver foto sua de alguma, usa; se não, só você falando'
      },
      {
        time: '30–75s',
        says: 'o que funciona: comprimento, tecido, sapato e a única peça que resolve quando esfria à noite. quatro decisões, não quatro looks.',
        shows: 'as peças, uma por vez, com o nome na tela',
        note: 'Nomeie o tecido. "esse body é em malha pesada" foi o Story com mais cliques do mês — o que puxa ação é o detalhe nomeado, não o adjetivo.'
      },
      {
        time: '75–105s',
        says: 'o que você usaria, de verdade, se fosse amanhã.',
        shows: 'um look só, o seu'
      },
      {
        time: 'até o fim',
        says: 'manda pra quem vai casar.',
        note: 'Compartilhamento em DM é o segundo sinal mais forte de distribuição, e "manda pra alguém" é o pedido que ele responde.'
      }
    ]
  },
  /*
   * THE ONLY PAUTA HERE THAT IS NOT A HYPOTHESIS
   *
   * Every other idea in this file argues from an average across posts. This one
   * argues from one post, measured inside Instagram on 18/08/2026: the carousel
   * of 10/08 reached 459.039 and brought 212 followers, against a median of 8
   * across her six other feed posts that month. It was also her most shared
   * (3.074) and most saved (2.731) post of the window.
   *
   * She invented it. The quadro, the name and the format are hers — what this
   * adds is the Sunday slot and the argument for repeating it. That is why it
   * took the fixed Sunday from "Trabalhar com a sua própria família", which was
   * my inference from something she said; measured beats inferred, and the
   * family scripts keep their place in the bank rather than being thrown away.
   *
   * The lines are written out because the column demands it, and they are the
   * part she should overwrite first: a "acho chic" that is not hers dies on the
   * slide. The shape is what matters — a position, no product, no brand.
   */
  {
    pillar: 'personagens',
    title: 'kinda chic — edição 2',
    hook: 'acho chic repetir roupa',
    format: 'carrossel',
    on: '2026-08-23',
    why: 'O "kinda chic" de 10/08 alcançou 459 mil e trouxe 212 seguidores — os seus outros seis carrosséis do mês trouxeram 8 na média. Foi também o mais compartilhado e o mais salvo do mês. É a única coisa sua com conversão medida por dentro do Instagram, e não deduzida. Domingo fixo porque quadro sem dia é evento, e evento não cria gente que volta.',
    caption: 'kinda chic ⭐️',
    cta: 'me conta o seu',
    script: [
      {
        time: 'slide 1',
        says: 'acho chic repetir roupa',
        shows: 'uma foto sua repetindo uma peça que já apareceu no perfil',
        note: 'O primeiro slide é o que decide se a pessoa arrasta. No de 10/08 foi "acho chic dizer não sem escrever textão" — posição, sem explicação e sem produto.'
      },
      {
        time: 'slide 2',
        says: 'acho chic responder depois',
        shows: 'foto de viagem, celular na mão'
      },
      {
        time: 'slide 3',
        says: 'acho chic não ter opinião sobre tudo',
        shows: 'foto sua em evento'
      },
      {
        time: 'slide 4',
        says: 'acho chic sair sem avisar',
        shows: 'foto de festa ou jantar'
      },
      {
        time: 'slide 5',
        says: 'acho chic almoçar sozinha',
        shows: 'foto de restaurante'
      },
      {
        time: 'slide 6',
        says: 'acho chic dizer que não leu',
        shows: 'foto em casa'
      },
      {
        time: 'slide 7',
        says: 'acho chic não explicar',
        shows: 'a última foto, a mais forte',
        note: 'Fecha sem CTA na imagem. O convite vai na legenda — no de 10/08 não havia chamada nenhuma no slide e ele foi o mais compartilhado do mês.'
      }
    ]
  },
  {
    pillar: 'personagens',
    title: 'kinda chic — edição 3',
    hook: 'os melhores vieram de vocês',
    format: 'carrossel',
    on: '2026-08-30',
    why: 'Segundo domingo seguido, mesmo nome, mesmo formato — é a regularidade que faz alguém voltar, e quem volta segue. As frases desta edição saem dos comentários da edição 2, o que fecha o ciclo: quem escreveu vê que foi lido, e você não precisa inventar sete frases do zero.',
    caption: 'kinda chic ⭐️',
    cta: 'continua mandando o seu',
    script: [
      {
        time: 'antes de montar',
        says: '—',
        shows: 'abra os comentários da edição 2 e separe as cinco melhores',
        note: 'Este é o trabalho todo. As frases boas já vão estar lá — o quadro de 10/08 teve 207 comentários, e o convite desta edição é justamente pedir a frase.'
      },
      {
        time: 'slide 1',
        says: 'os melhores vieram de vocês',
        shows: 'uma foto sua, sem print de comentário ainda',
        note: 'Abre dizendo que são delas. É o motivo de voltar no próximo domingo.'
      },
      {
        time: 'slides 2 a 6',
        says: 'as cinco frases que você escolheu, uma por slide, escritas do seu jeito',
        shows: 'suas fotos, sem o @ de quem mandou',
        note: 'Sem o @: crédito na legenda, não na imagem. Print de comentário na foto encurta a vida do slide fora do seu perfil.'
      },
      {
        time: 'slide 7',
        says: 'a sua, a que fecha',
        shows: 'a foto mais forte do lote'
      }
    ]
  },
  {
    pillar: 'personagens',
    title: 'Trabalhar com a sua própria família — episódio 1',
    hook: 'a minha chefe é a minha mãe, e ninguém me avisou o que isso ia dar',
    seconds: 90,
    why: 'Suas palavras em 13/08: "sucessão familiar é um tópico que sempre traz bastante conversa". A pauta continua de pé e o roteiro está pronto — ela saiu do domingo porque o "kinda chic" chegou com número medido e o domingo é um só. Quando você quiser, é marcar a data.',
    caption: 'quem manda na empresa',
    cta: 'quem mais trabalha com a família?',
    script: [
      {
        time: '0–5s',
        says: 'a minha chefe é a minha mãe, e ninguém me avisou o que isso ia dar',
        shows: 'você sozinha, câmera na mão'
      },
      {
        time: '5–35s',
        says: 'uma situação concreta desta semana. não a teoria da sucessão — a discussão real, com o assunto real.',
        note: 'Concreto sempre. "é difícil trabalhar em família" é uma frase que qualquer pessoa poderia dizer; a discussão de terça é sua.'
      },
      {
        time: '35–70s',
        says: 'o que você aprendeu a fazer diferente. uma coisa só, específica.',
        shows: 'se der, a loja ou o escritório ao fundo'
      },
      {
        time: '70–90s',
        says: 'o gancho do próximo: diz o assunto do episódio dois e o dia.',
        note: 'É isto que transforma um vídeo em quadro. Sem a promessa datada, o episódio dois começa do zero.'
      }
    ]
  },
  {
    pillar: 'opiniao',
    title: 'A base de duzentos reais contra a de trinta e nove',
    hook: 'eu usei as duas na mesma cara, no mesmo dia, e uma delas eu não repito',
    seconds: 100,
    on: '2026-08-25',
    why: 'Make é o primeiro assunto da lista que você mesma deu do que chega no direct, e comparação lado a lado é o formato que dá opinião sem parecer publi. Nas respostas de Stories de 13/08 apareceu "Essa base é perfeitaaaa" e "Tenho um gelzinho da ruby rose topíssimo" — a audiência já está falando de produto barato com você.',
    caption: 'vale os 200?',
    cta: 'qual base te salvou?',
    script: [
      {
        time: '0–6s',
        says: 'eu usei as duas na mesma cara, no mesmo dia, e uma delas eu não repito',
        shows: 'as duas embalagens, sem dizer ainda qual é qual'
      },
      {
        time: '6–35s',
        says: 'a barata primeiro: cobertura, quanto dura, e a hora do dia em que ela te abandona.',
        shows: 'aplicação real, sem corte de mágica'
      },
      {
        time: '35–70s',
        says: 'a cara: o que ela faz que a outra não faz. e se isso vale a diferença de preço pra você.',
        shows: 'mesma luz, mesmo ângulo — se a luz mudar, a comparação não vale'
      },
      {
        time: '70–95s',
        says: 'o veredito, sem meio-termo. qual fica na necessaire.',
        note: 'Escolha uma. "as duas são ótimas pra ocasiões diferentes" é a resposta que não faz ninguém te seguir.'
      },
      {
        time: 'até o fim',
        says: 'qual base te salvou?'
      }
    ]
  },
  {
    pillar: 'guardar',
    title: 'As quatro peças que sustentam qualquer look seu',
    hook: 'eu tenho o armário cheio e uso as mesmas quatro coisas há dois anos',
    seconds: 75,
    on: '2026-08-27',
    why: 'Salvamento é o sinal do perfil abaixo da referência do nicho — 0,23% contra 1,40% — e é guard-rail deste ciclo, não pode cair. Você já começou sozinha: "produtos baratos que valem a pena" (05/08) é exatamente este pilar. E das respostas de Stories veio literalmente "Deixa salvo nos destaques, divaaa".',
    caption: 'as mesmas quatro',
    cta: 'salva pra montar depois',
    script: [
      {
        time: '0–5s',
        says: 'eu tenho o armário cheio e uso as mesmas quatro coisas há dois anos',
        shows: 'o armário aberto atrás de você'
      },
      {
        time: '5–55s',
        says: 'uma peça por vez: o que é, o tecido, e as duas ocasiões em que ela funciona. quatro peças, quinze segundos cada.',
        shows: 'a peça na mão e no corpo — as duas coisas, ou não dá pra imaginar',
        note: 'Nomeie o tecido e o corte. É o que faz a pessoa salvar em vez de só assistir: ela salva o que pretende usar depois.'
      },
      {
        time: '55–75s',
        says: 'salva pra montar depois.',
        note: 'Este é o único pilar em que pedir salvamento cabe, porque é o que o vídeo entrega. Nos outros soa como cobrança.'
      }
    ]
  },
  {
    pillar: 'personagens',
    title: 'Trabalhar com a sua própria família — episódio 2',
    hook: 'a pergunta que mais veio no episódio um foi essa, e ela é desconfortável',
    seconds: 90,
    why: 'Depende do episódio um: a pauta sai dos comentários dele, o que fecha o ciclo — quem comentou vê que foi lido. Ganha data quando o primeiro sair.',
    caption: 'a pergunta desconfortável',
    cta: 'a do próximo domingo vocês escolhem',
    script: [
      {
        time: '0–6s',
        says: 'a pergunta que mais veio no episódio um foi essa, e ela é desconfortável',
        shows: 'o print do comentário na tela, sem o @ da pessoa'
      },
      {
        time: '6–60s',
        says: 'a resposta honesta. inclusive a parte que não é bonita.',
        note: 'Se a resposta for confortável, a pergunta era outra. O episódio um funcionou pelo que ele admitiu.'
      },
      {
        time: '60–90s',
        says: 'o que vem no próximo domingo, e o convite pra escolherem o assunto.',
        shows: 'você olhando pra câmera'
      }
    ]
  },

  /* ------------------------------------------------------------ the bank
   *
   * Deliberately without scripts. A pauta gets its blocks when it gets a date —
   * writing nine full scripts up front would mean writing six of them before
   * she has told me what she thought of the first three, which is exactly the
   * loop `idea_note` exists to create. The screen says "pauta sem roteiro
   * ainda" rather than pretending these are ready to film.
   */
  {
    pillar: 'opiniao',
    title: 'A tendência que eu não vou seguir',
    hook: 'todo mundo comprou e eu vou dizer por que eu não vou',
    seconds: 90,
    why: 'Tema que divide é o que mais rende comentário sem depender de alcance, e opinião contrária é a versão mais barata disso — você não precisa de produção, precisa de posição. Vira roteiro assim que você me disser qual é a tendência.',
    caption: 'passo dessa'
  },
  {
    pillar: 'opiniao',
    title: 'O que eu compraria de novo e o que eu não compraria',
    hook: 'fiz a conta do que eu gastei em roupa esse ano e me arrependi de umas quatro coisas',
    seconds: 110,
    why: 'Arrependimento nomeado é a coisa mais rara num perfil de moda, e é o que separa opinião de vitrine. Mesmo motor do vídeo dos perfumes: você dizendo o que não deu certo.',
    caption: 'os quatro arrependimentos'
  },
  {
    pillar: 'guardar',
    title: 'Como eu decido o que sai do armário',
    hook: 'eu tiro roupa do armário por uma regra só, e ela não é "faz um ano que não uso"',
    seconds: 80,
    why: 'Utilidade com método é o que se salva. Você já provou o pilar com "produtos baratos que valem a pena"; isto é a versão sem produto, que funciona em qualquer semana.',
    caption: 'a regra do armário'
  },
  {
    pillar: 'opiniao',
    title: 'Make pra trabalhar de câmera ligada',
    hook: 'reunião por vídeo achata tudo, e a make que fica boa ao vivo some na tela',
    seconds: 95,
    why: '68% do seu público tem entre 25 e 44 anos e 88,7% são mulheres — é gente em idade de renda própria, com reunião na agenda. Ocasião de uso concreta, que é o que você disse que mais te pedem.',
    caption: 'a cara da reunião'
  },
  {
    pillar: 'personagens',
    title: 'O mozão responde',
    hook: 'eu deixei ele responder vocês sem eu ver as perguntas antes',
    seconds: 70,
    why: 'Quadro nomeado com um personagem que a audiência já conhece. Recorrência é o que faz a mesma pessoa voltar — e quem volta é quem segue.',
    caption: 'ele responde'
  }
]

/* Lost its object with the handoff: daily store sessions belong to the brand
   team now. Retired below — narrated, not deleted — and only if untouched. */
const RETIRED_REQUEST_TITLE = 'O relatório de visitas da loja, dia por dia'
const RETIRED_REQUEST_NOTE =
  'A ponte com a loja passou para a equipe da My Favorite em 12/08/2026 — este pedido ' +
  'saiu do ciclo. Se o relatório aparecer, ele vai direto para o time da marca.'

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

  // ---------------------------------------------------------------- cycles
  /* Resolved by (clientId, title) — the unique key — never by `limit 1`:
     with two cycles in the table, "the first row" is whichever the engine
     feels like returning. */
  const cycleIdByTitle = async (title: string): Promise<number> => {
    const [row] = await o.select({ id: cycle.id }).from(cycle)
      .where(and(eq(cycle.clientId, clientId), eq(cycle.title, title))).limit(1)
    if (row === undefined) throw new Error(`Cycle missing: ${title}`)
    return row.id
  }

  const OLD_GOAL =
    'Transformar quem já te assiste em quem compra. Você vê, ela quer — falta ela conseguir chegar.'
  const OLD_TRADE_OFF =
    'Suas views médias vão cair, e isso é o combinado. Provador e Padrão não fazem ' +
    '2 milhões como o humor faz — a troca é alcance por gente que chega na loja. ' +
    'Nas primeiras semanas isso vai parecer piora se a régua continuar sendo alcance. ' +
    'É por isso que a métrica que manda no ciclo passou a ser visita rastreada, e não view.'

  await o.insert(cycle).values({
    publicCode: ulid(),
    clientId,
    title: OLD_CYCLE_TITLE,
    goal: OLD_GOAL,
    tradeOff: OLD_TRADE_OFF,
    northStarMetric: 'Visitas à loja vindas das suas origens',
    startsOn: CYCLE_START,
    endsOn: CYCLE2_START,
    state: 'closed',
    createdAt: now,
    updatedAt: now
  }).onDuplicateKeyUpdate({
    /* Everything the file authors — except that on a CLOSED cycle the frozen
       content (goal, trade-off, north star, start) is authored to the same
       literals it closed with. What this update actually changes on a live
       database is the closing itself: state and end date. */
    set: {
      goal: OLD_GOAL,
      tradeOff: OLD_TRADE_OFF,
      northStarMetric: 'Visitas à loja vindas das suas origens',
      startsOn: CYCLE_START,
      endsOn: CYCLE2_START,
      state: 'closed',
      updatedAt: now
    }
  })

  const NEW_GOAL =
    'Seu alcance ninguém mexe. O que este ciclo persegue é conversa em público: quem comenta, quem guarda, quem volta.'
  const NEW_TRADE_OFF =
    'Este ciclo abre mão de perseguir venda — loja, receita e link agora são do time da ' +
    'My Favorite. E post de conversa e de utilidade não faz 2 milhões de views como o ' +
    'humor faz: se a média de views baixar um pouco enquanto o comentário sobe, é o ' +
    'desenho funcionando. O que não pode cair é o alcance do mês — e isso a gente vigia.'

  await o.insert(cycle).values({
    publicCode: ulid(),
    clientId,
    title: NEW_CYCLE_TITLE,
    goal: NEW_GOAL,
    tradeOff: NEW_TRADE_OFF,
    northStarMetric: 'Comentários por alcance',
    startsOn: CYCLE2_START,
    endsOn: CYCLE3_START,
    state: 'closed',
    createdAt: now,
    updatedAt: now
  }).onDuplicateKeyUpdate({
    set: {
      goal: NEW_GOAL,
      tradeOff: NEW_TRADE_OFF,
      northStarMetric: 'Comentários por alcance',
      startsOn: CYCLE2_START,
      endsOn: CYCLE3_START,
      state: 'closed',
      updatedAt: now
    }
  })

  /* The cycle in force since 13/08/2026, by the client's own target.
     She ranked what she wants to see — "primeiro seguidores, segundo
     comentários e likes, terceiro views" — and asked for 1M by December. The
     diagnosis that put comments first was not wrong; it was answering a
     different question. It survives as a guard-rail with its baseline as the
     floor. */
  const THIRD_GOAL =
    'Fazer quem ainda não te segue virar seguidor. O alcance já é enorme — o que ' +
    'não acontece é a pessoa nova decidir te acompanhar.'
  const THIRD_TRADE_OFF =
    'Este ciclo abre mão de perseguir comentário como alvo — ele vira guard-rail, ' +
    'com piso no que já existe hoje. E pauta cujo assunto é a marca sai do seu ' +
    'perfil pessoal: quatro episódios sobre a coleção alcançaram 179 mil pessoas e ' +
    'trouxeram 45 seguidores, contra 3.131 de um vídeo de opinião do mesmo tamanho. ' +
    'Não é julgamento do conteúdo, é conta de espaço.'

  /* The deadline the client set — "1M até dezembro", read as 31/12. Until
     17/08 it existed only inside a prose note: the product carried a goal with
     a deadline and no date anywhere in the data. The panel reads it now. */
  const CYCLE3_END = '2026-12-31'

  await o.insert(cycle).values({
    publicCode: ulid(),
    clientId,
    title: THIRD_CYCLE_TITLE,
    goal: THIRD_GOAL,
    tradeOff: THIRD_TRADE_OFF,
    northStarMetric: 'Seguidores novos por mês',
    startsOn: CYCLE3_START,
    endsOn: CYCLE3_END,
    state: 'active',
    createdAt: now,
    updatedAt: now
  }).onDuplicateKeyUpdate({
    set: {
      goal: THIRD_GOAL,
      tradeOff: THIRD_TRADE_OFF,
      northStarMetric: 'Seguidores novos por mês',
      startsOn: CYCLE3_START,
      endsOn: CYCLE3_END,
      state: 'active',
      updatedAt: now
    }
  })

  const oldCycleId = await cycleIdByTitle(OLD_CYCLE_TITLE)
  const newCycleId = await cycleIdByTitle(NEW_CYCLE_TITLE)
  const thirdCycleId = await cycleIdByTitle(THIRD_CYCLE_TITLE)

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
    }).onDuplicateKeyUpdate({
      /* Everything the file authors. This set used to carry label and tier
         only, which meant a rewritten description — the words SHE reads under
         the number — sat here and never shipped. Same silent-staleness shape
         already fixed in cycle, step and pillar. */
      set: {
        label: d.label,
        shortLabel: d.short ?? null,
        unit: d.unit,
        direction: d.direction ?? 'up',
        decimals: d.decimals ?? 2,
        tier: d.tier ?? 'monitor',
        description: d.description ?? null,
        howToMeasure: d.howToMeasure ?? null
      }
    })
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
         that already had the row. */
    }).onDuplicateKeyUpdate({
      set: { value: v.value, note: v.note ?? null, updatedAt: now }
    })
  }

  // -------------------------------------------------------------- targets
  const seedTargets = async (cycleId: number, targets: TargetSeed[]): Promise<void> => {
    for (const t of targets) {
      await o.insert(metricTarget).values({
        clientId,
        cycleId,
        metricDefId: requireDef(t.key),
        baselineOn: BASELINE_ON,
        contaminated: t.contaminated === true ? 1 : 0,
        isNorthStar: t.northStar === true ? 1 : 0,
        createdAt: now,
        updatedAt: now,
        ...(t.baseline === undefined ? {} : { baseline: t.baseline }),
        ...(t.target === undefined ? {} : { target: t.target }),
        ...(t.note === undefined ? {} : { note: t.note })
      }).onDuplicateKeyUpdate({
        /* Everything the file authors — `baseline` alone meant a corrected
           target or note printed success and changed nothing. */
        set: {
          baseline: t.baseline ?? null,
          baselineOn: BASELINE_ON,
          target: t.target ?? null,
          contaminated: t.contaminated === true ? 1 : 0,
          isNorthStar: t.northStar === true ? 1 : 0,
          note: t.note ?? null,
          updatedAt: now
        }
      })
    }
  }
  await seedTargets(oldCycleId, OLD_TARGETS)
  await seedTargets(newCycleId, NEW_TARGETS)
  await seedTargets(thirdCycleId, THIRD_TARGETS)

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
  const seedExperiments = async (cycleId: number, list: ExperimentSeed[]): Promise<void> => {
    for (const e of list) {
      await o.insert(experiment).values({
        publicCode: ulid(),
        clientId,
        cycleId,
        name: e.name,
        hypothesis: e.hypothesis,
        isolatedVariable: e.isolated,
        successLabel: e.successLabel,
        position: e.position,
        state: e.state,
        createdAt: now,
        updatedAt: now,
        ...(e.key === undefined ? {} : { metricDefId: requireDef(e.key) }),
        ...(e.successValue === undefined ? {} : { successValue: e.successValue }),
        ...(e.minSample === undefined ? {} : { minSample: e.minSample }),
        ...(e.minDays === undefined ? {} : { minDays: e.minDays }),
        ...(e.outcome === undefined ? {} : { outcome: e.outcome })
      }).onDuplicateKeyUpdate({
        /* State and outcome are authored HERE: no screen writes them, so this
           file is the ledger. Closing the old cycle abandons its experiments
           with the reason on the row — the screen reads it from the outcome. */
        set: {
          hypothesis: e.hypothesis,
          isolatedVariable: e.isolated,
          successLabel: e.successLabel,
          position: e.position,
          state: e.state,
          outcome: e.outcome ?? null,
          updatedAt: now
        }
      })
    }
  }
  await seedExperiments(oldCycleId, OLD_EXPERIMENTS)
  await seedExperiments(newCycleId, NEW_EXPERIMENTS)
  await seedExperiments(thirdCycleId, THIRD_EXPERIMENTS)

  // ------------------------------------------------------ deliveries + steps
  const seedDelivery = async (
    row: {
      cycleId: number
      slug: string
      title: string
      subtitle: string
      periodStart: string
      periodEnd: string
      readingMinutes: number
      position: number
      publishedAt: Date
      archivedAt: Date | null
    },
    steps: StepSeed[]
  ): Promise<number> => {
    await o.insert(delivery).values({
      publicCode: ulid(),
      clientId,
      cycleId: row.cycleId,
      slug: row.slug,
      title: row.title,
      subtitle: row.subtitle,
      kind: 'plan',
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      readingMinutes: row.readingMinutes,
      position: row.position,
      publishedAt: row.publishedAt,
      archivedAt: row.archivedAt,
      createdAt: now,
      updatedAt: now
    }).onDuplicateKeyUpdate({
      set: {
        cycleId: row.cycleId,
        title: row.title,
        subtitle: row.subtitle,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
        readingMinutes: row.readingMinutes,
        position: row.position,
        publishedAt: row.publishedAt,
        archivedAt: row.archivedAt,
        updatedAt: now
      }
    })

    const [d] = await o.select({ id: delivery.id }).from(delivery)
      .where(and(eq(delivery.clientId, clientId), eq(delivery.slug, row.slug))).limit(1)
    const deliveryId = d?.id
    if (deliveryId === undefined) throw new Error(`Delivery was not created: ${row.slug}`)

    for (const [i, s] of steps.entries()) {
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
        copyValue: s.copyValue ?? null,
        copyLabel: s.copyLabel ?? null,
        copyNote: s.copyNote ?? null,
        verifyKey: s.verifyKey ?? null,
        position: i + 1,
        createdAt: now,
        updatedAt: now
      }).onDuplicateKeyUpdate({
        /* Everything this file authors. `step_status` is hers and lives in its
           own table, so nothing she answered is at risk here.

           `requestId` is deliberately NOT here: it is written by the linking
           pass at the end, after the requests exist, and listing it in this
           `set` would blank it on every re-seed — the exact silent failure the
           README's note about `onDuplicateKeyUpdate` is about. */
        set: {
          title: s.title,
          summary: s.summary,
          deadlineLabel: s.deadlineLabel,
          urgency: s.urgency,
          evidenceValue: s.evidenceValue,
          evidenceLabel: s.evidenceLabel,
          copyValue: s.copyValue ?? null,
          copyLabel: s.copyLabel ?? null,
          copyNote: s.copyNote ?? null,
          verifyKey: s.verifyKey ?? null,
          position: i + 1,
          updatedAt: now
        }
      })
    }

    return deliveryId
  }

  /**
   * A delivery that is read instead of done: no steps, prose in blocks.
   *
   * The finding comes before the evidence, and the last block says what changes
   * in practice — without which the analysis is a report. Both rules live in
   * `openspec/changes/analise-que-ela-le`.
   */
  const seedAnalise = async (
    row: {
      cycleId: number
      slug: string
      title: string
      subtitle: string
      periodStart: string
      periodEnd: string
      readingMinutes: number
      publishedAt: Date
    },
    secoes: Array<{
      title?: string
      body: string
      highlight?: string
      highlightLabel?: string
    }>
  ): Promise<number> => {
    await o.insert(delivery).values({
      publicCode: ulid(),
      clientId,
      cycleId: row.cycleId,
      slug: row.slug,
      title: row.title,
      subtitle: row.subtitle,
      kind: 'analysis',
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      readingMinutes: row.readingMinutes,
      position: 0,
      publishedAt: row.publishedAt,
      createdAt: now,
      updatedAt: now
    }).onDuplicateKeyUpdate({
      set: {
        cycleId: row.cycleId,
        title: row.title,
        subtitle: row.subtitle,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
        readingMinutes: row.readingMinutes,
        publishedAt: row.publishedAt,
        updatedAt: now
      }
    })

    const [d] = await o.select({ id: delivery.id }).from(delivery)
      .where(and(eq(delivery.clientId, clientId), eq(delivery.slug, row.slug))).limit(1)
    const deliveryId = d?.id
    if (deliveryId === undefined) throw new Error(`Analysis was not created: ${row.slug}`)

    for (const [i, sec] of secoes.entries()) {
      await o.insert(deliverySection).values({
        deliveryId,
        position: i + 1,
        title: sec.title ?? null,
        body: sec.body,
        highlight: sec.highlight ?? null,
        highlightLabel: sec.highlightLabel ?? null,
        createdAt: now,
        updatedAt: now
      }).onDuplicateKeyUpdate({
        set: {
          title: sec.title ?? null,
          body: sec.body,
          highlight: sec.highlight ?? null,
          highlightLabel: sec.highlightLabel ?? null,
          updatedAt: now
        }
      })
    }

    return deliveryId
  }

  /* The closed cycle's plan leaves the screen (archived) but keeps its rows —
     and her answers, if any ever come, keep their object. */
  const oldDeliveryId = await seedDelivery({
    cycleId: oldCycleId,
    slug: 'cinco-ajustes',
    title: 'Cinco ajustes. Nenhum deles é postar mais.',
    subtitle: 'Seu alcance está ótimo e não é ali que está o problema. Estes cinco ajustes mexem no que acontece depois que a pessoa te assiste.',
    periodStart: '2026-07-04',
    periodEnd: '2026-08-03',
    readingMinutes: 8,
    position: 1,
    publishedAt: new Date('2026-08-04T12:00:00Z'),
    archivedAt: new Date('2026-08-12T12:00:00Z')
  }, OLD_STEPS)

  /* The reading of the two exports she sent on 13/08/2026: 376 posts from 16/02
     to 12/08, plus eight retention screenshots. Written in her own Reels rather
     than in rates — "45 followers against 3.131" is the same fact as "0,025%
     against 1,026%" and is the version she can act on. */
  await seedAnalise({
    cycleId: thirdCycleId,
    slug: 'o-que-os-376-posts-dizem',
    title: 'O seu vídeo mais valioso custou 3% do alcance do seu maior sucesso',
    subtitle: 'Li os 376 posts que você mandou, de fevereiro a agosto. Tem um padrão muito claro, e ele não é sobre postar mais.',
    periodStart: '2026-02-16',
    periodEnd: '2026-08-12',
    readingMinutes: 4,
    publishedAt: new Date('2026-08-13T21:00:00Z')
  }, [
    {
      title: 'O achado',
      highlight: '41×',
      highlightLabel: 'de diferença entre dois vídeos do mesmo tamanho',
      body: 'Os quatro episódios de "por dentro da sua peça favorita" alcançaram 179 mil pessoas e trouxeram 45 seguidores.\n\nO "meus top 5 perfumes favoritos", com quase a mesma duração, alcançou 305 mil e trouxe 3.131.\n\nNão é o formato. Não é a duração. É sobre o quê o vídeo fala: quando você dá a sua opinião sobre uma coisa que a pessoa também usa, ela quer te acompanhar. Quando o vídeo é sobre a empresa, ela assiste e vai embora.'
    },
    {
      title: 'E tem uma segunda coisa, que é ainda mais estranha',
      highlight: '1%',
      highlightLabel: 'do seu vídeo longo chega em quem ainda não te segue',
      body: 'Olhei de onde vêm as visualizações dos seus vídeos, um por um.\n\nNos seus vídeos longos, quase todo mundo que assiste já te segue — só cerca de 1% vem do Explorar e da aba de Reels, que são os lugares onde estranho te encontra.\n\nNos seus vídeos curtos é o contrário: 80% vem de gente que não te segue.\n\nJunte as duas coisas e o problema aparece inteiro. O conteúdo que faz estranho querer te seguir quase nunca é mostrado pra estranho. E o conteúdo que os estranhos veem aos milhões é justamente o que eles assistem e esquecem.'
    },
    {
      title: 'Onde está indo o seu alcance',
      highlight: '39%',
      highlightLabel: 'de tudo que você alcança vai para vídeos de até 10 segundos',
      body: 'De fevereiro a agosto, os vídeos de até 10 segundos somaram 33 milhões de alcance — mais de um terço de tudo.\n\nEles são ótimos de distribuição e você não deve parar de fazê-los: são eles que sustentam o seu tamanho. Mas eles quase não trazem seguidor: a cada mil pessoas que veem, menos de uma segue.\n\nNos vídeos acima de 90 segundos, essa conta é mais que o dobro.'
    },
    {
      title: 'O que eu preciso dizer antes de você confiar demais nisso',
      body: 'São 376 posts, o que é bastante — mas dois avisos honestos.\n\nO número de "seguiu depois de ver" continua subindo enquanto o post é antigo, então posts de fevereiro tiveram mais tempo de somar do que os de agosto. Comparar mês contra mês fica injusto; comparar tipo de vídeo dentro do mesmo período, não.\n\nE a divisão entre "quem já te segue" e "quem não te segue" eu deduzi de onde vieram as visualizações, em oito vídeos. O Instagram tem esse número exato, na aba Público de cada Reel. Vou te pedir isso — é o que transforma essa dedução em medida.'
    },
    {
      title: 'O que muda no que você faz',
      body: 'Três coisas, e nenhuma delas é postar mais.\n\nPrimeiro: os vídeos onde você dá opinião sobre make, moda, perfume e "o que usar em tal ocasião" deixam de ser eventuais e viram o centro. Você já sabia disso — foi você quem me escreveu que essas pautas sempre performam bem. Os números concordam com você.\n\nSegundo: pauta cujo assunto é a marca sai do seu perfil pessoal. Não é julgamento do conteúdo, é conta de espaço: 45 seguidores por 179 mil pessoas alcançadas não paga o lugar. Isso é assunto do time da My Favorite.\n\nTerceiro: os vídeos curtos continuam, do mesmo jeito, na mesma quantidade. Mas eles vão ganhar um motivo pra pessoa te seguir — hoje eles são vistos por milhões de estranhos e não dizem quem você é.'
    }
  ])

  const newDeliveryId = await seedDelivery({
    /* Cycle 2, not 3. This plan belongs to the cycle it was written for, and
       repointing it would make an archived delivery claim it came from a cycle
       that started the day it was archived. */
    cycleId: newCycleId,
    slug: 'agora-o-assunto-e-conversa',
    title: 'O foco voltou pro seu perfil. Cinco movimentos, nenhum é postar mais.',
    subtitle: 'Seu alcance segue ótimo e ninguém mexe nele. O que muda é o alvo: conversa — quem comenta, quem guarda, quem volta.',
    periodStart: '2026-07-04',
    periodEnd: '2026-08-03',
    readingMinutes: 6,
    position: 1,
    publishedAt: new Date('2026-08-12T12:00:00Z'),
    /* Archived after one day. The cycle it belonged to closed on 13/08, and a
       plan for a closed cycle on her screen is a plan that asks her to do work
       nobody is reading any more. */
    archivedAt: new Date('2026-08-13T21:00:00Z')
  }, NEW_STEPS)

  /* The plan of the cycle in force. Three moves, and they are the same three
     the analysis ends on — if these two screens disagree, she is right not to
     trust either. */
  const THIRD_STEPS: StepSeed[] = [
    {
      code: 'c1', urgency: 'today', deadlineLabel: 'hoje, se der',
      title: 'Me mandar a aba Público dos seus Reels',
      summary: 'Em cada Reel: Ver insights → aba Público. Tem um número dizendo quantos dos que viram já te seguiam.\n\nVocê mandou seis em 17/08 — eles estão em Pedidos, com o número de cada um.',
      evidenceValue: '8',
      evidenceLabel: 'vídeos em que eu deduzi esse número — este pedido transforma dedução em medida',
      copyValue: 'Ver insights → Público → quantos já te seguiam',
      copyLabel: 'o caminho, dentro do Reel',
      /* The same job as the request of the same name — and the title has to
         track it. `requestByTitle` here takes ONE title and does not consult
         `legacyTitles`, so renaming the request without renaming this string
         unlinks the step: the plan goes back to asking for something already
         answered, and every screen still looks perfectly fine. That is the
         complaint that opened this whole change, arriving by the back door. */
      requestTitle: 'A aba Público dos Reels que você mediu'
    },
    {
      code: 'c2', urgency: 'this_week', deadlineLabel: 'esta semana',
      title: 'Gravar dois vídeos de opinião, do jeito que você já fala',
      summary: 'Perfume, make, tendência ou "o que usar em tal ocasião". Longo, sem roteiro, do jeito que você faz nos Stories — foi assim o dos perfumes.\n\nNão precisa ser produzido. Precisa ser você dizendo o que acha.',
      evidenceValue: '3.131',
      evidenceLabel: 'seguidores que "meus top 5 perfumes" trouxe, contra 45 dos quatro episódios da coleção'
    },
    {
      code: 'c3', urgency: 'ongoing', deadlineLabel: 'a partir de já',
      title: 'Pauta sobre a coleção sai do seu perfil',
      summary: 'Bastidor de produção, lançamento, peça — isso é do perfil da marca. No seu, entra só quando for escolha sua dentro de uma pauta sua.\n\nNão é sobre a qualidade do conteúdo. É que o espaço é limitado e essa pauta rende 41× menos.',
      evidenceValue: '179 mil',
      evidenceLabel: 'pessoas alcançadas pelos quatro episódios da série, que trouxeram 45 seguidores'
    },
    /* Added 18/08/2026. The three above are about what she publishes; these
       three are about what a stranger finds after clicking, which nothing in
       this product had ever looked at. 347.482 profile visits a month and 6 in
       every 100 of those people follow — the other 94 saw the top of the
       profile and left. */
    {
      code: 'c4', urgency: 'today', deadlineLabel: 'hoje, dois minutos',
      title: 'Trocar um dos seus três posts fixados',
      summary: 'Os fixados são a primeira coisa que aparece pra quem abre seu perfil. Hoje são a coleção, a viagem e a publi da Miu Miu.\n\nTira a publi e fixa o "kinda chic" no lugar. Os outros dois podem ficar.',
      evidenceValue: '212',
      evidenceLabel: 'seguidores que o "kinda chic" trouxe. A média dos seus outros seis carrosséis do mês é 8'
    },
    {
      code: 'c5', urgency: 'this_week', deadlineLabel: 'esta semana',
      title: 'Uma bio que responde "o que eu vou ver aqui?"',
      summary: 'A sua bio hoje diz o seu cargo e um e-mail de assessoria. Ela funciona pra marca e pra imprensa.\n\nPra quem acabou de te descobrir, ela não diz o que a pessoa ganha te seguindo — e são 347 mil pessoas por mês abrindo esse perfil.',
      evidenceValue: '94 em 100',
      evidenceLabel: 'pessoas que abrem seu perfil e saem sem seguir',
      copyValue:
        'acho chic dizer o que eu acho\n' +
        'moda, beleza e o que eu ando usando\n' +
        'assessoria@biancaolivo.com.br',
      copyLabel: 'Cole isto na sua bio',
      copyNote:
        'A primeira linha é sua — foi o post que mais trouxe gente nova esse mês. ' +
        'A segunda diz em três palavras o que a pessoa vai encontrar. O e-mail ' +
        'continua igual.\n\n' +
        'Se você quiser manter "diretora criativa da @myfavorite.oficial", ela cabe ' +
        'como última linha. Só não na primeira: quem chegou agora ainda não sabe o ' +
        'que é a marca, e a primeira linha é a única que todo mundo lê.'
    },
    {
      code: 'c6', urgency: 'this_week', deadlineLabel: 'esta semana',
      title: 'Pôr "looks" na frente dos destaques',
      summary: 'Você tem 49 destaques e não precisa apagar nenhum — é só arrastar.\n\nO primeiro é o menu de quem chegou agora. Hoje começa por cidade, que é o que quem já te acompanha quer rever. Põe "looks" em primeiro e deixa as viagens depois.',
      evidenceValue: '36',
      evidenceLabel: 'dos seus 49 destaques são viagem. "looks" é o único que responde o que a pessoa vai ver aqui'
    },
    /* Added 20/08/2026, after checking the profile: c4 was marked done and the
       "kinda chic" really is pinned — but what left the three was the trip, not
       the publi. This does not reopen c4. It names the two slots still holding
       brand, and it names them from the only ranking that exists: the 14 feed
       posts of the last 30 days, the surface where the API answers `follows`.
       Every personal photo dump beat every brand post, and the cliff between
       third and fourth place is 146 to 20. Reels are not in this ranking and
       the copy must never imply they are. */
    {
      code: 'c7', urgency: 'today', deadlineLabel: 'hoje, dois minutos',
      title: 'Os outros dois fixados',
      summary: 'O "kinda chic" já está lá e fica onde está.\n\nOs outros dois lugares são a coleção e a publi da Miu Miu. No lugar deles: "pensando pensamentos", de 20 de julho, e "thinking out loud", de 5 de agosto.\n\nDesafixar não tira o post do ar. Ele continua no seu perfil, na data dele — só sai dos três de cima.',
      evidenceValue: '196 e 146',
      evidenceLabel: 'seguidores que esses dois trouxeram. Nenhum post seu que fala da marca passou de 9'
    }
  ]

  const thirdDeliveryId = await seedDelivery({
    cycleId: thirdCycleId,
    slug: 'quem-te-ve-te-segue',
    /* The first three are the ones she already had and nothing about them
       changed; the wording opens by saying so, because on this product every
       new delivery is read as a replacement until told otherwise.

       The count used to be in this string — "Três novos". A seventh step
       arrived on 20/08 and the sentence was wrong before anyone noticed. A
       title that states a number has to be edited every time the list moves,
       and the edit that gets forgotten is the one nobody can see is stale. */
    title: 'Os três primeiros continuam. Os novos são sobre o seu perfil, não sobre o que você posta.',
    subtitle: 'Você já publica 8 Reels por semana e alcança 5,4 milhões de contas por mês. Isto aqui continua não pedindo mais nada — o que entrou agora é sobre o que a pessoa encontra depois de clicar no seu perfil.',
    periodStart: '2026-02-16',
    periodEnd: '2026-08-12',
    readingMinutes: 4,
    position: 1,
    publishedAt: new Date('2026-08-13T21:00:00Z'),
    archivedAt: null
  }, THIRD_STEPS)

  // -------------------------------------------------------------- pillars
  const seedPillars = async (cycleId: number, list: PillarSeed[]): Promise<void> => {
    for (const [i, p] of list.entries()) {
      await o.insert(pillar).values({
        clientId,
        cycleId,
        pillarKey: p.key,
        name: p.name,
        sharePct: p.share,
        perWeek: p.perWeek,
        thesis: p.thesis,
        roleNote: p.role,
        evidence: p.evidence,
        metricKey: p.metricKey,
        successLabel: p.success,
        isControl: p.control ? 1 : 0,
        position: i + 1,
        createdAt: now,
        updatedAt: now
      }).onDuplicateKeyUpdate({
        set: {
          name: p.name,
          sharePct: p.share,
          perWeek: p.perWeek,
          thesis: p.thesis,
          roleNote: p.role,
          evidence: p.evidence,
          metricKey: p.metricKey,
          successLabel: p.success,
          isControl: p.control ? 1 : 0,
          position: i + 1,
          updatedAt: now
        }
      })
    }
  }
  await seedPillars(oldCycleId, OLD_PILLARS)
  await seedPillars(newCycleId, NEW_PILLARS)
  await seedPillars(thirdCycleId, THIRD_PILLARS)

  // --------------------------------------------------------------- pautas
  /*
   * Keyed by title through `uq_idea_client_title`, so editing a script here and
   * re-running updates it in place.
   *
   * `state` and `published_code` are NOT in the `set`. They are hers: a pauta
   * she marked "gravei" must not go back to "proposta" because I fixed a typo
   * in the hook. This is the same rule that keeps `step_status` in its own
   * table, applied to a column that could not be moved out of this one — there
   * is no per-person version of "this video is out".
   *
   * The beats ARE fully re-authored: they are entirely mine, nobody edits them
   * in the app, and updating nine rows in place would need a stable key per
   * beat that the script's own shape does not have. What SHE wrote lives in
   * `idea_note`, which nothing here touches.
   */
  let pautasGravadas = 0
  for (const [i, p] of IDEAS.entries()) {
    await o.insert(idea).values({
      publicCode: ulid(),
      clientId,
      cycleId: thirdCycleId,
      pillarKey: p.pillar,
      title: p.title,
      hook: p.hook,
      format: p.format ?? 'reel',
      targetSeconds: p.seconds ?? null,
      why: p.why,
      caption: p.caption ?? null,
      cta: p.cta ?? null,
      scheduledFor: p.on ?? null,
      state: p.on === undefined ? 'proposed' : 'scheduled',
      position: i + 1,
      createdAt: now,
      updatedAt: now
    }).onDuplicateKeyUpdate({
      set: {
        cycleId: thirdCycleId,
        pillarKey: p.pillar,
        hook: p.hook,
        format: p.format ?? 'reel',
        targetSeconds: p.seconds ?? null,
        why: p.why,
        caption: p.caption ?? null,
        cta: p.cta ?? null,
        scheduledFor: p.on ?? null,
        position: i + 1,
        updatedAt: now
      }
    })

    const [row] = await o.select({ id: idea.id }).from(idea)
      .where(and(eq(idea.clientId, clientId), eq(idea.title, p.title))).limit(1)
    const ideaId = row?.id
    if (ideaId === undefined) throw new Error(`Idea was not created: ${p.title}`)

    await o.delete(ideaBeat).where(eq(ideaBeat.ideaId, ideaId))
    for (const [j, b] of (p.script ?? []).entries()) {
      await o.insert(ideaBeat).values({
        ideaId,
        position: j + 1,
        timeLabel: b.time ?? null,
        says: b.says,
        shows: b.shows ?? null,
        note: b.note ?? null
      })
    }
    pautasGravadas += 1
  }

  // -------------------------------------------------------------- requests
  /*
   * Keyed by title (with known legacy titles), not by "table is empty": the
   * empty-table guard meant a renamed request never reached production and a
   * new request could never be added at all. What a person did on a request —
   * state changes, comments, files — is never touched here; only the fields
   * this file authors are.
   */
  const requestByTitle = async (titles: string[]) => {
    for (const t of titles) {
      const [row] = await o.select({ id: request.id, state: request.state })
        .from(request)
        .where(and(eq(request.clientId, clientId), eq(request.title, t)))
        .limit(1)
      if (row !== undefined) return row
    }
    return undefined
  }

  const ALL_REQUESTS: RequestSeed[] = [...MEASURE_REQUESTS, ...QUESTION_REQUESTS, ...RETAINED_REQUESTS]
  for (const r of ALL_REQUESTS) {
    const existing = await requestByTitle([r.title, ...(r.legacyTitles ?? [])])
    if (existing === undefined) {
      await o.insert(request).values({
        publicCode: ulid(),
        clientId,
        cycleId: thirdCycleId,
        title: r.title,
        description: r.description,
        whyItMatters: r.whyItMatters,
        kind: r.kind,
        priority: r.priority,
        raisedBySide: 'consultant',
        state: 'open',
        position: r.position,
        createdAt: now,
        updatedAt: now
      })
    } else {
      await o.update(request).set({
        cycleId: thirdCycleId,
        title: r.title,
        description: r.description,
        whyItMatters: r.whyItMatters,
        kind: r.kind,
        priority: r.priority,
        position: r.position,
        updatedAt: now
      }).where(eq(request.id, existing.id))
    }
  }

  /* ------------------------------------------------- request fields
   *
   * Keyed by (request, slug) since 012, so rewording a label updates the field
   * rather than adding a second one.
   *
   * `value`, `answered_at` and `answered_by` are NOT in the `set`. They are
   * hers: correcting a typo in a hint must never erase the number she typed —
   * the same rule that keeps `step_status` in its own table and `idea.state`
   * out of the idea upsert.
   */
  let campos = 0
  for (const r of ALL_REQUESTS) {
    if (r.fields === undefined) continue
    const alvo = await requestByTitle([r.title, ...(r.legacyTitles ?? [])])
    if (alvo === undefined) {
      console.warn(`  ! fields for "${r.title}": request not found`)
      continue
    }

    for (const [i, f] of r.fields.entries()) {
      /* A shortcode that is not in the archive is a typo or an invention, and
         both fail SILENTLY at her end: the number is accepted, stored on the
         field, and lands on no post. It happened on the first pass of this very
         list. Loud here, where it costs a re-run, instead of loud never. */
      if (f.postCode !== undefined) {
        const [existe] = await o.select({ id: post.id }).from(post)
          .where(and(eq(post.clientId, clientId), eq(post.igCode, f.postCode))).limit(1)
        if (existe === undefined) {
          console.warn(`  ! field "${f.label}": post ${f.postCode} is not in the archive — skipped`)
          continue
        }
      }

      await o.insert(requestField).values({
        requestId: alvo.id,
        slug: f.slug,
        position: i + 1,
        label: f.label,
        hint: f.hint,
        unit: f.unit ?? 'count',
        target: f.target ?? 'metric',
        metricKey: f.metricKey ?? null,
        period: f.period ?? null,
        postCode: f.postCode ?? null,
        createdAt: now,
        updatedAt: now
      }).onDuplicateKeyUpdate({
        set: {
          /* The label IS in the set now — it is a sentence, not an identity,
             and improving the wording has to reach her screen. */
          label: f.label,
          position: i + 1,
          hint: f.hint,
          unit: f.unit ?? 'count',
          target: f.target ?? 'metric',
          metricKey: f.metricKey ?? null,
          period: f.period ?? null,
          postCode: f.postCode ?? null,
          updatedAt: now
        }
      })
      campos += 1
    }

    /* Prune what this file no longer authors — UNANSWERED rows only. 012's own
       cleanup ran after its backfill had already slugged every row, so it
       deleted nothing; a label-derived slug left by that pass would sit beside
       the authored field for ever, asking her the same number twice. A field
       with a typed value is hers and stays, whatever its slug. */
    const autorais = r.fields.map(f => f.slug)
    await o.delete(requestField).where(and(
      eq(requestField.requestId, alvo.id),
      isNull(requestField.value),
      or(isNull(requestField.slug), notInArray(requestField.slug, autorais))
    ))
  }

  /* ------------------------------------------------- steps ↔ requests
   *
   * Run here, after both exist, because the two are seeded in an order this
   * file chose for other reasons and nothing should make that order matter.
   *
   * Only the pairs the author declared. A pass that matched on similar titles
   * would guess at a relationship the person who wrote both already knows, and
   * a wrong guess here silently marks a chore as done.
   */
  const LINK_STEPS: Array<{ deliveryId: number; steps: StepSeed[] }> = [
    { deliveryId: oldDeliveryId, steps: OLD_STEPS },
    { deliveryId: newDeliveryId, steps: NEW_STEPS },
    { deliveryId: thirdDeliveryId, steps: THIRD_STEPS }
  ]

  let ligados = 0
  for (const { deliveryId, steps } of LINK_STEPS) {
    for (const s of steps) {
      if (s.requestTitle === undefined) continue

      const alvo = await requestByTitle([s.requestTitle])
      if (alvo === undefined) {
        /* Loud, because the failure mode is silence: a typo in the title leaves
           the step unlinked, the plan goes on asking for something already
           answered, and every screen looks perfectly fine. */
        console.warn(`  ! step ${s.code}: no request titled "${s.requestTitle}"`)
        continue
      }

      await o.update(step)
        .set({ requestId: alvo.id, updatedAt: now })
        .where(and(eq(step.deliveryId, deliveryId), eq(step.code, s.code)))
      ligados += 1
    }
  }

  /* Retire the request that lost its object — narrated on its own timeline,
     and only while untouched: any event on it means a person got involved,
     and then the closing is a conversation, not a seed. */
  const retired = await requestByTitle([RETIRED_REQUEST_TITLE])
  if (retired !== undefined && retired.state === 'open') {
    const [{ n } = { n: 0 }] = await o
      .select({ n: sql<number>`COUNT(*)` })
      .from(requestEvent)
      .where(eq(requestEvent.requestId, retired.id))

    if (Number(n) === 0) {
      const [consultant] = await o.select({ id: user.id }).from(user)
        .where(eq(user.role, 'consultant')).limit(1)

      await o.update(request).set({
        state: 'dropped',
        closedAt: now,
        updatedAt: now
      }).where(eq(request.id, retired.id))

      await o.insert(requestEvent).values({
        requestId: retired.id,
        userId: consultant?.id ?? null,
        kind: 'state_change',
        fromState: 'open',
        toState: 'dropped',
        createdAt: now
      })
      /* The state_change row renders as a narration without a body, so the
         reason travels as a comment — the part she can actually read. */
      await o.insert(requestEvent).values({
        requestId: retired.id,
        userId: consultant?.id ?? null,
        kind: 'comment',
        body: RETIRED_REQUEST_NOTE,
        createdAt: now
      })
    }
  }

  console.log(`Seeded client #${clientId}.`)
  console.log(
    `  Cycles: #${oldCycleId} + #${newCycleId} closed, #${thirdCycleId} active ("${THIRD_CYCLE_TITLE}")`
  )
  console.log(`  ${DEFS.length} metric definitions, ${VALUES.length} values, ${OLD_TARGETS.length + NEW_TARGETS.length + THIRD_TARGETS.length} targets, ${BENCHMARKS.length} benchmarks`)
  console.log(
    `  Experiments: ${OLD_EXPERIMENTS.length + NEW_EXPERIMENTS.length} closed + ` +
    `${THIRD_EXPERIMENTS.length} active`
  )
  console.log(
    `  Deliveries: #${oldDeliveryId} + #${newDeliveryId} archived, ` +
    `#${thirdDeliveryId} active (${THIRD_STEPS.length} steps), 1 analysis to read`
  )
  console.log(
    `  Pillars: ${OLD_PILLARS.length + NEW_PILLARS.length} frozen + ` +
    `${THIRD_PILLARS.length} active`
  )
  console.log(`  Requests: ${MEASURE_REQUESTS.length} measurement + ${QUESTION_REQUESTS.length} questions + ${RETAINED_REQUESTS.length} retained, 1 retired if untouched`)
  console.log(
    `  Pautas: ${pautasGravadas} (${IDEAS.filter(p => p.on !== undefined).length} agendadas, ` +
    `${IDEAS.filter(p => p.on === undefined).length} no banco), ` +
    `${IDEAS.reduce((n, p) => n + (p.script?.length ?? 0), 0)} blocos de roteiro`
  )
  console.log(`  Steps linked to a request: ${ligados}`)
  console.log(`  Request fields (numbers she types): ${campos}`)
}

main()
  .catch((error: unknown) => {
    const reason = error instanceof Error ? error.message : String(error)
    console.error(`\nSeed failed: ${reason}`)
    process.exitCode = 1
  })
  .finally(() => { void db().end() })
