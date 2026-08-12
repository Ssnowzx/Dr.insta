# Metas — ciclo de 90 dias

> Meta sem baseline é ficção. Preencha a coluna "Baseline" **antes** de definir alvo.

Baseline levantado em **04/08/2026** (Insights de 04/07 a 03/08/2026, 6 Reels com dados
completos) e complementado em 05/08/2026 pela extração pública dos 203 Reels de jan–ago.
Material em `dados/bianca-olivo-2026-07/` e `dados/metricas/`.

## Objetivo do ciclo

**Engajamento do perfil dela** — transformar a conversa que já existe em privado em conversa
pública e recorrente, sem mexer no motor de alcance.

> Substituiu "Caminho até a compra" em **12/08/2026, por decisão da cliente**: o perfil
> pessoal é dela; a relação com a loja e o e-commerce ficam com a equipe da My Favorite.
> O diagnóstico de conversão (saves 0,23%, conversão 0,29%, link sem etiqueta) **continua
> válido** — mudou de dono, não de veracidade. Vira material de handoff para o time da marca.

Traduzido: a audiência dela já conversa com ela — 22 mil respostas de Stories por mês, DMs
diárias — mas em privado. Em público o perfil aplaude (curtidas na média) e não conversa
(comentários/alcance 0,21% contra 0,50% do nicho), e nada pede para ser guardado
(saves/alcance 0,23% contra 1,40%). O ciclo ataca exatamente esses dois sinais — os únicos
de engajamento abaixo da referência.

## Métrica-norte

**Comentários por alcance.**

Uma única métrica manda no ciclo. Quando houver conflito entre duas recomendações, ganha a
que move esta. Alcance e views são guard-rail (não podem cair), não alvo — já estão em nível
alto e otimizá-los seria resolver problema que a conta não tem.

> ⚠️ As respostas da Bianca às perguntas do app (pedidos do ciclo) podem recalibrar alvo e
> pesos — o desenho abaixo é o melhor possível com o que os dados dizem hoje.

## Painel do ciclo

| Métrica | Baseline (jul/2026) | Alvo 90d | Como medir | Cadência |
|---|---|---|---|---|
| **Comentários/alcance** | **0,21%** ⚠️ amostra 6 | **≥ 0,50%** (referência do nicho) | Insights por post; API quando ela conectar | por post |
| **Saves/alcance** | **0,23%** ⚠️ amostra 6 | **≥ 0,8%** (caminho até 1,4%) | Insights por post | por post |
| **Sends/alcance — controle** | 1,32% | **não cair** | Insights por post | por post |
| **Respostas em Stories** | 22.000/mês | não cair | Insights > Interações | mensal |
| **Alcance — guard-rail** | 5.413.754/mês | ≥ baseline | Insights > Visão geral | mensal |
| **Retorno da mesma pessoa** | sem medição hoje | — | manual (comentários de quem já comentou) | quinzenal |

⚠️ **Os dois baselines de taxa vêm de 6 Reels em 13 dias** — abaixo do mínimo de 7 posts.
Servem de ponto de partida declarado, não de certeza. A primeira leitura com a conta
conectada substitui os dois.

**Retorno da mesma pessoa não tem baseline nem ferramenta.** A API conectada não dá acesso a
comentários (escopo recusado de propósito no app da Meta). Enquanto for manual, é leitura
qualitativa quinzenal — está escrito assim para ninguém fingir precisão.

## O que saiu do painel — e para onde foi

Sessões rastreadas, receita, transações, conversão, cliques no link da bio e retenção de
Reel de produto **saíram do ciclo**: são da relação perfil→loja, que agora é da equipe da
My Favorite. O material de handoff (diagnóstico, UTM correta, caminho `/bia` na VTEX,
achado do formato curto) fica registrado no OpenSpec — entregar ao time quando o usuário
decidir o canal.

## Baseline de conteúdo (medido)

Referência: benchmark `lifestyle`, fonte compilada Hootsuite/Rival IQ, atualizado em 2026-01-15.

