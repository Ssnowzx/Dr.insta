import { and, eq, sql } from 'drizzle-orm'
import { orm } from './client.ts'
import { db, waitForDatabase } from './connection.ts'
import {
  benchmark, client, cycle, delivery, experiment, metricDef, metricTarget,
  metricValue, pillar, request, requestEvent, step, user
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
 * Two cycles live here since 12 Aug 2026. "Caminho até a compra" is CLOSED —
 * the client redirected the work to her personal profile and the store side
 * went to the brand's own team. Its pillars, targets and experiments stay
 * frozen under it, which is what lets "did the bet pay off?" keep an object.
 * "O perfil que conversa" is the active cycle.
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
const BASELINE_ON = '2026-08-04'

const OLD_CYCLE_TITLE = 'Caminho até a compra'
const NEW_CYCLE_TITLE = 'O perfil que conversa'

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
  { key: 'product_reel_retention', value: '0.080000', source: 'insights', sample: 1, note: 'Um único Reel: o lançamento da coleção, 1min37.' }
]

interface TargetSeed {
  key: string
  baseline: string
  target?: string
  contaminated?: boolean
  note?: string
}

/* Frozen with the closed cycle. Re-seeding must leave the closed cycle reading
   exactly as it read on the day it closed — these literals are that reading. */
