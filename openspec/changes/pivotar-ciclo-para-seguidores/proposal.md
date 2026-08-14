## Why

Em 13/08/2026 a Bianca respondeu, dentro da plataforma, o pedido "Quando você fala em engajamento, o que você quer ver mais?":

> "mais importante em ordem: primeiro seguidores - segundo comentários e likes - terceiro views. Gostaria de chegar a 1M de seguidores até dezembro"

Isso contradiz frontalmente o ciclo aberto um dia antes, em 12/08, que fixou **comentários/alcance** como métrica-norte e escreveu seguidores como métrica de vaidade explicitamente fora de meta (`perfil/metas.md:88`). O consultor decidiu em 13/08 que **o alvo declarado pela cliente prevalece** — o perfil é dela, e estratégia que a cliente não reconhece como sua não é executada (a não-execução do ciclo de conversão, em 04/08, já provou isso uma vez).

No mesmo dia ela entregou os dados que faltavam: dois CSVs com **376 Reels e carrosséis de 16/02 a 12/08/2026**, oito prints de retenção e seis de Stories. Pela primeira vez existe a coluna `Seguimentos` — seguidores ganhos por post. A métrica-norte nova é mensurável post a post desde fevereiro.

### O que os dados dizem

**O gargalo não é conteúdo nem alcance. É distribuição.** Os oito prints de retenção formam um experimento natural, lidos pela aba *Principais fontes das visualizações*:

| Grupo | Aba Reels + Explorar (estranhos) | Feed + Stories + Perfil (quem já segue) |
|---|---:|---:|
| 6 Reels longos (1:26–1:51) | **1,0% – 4,2%** | 95,8% – 99,0% |
| 2 Reels curtos (0:06 e 0:08) | **77,8% – 83,5%** | 16,5% – 22,2% |

Cruzando com os 376 posts do CSV:

| Duração | Posts | Alcance | Seguidores | Conversão |
|---|---:|---:|---:|---:|
| 1–10s | 90 | **33.271.101** | 20.460 | 0,061% |
| 10–20s | 67 | 26.779.728 | 22.332 | 0,083% |
| 20–45s | 30 | 4.778.645 | 2.845 | 0,060% |
| 45–90s | 36 | 2.894.827 | 3.299 | 0,114% |
| **90s+** | 41 | 7.947.289 | 11.606 | **0,146%** |

O formato que melhor converte é o que quase nunca chega a estranho. E **39% de todo o alcance do período — 33,3 milhões — vai para o formato de 1–10s**, que alcança estranho e não o converte. Quem já segue não pode seguir de novo.

Os dois extremos provam a tese dentro da mesma faixa de duração:

- **Série institucional** "por dentro da sua peça favorita" (4 eps, 86–89s): 179.461 de alcance → **45 seguidores** → 0,025%
- **Vídeo de opinião** "meus top 5 perfumes favoritos" (99s): 305.249 de alcance → **3.131 seguidores** → **1,026%**

**41× de diferença.** Não é formato nem duração: é o sujeito do conteúdo. E o vídeo de perfumes sozinho fez 45% de tudo que julho inteiro produziu em seguidores por post.

Três outras fontes apontam para o mesmo lugar: as respostas de Stories dela ("Amooooo seus videos **longosss**", "Amo quando posta conteúdo assim", "Deixa salvo nos destaques"), a resposta dela ao pedido sobre o direct ("opiniões como perfumes, makes, tendências de moda sempre performam bem e geram conversa") e a concentração — **os top 5% dos posts produziram 52,9% de todos os seguidores** do período.

### A aritmética da meta

| | |
|---|---|
| Baseline (`perfil/perfil.md:20`) | **713.838** seguidores |
| Ritmo atual (`perfil/metas.md:88`) | **+20.824/mês** líquidos |
| Falta | **286.162** |
| Prazo assumido: 13/08 → 31/12/2026 | 140 dias |
| Ritmo necessário | **~62.200/mês** — 3,0× o atual |
| No ritmo de hoje, 1M chega em | ~outubro de **2027** |

Posts explicam apenas **34%** do crescimento (julho: 6.987 de +20.824); os outros ~13.800/mês vêm de busca, sugestão e perfil. Projetando sobre o alcance-post de julho:

| Conversão média | Seguidores/mês | Projeção em 31/12 |
|---|---:|---:|
| 0,060% (hoje) | 20.800 | ~810.000 |
| 0,20% | 37.300 | ~885.000 |
| 0,30% | 49.000 | ~939.000 |
| 0,40% | 60.700 | ~993.000 |

**Conversão sozinha não fecha 1M.** Março/2026 fechou: 26.847 seguidores por post num mês, contra 7.000–11.000 dos meses normais — a corrente de vídeos com a @virginia. A meta só fecha com conversão de 3–4× **somada** a um evento de escala por mês. Isso fica escrito no ciclo desde o primeiro dia, não descoberto na semana 6.

