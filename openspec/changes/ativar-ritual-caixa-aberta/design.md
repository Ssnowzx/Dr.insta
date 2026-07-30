## Context

O projeto não tem componente de software para esta mudança. Os rituais são um protocolo
operacional executado pela pessoa, apoiado pelas skills já existentes em
`.claude/skills/instagram-community/`.

A decisão de design aqui é sobre **cadência, escopo e instrumentação** — não sobre código.
Nenhum arquivo em `src/` é tocado.

Restrições que moldam o desenho:

- Capacidade real de execução declarada em `perfil/perfil.md` (o plano precisa caber nela).
- O Instagram Insights não exporta as métricas que importam para comunidade, então a
  instrumentação é manual por necessidade, não por preferência.
- Zero dependências de runtime é padrão do projeto. Nada aqui justifica quebrar isso.

## Goals / Non-Goals

**Goals**
- Criar previsibilidade suficiente para gerar hábito de retorno na audiência.
- Instrumentar as métricas de comunidade para que o ciclo produza aprendizado, não impressão.
- Manter a carga operacional dentro da capacidade declarada.

**Non-Goals**
- Automatizar qualquer parte da interação.
- Aumentar volume de publicação.
- Alterar o motor de métricas para ler dados de Stories.

## Decisions

### Decisão 1 — Dois rituais, não cinco

**Escolha:** ativar exatamente "Caixa aberta" e "Discordância da semana".

**Alternativas consideradas:**

| Opção | Por que foi descartada |
|---|---|
| Um ritual só | Cobre um gargalo (resposta em Stories) e deixa o outro (comentário com substância) sem tratamento. |
| Os cinco do playbook | Carga operacional acima da capacidade. Cinco rituais novos colapsam em duas semanas e deixam sensação de fracasso, que custa mais que o conteúdo não publicado. |
| Três | Ponto médio sem ganho claro. O terceiro ritual concorreria por atenção com os dois que atacam os gargalos primários. |

**Por que este par:** os dois rituais atacam gargalos diferentes e complementares. "Caixa
aberta" move a métrica-norte diretamente (taxa de resposta em Stories). "Discordância da
semana" move comentários com substância, que é o insumo qualitativo de comunidade e o
formato que mais gera comentário longo — porque comentário nasce de tensão, não de
concordância.

**Trade-off aceito:** não estamos atacando "retorno de audiência" diretamente neste ciclo.
O ritual que mais moveria essa métrica ("Spotlight de seguidor") fica para o ciclo seguinte.
Aceitamos porque retorno de audiência é métrica de efeito lento e precisa de base de
interação antes de fazer sentido medir.

### Decisão 2 — Instrumentação manual, semanal

**Escolha:** contagem manual das quatro métricas de comunidade, uma vez por semana,
registrada em `perfil/metas.md`.

**Por que não automatizar:** exigiria Graph API, que está fora de escopo do projeto por
decisão anterior (entrada manual/CSV). Além disso, a métrica mais importante — "comentários
com substância" — depende de julgamento sobre o que é substância, e nenhuma API entrega isso.

**Por que semanal e não diária:** contagem diária é abandonada. Semanal cabe no ritmo e a
resolução é suficiente para detectar desvio em 2-3 semanas.

**Custo aceito:** ~15 min/semana de contagem manual.

### Decisão 3 — Critério de abandono declarado antes de começar

**Escolha:** se a taxa de resposta em Stories não subir ao menos 20% sobre o baseline até a
semana 6, a hipótese é dada como refutada.

**Por quê:** sem critério declarado antes, todo resultado vira justificativa para continuar.
A semana 6 é o ponto em que já houve aquecimento suficiente (5 ciclos completos de cada
ritual) e ainda sobra tempo no ciclo de 90 dias para corrigir o rumo.

**O que fazer se refutar:** o problema passa a ser diagnosticado como audiência, não como
ritual. A próxima mudança seria estreitar o ICP em vez de adicionar mais convites de
interação — porque uma audiência que não responde a convite recorrente e bem construído
provavelmente não é a audiência certa.

### Decisão 4 — Tema delimitado na caixa de perguntas

**Escolha:** toda caixa de perguntas abre com tema nomeado.

**Por quê:** "pergunte qualquer coisa" rende perguntas genéricas. Pergunta genérica rende
resposta genérica, que não alimenta o banco de pautas — e o banco de pautas é metade do
valor deste ritual. O tema delimitado troca volume por densidade de sinal.

## Risks / Trade-offs

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Abandono nas primeiras 3 semanas | Alta — é o padrão de ritual novo | Apenas dois rituais; dias fixos; regra explícita de comunicar ausência em vez de sumir |
| Contagem manual não acontecer | Média | Fechamento semanal amarrado ao mesmo dia do check do painel |
| "Discordância da semana" virar contrarianismo vazio | Média | Lista de 10 teses preparada de uma vez, cada uma com evidência ou experiência própria; começar pelas menos polêmicas |
| Baseline ruim por semana atípica | Média | Baseline levantado sobre a semana 1 e revisado na semana 3 se houver anomalia evidente |
| Janela de 2h não ser cumprida em dia cheio | Alta | Aceito. A regra é meta, não contrato — o custo de perder uma janela é menor que o de abandonar o ritual por culpa |

## Migration Plan

Não há migração. É ativação de protocolo novo, sem estado anterior a preservar.

Ordem de execução: preencher contexto do perfil → levantar baseline → ativar rituais →
apurar semanalmente → avaliar na semana 6.

## Open Questions

- Quais dias da semana serão fixados para cada ritual? Depende da rotina real da pessoa e
  de quando a audiência está mais ativa (Insights > Público). Resolver na tarefa 2.1.
- As 10 teses de discordância precisam ser levantadas antes da semana 1 — é o insumo que
  destrava as 10 primeiras semanas do segundo ritual.