| Métrica | Bianca | Referência | Leitura |
|---|---:|---:|---|
| Curtidas/alcance | 7,73% | 8,00% | na média |
| Compartilhamentos/alcance | 1,32% | 1,60% | na média — com um post em 5,38% |
| **Comentários/alcance** | **0,21%** | **0,50%** | **alvo do ciclo** |
| **Salvamentos/alcance** | **0,23%** | **1,40%** | **alvo do ciclo** |
| Retenção — Reel curto (0:09 / 0:13) | 89% / 77% | 48% | muito acima |
| Retenção — Reel longo pessoal (3:00) | 28% | 48% | abaixo |

Amostra: 6 Reels em 13 dias — indício, não tendência.

**Evidência prévia da aposta de conversa:** o Reel "DOJI: pinterest + stardoll" (05/08)
alcançou pouco (35% da mediana de views) e conversou muito — **3,0 comentários por mil
views, quase o triplo dos vizinhos**. Pauta de opinião puxa comentário mesmo sem viralizar.

## Métricas de acompanhamento (reportar, não otimizar)

Já estão em nível alto. Entram no relatório para contexto e detecção de queda, **não** para
guiar decisão:

- Alcance total (5.413.754 em 30 dias) e visualizações (54.570.184)
- Seguidores líquidos (+20.824) — vaidade, segue fora de meta
- Compartilhamentos em Reels (284 mil)
- Visitas ao perfil (347.482)

Se alguma cair de forma acentuada e sustentada (>25% por 3 semanas), vira assunto — pode
indicar problema de distribuição causado pela mudança de mix.

## Experimentos do ciclo

| # | Experimento | Hipótese | Variável isolada | Critério de sucesso | Prazo |
|---|---|---|---|---|---|
| 1 | **Pauta de conversa** | Post que termina em pergunta curta, na voz dela, puxa comentário | pauta/legenda | comentários/alcance ≥ 0,35% | 14 dias, mín. 7 posts |
| 2 | **Resposta na primeira hora** | Comentário respondido na 1ª hora puxa segunda rodada de conversa | rotina de resposta (ela + assessora) | posts com resposta ativa ≥ 1,5× os sem | 14 dias, mín. 7 posts |
| 3 | **Utilidade na voz dela** | Conteúdo útil no formato dela (qualquer marca) eleva salvamento | pauta do pilar Vale guardar | saves/alcance ≥ 0,8% | 14 dias, mín. 7 posts |
| 4 | **Colab mensal** | Colab no formato validado amplia alcance sem derrubar a conversa | distribuição | colab ≥ 2× mediana de views com comentários/alcance ≥ 0,50% | dias 61–90 |

**Ordem obrigatória: um de cada vez, nesta sequência.** O experimento 2 entra em cima do 1
já lido; o 3 começa no segundo mês; o 4 só no terceiro. Rodar tudo junto produz quatro
variáveis se movendo e nenhuma conclusão válida.

## Como saberemos que deu errado

Se com **≥ 14 posts do pilar Conversa e 6 semanas** comentários/alcance não passar de
0,35%, a hipótese "pauta certa gera conversa pública" está errada — o gargalo é ritmo de
resposta ou a audiência prefere o privado. Aí o ciclo troca: Stories-first (caixinha diária
+ repost de resposta como conteúdo), antes de insistir em formato de feed.

## Regras de leitura

- **Amostra mínima:** 7 posts ou 14 dias. Abaixo disso não existe tendência, existe ruído.
- **Um experimento por vez.**
- **Pré-requisito de medição:** comentários/alcance e saves/alcance precisam de Insights.
  Enquanto a Bianca não conectar a conta na aba Conta, a leitura fica em proxy público
  (comentários por mil views) — rotulado como proxy, nunca como a métrica.
- **Revisão do painel:** semanal (leve) e mensal (relatório completo via `instagram-report`).

---

**Início do ciclo:** 12/08/2026
**Última atualização:** 12/08/2026
