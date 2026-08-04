# Metas — ciclo de 90 dias

> Meta sem baseline é ficção. Preencha a coluna "Baseline" **antes** de definir alvo.

Baseline levantado em **04/08/2026**, a partir dos Insights de 30 dias (04/07 a 03/08/2026),
dos 6 Reels com dados completos e do painel de receita por origem de julho.
Material em `dados/bianca-olivo-2026-07/`.

## Objetivo do ciclo

**Caminho até a compra** — converter alcance em receita rastreável.

Traduzido: a pessoa vê, quer, e consegue chegar ao produto. Hoje ela vê e quer; o resto
depende de mandar DM perguntando o link.

> Substituiu "Engajamento e comunidade" em 04/08/2026. Motivo: os dados de julho mostram
> engajamento na média ou acima da referência do nicho — 5,4M de contas alcançadas, 284 mil
> compartilhamentos, 22 mil respostas em Stories, +20.824 seguidores — contra conversão de
> 0,29% e `saves/reach` de 0,23%. O gargalo não é interação, é o que vem depois dela.

## Métrica-norte

**Sessões rastreadas/mês vindas das origens dela no GA4.**

Uma única métrica manda no ciclo. Quando houver conflito entre duas recomendações, ganha a
que move esta.

## Painel do ciclo

| Métrica | Baseline (jul/2026) | Alvo 90d | Como medir | Cadência |
|---|---|---|---|---|
| **Sessões rastreadas/mês** | 7.976 ⚠️ | ver nota | GA4, origens `influencer/bianca-olivo` + `bianca.olivo` | mensal |
| **Saves/reach** | **0,23%** | **1,4%** (média do nicho) | Insights por post | por post |
| **Cliques no link da bio** | **0** (não havia link) | ver nota | Insights > Atividade do perfil | semanal |
| **Retenção de Reel de produto** | **8%** (1 post) | **≥ 40%** | Insights por Reel | por post |
| **Receita/mês do canal** | R$ 10.583,28 ⚠️ | ver nota | painel de receita por origem | mensal |
| **Transações/mês** | 23 | ver nota | painel de receita por origem | mensal |
| **Conversão do canal** | 0,29% | **≥ 0,50%** | GA4 | mensal |

⚠️ **Os dois baselines marcados estão contaminados** e não servem para definir alvo ainda:

1. As 7.976 sessões e a receita de julho foram geradas **sem link na bio** — todo o tráfego
   veio de sticker manual em Stories. O link entrou entre 30/07 e 04/08.
2. O link entrou **sem UTM**, então os cliques dele ainda não aparecem como canal dela.
3. A receita de julho tem divergência aberta: R$ 10.583,28 no painel contra R$ 12,7 mil na
   resposta 12 do formulário.

**Consequência:** corrigir a UTM, rodar 30 dias, e só então fixar o alvo. Definir meta sobre
um baseline que sabidamente vai mudar de patamar é inventar número.

## Baseline de conteúdo (medido)

Referência: benchmark `lifestyle`, fonte compilada Hootsuite/Rival IQ, atualizado em 2026-01-15.

| Métrica | Bianca | Referência | Leitura |
|---|---:|---:|---|
| Curtidas/alcance | 7,73% | 8,00% | na média |
| Compartilhamentos/alcance | 1,32% | 1,60% | na média — com um post em 5,38% |
| **Salvamentos/alcance** | **0,23%** | **1,40%** | **crítico** |
| Comentários/alcance | 0,21% | 0,50% | abaixo |
| Retenção — Reel curto (0:09 / 0:13) | 89% / 77% | 48% | muito acima |
| Retenção — Reel longo pessoal (3:00) | 28% | 48% | abaixo |
| **Retenção — Reel de produto (1:37)** | **8%** | 48% | **muito abaixo do crítico (22%)** |

Amostra: 6 Reels em 13 dias. **Abaixo do mínimo de 7 posts e 14 dias** — indício, não tendência.

## Métricas de acompanhamento (reportar, não otimizar)

Já estão em nível alto. Entram no relatório para dar contexto e para detectar queda, **não**
para guiar decisão neste ciclo:

- Alcance total (5.413.754 em 30 dias)
- Visualizações (54.570.184)
- Seguidores líquidos (+20.824)
- Compartilhamentos em Reels (284 mil)
- Respostas em Stories (22 mil)
- Visitas ao perfil (347.482)

Se alguma cair de forma acentuada e sustentada (>25% por 3 semanas), aí sim vira assunto —
pode indicar problema de distribuição causado pela mudança de mix.

## Experimentos ativos

| Experimento | Hipótese | Variável isolada | Critério de sucesso | Prazo | Status |
|---|---|---|---|---|---|
| **UTM na bio** | Sem parâmetro, o tráfego da bio não é creditado ao canal dela | link da bio | Volume mensurável em `utm_campaign=bio` no GA4 | 30 dias | a iniciar |
| **Mix de pilares** | Conteúdo de utilidade (Provador) eleva `saves/reach`, hoje em 0,23% | mix editorial | `saves/reach` ≥ 0,8% | 14 dias, mín. 7 posts | a iniciar |
| **Voz única para marca** | Post de produto performa mal em parte porque ela troca de voz | legenda | Retenção de Reel de produto ≥ 40% | 14 dias, mín. 7 posts | a iniciar |

**Ordem obrigatória:** UTM primeiro, sozinha — é infraestrutura, não experimento. Os dois
outros começam na semana seguinte. Rodar tudo junto produz três variáveis se movendo ao mesmo
tempo e nenhuma conclusão válida.

## Regras de leitura

- **Amostra mínima:** 7 posts ou 14 dias. Abaixo disso não existe tendência, existe ruído.
- **Um experimento por vez.**
- **As views médias vão cair** quando o mix mudar. Isso é esperado e está combinado — não é
  sinal de falha. O que não pode cair é `sends/reach` do pilar Espelho, que é o controle.
- **Revisão do painel:** semanal (leve) e mensal (relatório completo via `instagram-report`).

---

**Início do ciclo:** 04/08/2026
**Última atualização:** 04/08/2026