const OLD_TARGETS: TargetSeed[] = [
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

const NEW_TARGETS: TargetSeed[] = [
  {
    key: 'comments_reach', baseline: '0.002100', target: '0.005000',
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
    evidenceValue: '0', evidenceLabel: 'dos seus 205 Reels têm alcance medido hoje'
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

const NEW_EXPERIMENTS: ExperimentSeed[] = [
  {
    name: 'Pauta de conversa',
    hypothesis: 'Post que termina em pergunta curta, na sua voz, puxa comentário — sem precisar viralizar.',
    isolated: 'pauta e legenda',
    key: 'comments_reach', successValue: '0.003500',
    successLabel: 'comentários/alcance ≥ 0,35%',
    minSample: 7, minDays: 14, position: 1, state: 'not_started'
  },
  {
    name: 'Resposta na primeira hora',
    hypothesis: 'Comentário respondido na primeira hora puxa a segunda rodada — quem foi respondido volta.',
    isolated: 'rotina de resposta (você + assessora)',
    key: 'comments_reach',
    successLabel: 'posts com resposta ativa fazem ≥ 1,5× os sem',
    minSample: 7, minDays: 14, position: 2, state: 'not_started'
  },
  {
    name: 'Utilidade na sua voz',
    hypothesis: 'Conteúdo útil no seu formato — qualquer marca — faz a pessoa guardar.',
    isolated: 'pauta do pilar Vale guardar',
    key: 'saves_reach', successValue: '0.008000',
    successLabel: 'salvamentos/alcance ≥ 0,8%',
    minSample: 7, minDays: 14, position: 3, state: 'not_started'
  },
  {
    name: 'Colab mensal',
    hypothesis: 'Colab no formato validado amplia alcance sem derrubar a conversa — a do desfile fez 3,45M, e a colab com a K Pro (09/08) fez 1,4× a sua mediana com a conversa na média.',
    isolated: 'distribuição',
    key: 'reach',
    successLabel: 'colab ≥ 2× a sua mediana de views, com comentários/alcance segurando',
    position: 4, state: 'not_started'
  }
]

interface RequestSeed {
  title: string
  /** Titles this request carried before — how a renamed request is found again. */
  legacyTitles?: string[]
  kind: 'data' | 'action' | 'question' | 'material'
  priority: 'low' | 'medium' | 'high'
  description: string
  whyItMatters: string
  position: number
}

/**
 * The five questions that calibrate the active cycle. First on the list on
 * purpose: her answers can change the cycle's target, and the sooner they
 * arrive the less gets built on a guess.
 */
const QUESTION_REQUESTS: RequestSeed[] = [
  {
    title: 'Quando você fala em engajamento, o que você quer ver mais?',
    kind: 'question', priority: 'high', position: 1,
    description:
      'Me diz a ordem, do mais importante para o menos: mais comentários e conversa? mais alcance e views? mais seguidores?\n\n' +
      'Como responder: escreva na caixa "Quer escrever alguma coisa junto?" aqui embaixo, do seu jeito, e toque em Enviar recado. Não tem certo ou errado.',
    whyItMatters: 'O ciclo persegue uma métrica só. Eu desenhei para conversa — comentários — porque é onde os números mostram espaço. Se para você engajamento é outra coisa, eu troco o desenho agora, não na terceira semana.'
  },
  {
    title: 'Quanto tempo por semana você tem, de verdade, para conteúdo?',
    kind: 'question', priority: 'high', position: 2,
    description:
      'Contando gravar, editar e escrever legenda — tudo que já é seu.\n\n' +
      'Como responder: escreva aqui embaixo e toque em Enviar recado. Pode ser "umas 6 horas" — não precisa de precisão, precisa de verdade.',
    whyItMatters: 'Você publicou uns 8 Reels por semana no último mês, tudo sozinha. O plano precisa caber na sua semana real — plano que não cabe é descartado na segunda semana, e a culpa é do plano.'
  },
  {
    title: 'O que você NÃO quer no seu perfil?',
    kind: 'question', priority: 'high', position: 3,
    description:
      'Assunto, formato ou papel que você não quer aí — inclusive quanto de marca você quer mostrar, agora que o time da My Favorite cuida do resto.\n\n' +
      'Como responder: uma lista curta aqui embaixo já resolve. Toque em Enviar recado quando terminar.',
    whyItMatters: 'O perfil é seu. Saber a fronteira evita eu recomendar o que você não vai fazer — foi exatamente o que aconteceu com o plano anterior.'
  },
  {
    title: 'Além de "qual o link?", o que mais chega no seu direct?',
    kind: 'question', priority: 'high', position: 4,
    description:
      'As duas ou três perguntas ou assuntos que mais se repetem — do jeito que as pessoas escrevem.\n\n' +
      'Como responder: escreva aqui embaixo, um por linha, e toque em Enviar recado. Se preferir, tire prints do direct e mande pelo botão Anexar arquivo.',
    whyItMatters: 'A pauta de conversa nasce do que a sua audiência já quer falar com você. O que chega no direct é essa lista, pronta.'
  },
  {
    title: 'Quais personagens você toparia transformar em quadro fixo?',
    kind: 'question', priority: 'high', position: 5,
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
    whyItMatters: 'Sem alcance real eu só consigo ver visualização, e visualização conta looping. Com a planilha eu leio comentário e salvamento por alcance — os dois números deste ciclo.'
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
    state: 'active',
    createdAt: now,
    updatedAt: now
  }).onDuplicateKeyUpdate({
    set: {
      goal: NEW_GOAL,
      tradeOff: NEW_TRADE_OFF,
      northStarMetric: 'Comentários por alcance',
      startsOn: CYCLE2_START,
      state: 'active',
      updatedAt: now
    }
  })

  const oldCycleId = await cycleIdByTitle(OLD_CYCLE_TITLE)
  const newCycleId = await cycleIdByTitle(NEW_CYCLE_TITLE)

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
        baseline: t.baseline,
        baselineOn: BASELINE_ON,
        contaminated: t.contaminated === true ? 1 : 0,
        createdAt: now,
        updatedAt: now,
        ...(t.target === undefined ? {} : { target: t.target }),
        ...(t.note === undefined ? {} : { note: t.note })
      }).onDuplicateKeyUpdate({
        /* Everything the file authors — `baseline` alone meant a corrected
           target or note printed success and changed nothing. */
        set: {
          baseline: t.baseline,
          baselineOn: BASELINE_ON,
          target: t.target ?? null,
          contaminated: t.contaminated === true ? 1 : 0,
          note: t.note ?? null,
          updatedAt: now
        }
      })
    }
  }
  await seedTargets(oldCycleId, OLD_TARGETS)
  await seedTargets(newCycleId, NEW_TARGETS)

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
        position: i + 1,
        createdAt: now,
        updatedAt: now
      }).onDuplicateKeyUpdate({
        /* Everything this file authors. `step_status` is hers and lives in its
           own table, so nothing she answered is at risk here. */
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
          position: i + 1,
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

  const newDeliveryId = await seedDelivery({
    cycleId: newCycleId,
    slug: 'agora-o-assunto-e-conversa',
    title: 'O foco voltou pro seu perfil. Cinco movimentos, nenhum é postar mais.',
    subtitle: 'Seu alcance segue ótimo e ninguém mexe nele. O que muda é o alvo: conversa — quem comenta, quem guarda, quem volta.',
    periodStart: '2026-07-04',
    periodEnd: '2026-08-03',
    readingMinutes: 6,
    position: 1,
    publishedAt: new Date('2026-08-12T12:00:00Z'),
    archivedAt: null
  }, NEW_STEPS)

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

  const ALL_REQUESTS: RequestSeed[] = [...QUESTION_REQUESTS, ...RETAINED_REQUESTS]
  for (const r of ALL_REQUESTS) {
    const existing = await requestByTitle([r.title, ...(r.legacyTitles ?? [])])
    if (existing === undefined) {
      await o.insert(request).values({
        publicCode: ulid(),
        clientId,
        cycleId: newCycleId,
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
        cycleId: newCycleId,
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
  console.log(`  Cycles: #${oldCycleId} closed ("${OLD_CYCLE_TITLE}"), #${newCycleId} active ("${NEW_CYCLE_TITLE}")`)
  console.log(`  ${DEFS.length} metric definitions, ${VALUES.length} values, ${OLD_TARGETS.length}+${NEW_TARGETS.length} targets, ${BENCHMARKS.length} benchmarks`)
  console.log(`  Experiments: ${OLD_EXPERIMENTS.length} closed + ${NEW_EXPERIMENTS.length} active`)
  console.log(`  Deliveries: #${oldDeliveryId} archived, #${newDeliveryId} active (${NEW_STEPS.length} steps)`)
  console.log(`  Pillars: ${OLD_PILLARS.length} frozen + ${NEW_PILLARS.length} active`)
  console.log(`  Requests: ${QUESTION_REQUESTS.length} questions + ${RETAINED_REQUESTS.length} retained, 1 retired if untouched`)
}

main()
  .catch((error: unknown) => {
    const reason = error instanceof Error ? error.message : String(error)
    console.error(`\nSeed failed: ${reason}`)
    process.exitCode = 1
  })
  .finally(() => { void db().end() })
