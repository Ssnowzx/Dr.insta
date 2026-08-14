## Why

Em 13/08/2026 a Bianca entregou dois CSVs com 376 posts e dezesseis prints. A leitura desses arquivos produziu o achado mais forte que este projeto já teve sobre o perfil dela — o conteúdo longo de opinião converte estranho em seguidor a uma taxa 41× maior que a série institucional, e quase nunca é entregue a estranho.

**Esse achado não está em lugar nenhum que ela abra.** Vive em `openspec/`, que é meu, e numa linha de desfecho de um pedido. Ela não tem tela que diga o que foi descoberto sobre o perfil dela, nem como isso mudou ao longo dos meses.

A causa é estrutural, não esquecimento:

**`deliveries()` faz `innerJoin(step)`** (`lib/dashboard.ts`). Uma entrega sem passos é invisível. A tabela `delivery` tem `kind: 'plan' | 'analysis' | 'report' | 'audit'` desde a primeira migração — o modelo previu análise, e o único renderizador de entrega exige checkbox. Análise é leitura, não tarefa.

**Não existe onde guardar texto corrido.** `delivery` tem título, subtítulo e minutos de leitura. `step` tem título e resumo, mas carrega estado e caixa de marcar. Nenhuma tabela guarda prosa.

**Não existe progressão.** O painel mostra o número do mês corrente. `monthlySeries` existe e sabe montar série por chave de métrica, mas é usado apenas para views e posts publicados — nunca para a métrica que decide o ciclo. Ela vê um número solto, nunca "onde eu estava, onde estou, para onde vai".

## What Changes

- Tabela nova **`delivery_section`**: blocos de prosa numerados dentro de uma entrega, com título opcional e um destaque numérico opcional. É o que faltava para uma entrega ser lida em vez de executada
- **`deliveries()` deixa de exigir passo.** A consulta passa a devolver entregas sem etapas, e a tela decide o que fazer com cada tipo — hoje um `innerJoin` decide o que existe
- Rota nova **`/analise`**: as entregas de leitura publicadas, em ordem, com o achado escrito na linguagem dela
- **A progressão entra**: a métrica-norte do ciclo mês a mês, com o ponto de partida marcado e o alvo declarado — não um número solto do mês corrente
- A análise dos 376 posts é semeada como a primeira entrega de leitura: o 41×, a distribuição que não alcança estranho, e o que isso muda no que ela faz

## Capabilities

### New Capabilities

- `entrega-de-leitura`: uma entrega que se lê em vez de se executar — prosa em blocos, visível sem depender de ter etapas, e a regra de que toda análise termina dizendo o que muda na prática
- `progressao-da-metrica`: como a métrica que decide o ciclo é mostrada ao longo do tempo — de onde partiu, onde está, quanto falta — em vez de um número do mês corrente sem passado

### Modified Capabilities

Nenhuma. `openspec/specs/` continua vazio.

## Impact

- `platform/db/schema.ts` e migração nova — tabela `delivery_section`
- `platform/lib/dashboard.ts` — `deliveries()` sem `innerJoin(step)`; consulta das entregas de leitura; série da métrica-norte
- `platform/app/(app)/analise/` — rota nova
- `platform/app/(app)/plano/page.tsx` — passa a filtrar o que renderiza, já que a consulta devolve mais
- `platform/components/nav.tsx` — item novo
- `platform/db/seed.ts` — a análise de 13/08 como primeira entrega de leitura
- Sem impacto em `src/`

## Fora de escopo

- **Editor de análise na tela.** O texto é autorado fora do app, como os pedidos: semente e `scripts/`. Um editor rico é produto próprio
- **Comparação com o nicho na tela dela.** A referência preferida é um conteúdo dela mesma — regra que já vem de `leitura-por-papel`
- **Gráfico interativo.** A progressão é leitura, não ferramenta de exploração; `/conteudo` já é o lugar de filtrar
- **Reescrever o painel.** Continua sendo o número do mês; a progressão vive na análise