## What Changes

- **BREAKING** — a métrica-norte passa de **comentários por alcance** para **seguidores líquidos por mês** (baseline 20.824, alvo 62.200). O ciclo de engajamento aberto em 12/08 **fecha sem leitura**, mesmo desfecho do ciclo de conversão de 04/08 — dois ciclos seguidos encerrados antes da primeira leitura, e isso fica registrado como padrão a observar
- **A regra do denominador é refinada.** O projeto normaliza tudo por alcance; para crescimento de seguidor o denominador honesto passa a ser o **alcance de não-seguidor**, e toda taxa precisa declarar qual usou
- Comentários/alcance e saves/alcance **descem para guard-rail**, com piso no próprio baseline (0,21% e 0,23%). Não são descartados: são o que impede o ciclo de comprar seguidor às custas da conversa
- **Pauta cujo sujeito é a marca sai do feed do perfil pessoal** enquanto o ciclo tiver seguidores como norte — 0,025% não paga o espaço. A marca segue aparecendo como escolha dela dentro de pauta dela
- Quatro experimentos novos, em ordem obrigatória, atacando **do maior desperdício para o menor**: longo de opinião com engenharia de descoberta → perfil como página de decisão → motivo de seguir no curto → colab de escala mensal
- **A restrição de capacidade cai.** Ela declarou "tenho bastante tempo e uma equipe pra me ajudar nisso". Ainda assim volume não é alavanca: ela já publica 58 a 81 posts/mês a 0,060% de conversão
- O posicionamento ganha objetivo comercial declarado por ela: **nicho premium para fechar publicidade com marcas relevantes**
- Fica escrito o **critério de morte da meta**: projeção linear na semana 6 (24/09), renegociada com ela em números

## Capabilities

### New Capabilities

- `ciclo-seguidores-perfil`: como o perfil converte alcance em seguidor — por que o denominador é o alcance de não-seguidor, o funil por estágios, os experimentos em ordem, os guard-rails que impedem crescer destruindo a conversa, e o critério aritmético de morte da meta
- `alvo-declarado-pela-cliente`: o que acontece quando o alvo que a cliente declara contradiz o diagnóstico dos dados — quem ganha, o que precisa ser dito antes de obedecer, e como o diagnóstico vencido é preservado como risco declarado em vez de descartado

### Modified Capabilities

Nenhuma. `openspec/specs/` continua vazio — não há spec principal publicada. A capacidade `transicao-de-ciclo-na-plataforma`, definida em `ativar-ciclo-engajamento-agosto`, é reusada como está: o mecanismo de troca de ciclo não muda, só o conteúdo que ele carrega.

## Impact

- `CLAUDE.md` — objetivo dos 90 dias, métrica-norte, a regra 1 (denominador) e a seção "o que não é o gargalo", que hoje afirma o oposto do novo ciclo
- `perfil/metas.md` — painel inteiro: objetivo, métrica-norte, funil por estágios, experimentos, critério de fracasso
- `perfil/pilares.md` — mix revisto: mais 90s+ de opinião, menos institucional, o curto mantido como motor de distribuição
- `perfil/perfil.md` — posicionamento premium e objetivo de publicidade
- `perfil/icp.md` — o que chega no direct dela como evidência de demanda
- `platform/db/seed.ts` — fecha o ciclo de engajamento, cadastra as métricas novas, semeia ciclo/pilares/alvos/experimentos/entrega/passos; re-seed em produção
- `.claude/skills/` — `instagram-growth` e `instagram-audit` assumem a prioridade; `instagram-community` a perde. A descrição de `instagram-growth` afirma hoje que crescimento é secundário neste ciclo e precisa ser invertida
- `dados/metricas/` — os dois CSVs entram no repositório de dados como base do ciclo
- Sem impacto em `src/` — o motor não muda; nenhum benchmark novo é citado

## Fora de escopo

- **Impulsionamento pago.** Ela confirmou que nada foi impulsionado. Com equipe e objetivo de publi é alavanca legítima, mas exige orçamento que ninguém aprovou. Fica como opção declarada, não como plano
- **O handoff para a equipe da My Favorite.** Continua identificado e continua sem canal definido — herdado do ciclo anterior
- **Prazo alternativo.** Assume-se 31/12/2026. Se ela quis dizer 01/12, o ritmo necessário sobe para ~80k/mês
- **Alvo numérico para as taxas de não-seguidor.** Os 8 prints são indício, não medição — a fatia de não-seguidor foi inferida por fonte de tráfego, não lida na aba *Público*. O baseline vira primeiro passo do ciclo; alvo só depois dele
- **Medição de retorno da mesma pessoa.** Segue sem ferramenta e agora também sem prioridade
